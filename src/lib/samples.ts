/**
 * Sample references: the landing-page illustrations, saved into the library
 * with hand-written tags, so the library can be tried before adding images
 * or a Gemini key.
 */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { DuotoneArt } from '../components/hero/DuotoneArt';
import { HERO_REFS, type HeroRef } from './heroRefs';
import { processImage } from './image';
import { enqueue } from './ingest';
import { getSettings } from './settings';
import type { LibraryStore } from './store/LibraryStore';
import { newId, type ImageRecord } from './types';

const LENS_BY_DISCIPLINE: Record<string, string> = {
  Industrial: 'industrial',
  Vehicle: 'vehicle',
  Interiors: 'interiors',
  Architecture: 'interiors',
  CMF: 'cmf',
  Fashion: 'fashion',
  Graphic: 'graphic',
  'UI/UX': 'ui',
};

async function renderPng(ref: HeroRef): Promise<Blob> {
  const [w, h] = ref.ratio.split(' / ').map(Number);
  const W = 900;
  const H = Math.round((W * h) / w);
  // Render the illustration into a detached node and read its markup.
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(createElement(DuotoneArt, { variant: ref.art, colors: ref.swatches })));
  const svg = host.innerHTML.replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"`);
  root.unmount();
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.getContext('2d')!.drawImage(img, 0, 0, W, H);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the sample image.'))), 'image/png'),
  );
}

export async function addSamples(store: LibraryStore): Promise<number> {
  const existing = new Set((await store.listImages()).filter((i) => i.isDemo).map((i) => i.name));
  const ids: string[] = [];
  for (const ref of HERO_REFS) {
    if (existing.has(ref.subject)) continue;
    const p = await processImage(await renderPng(ref));
    const now = Date.now();
    const record: ImageRecord = {
      id: newId(),
      name: ref.subject,
      width: p.width,
      height: p.height,
      lensId: LENS_BY_DISCIPLINE[ref.discipline] ?? 'general',
      subject: ref.subject,
      description: ref.about.join(' '),
      tags: { details: ref.tags, mood: ref.feel },
      customTags: [ref.discipline.toLowerCase()],
      swatches: p.swatches,
      source: { credit: 'Design Shelf sample illustration', provider: 'Design Shelf' },
      status: 'ready',
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    };
    await store.addImage(record, { full: p.full, thumb: p.thumb });
    ids.push(record.id);
  }
  // With a key, embed them so search by meaning works on samples too.
  if (getSettings().geminiKey) enqueue(store, ids, 'embed');
  return ids.length;
}
