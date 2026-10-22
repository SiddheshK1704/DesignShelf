#!/usr/bin/env node
/**
 * Fetches real, open-licensed reference photos for each landing-page
 * reference from Openverse and Wikimedia Commons, and writes a snapshot to
 * src/data/reference-photos.json with credit, licence and source for each.
 *
 * Run: npm run refs:fetch            (writes the snapshot)
 *      npm run refs:fetch -- --list  (prints every candidate id for curation)
 *
 * scripts/reference-picks.json lists the hand-picked ids per reference, in
 * display order. References without picks use the first results.
 *
 * The snapshot is committed, so the site does not depend on these APIs at
 * runtime. Results are filtered for obvious noise and brand names; review
 * the output before committing.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/data/reference-photos.json');
const PICKS = resolve(ROOT, 'scripts/reference-picks.json');
const PER_REF = 8;
const UA = 'DesignShelf/0.1 (https://github.com/SiddheshK1704/DesignShelf)';

// Skip toys, renders and branded products.
const BLOCK = [
  'lego', 'toy', 'model kit', 'render', '3d', 'cartoon', 'drawing', 'logo', 'icon', 'screenshot of',
  'vespa', 'lambretta', 'piaggio', 'honda', 'yamaha', 'suzuki', 'bmw', 'audi', 'mercedes', 'porsche',
  'ferrari', 'toyota', 'tesla', 'ford', 'volkswagen', 'vw ', 'apple', 'iphone', 'samsung', 'ikea',
  'starbucks', 'gucci', 'louis vuitton', 'prada', 'chanel', 'hermes', 'coach', 'nike', 'adidas',
  'harley', 'ducati', 'kawasaki', 'nissan', 'chevrolet', 'lime', 'bird', 'xiaomi', 'segway',
  'tiktok', 'onlyfans', 'chatgpt', 'openai', 'facebook', 'instagram', 'twitter', 'whatsapp', 'google',
  'microsoft', 'spotify', 'netflix', 'uber', 'youtube', 'snapchat', 'amazon', 'escalator',
];

const clean = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const blocked = (...parts) => {
  const text = parts.join(' ').toLowerCase();
  return BLOCK.some((w) => text.includes(w));
};

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** Prefer a ~640px Flickr size over the 1024px original. */
function smallerFlickr(url) {
  return /staticflickr\.com\/.+_[a-z]\.jpg$/.test(url) ? url.replace(/_[a-z]\.jpg$/, '_z.jpg') : url;
}

async function openverse(query) {
  const params = new URLSearchParams({
    q: query,
    page_size: '20',
    category: 'photograph',
    mature: 'false',
    // Commercial use and modification allowed: no NC or ND licences.
    license_type: 'commercial,modification',
  });
  const data = await getJson(`https://api.openverse.org/v1/images/?${params}`);
  return (data.results ?? [])
    .filter((r) => r.width >= 500 && r.height >= 400)
    .filter((r) => !blocked(r.title, (r.tags ?? []).map((t) => t.name).join(' ')))
    .map((r) => ({
      id: `ov-${r.id}`,
      title: clean(r.title) || 'Untitled',
      src: smallerFlickr(r.url),
      width: r.width,
      height: r.height,
      creator: clean(r.creator) || 'Unknown',
      creatorUrl: r.creator_url || undefined,
      licence: `${r.license === 'cc0' || r.license === 'pdm' ? r.license.toUpperCase() : `CC ${r.license.toUpperCase()}`} ${r.license_version ?? ''}`.trim(),
      licenceUrl: r.license_url,
      sourceUrl: r.foreign_landing_url,
      provider: `Openverse / ${r.source}`,
    }));
}

async function wikimedia(query) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '640',
  });
  const data = await getJson(`https://commons.wikimedia.org/w/api.php?${params}`);
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  return pages
    .map((p) => ({ p, info: p.imageinfo?.[0] }))
    .filter(({ info }) => info && info.thumburl && info.width >= 500 && info.height >= 400)
    .filter(({ info }) => /\.(jpe?g|png|webp)$/i.test(info.url.split('?')[0]))
    .map(({ p, info }) => {
      const m = info.extmetadata ?? {};
      const title = clean(m.ObjectName?.value) || p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '');
      return {
        id: `wm-${p.pageid}`,
        title,
        src: info.thumburl.split('?')[0],
        width: info.thumbwidth,
        height: info.thumbheight,
        creator: clean(m.Artist?.value) || 'Unknown',
        licence: clean(m.LicenseShortName?.value) || 'See source',
        licenceUrl: m.LicenseUrl?.value,
        sourceUrl: info.descriptionurl,
        provider: 'Wikimedia Commons',
        _desc: clean(m.ImageDescription?.value),
      };
    })
    .filter((r) => !blocked(r.title, r._desc))
    .map(({ _desc, ...r }) => r);
}

async function reachable(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/');
  } catch {
    return false;
  }
}

async function main() {
  const listOnly = process.argv.includes('--list');
  const src = await readFile(resolve(ROOT, 'src/lib/heroRefs.ts'), 'utf8');
  // Pull slug + queries out of the TS source so the two never drift apart.
  const refs = [...src.matchAll(/slug: '([^']+)'[\s\S]*?queries: \[([^\]]*)\]/g)].map((m) => ({
    slug: m[1],
    queries: [...m[2].matchAll(/'([^']+)'/g)].map((q) => q[1]),
  }));

  // Hand-picked ids per reference. Without picks, the first results are used.
  let picks = {};
  try {
    picks = JSON.parse(await readFile(PICKS, 'utf8'));
  } catch {
    // No picks file yet.
  }

  const out = {};
  for (const ref of refs) {
    // Gather the pool: every query, both sources interleaved, de-duplicated.
    const seen = new Set();
    const pool = [];
    for (const q of ref.queries) {
      const results = await Promise.allSettled([openverse(q), wikimedia(q)]);
      for (const r of results) if (r.status === 'rejected') console.warn(`  ! ${ref.slug} "${q}": ${r.reason.message}`);
      const [ov, wm] = results.map((r) => (r.status === 'fulfilled' ? r.value : []));
      for (let i = 0; i < Math.max(ov.length, wm.length); i++) {
        for (const item of [ov[i], wm[i]]) {
          if (!item) continue;
          const key = item.title.toLowerCase();
          if (seen.has(item.id) || seen.has(key)) continue;
          seen.add(item.id);
          seen.add(key);
          pool.push(item);
        }
      }
    }

    if (listOnly) {
      console.log(`\n## ${ref.slug} (${pool.length})`);
      for (const p of pool) console.log(`  ${p.id.padEnd(42)} ${p.licence.padEnd(16)} ${p.title.slice(0, 80)}`);
      out[ref.slug] = pool;
      continue;
    }

    const wanted = picks[ref.slug];
    const chosen = wanted
      ? wanted.map((id) => pool.find((p) => p.id === id)).filter(Boolean)
      : pool.slice(0, PER_REF * 2);
    if (wanted && chosen.length < wanted.length) {
      console.warn(`  ! ${ref.slug}: ${wanted.length - chosen.length} picked ids no longer returned by the sources`);
    }
    const ok = await Promise.all(chosen.map((item) => reachable(item.src)));
    out[ref.slug] = chosen.filter((_, i) => ok[i]).slice(0, PER_REF);
    console.log(`${ref.slug}: ${out[ref.slug].length} photos`);
  }

  if (listOnly) {
    // Optional: dump the full pool as JSON for building a visual contact sheet.
    if (process.env.POOL_OUT) await writeFile(process.env.POOL_OUT, JSON.stringify(out, null, 2));
    return;
  }
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), photos: out }, null, 2) + '\n');
  console.log(`Wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
