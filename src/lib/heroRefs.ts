/**
 * The references shown in the landing collage. Each has a duotone placeholder
 * (`art`) that is used until a matching photo is listed in
 * /public/hero/manifest.json.
 */

export type ArtVariant =
  | 'cup'
  | 'cluster'
  | 'sideboard'
  | 'dial'
  | 'tote'
  | 'poster'
  | 'speaker'
  | 'stair'
  | 'phone';

export type Ratio = '4 / 5' | '1 / 1' | '3 / 4';

export interface HeroRef {
  slug: string;
  subject: string;
  discipline: string;
  ratio: Ratio;
  /** Dark tone, light tone, small accent. Also the caption swatches. */
  swatches: [string, string, string];
  tags: string[];
  /** Words this reference answers to in the landing search demo. */
  feel: string[];
  art: ArtVariant;
}

export const HERO_REFS: HeroRef[] = [
  {
    slug: 'stoneware-cup',
    subject: 'Stoneware cup',
    discipline: 'Industrial',
    ratio: '4 / 5',
    swatches: ['#2A3138', '#CDBB9F', '#8C7A62'],
    tags: ['matte glaze', 'soft radius', 'warm neutral'],
    feel: ['calm', 'soft', 'warm', 'handmade', 'matte', 'quiet'],
    art: 'cup',
  },
  {
    slug: 'night-cluster',
    subject: 'Night cluster',
    discipline: 'Vehicle',
    ratio: '1 / 1',
    swatches: ['#101716', '#3F7A6E', '#E3A94A'],
    tags: ['low glare', 'amber pointers', 'dark interface'],
    feel: ['technical', 'dark', 'focused', 'night', 'precise', 'premium'],
    art: 'cluster',
  },
  {
    slug: 'walnut-sideboard',
    subject: 'Walnut sideboard',
    discipline: 'Interiors',
    ratio: '3 / 4',
    swatches: ['#3A2A1F', '#D9D1C2', '#7B5536'],
    tags: ['oiled walnut', 'slim legs', 'flush doors'],
    feel: ['warm', 'premium', 'natural', 'calm', 'crafted'],
    art: 'sideboard',
  },
  {
    slug: 'aluminium-dial',
    subject: 'Aluminium dial',
    discipline: 'CMF',
    ratio: '1 / 1',
    swatches: ['#3C4249', '#C3C9CF', '#E3A94A'],
    tags: ['brushed finish', 'knurled edge', 'cool metal'],
    feel: ['precise', 'technical', 'cool', 'premium', 'tactile'],
    art: 'dial',
  },
  {
    slug: 'leather-tote',
    subject: 'Saddle leather tote',
    discipline: 'Fashion',
    ratio: '4 / 5',
    swatches: ['#2E211B', '#B9773F', '#E6CFAE'],
    tags: ['veg-tanned', 'edge stitching', 'warm brown'],
    feel: ['warm', 'crafted', 'soft', 'natural', 'premium'],
    art: 'tote',
  },
  {
    slug: 'grid-poster',
    subject: 'Grid poster',
    discipline: 'Graphic',
    ratio: '3 / 4',
    swatches: ['#E7E1D6', '#B6402F', '#1F2023'],
    tags: ['strict grid', 'red block', 'grotesk type'],
    feel: ['bold', 'graphic', 'loud', 'structured', 'confident'],
    art: 'poster',
  },
  {
    slug: 'knit-speaker',
    subject: 'Knit speaker',
    discipline: 'Industrial',
    ratio: '1 / 1',
    swatches: ['#3A3D41', '#A9ADB1', '#D8DADC'],
    tags: ['knit textile', 'pillowy form', 'soft grey'],
    feel: ['soft', 'calm', 'friendly', 'quiet', 'homely'],
    art: 'speaker',
  },
  {
    slug: 'concrete-stair',
    subject: 'Concrete stair',
    discipline: 'Architecture',
    ratio: '4 / 5',
    swatches: ['#2B2C2D', '#9C9A94', '#CFCBC2'],
    tags: ['raw concrete', 'deep shadow', 'stepped mass'],
    feel: ['raw', 'calm', 'heavy', 'monumental', 'quiet'],
    art: 'stair',
  },
  {
    slug: 'banking-screen',
    subject: 'Savings app screen',
    discipline: 'UI/UX',
    ratio: '3 / 4',
    swatches: ['#16201E', '#E6ECE8', '#5FA58E'],
    tags: ['generous spacing', 'soft contrast', 'single action'],
    feel: ['calm', 'clean', 'friendly', 'soft', 'trustworthy'],
    art: 'phone',
  },
];

export interface HeroPhoto {
  slug: string;
  file: string;
  credit?: string;
  licence?: string;
  sourceUrl?: string;
}

/** Reads /hero/manifest.json. Missing or invalid manifests mean "no photos yet". */
export async function loadHeroPhotos(): Promise<Map<string, HeroPhoto>> {
  try {
    const res = await fetch('/hero/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return new Map();
    const data = (await res.json()) as { images?: HeroPhoto[] };
    return new Map((data.images ?? []).filter((p) => p.slug && p.file).map((p) => [p.slug, p]));
  } catch {
    return new Map();
  }
}
