/**
 * Gemini, called straight from the browser with the user's own key.
 * Models are discovered with ListModels instead of being hardcoded.
 */
import { groupsFor } from './lenses';
import { parsePartialJson } from './partialJson';
import { getSettings, updateSettings } from './settings';
import type { Lens, TagGroups } from './types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const EMBED_DIMS = 768;

/** What a 429 said about the quota that was hit. */
export interface QuotaInfo {
  /** The limit resets daily (waiting a minute won't help). */
  perDay: boolean;
  /** The limit itself; 0 means this model has no free requests on this key at all. */
  limit?: number;
  model?: string;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public retryAfterMs?: number,
    public quota?: QuotaInfo,
  ) {
    super(message);
  }

  /** A quota that waiting won't fix: none at all for this model, or today's used up. */
  get exhausted(): boolean {
    return this.status === 429 && Boolean(this.quota && (this.quota.limit === 0 || this.quota.perDay));
  }
}

export interface GeminiModel {
  name: string;
  displayName: string;
  methods: string[];
}

interface ErrorDetail {
  '@type'?: string;
  retryDelay?: string;
  reason?: string;
  violations?: { quotaId?: string; quotaValue?: string; quotaDimensions?: { model?: string } }[];
}

/** Turns API failures into messages that say what happened and how to fix it. */
async function toError(res: Response): Promise<GeminiError> {
  let body: { error?: { message?: string; status?: string; details?: ErrorDetail[] } } = {};
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
    // Which quota was hit: per minute (wait), per day, or none at all for this model.
    const v = details.flatMap((d) => d.violations ?? []);
    const perDay = v.some((x) => /PerDay/i.test(x.quotaId ?? ''));
    const limits = v.map((x) => Number(x.quotaValue)).filter((n) => !Number.isNaN(n));
    const limitFromText = raw.match(/limit:\s*(\d+)/)?.[1];
    const limit = limits.length ? Math.min(...limits) : limitFromText !== undefined ? Number(limitFromText) : undefined;
    const model = v.find((x) => x.quotaDimensions?.model)?.quotaDimensions?.model ?? raw.match(/model:\s*([\w.-]+)/)?.[1];
    const quota: QuotaInfo = { perDay, limit, model };
    const message =
      limit === 0
        ? `Your Gemini key has no free requests for ${model ?? 'this model'}.`
        : perDay
          ? `Today’s free Gemini requests for ${model ?? 'this model'} are used up. They reset tomorrow.`
          : 'Gemini’s per-minute limit was reached. Waiting before trying again.';
    return new GeminiError(message, 429, retryAfterMs, quota);
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
 * One Gemini request at a time, across the whole app. Requests from what
 * the user is waiting on (Ask, design docs) go ahead of background tagging.
 * When Gemini asks us to wait, every queued request waits together, so a
 * rate limit is never hit again by the next request in line.
 */
export type Priority = 'now' | 'background';
const queues: Record<Priority, (() => void)[]> = { now: [], background: [] };
let busy = false;
/** Per model: hold requests until this time after a per-minute 429. */
const pausedUntil = new Map<string, number>();

/** When the request at the front of the queue is waiting out a limit, until when. Screens show a countdown. */
let waitingUntil = 0;
const waitListeners = new Set<() => void>();
function setWaiting(until: number) {
  waitingUntil = until;
  waitListeners.forEach((l) => l());
}
export function getGeminiWait(): number {
  return waitingUntil;
}
export function subscribeGeminiWait(fn: () => void) {
  waitListeners.add(fn);
  return () => waitListeners.delete(fn);
}

async function slot<T>(priority: Priority, model: string, fn: () => Promise<T>): Promise<T> {
  if (busy) await new Promise<void>((resolve) => queues[priority].push(resolve));
  busy = true;
  try {
    const wait = (pausedUntil.get(model) ?? 0) - Date.now();
    if (wait > 0) {
      setWaiting(Date.now() + wait);
      try {
        await sleep(wait);
      } finally {
        setWaiting(0);
      }
    }
    return await fn();
  } finally {
    busy = false;
    (queues.now.shift() ?? queues.background.shift())?.();
  }
}

/** How long requests to this model should hold off after a per-minute 429. */
function pause(model: string, ms: number) {
  pausedUntil.set(model, Math.max(pausedUntil.get(model) ?? 0, Date.now() + ms));
}

async function call<T>(path: string, init: RequestInit = {}, key = getSettings().geminiKey, priority: Priority = 'now'): Promise<T> {
  if (!key) throw new GeminiError('Add your Gemini API key in Settings to use AI tagging and search by meaning.', 0);
  const model = path.match(/^models\/([^:/?]+):/)?.[1] ?? 'list';
  return slot(priority, model, async () => {
    let res: Response;
    try {
      res = await fetch(`${BASE}/${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, ...init.headers },
      });
    } catch {
      throw new GeminiError('Could not reach Gemini. Check your internet connection and try again.', 0);
    }
    if (!res.ok) {
      const err = await toError(res);
      if (err.status === 429 && !err.exhausted) pause(model, err.retryAfterMs ?? 15_000);
      throw err;
    }
    return res.json() as Promise<T>;
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retries per-minute rate limits and 5xx errors, waiting as long as Gemini
 * asks. Quotas that waiting can't fix (none for the model, or today's used
 * up) are not retried. `onWait` reports how long it's waiting.
 */
export async function withBackoff<T>(fn: () => Promise<T>, onWait?: (ms: number) => void, tries = 4): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const e = err as GeminiError;
      const retryable = e instanceof GeminiError && ((e.status === 429 && !e.exhausted) || e.status >= 500);
      if (!retryable || attempt >= tries - 1) throw err;
      const wait = Math.min(65_000, e.retryAfterMs ?? 1000 * 2 ** attempt + Math.random() * 400);
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

/* ---------- Which model to use ---------- */

const LIST_KEY = 'designshelf.modelList';
const UNAVAILABLE_KEY = 'designshelf.unavailableModels';
const LIST_MAX_AGE = 12 * 60 * 60 * 1000;

interface ModelList {
  at: number;
  generate: string[];
  embed: string[];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: keep it in memory only.
  }
}

let list: ModelList | null = readJson<ModelList | null>(LIST_KEY, null);
let listing: Promise<ModelList> | null = null;

/** The ranked model list, refreshed at most twice a day, shared by everyone who asks at once. */
async function modelList(): Promise<ModelList> {
  if (list && Date.now() - list.at < LIST_MAX_AGE) return list;
  listing ??= listModels()
    .then((all) => {
      const found = pickModels(all);
      list = { at: Date.now(), generate: found.generate.map((m) => m.name), embed: found.embed.map((m) => m.name) };
      writeJson(LIST_KEY, list);
      return list;
    })
    .finally(() => (listing = null));
  return listing;
}

/** Models whose quota is used up (until a time), remembered across reloads. */
let unavailable: Record<string, number> = readJson(UNAVAILABLE_KEY, {});
/** Models that just hit a per-minute limit (until a time). */
const cooling = new Map<string, number>();

/** Record a rate limit for a model, so the next request can pick another. */
function noteLimit(model: string, err: GeminiError) {
  if (err.exhausted) {
    // No free quota at all: skip for a week. Daily quota used: skip for a day.
    unavailable = { ...unavailable, [model]: Date.now() + (err.quota?.limit === 0 ? 7 : 1) * 24 * 60 * 60 * 1000 };
    writeJson(UNAVAILABLE_KEY, unavailable);
  } else {
    cooling.set(model, Date.now() + (err.retryAfterMs ?? 30_000));
  }
}

/** Models that can be tried right now, best first. */
function usable(names: string[]): { ready: string[]; all: string[] } {
  const now = Date.now();
  const all = names.filter((n) => !(unavailable[n] > now));
  return { all, ready: all.filter((n) => !((cooling.get(n) ?? 0) > now)) };
}

/**
 * The models to use. Unless the user picked one by hand, the generation
 * model is the newest Flash model the key can use right now: models whose
 * quota is used up, or that just hit a per-minute limit, are skipped in
 * favour of the next best. The embedding model stays fixed once chosen,
 * because changing it would make existing search vectors incomparable.
 */
export async function ensureModels(): Promise<{ generate: string; embed: string }> {
  const { models } = getSettings();
  const auto = models.generateAuto !== false;
  if (!auto && models.generate && models.embed) return { generate: models.generate, embed: models.embed };

  let ranked: ModelList;
  try {
    ranked = await modelList();
  } catch (err) {
    // Couldn't read the list: keep using what we have, if anything.
    if (models.generate && models.embed) return { generate: models.generate, embed: models.embed };
    throw err;
  }

  const { ready, all } = usable(ranked.generate);
  const generate = (auto ? ready[0] ?? all[0] : undefined) ?? models.generate ?? ranked.generate[0];
  const embed = models.embed ?? ranked.embed[0];
  if (!generate || !embed) {
    if (auto && ranked.generate.length && !all.length) {
      throw new GeminiError(
        'Every Gemini model on your key has used up its free requests for now. They reset daily; you can also add billing to the key in Google AI Studio.',
        429,
      );
    }
    throw new GeminiError('No suitable Gemini models are available to this key. Check the key in Google AI Studio.');
  }
  if (generate !== models.generate || embed !== models.embed) updateSettings({ models: { ...models, generate, embed } });
  return { generate, embed };
}

/** Forget remembered limits (e.g. after a new key is saved). */
export function resetModelLimits() {
  unavailable = {};
  cooling.clear();
  list = null;
  writeJson(UNAVAILABLE_KEY, {});
  try {
    localStorage.removeItem(LIST_KEY);
  } catch {
    // Nothing stored.
  }
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

/**
 * A streamed request (streamGenerateContent over server-sent events). Calls
 * `onText` with everything written so far, so the page can show the reply
 * as it arrives instead of after the last word. Same queue and errors as call().
 */
async function streamCall(model: string, body: string, priority: Priority, onText: (text: string) => void): Promise<GenerateResponse> {
  const key = getSettings().geminiKey;
  if (!key) throw new GeminiError('Add your Gemini API key in Settings to use AI tagging and search by meaning.', 0);
  return slot(priority, model, async () => {
    let res: Response;
    try {
      res = await fetch(`${BASE}/models/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body,
      });
    } catch {
      throw new GeminiError('Could not reach Gemini. Check your internet connection and try again.', 0);
    }
    if (!res.ok || !res.body) {
      const err = await toError(res);
      if (err.status === 429 && !err.exhausted) pause(model, err.retryAfterMs ?? 15_000);
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let finishReason: string | undefined;
    let blockReason: string | undefined;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        let chunk: GenerateResponse & { error?: { message?: string } };
        try {
          chunk = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (chunk.error) throw new GeminiError(`Gemini stopped partway: ${chunk.error.message ?? 'unknown error'}. Try again.`, 500);
        const c = chunk.candidates?.[0];
        // Thought summaries (if a model sends them) aren't part of the answer.
        const piece = c?.content?.parts?.filter((p) => !(p as { thought?: boolean }).thought).map((p) => p.text ?? '').join('') ?? '';
        if (piece) {
          text += piece;
          onText(text);
        }
        if (c?.finishReason) finishReason = c.finishReason;
        if (chunk.promptFeedback?.blockReason) blockReason = chunk.promptFeedback.blockReason;
      }
    }
    return { candidates: [{ content: { parts: [{ text }] }, finishReason }], promptFeedback: blockReason ? { blockReason } : undefined };
  });
}

export async function generateJson<T>(
  parts: Part[],
  schema: Schema,
  opts: {
    temperature?: number;
    system?: string;
    history?: Turn[];
    priority?: Priority;
    /** Stream the reply and call this with the parsed-so-far value as it grows. */
    onPartial?: (value: Record<string, unknown>) => void;
  } = {},
): Promise<T> {
  const body = JSON.stringify({
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    contents: [...(opts.history ?? []), { role: 'user', parts }],
    // No thinking settings: each model thinks at its default level for the best answers.
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: opts.temperature ?? 0.4 },
  });
  const auto = getSettings().models.generateAuto !== false;

  let data: GenerateResponse | undefined;
  for (let attempt = 0; !data; attempt++) {
    const { generate } = await ensureModels();
    try {
      const onPartial = opts.onPartial;
      data = onPartial
        ? await streamCall(generate, body, opts.priority ?? 'now', (text) => {
            const value = parsePartialJson(text);
            if (value && typeof value === 'object' && !Array.isArray(value)) onPartial(value as Record<string, unknown>);
          })
        : await call<GenerateResponse>(`models/${generate}:generateContent`, { method: 'POST', body }, undefined, opts.priority);
    } catch (err) {
      if (!(err instanceof GeminiError) || err.status !== 429) throw err;
      noteLimit(generate, err);
      // Automatic: go straight to the next model that can answer now, instead of waiting.
      if (auto && attempt < 6) {
        const next = (await ensureModels()).generate;
        if (next !== generate) continue;
      }
      if (!auto && err.exhausted) {
        throw new GeminiError(
          `${err.message} You chose this model in Settings; pick another there, or switch to Automatic so Design Shelf can use one that works.`,
          429,
          err.retryAfterMs,
          err.quota,
        );
      }
      // Nothing else to switch to: per-minute limits are waited out by withBackoff.
      throw err;
    }
  }
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
  const out = await generateJson<TagResult>([{ inlineData: image }, { text: prompt }], tagSchema(lens), { temperature: 0.3, priority: 'background' });
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
  // Indexing images is background work; query embeddings are for someone waiting.
  const priority: Priority = task === 'RETRIEVAL_DOCUMENT' ? 'background' : 'now';
  const data = await call<{ embedding?: { values?: number[] } }>(`models/${model}:embedContent`, {
    method: 'POST',
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      taskType: task,
      outputDimensionality: EMBED_DIMS,
    }),
  }, undefined, priority);
  const values = data.embedding?.values;
  if (!values?.length) throw new GeminiError('Gemini returned an empty embedding. Try again.');
  return { values: normalise(values.slice(0, EMBED_DIMS)), model };
}

/** The text an image is embedded from: its description plus every tag. */
export function embeddingText(r: { name: string; subject?: string; description?: string; tags: TagGroups; customTags: string[] }) {
  return [r.subject, r.description, ...Object.values(r.tags).flat(), ...r.customTags, r.name].filter(Boolean).join('. ');
}
