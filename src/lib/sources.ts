/**
 * Open-licensed image search from the browser: Openverse and Wikimedia
 * Commons. Both allow cross-origin requests and need no key. Every result
 * carries its author, licence and source link.
 *
 * Openverse allows anonymous clients 20 requests a minute and 200 a day, so
 * results are cached for the session and Wikimedia keeps working if
 * Openverse says no.
 */

export interface OpenImage {
  id: string;
  title: string;
  thumb: string;
  full: string;
  width: number;
  height: number;
  creator: string;
  creatorUrl?: string;
  licence: string;
  licenceUrl?: string;
  sourceUrl: string;
  provider: string;
}

export interface OpenSearchResult {
  images: OpenImage[];
  /** Problems with individual sources; results from the others still show. */
  warnings: string[];
}

const clean = (s: unknown) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function openverse(query: string, limit: number): Promise<OpenImage[]> {
  const params = new URLSearchParams({ q: query, page_size: String(limit), mature: 'false', category: 'photograph' });
  const res = await fetch(`https://api.openverse.org/v1/images/?${params}`);
  if (res.status === 429) throw new Error('Openverse’s free daily limit was reached; showing Wikimedia Commons only.');
  if (!res.ok) throw new Error(`Openverse returned ${res.status}.`);
  const data = (await res.json()) as {
    results?: {
      id: string;
      title?: string;
      url: string;
      thumbnail?: string;
      width?: number;
      height?: number;
      creator?: string;
      creator_url?: string;
      license: string;
      license_version?: string;
      license_url?: string;
      foreign_landing_url: string;
      source?: string;
    }[];
  };
  return (data.results ?? []).map((r) => ({
    id: `ov-${r.id}`,
    title: clean(r.title) || 'Untitled',
    thumb: r.thumbnail || r.url,
    full: r.url,
    width: r.width || 4,
    height: r.height || 3,
    creator: clean(r.creator) || 'Unknown',
    creatorUrl: r.creator_url || undefined,
    licence: ['cc0', 'pdm'].includes(r.license) ? r.license.toUpperCase() : `CC ${r.license.toUpperCase()} ${r.license_version ?? ''}`.trim(),
    licenceUrl: r.license_url,
    sourceUrl: r.foreign_landing_url,
    provider: `Openverse / ${r.source ?? 'web'}`,
  }));
}

async function wikimedia(query: string, limit: number): Promise<OpenImage[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '480',
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!res.ok) throw new Error(`Wikimedia Commons returned ${res.status}.`);
  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          pageid: number;
          index: number;
          title: string;
          imageinfo?: {
            url: string;
            thumburl?: string;
            thumbwidth?: number;
            thumbheight?: number;
            descriptionurl: string;
            extmetadata?: Record<string, { value?: string }>;
          }[];
        }
      >;
    };
  };
  return Object.values(data.query?.pages ?? {})
    .sort((a, b) => a.index - b.index)
    .filter((p) => p.imageinfo?.[0]?.thumburl && /\.(jpe?g|png|webp)$/i.test(p.imageinfo[0].url.split('?')[0]))
    .map((p) => {
      const info = p.imageinfo![0];
      const m = info.extmetadata ?? {};
      return {
        id: `wm-${p.pageid}`,
        title: clean(m.ObjectName?.value) || p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
        thumb: info.thumburl!.split('?')[0],
        full: info.url.split('?')[0],
        width: info.thumbwidth || 4,
        height: info.thumbheight || 3,
        creator: clean(m.Artist?.value) || 'Unknown',
        licence: clean(m.LicenseShortName?.value) || 'See source',
        licenceUrl: m.LicenseUrl?.value,
        sourceUrl: info.descriptionurl,
        provider: 'Wikimedia Commons',
      };
    });
}

const CACHE_KEY = 'designshelf.openimages';

function readCache(): Record<string, OpenSearchResult> {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeCache(key: string, value: OpenSearchResult) {
  try {
    const all = readCache();
    all[key] = value;
    // Keep the cache small.
    const keys = Object.keys(all);
    if (keys.length > 60) delete all[keys[0]];
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    // Storage full or blocked: skip caching.
  }
}

/** Search both sources and interleave the results. */
export async function searchOpenImages(query: string, limit = 6): Promise<OpenSearchResult> {
  const key = `${query.trim().toLowerCase()}|${limit}`;
  const hit = readCache()[key];
  if (hit) return hit;

  const per = Math.max(3, Math.ceil(limit / 2) + 2);
  const [ov, wm] = await Promise.allSettled([openverse(query, per), wikimedia(query, per)]);
  const warnings: string[] = [];
  if (ov.status === 'rejected') warnings.push((ov.reason as Error).message.includes('Openverse') ? (ov.reason as Error).message : 'Openverse could not be reached.');
  if (wm.status === 'rejected') warnings.push((wm.reason as Error).message.includes('Wikimedia') ? (wm.reason as Error).message : 'Wikimedia Commons could not be reached.');
  if (ov.status === 'rejected' && wm.status === 'rejected') {
    throw new Error('Neither Openverse nor Wikimedia Commons could be reached. Check your connection and try again.');
  }
  const a = ov.status === 'fulfilled' ? ov.value : [];
  const b = wm.status === 'fulfilled' ? wm.value : [];
  const images: OpenImage[] = [];
  for (let i = 0; i < Math.max(a.length, b.length) && images.length < limit; i++) {
    if (a[i]) images.push(a[i]);
    if (b[i] && images.length < limit) images.push(b[i]);
  }
  const result = { images, warnings };
  if (!warnings.length) writeCache(key, result);
  return result;
}
