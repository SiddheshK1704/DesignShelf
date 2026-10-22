/**
 * Hybrid search: embedding similarity, plus a small boost when query words
 * appear in an image's tags, description or name. Falls back to keywords
 * only when there is no key or no embeddings yet.
 */
import { embed } from './gemini';
import type { ImageRecord } from './types';

const KEYWORD_WEIGHT = 0.15;
const STOP = new Set(['a', 'an', 'and', 'the', 'of', 'with', 'for', 'in', 'on', 'to', 'like', 'very', 'but', 'or']);

export function terms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) dot += a[i] * b[i];
  return dot; // Both vectors are normalised when stored.
}

function haystack(img: ImageRecord): string {
  return [img.name, img.subject, img.description, ...Object.values(img.tags).flat(), ...img.customTags]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Share of query words found in the image's text, 0 to 1. */
export function keywordScore(img: ImageRecord, words: string[]): number {
  if (!words.length) return 0;
  const text = haystack(img);
  return words.filter((w) => text.includes(w)).length / words.length;
}

const queryCache = new Map<string, number[]>();

export async function embedQuery(query: string): Promise<number[]> {
  const key = query.trim().toLowerCase();
  const hit = queryCache.get(key);
  if (hit) return hit;
  const { values } = await embed(key, 'RETRIEVAL_QUERY');
  queryCache.set(key, values);
  return values;
}

export interface SearchHit {
  image: ImageRecord;
  score: number;
  semantic: number;
  keyword: number;
}

export interface SearchResult {
  hits: SearchHit[];
  mode: 'hybrid' | 'keyword';
  /** Why we fell back to keywords, if we did. */
  note?: string;
}

export async function search(images: ImageRecord[], query: string, opts: { useEmbeddings: boolean }): Promise<SearchResult> {
  const words = terms(query);
  const withVectors = images.filter((i) => i.embedding?.length);
  let qv: number[] | null = null;
  let note: string | undefined;

  if (opts.useEmbeddings && withVectors.length) {
    try {
      qv = await embedQuery(query);
    } catch (err) {
      note = `Searching by keyword only: ${(err as Error).message}`;
    }
  }

  const scored = images.map((image) => {
    const keyword = keywordScore(image, words);
    const semantic = qv && image.embedding?.length ? cosine(qv, image.embedding) : 0;
    return { image, keyword, semantic, score: semantic + KEYWORD_WEIGHT * keyword };
  });

  if (!qv) {
    return {
      hits: scored.filter((h) => h.keyword > 0).sort((a, b) => b.keyword - a.keyword),
      mode: 'keyword',
      note,
    };
  }

  // Keep strong semantic matches and anything that matched a word.
  const best = Math.max(...scored.map((h) => h.semantic));
  const floor = Math.max(0.42, best - 0.14);
  return {
    hits: scored.filter((h) => h.keyword > 0 || h.semantic >= floor).sort((a, b) => b.score - a.score),
    mode: 'hybrid',
  };
}

/** Images most like this one: embedding similarity, or shared tags without embeddings. */
export function similarTo(target: ImageRecord, images: ImageRecord[], count = 6): ImageRecord[] {
  const others = images.filter((i) => i.id !== target.id);
  const tagSet = new Set(Object.values(target.tags).flat().concat(target.customTags));
  return others
    .map((i) => {
      const shared = Object.values(i.tags).flat().concat(i.customTags).filter((t) => tagSet.has(t)).length;
      const sem = target.embedding?.length && i.embedding?.length ? cosine(target.embedding, i.embedding) : 0;
      return { i, s: sem + shared * 0.05 };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, count)
    .map((x) => x.i);
}
