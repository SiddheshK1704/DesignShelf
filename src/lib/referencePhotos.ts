import data from '../data/reference-photos.json';

/** A real photo from an open-licence source, with what's needed to credit it. */
export interface RefPhoto {
  id: string;
  title: string;
  src: string;
  width: number;
  height: number;
  creator: string;
  creatorUrl?: string;
  licence: string;
  licenceUrl?: string;
  sourceUrl: string;
  provider: string;
}

const photos = (data as { fetchedAt: string; photos: Record<string, RefPhoto[]> }).photos;

export const PHOTOS_FETCHED_AT = (data as { fetchedAt: string }).fetchedAt;

export function photosFor(slug: string): RefPhoto[] {
  return photos[slug] ?? [];
}

export function allPhotos(): (RefPhoto & { slug: string })[] {
  return Object.entries(photos).flatMap(([slug, list]) => list.map((p) => ({ ...p, slug })));
}
