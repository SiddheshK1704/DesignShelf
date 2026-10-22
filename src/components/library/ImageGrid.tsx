import { useEffect, useRef, useState } from 'react';
import type { LibraryStore } from '../../lib/store/LibraryStore';
import type { ImageRecord } from '../../lib/types';
import { useBlobUrl } from './useBlobUrl';

function columnsFor(width: number) {
  if (width < 520) return 2;
  if (width < 860) return 3;
  if (width < 1240) return 4;
  return 5;
}

/**
 * Masonry by shortest column. Each tile's box is sized from the stored
 * width and height, so nothing jumps as thumbnails load.
 */
export interface GridSelection {
  selected: Set<string>;
  /** `range` is true for shift-click, to select everything since the last click. */
  onToggle: (id: string, range: boolean) => void;
}

export function ImageGrid({
  images,
  store,
  onOpen,
  selection,
}: {
  images: ImageRecord[];
  store: LibraryStore;
  onOpen: (id: string) => void;
  /** When set, tiles toggle selection instead of opening. */
  selection?: GridSelection;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setCols(columnsFor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns: ImageRecord[][] = Array.from({ length: cols }, () => []);
  const heights = new Array(cols).fill(0);
  for (const img of images) {
    const c = heights.indexOf(Math.min(...heights));
    columns[c].push(img);
    heights[c] += img.height / img.width + 0.12; // + caption strip
  }

  return (
    <div ref={ref} className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {columns.map((col, i) => (
        <ul className="grid__col" key={i}>
          {col.map((img) => (
            <li key={img.id}>
              <Tile image={img} store={store} onOpen={onOpen} selection={selection} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

const STATUS_LABEL: Record<ImageRecord['status'], string | null> = {
  ready: null,
  pending: 'Waiting to tag',
  tagging: 'Tagging…',
  untagged: 'No AI tags',
  error: 'Tagging failed',
};

function Tile({
  image,
  store,
  onOpen,
  selection,
}: {
  image: ImageRecord;
  store: LibraryStore;
  onOpen: (id: string) => void;
  selection?: GridSelection;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const url = useBlobUrl(store, image.id, 'thumb', visible);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const status = STATUS_LABEL[image.status];
  const label = image.subject || image.name;
  const selecting = Boolean(selection);
  const checked = selection?.selected.has(image.id) ?? false;

  return (
    <button
      ref={ref}
      type="button"
      className={`tile2 ${selecting ? 'tile2--selecting' : ''} ${checked ? 'is-checked' : ''}`}
      onClick={(e) => (selection ? selection.onToggle(image.id, e.shiftKey) : onOpen(image.id))}
      {...(selecting ? { role: 'checkbox', 'aria-checked': checked, 'aria-label': `Select ${label}` } : { 'aria-label': `Open ${label}` })}
    >
      <span className="tile2__img" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
        {url && <img src={url} alt="" decoding="async" />}
        {selecting && (
          <span className="tile2__check" aria-hidden="true">
            <svg viewBox="0 0 16 16">
              <path d="M3.5 8.5l3 3 6-7" />
            </svg>
          </span>
        )}
        {status && (
          <span className={`tile2__status tile2__status--${image.status}`}>
            {image.status === 'tagging' && <span className="spinner" aria-hidden="true" />}
            {status}
          </span>
        )}
      </span>
      <span className="tile2__strip" aria-hidden="true">
        {image.swatches.slice(0, 5).map((c, i) => (
          <i key={`${c}-${i}`} style={{ background: c }} />
        ))}
      </span>
      <span className="tile2__name">{label}</span>
    </button>
  );
}
