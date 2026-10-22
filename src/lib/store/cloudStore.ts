/**
 * Account mode: the library in Supabase. Rows are protected by row level
 * security, image files live in the private "references" bucket under the
 * user's own folder, and search by meaning runs in the database through
 * match_images.
 */
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { BUCKET } from '../supabase';
import type { Board, BoardImage, ImageRecord, SavedDoc } from '../types';
import type { LibraryStore } from './LibraryStore';

/** Every column except the embedding, which stays in the database. */
const IMAGE_COLUMNS =
  'id,name,storage_path,thumb_path,width,height,lens_id,subject,description,tags,custom_tags,swatches,source,embedding_model,status,error,created_at,updated_at';

interface ImageRow {
  id: string;
  name: string;
  storage_path: string | null;
  thumb_path: string | null;
  width: number;
  height: number;
  lens_id: string;
  subject: string | null;
  description: string | null;
  tags: ImageRecord['tags'];
  custom_tags: string[];
  swatches: string[];
  source: (ImageRecord['source'] & { sample?: boolean }) | null;
  embedding_model: string | null;
  status: ImageRecord['status'];
  error: string | null;
  created_at: string;
  updated_at: string;
}

const ms = (t: string) => new Date(t).getTime();
const iso = (n: number) => new Date(n).toISOString();

function fromRow(r: ImageRow): ImageRecord {
  const { sample, ...source } = r.source ?? {};
  return {
    id: r.id,
    name: r.name,
    width: r.width,
    height: r.height,
    lensId: r.lens_id,
    subject: r.subject ?? undefined,
    description: r.description ?? undefined,
    tags: r.tags ?? {},
    customTags: r.custom_tags ?? [],
    swatches: r.swatches ?? [],
    source: r.source ? source : undefined,
    // The vector itself isn't downloaded; the model name says one exists.
    embeddingModel: r.embedding_model ?? undefined,
    status: r.status,
    error: r.error ?? undefined,
    isDemo: Boolean(sample),
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
  };
}

/** Only the fields present in the patch, in column names. */
function toRow(p: Partial<ImageRecord>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set('name', p.name);
  set('width', p.width);
  set('height', p.height);
  set('lens_id', p.lensId);
  if ('subject' in p) row.subject = p.subject ?? null;
  if ('description' in p) row.description = p.description ?? null;
  set('tags', p.tags);
  set('custom_tags', p.customTags);
  set('swatches', p.swatches);
  if ('source' in p || 'isDemo' in p) row.source = p.source || p.isDemo ? { ...p.source, ...(p.isDemo ? { sample: true } : {}) } : null;
  if (p.embedding) row.embedding = JSON.stringify(p.embedding);
  set('embedding_model', p.embeddingModel);
  set('status', p.status);
  if ('error' in p) row.error = p.error ?? null;
  return row;
}

function must<T>(res: { data: T; error: PostgrestError | null }, action: string): T {
  if (res.error) {
    const hint = res.error.code === '42501' || /row-level security/i.test(res.error.message) ? ' Your session may have expired; sign in again.' : '';
    throw new Error(`Could not ${action} in your account: ${res.error.message}.${hint}`);
  }
  return res.data;
}

/** Like must(), for queries that return rows: never null. */
function rowsOf<T>(res: { data: T[] | null; error: PostgrestError | null }, action: string): T[] {
  return must(res, action) ?? [];
}

const extOf = (b: Blob) => (b.type === 'image/png' ? 'png' : b.type === 'image/jpeg' ? 'jpg' : b.type === 'image/gif' ? 'gif' : b.type === 'image/avif' ? 'avif' : 'webp');

export function createCloudStore(sb: SupabaseClient, userId: string): LibraryStore {
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const bucket = () => sb.storage.from(BUCKET);

  async function paths(ids: string[]): Promise<string[]> {
    if (!ids.length) return [];
    const rows = rowsOf(await sb.from('images').select('storage_path,thumb_path').in('id', ids), 'read image files');
    return rows.flatMap((r) => [r.storage_path, r.thumb_path]).filter((p): p is string => Boolean(p));
  }

  async function removeFiles(list: string[]) {
    for (let i = 0; i < list.length; i += 100) await bucket().remove(list.slice(i, i + 100));
  }

  return {
    kind: 'cloud',

    async listImages() {
      const rows = rowsOf(await sb.from('images').select(IMAGE_COLUMNS).order('created_at', { ascending: false }).limit(5000), 'load your library');
      return (rows as unknown as ImageRow[]).map(fromRow);
    },

    async getImage(id) {
      const row = must(await sb.from('images').select(IMAGE_COLUMNS).eq('id', id).maybeSingle(), 'load the image');
      return row ? fromRow(row as unknown as ImageRow) : undefined;
    },

    async addImage(record, blobs) {
      const base = `${userId}/${record.id}`;
      const full = `${base}/full.${extOf(blobs.full)}`;
      const thumb = `${base}/thumb.${extOf(blobs.thumb)}`;
      const up1 = await bucket().upload(full, blobs.full, { contentType: blobs.full.type || 'image/webp', upsert: true });
      if (up1.error) throw new Error(`Could not upload the image: ${up1.error.message}`);
      const up2 = await bucket().upload(thumb, blobs.thumb, { contentType: blobs.thumb.type || 'image/webp', upsert: true });
      if (up2.error) {
        await removeFiles([full]);
        throw new Error(`Could not upload the thumbnail: ${up2.error.message}`);
      }
      const res = await sb.from('images').insert({
        id: record.id,
        ...toRow(record),
        storage_path: full,
        thumb_path: thumb,
        created_at: iso(record.createdAt),
      });
      if (res.error) {
        // Don't leave orphaned files behind.
        await removeFiles([full, thumb]);
        must(res, 'save the image');
      }
      emit();
    },

    async updateImage(id, patch) {
      const row = must(await sb.from('images').update(toRow(patch)).eq('id', id).select(IMAGE_COLUMNS).maybeSingle(), 'update the image');
      if (!row) throw new Error('That image no longer exists. It may have been deleted on another device.');
      emit();
      return fromRow(row as unknown as ImageRow);
    },

    async deleteImages(ids) {
      const files = await paths(ids);
      must(await sb.from('images').delete().in('id', ids), 'delete the images');
      await removeFiles(files);
      emit();
    },

    async getBlob(id, which) {
      const row = must(await sb.from('images').select('storage_path,thumb_path').eq('id', id).maybeSingle(), 'find the image file');
      const path = which === 'full' ? row?.storage_path : row?.thumb_path;
      if (!path) return undefined;
      const { data, error } = await bucket().download(path);
      if (error) throw new Error(`Could not download the image: ${error.message}`);
      return data ?? undefined;
    },

    async listBoards() {
      const rows = rowsOf(await sb.from('boards').select('id,name,description,created_at,updated_at').order('updated_at', { ascending: false }), 'load your boards');
      return rows.map((b) => ({ id: b.id, name: b.name, description: b.description ?? undefined, createdAt: ms(b.created_at), updatedAt: ms(b.updated_at) }));
    },

    async createBoard(name) {
      const b = must(await sb.from('boards').insert({ name: name.trim() || 'Untitled board' }).select('id,name,description,created_at,updated_at').single(), 'create the board');
      if (!b) throw new Error('The board was not created. Try again.');
      emit();
      return { id: b.id, name: b.name, description: b.description ?? undefined, createdAt: ms(b.created_at), updatedAt: ms(b.updated_at) } satisfies Board;
    },

    async updateBoard(id, patch) {
      must(await sb.from('boards').update(patch).eq('id', id), 'rename the board');
      emit();
    },

    async deleteBoard(id) {
      must(await sb.from('boards').delete().eq('id', id), 'delete the board');
      emit();
    },

    async listBoardImages() {
      const rows = rowsOf(await sb.from('board_images').select('board_id,image_id,added_at'), 'load board contents');
      return rows.map((r) => ({ boardId: r.board_id, imageId: r.image_id, addedAt: ms(r.added_at) }) satisfies BoardImage);
    },

    async addToBoard(boardId, imageIds) {
      if (!imageIds.length) return;
      must(
        await sb.from('board_images').upsert(imageIds.map((image_id) => ({ board_id: boardId, image_id })), { onConflict: 'board_id,image_id', ignoreDuplicates: true }),
        'add to the board',
      );
      // Touch the board so it sorts to the top.
      await sb.from('boards').update({ updated_at: new Date().toISOString() }).eq('id', boardId);
      emit();
    },

    async removeFromBoard(boardId, imageIds) {
      must(await sb.from('board_images').delete().eq('board_id', boardId).in('image_id', imageIds), 'remove from the board');
      emit();
    },

    async listDocs() {
      const rows = rowsOf(await sb.from('design_docs').select('*').order('updated_at', { ascending: false }), 'load your saved docs');
      return rows.map(
        (r) =>
          ({
            id: r.id,
            title: r.title,
            brief: r.brief,
            lensId: r.lens_id,
            boardId: r.board_id ?? undefined,
            doc: r.doc,
            shelfIds: r.shelf_ids ?? [],
            diagram: r.diagram ?? { ok: true },
            createdAt: ms(r.created_at),
            updatedAt: ms(r.updated_at),
          }) satisfies SavedDoc,
      );
    },

    async saveDoc(d) {
      must(
        await sb.from('design_docs').upsert({
          id: d.id,
          title: d.title,
          brief: d.brief,
          lens_id: d.lensId,
          board_id: d.boardId ?? null,
          doc: d.doc,
          shelf_ids: d.shelfIds,
          diagram: d.diagram,
          created_at: iso(d.createdAt),
        }),
        'save the doc',
      );
      emit();
    },

    async deleteDoc(id) {
      must(await sb.from('design_docs').delete().eq('id', id), 'delete the doc');
      emit();
    },

    async matchImages(queryEmbedding, count) {
      const rows = must(
        await sb.rpc('match_images', { query_embedding: JSON.stringify(queryEmbedding), match_count: Math.min(count, 200) }),
        'search your library',
      ) as { id: string; similarity: number }[];
      return rows ?? [];
    },

    async clear() {
      const ids = rowsOf(await sb.from('images').select('id'), 'list your images').map((r) => r.id);
      const files = await paths(ids);
      must(await sb.from('design_docs').delete().eq('user_id', userId), 'delete your docs');
      must(await sb.from('boards').delete().eq('user_id', userId), 'delete your boards');
      must(await sb.from('images').delete().eq('user_id', userId), 'delete your images');
      await removeFiles(files);
      emit();
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
