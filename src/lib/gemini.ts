/**
 * Gemini, called straight from the browser with the user's own key.
 * Models are discovered with ListModels instead of being hardcoded.
 */
import { groupsFor } from './lenses';
import { getSettings, updateSettings } from './settings';
import type { Lens, TagGroups } from './types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const EMBED_DIMS = 768;

export class GeminiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}

export interface GeminiModel {
  name: string;
  displayName: string;
  methods: string[];
}

/** Turns API failures into messages that say what happened and how to fix it. */
async function toError(res: Response): Promise<GeminiError> {
  let body: { error?: { message?: string; status?: string; details?: { '@type'?: string; retryDelay?: string; reason?: string }[] } } = {};
  try {
    body = await res.json();
  } catch {
    // Non-JSON error body.
  }
  const details = body.error?.details ?? [];
  const reason = details.find((d) => d.reason)?.reason;
  const retry = details.find((d) => d.retryDelay)?.retryDelay;
  const retryAfterMs = retry ? parseFloat(retry) * 1000 : Number(res.headers.get('retry-after')) * 1000 || undefined;
  const raw = body.error?.message ?? res.statusText;

  if (reason === 'API_KEY_INVALID' || res.status === 401) {
    return new GeminiError('Google rejected this API key. Check that it was copied in full, or create a new one in Google AI Studio.', res.status);
  }
  if (res.status === 403) {
    return new GeminiError(`This key isn’t allowed to use the Gemini API (${raw}). Check the key’s restrictions in Google AI Studio.`, 403);
  }
  if (res.status === 429) {
    return new GeminiError('Gemini’s rate limit was reached. Waiting a moment before trying again.', 429, retryAfterMs);
  }
  if (res.status === 404) {
    return new GeminiError(`The selected model isn’t available to this key (${raw}). Pick another model in Settings.`, 404);
  }
  if (res.status >= 500) {
    return new GeminiError('Gemini had a temporary problem. Trying again usually works.', res.status, retryAfterMs);
  }
  return new GeminiError(`Gemini returned an error: ${raw}`, res.status);
}

/**
 * At most this many Gemini requests are in flight at once, across the whole
 * app (tagging, Ask, design docs). The rest wait their turn, which keeps a
 * busy moment from tripping the per-minute rate limit. Backoff waits happen
 * outside a slot, so a sleeping retry never blocks other requests.
 */
const MAX_IN_FLIGHT = 2;
let inFlight = 0;
const waiting: (() => void)[] = [];

async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>((resolve) => waiting.push(resolve));
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
    waiting.shift()?.();
  }
}

async function call<T>(path: string, init: RequestInit = {}, key = getSettings().geminiKey): Promise<T> {
  if (!key) throw new GeminiError('Add your Gemini API key in Settings to use AI tagging and search by meaning.', 0);
  return slot(async () => {
    let res: Response;
    try {
      res = await fetch(`${BASE}/${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, ...init.headers },
      });
    } catch {
      throw new GeminiError('Could not reach Gemini. Check your internet connection and try again.', 0);
    }
    if (!res.ok) throw await toError(res);
    return res.json() as Promise<T>;
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retries on 429 and 5xx with exponential backoff (or the server's
 * suggested delay). `onWait` reports how long it's waiting.
 */
export async function withBackoff<T>(fn: () => Promise<T>, onWait?: (ms: number) => void, tries = 5): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const e = err as GeminiError;
      const retryable = e instanceof GeminiError && (e.status === 429 || e.status >= 500);
      if (!retryable || attempt >= tries - 1) throw err;
      const wait = Math.min(60_000, e.retryAfterMs ?? 1000 * 2 ** attempt + Math.random() * 400);
      onWait?.(wait);
      await sleep(wait);
    }
  }
}

/* ---------- Models ---------- */

export async function listModels(key?: string): Promise<GeminiModel[]> {
  const data = await call<{ models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] }>(
    'models?pageSize=1000',
    {},
    key,
  );
  return (data.models ?? []).map((m) => ({
    name: m.name.replace(/^models\//, ''),
    displayName: m.displayName ?? m.name,
    methods: m.supportedGenerationMethods ?? [],
  }));
}

/**
 * Newest first. Within a version, Flash before Pro and full Flash before
 * Lite. A preview only loses to a stable model of the same version, so a
 * newer preview still wins over an older stable release. Image, audio,
 * live and other special-purpose models are never picked.
 */
export function rankGenerate(name: string): number {
  const v = parseFloat(name.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? '0');
  let score = v * 100;
  if (/flash/.test(name)) score += 3;
  if (/lite/.test(name)) score -= 2;
  if (/preview|exp|experimental/.test(name)) score -= 1;
  if (/thinking|tts|image|audio|live|robotics|computer|native|embedding/.test(name)) score -= 10000;
  return score;
}

export function pickModels(models: GeminiModel[]) {
  const generate = models
    // Special-purpose models (image, audio, live…) can't do tagging or JSON answers: leave them out.
    .filter((m) => m.methods.includes('generateContent') && /^gemini-/.test(m.name) && rankGenerate(m.name) > 0)
    .sort((a, b) => rankGenerate(b.name) - rankGenerate(a.name));
  const embed = models
    .filter((m) => m.methods.includes('embedContent'))
    .sort((a, b) => (/gemini-embedding/.test(b.name) ? 1 : 0) - (/gemini-embedding/.test(a.name) ? 1 : 0));
  return { generate, embed };
}

/** The model list is checked once per page load, so new releases are picked up without a reload loop. */
let checkedThisSession = false;

/**
 * The models to use. Unless the user picked one by hand, the generation
 * model follows the newest Flash model the key can use. The embedding model
 * stays fixed once chosen: changing it would make existing search vectors
 * incomparable.
 */
export async function ensureModels(): Promise<{ generate: string; embed: string }> {
  const { models } = getSettings();
  const auto = models.generateAuto !== false;
  if (models.generate && models.embed && (!auto || checkedThisSession)) {
    return { generate: models.generate, embed: models.embed };
  }
  // Callers that arrive together share one model-list lookup.
  modelsLookup ??= resolveModels().finally(() => (modelsLookup = null));
  return modelsLookup;
}

let modelsLookup: Promise<{ generate: string; embed: string }> | null = null;

async function resolveModels(): Promise<{ generate: string; embed: string }> {
  const { models } = getSettings();
  const auto = models.generateAuto !== false;
  if (models.generate && models.embed && (!auto || checkedThisSession)) {
    return { generate: models.generate, embed: models.embed };
  }

  let found: ReturnType<typeof pickModels> | null = null;
  try {
    found = pickModels(await listModels());
    checkedThisSession = true;
  } catch (err) {
    // Couldn't refresh the list: keep using what we have, if anything.
    if (models.generate && models.embed) return { generate: models.generate, embed: models.embed };
    throw err;
  }

  const generate = (auto ? found.generate[0]?.name : undefined) ?? models.generate ?? found.generate[0]?.name;
  const embed = models.embed ?? found.embed[0]?.name;
  if (!generate || !embed) {
    throw new GeminiError('No suitable Gemini models are available to this key. Check the key in Google AI Studio.');
  }
  if (generate !== models.generate || embed !== models.embed) updateSettings({ models: { ...models, generate, embed } });
  return { generate, embed };
}

/* ---------- Structured generation ---------- */

type Schema = Record<string, unknown>;

export interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface Turn {
  role: 'user' | 'model';
  parts: Part[];
}

type GenerateResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

export async function generateJson<T>(
  parts: Part[],
  schema: Schema,
  opts: { temperature?: number; system?: string; history?: Turn[] } = {},
): Promise<T> {
  const { generate } = await ensureModels();
  const data = await call<GenerateResponse>(`models/${generate}:generateContent`, {
      method: 'POST',
      body: JSON.stringify({
        ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
        contents: [...(opts.history ?? []), { role: 'user', parts }],
        // No thinking settings: each model thinks at its default level for the best answers.
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: opts.temperature ?? 0.4 },
      }),
    });
  if (data.promptFeedback?.blockReason) {
    throw new GeminiError(`Gemini declined this request (${data.promptFeedback.blockReason}). Try a different image or wording.`);
  }
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'PROHIBITED_CONTENT') {
    throw new GeminiError('Gemini declined to answer this one. Try rewording it or using a different image.');
  }
  const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (candidate?.finishReason === 'MAX_TOKENS' && !text.trim().endsWith('}')) {
    throw new GeminiError('Gemini’s answer was cut off before it finished. Try a shorter or more specific request.');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError('Gemini’s reply could not be read. Try again.');
  }
}

/* ---------- Tagging ---------- */

export interface TagResult {
  subject: string;
  description: string;
  tags: TagGroups;
}

export function tagSchema(lens: Lens): Schema {
  const groups = groupsFor(lens);
  return {
    type: 'OBJECT',
    properties: {
      subject: { type: 'STRING', description: 'What the image shows, as a short noun phrase.' },
      description: { type: 'STRING', description: 'Two plain sentences on what a designer would notice.' },
      tags: {
        type: 'OBJECT',
        properties: Object.fromEntries(
          groups.map((g) => [g.key, { type: 'ARRAY', items: { type: 'STRING' }, description: g.hint }]),
        ),
        required: groups.map((g) => g.key),
      },
    },
    required: ['subject', 'description', 'tags'],
  };
}

export async function tagImage(image: { mimeType: string; data: string }, lens: Lens): Promise<TagResult> {
  const groups = groupsFor(lens);
  const prompt = [
    `Tag this design reference for a ${lens.name.toLowerCase()} designer.`,
    `Focus on ${lens.focus}.`,
    'Give 3 to 6 tags per group. Each tag is 1 to 3 lowercase words, using common design vocabulary.',
    'Name colours plainly (warm grey, sage green, deep navy). Be concrete. No brand names, no hype.',
    `Groups: ${groups.map((g) => `${g.key} (${g.hint})`).join('; ')}.`,
  ].join('\n');
  const out = await generateJson<TagResult>([{ inlineData: image }, { text: prompt }], tagSchema(lens), { temperature: 0.3 });
  const tags: TagGroups = {};
  for (const g of groups) {
    tags[g.key] = [...new Set((out.tags?.[g.key] ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
  }
  return { subject: out.subject?.trim() ?? '', description: out.description?.trim() ?? '', tags };
}

/* ---------- Embeddings ---------- */

function normalise(v: number[]): number[] {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

/**
 * Several texts in one request (Gemini's batchEmbedContents), in the same
 * order. Used where a search needs vectors for many queries at once.
 */
export async function embedMany(texts: string[], task: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<{ values: number[][]; model: string }> {
  if (!texts.length) return { values: [], model: '' };
  const { embed: model } = await ensureModels();
  const data = await call<{ embeddings?: { values?: number[] }[] }>(`models/${model}:batchEmbedContents`, {
    method: 'POST',
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        taskType: task,
        outputDimensionality: EMBED_DIMS,
      })),
    }),
  });
  const out = data.embeddings ?? [];
  if (out.length !== texts.length || out.some((e) => !e.values?.length)) {
    throw new GeminiError('Gemini returned incomplete embeddings. Try again.');
  }
  return { values: out.map((e) => normalise(e.values!.slice(0, EMBED_DIMS))), model };
}

export async function embed(text: string, task: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<{ values: number[]; model: string }> {
  const { embed: model } = await ensureModels();
  const data = await call<{ embedding?: { values?: number[] } }>(`models/${model}:embedContent`, {
    method: 'POST',
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      taskType: task,
      outputDimensionality: EMBED_DIMS,
    }),
  });
  const values = data.embedding?.values;
  if (!values?.length) throw new GeminiError('Gemini returned an empty embedding. Try again.');
  return { values: normalise(values.slice(0, EMBED_DIMS)), model };
}

/** The text an image is embedded from: its description plus every tag. */
export function embeddingText(r: { name: string; subject?: string; description?: string; tags: TagGroups; customTags: string[] }) {
  return [r.subject, r.description, ...Object.values(r.tags).flat(), ...r.customTags, r.name].filter(Boolean).join('. ');
}
