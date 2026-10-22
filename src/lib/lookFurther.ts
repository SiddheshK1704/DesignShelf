/**
 * "Look further" links: real image-search results on other sites, opened in
 * a new tab. Nothing is fetched or scraped; these are plain links.
 *
 * Checked 2026-10-22: Google (tbm=isch now redirects to udm=2, so udm=2 is
 * used directly), Pinterest, Behance, Dribbble and Pexels load results pages.
 * Unsplash blocks automated checks; its /s/photos/<query> pattern is
 * long-standing.
 */

export interface LookFurtherLink {
  site: string;
  href: string;
}

const SITES: { site: string; build: (q: string) => string }[] = [
  { site: 'Google Images', build: (q) => `https://www.google.com/search?udm=2&q=${q}` },
  { site: 'Pinterest', build: (q) => `https://www.pinterest.com/search/pins/?q=${q}` },
  { site: 'Behance', build: (q) => `https://www.behance.net/search/projects?search=${q}` },
  { site: 'Dribbble', build: (q) => `https://dribbble.com/search/${q}` },
  { site: 'Unsplash', build: (q) => `https://unsplash.com/s/photos/${q}` },
  { site: 'Pexels', build: (q) => `https://www.pexels.com/search/${q}/` },
];

export function lookFurther(query: string): LookFurtherLink[] {
  const q = encodeURIComponent(query.trim());
  return SITES.map(({ site, build }) => ({ site, href: build(q) }));
}
