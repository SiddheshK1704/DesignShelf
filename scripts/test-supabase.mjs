#!/usr/bin/env node
/**
 * Checks that .env.local points at a working Supabase project set up with
 * supabase/schema.sql. Prints pass/fail per check; never prints the keys.
 *
 * Run: npm run test:supabase
 */
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const results = [];
const pass = (name, detail = '') => results.push({ ok: true, name, detail });
const fail = (name, detail) => results.push({ ok: false, name, detail });

async function readEnv() {
  let text;
  try {
    text = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  } catch {
    throw new Error('.env.local was not found in the project root. Create it from .env.example.');
  }
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

/** The role inside a legacy JWT key, without printing the key. */
function jwtRole(key) {
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role;
  } catch {
    return undefined;
  }
}

async function main() {
  const env = await readEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;

  // 1. Values are present and look right.
  if (!url || !key) {
    fail('Environment', 'VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is empty in .env.local.');
    return;
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
    fail('Project URL', 'Expected something like https://abcd.supabase.co (no path after it).');
    return;
  }
  pass('Project URL', 'looks like a Supabase project URL');

  if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') {
    fail('Key type', 'This is a SECRET / service_role key. Replace it with the anon or publishable key, then rotate the secret key in Supabase.');
    return;
  }
  if (key.startsWith('sb_publishable_') || jwtRole(key) === 'anon') pass('Key type', key.startsWith('sb_') ? 'publishable key' : 'anon key');
  else {
    fail('Key type', 'This does not look like an anon or publishable key.');
    return;
  }

  const supabase = createClient(url.replace(/\/$/, ''), key, { auth: { persistSession: false } });

  // 2. The project answers and email sign-in is on.
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: key } });
    if (res.status === 401 || res.status === 403) fail('Connection', `Supabase rejected the key (${res.status}). Copy the anon/publishable key again.`);
    else if (!res.ok) fail('Connection', `Auth settings returned ${res.status}.`);
    else {
      pass('Connection', 'project reachable, key accepted');
      const s = await res.json();
      if (s.external?.email) pass('Email sign-in', 'enabled');
      else fail('Email sign-in', 'Turn on the Email provider under Authentication > Sign In / Providers.');
    }
  } catch (err) {
    fail('Connection', `Could not reach the project: ${err.message}`);
    return;
  }

  // 3. Tables exist. Signed out, row level security returns no rows, but no error.
  for (const table of ['images', 'boards', 'board_images', 'design_docs']) {
    const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' });
    if (error) fail(`Table ${table}`, `${error.message}. Run supabase/schema.sql in the SQL Editor.`);
    else pass(`Table ${table}`, 'exists');
  }

  // 4. Row level security blocks writes when signed out.
  const { error: insertError } = await supabase.from('boards').insert({ name: 'connection test' });
  if (insertError) pass('Row level security', 'signed-out insert was refused, as it should be');
  else fail('Row level security', 'A signed-out insert succeeded. Re-run supabase/schema.sql so the policies are created.');

  // 5. The search function exists and accepts a 768-d vector.
  const zero = `[${new Array(768).fill(0).join(',')}]`;
  const { error: rpcError } = await supabase.rpc('match_images', { query_embedding: zero, match_count: 1 });
  if (rpcError) fail('match_images', `${rpcError.message}. Run supabase/schema.sql again.`);
  else pass('match_images', 'callable');

  // 6. The private storage bucket exists.
  const { error: storageError } = await supabase.storage.from('references').list('demo', { limit: 1 });
  if (storageError) fail('Storage bucket', `${storageError.message}. Check that the "references" bucket exists.`);
  else pass('Storage bucket', '"references" found');
}

main()
  .catch((err) => fail('Setup', err.message))
  .finally(() => {
    for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `: ${r.detail}` : ''}`);
    const failed = results.filter((r) => !r.ok).length;
    console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed. Supabase is ready.');
    process.exitCode = failed ? 1 : 0;
  });
