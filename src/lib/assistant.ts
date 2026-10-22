/**
 * The assistant's Ask mode. Gemini answers with structured JSON: a short
 * summary, directions to explore, and image-search queries. It never writes
 * image URLs; real images come from the shelf and from open-licence sources.
 */
import { generateJson, withBackoff, type Part, type Turn } from './gemini';
import { search } from './search';
import type { LibraryStore } from './store/LibraryStore';
import type { ImageRecord } from './types';

export interface AskAnswer {
  summary: string;
  directions: { title: string; why: string }[];
  queries: { label: string; query: string }[];
}

const ASK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING', description: 'Plain prose, under 150 words.' },
    directions: {
      type: 'ARRAY',
      minItems: 2,
      maxItems: 5,
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'A short name for the direction, 2 to 5 words.' },
          why: { type: 'STRING', description: 'One sentence on why it fits the request.' },
        },
        required: ['title', 'why'],
      },
    },
    queries: {
      type: 'ARRAY',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING', description: 'A short label, 1 to 4 words.' },
          query: { type: 'STRING', description: 'An image-search query of 2 to 4 broad, concrete visual words.' },
        },
        required: ['label', 'query'],
      },
    },
  },
  required: ['summary', 'directions', 'queries'],
};

const SYSTEM = [
  'You are a design research assistant for designers of any discipline: industrial, vehicle, CMF, UI/UX, graphic, interiors, fashion and packaging.',
  'Help the designer find references and directions. Be concrete and specific, like an experienced colleague. Use short sentences and plain words. No hype.',
  'summary: under 150 words of plain prose that answers the question directly.',
  'directions: 3 to 5 distinct directions worth exploring, each with a short title and one sentence on why it fits.',
  'queries: up to 3 image-search queries of 2 to 4 words that would return good reference photos on sites like Pinterest or Wikimedia Commons. Keep them broad enough to match real photos: concrete objects, materials, finishes or settings. Avoid long or niche phrases and brand names.',
  'If images are attached, base your answer on what is visible in them.',
  'Never include URLs, links or image addresses anywhere in the reply.',
].join('\n');

const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

function tidy(a: AskAnswer): AskAnswer {
  const words = (a.summary ?? '').replace(URL_RE, '').trim().split(/\s+/);
  return {
    summary: words.length > 160 ? `${words.slice(0, 150).join(' ')}…` : words.join(' '),
    directions: (a.directions ?? []).slice(0, 5).map((d) => ({ title: d.title.replace(URL_RE, '').trim(), why: d.why.replace(URL_RE, '').trim() })),
    queries: (a.queries ?? [])
      .map((q) => ({ label: q.label.trim(), query: q.query.replace(URL_RE, '').trim() }))
      .filter((q) => q.query)
      .slice(0, 3),
  };
}

export async function ask(
  question: string,
  images: { mimeType: string; data: string }[],
  history: Turn[],
  onWait?: (ms: number) => void,
): Promise<AskAnswer> {
  const parts: Part[] = [...images.map((inlineData) => ({ inlineData })), { text: question || 'What directions and references should I look at for these images?' }];
  const answer = await withBackoff(
    () => generateJson<AskAnswer>(parts, ASK_SCHEMA, { system: SYSTEM, history, temperature: 0.6 }),
    onWait,
  );
  return tidy(answer);
}

/** A compact record of a finished exchange, sent as context for follow-ups. */
export function toHistory(question: string, imageCount: number, answer: AskAnswer): Turn[] {
  const userText = `${question}${imageCount ? ` (with ${imageCount} attached ${imageCount === 1 ? 'image' : 'images'})` : ''}`;
  return [
    { role: 'user', parts: [{ text: userText }] },
    { role: 'model', parts: [{ text: JSON.stringify(answer) }] },
  ];
}

/**
 * Best matches from the designer's own library: the question and each
 * suggested query go through the usual hybrid search, and the best score
 * per image wins.
 */
export async function shelfMatches(
  images: ImageRecord[],
  question: string,
  answer: AskAnswer,
  useEmbeddings: boolean,
  count = 6,
  store?: Pick<LibraryStore, 'matchImages'>,
) {
  if (!images.length) return [];
  const texts = [question, ...answer.queries.map((q) => q.query)].filter((t) => t.trim());
  const best = new Map<string, { image: ImageRecord; score: number }>();
  // All searches at once: each needs its own embedding call, and they don't depend on each other.
  const results = await Promise.all(texts.map((t) => search(images, t, { useEmbeddings, store })));
  for (const r of results) {
    for (const h of r.hits) {
      const cur = best.get(h.image.id);
      if (!cur || h.score > cur.score) best.set(h.image.id, { image: h.image, score: h.score });
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, count).map((x) => x.image);
}
