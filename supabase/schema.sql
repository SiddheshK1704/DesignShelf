-- Design Shelf: database schema for Supabase.
-- Paste into the SQL Editor and run. Safe to run more than once.
--
-- Every table has row level security: signed-in users only see and change
-- their own rows, and anyone (even signed out) can read rows marked is_demo.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.images (
  id              uuid primary key default gen_random_uuid(),
  -- Null only for demo rows added by the project owner.
  user_id         uuid default auth.uid() references auth.users (id) on delete cascade,
  name            text not null,
  storage_path    text,
  thumb_path      text,
  width           integer not null check (width > 0),
  height          integer not null check (height > 0),
  lens_id         text not null default 'general',
  subject         text,
  description     text,
  tags            jsonb not null default '{}'::jsonb,
  custom_tags     text[] not null default '{}',
  swatches        text[] not null default '{}',
  source          jsonb,
  embedding       extensions.vector(768),
  embedding_model text,
  status          text not null default 'pending'
                  check (status in ('pending', 'tagging', 'ready', 'untagged', 'error')),
  error           text,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.board_images (
  board_id uuid not null references public.boards (id) on delete cascade,
  image_id uuid not null references public.images (id) on delete cascade,
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (board_id, image_id)
);

create table if not exists public.design_docs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null,
  brief      text not null,
  lens_id    text not null default 'general',
  board_id   uuid references public.boards (id) on delete set null,
  doc        jsonb not null,
  shelf_ids  uuid[] not null default '{}',
  diagram    jsonb not null default '{"ok": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists images_user_created_idx on public.images (user_id, created_at desc);
create index if not exists images_demo_idx on public.images (is_demo) where is_demo;
create index if not exists images_embedding_idx on public.images
  using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists boards_user_idx on public.boards (user_id, updated_at desc);
create index if not exists board_images_image_idx on public.board_images (image_id);
create index if not exists board_images_user_idx on public.board_images (user_id);
create index if not exists design_docs_user_idx on public.design_docs (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists images_updated_at on public.images;
create trigger images_updated_at before update on public.images
  for each row execute function public.set_updated_at();

drop trigger if exists boards_updated_at on public.boards;
create trigger boards_updated_at before update on public.boards
  for each row execute function public.set_updated_at();

drop trigger if exists design_docs_updated_at on public.design_docs;
create trigger design_docs_updated_at before update on public.design_docs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.images enable row level security;
alter table public.boards enable row level security;
alter table public.board_images enable row level security;
alter table public.design_docs enable row level security;

-- images: owners do everything; anyone can read demo rows.
drop policy if exists "images: owner select" on public.images;
create policy "images: owner select" on public.images
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "images: demo read" on public.images;
create policy "images: demo read" on public.images
  for select to anon, authenticated using (is_demo = true);

drop policy if exists "images: owner insert" on public.images;
create policy "images: owner insert" on public.images
  for insert to authenticated with check ((select auth.uid()) = user_id and is_demo = false);

drop policy if exists "images: owner update" on public.images;
create policy "images: owner update" on public.images
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and is_demo = false);

drop policy if exists "images: owner delete" on public.images;
create policy "images: owner delete" on public.images
  for delete to authenticated using ((select auth.uid()) = user_id);

-- boards
drop policy if exists "boards: owner all" on public.boards;
create policy "boards: owner all" on public.boards
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- board_images: both the board and the image must belong to the user.
drop policy if exists "board_images: owner select" on public.board_images;
create policy "board_images: owner select" on public.board_images
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "board_images: owner insert" on public.board_images;
create policy "board_images: owner insert" on public.board_images
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.boards b where b.id = board_id and b.user_id = (select auth.uid()))
    and exists (select 1 from public.images i where i.id = image_id and i.user_id = (select auth.uid()))
  );

drop policy if exists "board_images: owner delete" on public.board_images;
create policy "board_images: owner delete" on public.board_images
  for delete to authenticated using ((select auth.uid()) = user_id);

-- design_docs
drop policy if exists "design_docs: owner all" on public.design_docs;
create policy "design_docs: owner all" on public.design_docs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Search: nearest images by cosine distance
-- ---------------------------------------------------------------------------

-- security invoker: the caller's row level security applies, so users only
-- ever match their own images (and demo rows).
create or replace function public.match_images(
  query_embedding extensions.vector(768),
  match_count integer default 24
)
returns table (id uuid, similarity double precision)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select i.id, 1 - (i.embedding <=> query_embedding) as similarity
  from public.images i
  where i.embedding is not null
  order by i.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 200);
$$;

revoke all on function public.match_images(extensions.vector, integer) from public;
grant execute on function public.match_images(extensions.vector, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: a private bucket for image files
-- ---------------------------------------------------------------------------
-- Files live at references/<user id>/<image id>/full.webp (and thumb.webp).
-- Demo files live under references/demo/ and anyone can read them.

insert into storage.buckets (id, name, public)
values ('references', 'references', false)
on conflict (id) do update set public = false;

drop policy if exists "references: owner read" on storage.objects;
create policy "references: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'references' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "references: demo read" on storage.objects;
create policy "references: demo read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'references' and (storage.foldername(name))[1] = 'demo');

drop policy if exists "references: owner insert" on storage.objects;
create policy "references: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'references' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "references: owner update" on storage.objects;
create policy "references: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'references' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "references: owner delete" on storage.objects;
create policy "references: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'references' and (storage.foldername(name))[1] = (select auth.uid())::text);
