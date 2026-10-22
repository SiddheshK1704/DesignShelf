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

export function newId(): string {
  return crypto.randomUUID();
}
