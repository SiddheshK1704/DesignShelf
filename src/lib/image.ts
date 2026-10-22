/**
 * Image processing in the browser: decode, resize, make a thumbnail, and
 * extract a real palette from the pixels.
 */

export interface ProcessedImage {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  swatches: string[];
}

const FULL_MAX = 2000;
const THUMB_MAX = 480;
const AI_MAX = 1024;

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'];

export class ImageError extends Error {}

async function decode(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob);
  } catch {
    throw new ImageError(
      blob.type === 'image/heic' || blob.type === 'image/heif'
        ? 'HEIC photos cannot be read by this browser. Export the photo as JPEG and try again.'
        : 'This file could not be read as an image. Try a JPEG, PNG or WebP.',
    );
  }
}

function fit(w: number, h: number, max: number) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

function draw(bitmap: ImageBitmap, max: number) {
  const { w, h } = fit(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  return { canvas, ctx };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageError('Could not encode the image.'))), type, quality),
  );
}

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

/**
 * k-means on a 64px copy of the image. Returns up to `k` colours, most
 * common first, with near-duplicates merged.
 */
export function extractPalette(data: Uint8ClampedArray, k = 5): string[] {
  const px: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    px.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (px.length === 0) return [];

  // Deterministic farthest-point initialisation.
  const centres: number[][] = [px[Math.floor(px.length / 2)].slice()];
  while (centres.length < k) {
    let best = px[0];
    let bestD = -1;
    for (let i = 0; i < px.length; i += 7) {
      const p = px[i];
      const d = Math.min(...centres.map((c) => (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2));
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    centres.push(best.slice());
  }

  const counts = new Array(k).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    const sums = centres.map(() => [0, 0, 0]);
    counts.fill(0);
    for (const p of px) {
      let ci = 0;
      let cd = Infinity;
      for (let c = 0; c < k; c++) {
        const d = (centres[c][0] - p[0]) ** 2 + (centres[c][1] - p[1]) ** 2 + (centres[c][2] - p[2]) ** 2;
        if (d < cd) {
          cd = d;
          ci = c;
        }
      }
      sums[ci][0] += p[0];
      sums[ci][1] += p[1];
      sums[ci][2] += p[2];
      counts[ci]++;
    }
    for (let c = 0; c < k; c++) if (counts[c]) centres[c] = sums[c].map((s) => s / counts[c]);
  }

  const ranked = centres.map((c, i) => ({ c, n: counts[i] })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const out: number[][] = [];
  for (const { c } of ranked) {
    if (out.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) > 24)) out.push(c);
  }
  return out.map((c) => hex(c[0], c[1], c[2]));
}

export async function processImage(file: Blob): Promise<ProcessedImage> {
  const bitmap = await decode(file);
  try {
    const { width, height } = bitmap;
    // Keep small originals as they are; re-encode big ones to save space.
    const full =
      Math.max(width, height) <= FULL_MAX && file.size < 2_500_000 && file.type !== 'image/bmp'
        ? file
        : await toBlob(draw(bitmap, FULL_MAX).canvas, 'image/webp', 0.88);
    const thumb = await toBlob(draw(bitmap, THUMB_MAX).canvas, 'image/webp', 0.82);
    const small = draw(bitmap, 64);
    const swatches = extractPalette(small.ctx.getImageData(0, 0, small.canvas.width, small.canvas.height).data);
    return { full, thumb, width, height, swatches };
  } finally {
    bitmap.close();
  }
}

/** A downscaled JPEG as base64, for sending to Gemini. */
export async function toAiImage(blob: Blob): Promise<{ mimeType: string; data: string }> {
  const bitmap = await decode(blob);
  try {
    const out = await toBlob(draw(bitmap, AI_MAX).canvas, 'image/jpeg', 0.85);
    return { mimeType: 'image/jpeg', data: await blobToBase64(out) };
  } finally {
    bitmap.close();
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

/** File name without extension, tidied for display. */
export function displayName(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled';
}
