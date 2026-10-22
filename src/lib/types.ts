/** Tags grouped by type, e.g. { form: ['soft radius'], material: ['oiled walnut'] }. */
export type TagGroups = Record<string, string[]>;

export type ImageStatus =
  /** Saved, waiting in the tagging queue. */
  | 'pending'
  /** Being tagged right now. */
  | 'tagging'
  /** Tagged and searchable by meaning. */
  | 'ready'
  /** Saved without AI tags (no Gemini key yet). */
  | 'untagged'
  /** Tagging failed; `error` says why. */
  | 'error';

export interface SourceInfo {
  url?: string;
  pageTitle?: string;
  credit?: string;
  licence?: string;
  licenceUrl?: string;
  provider?: string;
}

export interface ImageRecord {
  id: string;
  name: string;
  width: number;
  height: number;
  lensId: string;
  subject?: string;
  description?: string;
  tags: TagGroups;
  customTags: string[];
  swatches: string[];
  source?: SourceInfo;
  embedding?: number[];
  embeddingModel?: string;
  status: ImageStatus;
  error?: string;
  isDemo?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Board {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BoardImage {
  boardId: string;
  imageId: string;
  addedAt: number;
}

export interface TagGroupDef {
  key: string;
  label: string;
  /** What the model should list in this group. */
  hint: string;
}

export interface Lens {
  id: string;
  name: string;
  /** One sentence telling the model what this kind of designer looks at. */
  focus: string;
  /** Extra groups on top of the shared ones (form, material, colour, mood, details). */
  groups: TagGroupDef[];
  custom?: boolean;
}

export interface DesignDoc {
  title: string;
  summary: string;
  problem: string;
  audience: string;
  goals: string[];
  constraints: string[];
  principles: { title: string; detail: string }[];
  /** Uses the shared tag vocabulary. */
  visual: { form: string[]; material: string[]; colour: string[]; mood: string[] };
  /** CMF, UI or other directions, following the chosen lens. */
  lensSection: { heading: string; items: { title: string; detail: string }[] };
  queries: { label: string; query: string }[];
  risks: string[];
  questions: string[];
  architecture: { kind: string; mermaid: string; explanation: string };
}

export interface SavedDoc {
  id: string;
  title: string;
  brief: string;
  lensId: string;
  boardId?: string;
  doc: DesignDoc;
  /** Shelf references chosen when the doc was written. */
  shelfIds: string[];
  /** Whether the diagram parsed, after at most one repair. */
  diagram: { ok: boolean; error?: string; repaired?: boolean };
  createdAt: number;
  updatedAt: number;
}

export function newId(): string {
  return crypto.randomUUID();
}
