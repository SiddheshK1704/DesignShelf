import { useMemo, useState } from 'react';
import { groupLabel } from '../../lib/lenses';
import { allLenses, useSettings } from '../../lib/settings';
import type { ImageRecord } from '../../lib/types';

const GROUP_ORDER = ['form', 'material', 'colour', 'mood', 'details'];
const SHOW = 8;

export function filterKey(group: string, tag: string) {
  return `${group}:${tag}`;
}

export function matchesFilters(img: ImageRecord, selected: Set<string>) {
  for (const key of selected) {
    const [group, ...rest] = key.split(':');
    const tag = rest.join(':');
    const list = group === 'yours' ? img.customTags : img.tags[group];
    if (!list?.includes(tag)) return false;
  }
  return true;
}

/** Tag filters grouped by type, with counts. Selected filters combine (AND). */
export function FilterRail({
  images,
  selected,
  onToggle,
  onClear,
}: {
  images: ImageRecord[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  onClear: () => void;
}) {
  const settings = useSettings();
  const lenses = allLenses(settings);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const counts = new Map<string, Map<string, number>>();
    const bump = (g: string, t: string) => {
      if (!counts.has(g)) counts.set(g, new Map());
      const m = counts.get(g)!;
      m.set(t, (m.get(t) ?? 0) + 1);
    };
    for (const img of images) {
      for (const [g, tags] of Object.entries(img.tags)) tags.forEach((t) => bump(g, t));
      img.customTags.forEach((t) => bump('yours', t));
    }
    return [...counts.entries()]
      .map(([key, m]) => ({ key, tags: [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) }))
      .sort((a, b) => {
        const ia = GROUP_ORDER.indexOf(a.key);
        const ib = GROUP_ORDER.indexOf(b.key);
        if (a.key === 'yours') return 1;
        if (b.key === 'yours') return -1;
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
  }, [images]);

  if (!groups.length) {
    return (
      <div className="rail rail--empty">
        <p className="muted">Filters appear here once images have tags.</p>
      </div>
    );
  }

  return (
    <div className="rail">
      <div className="rail__head">
        <h2 className="rail__title">Filter</h2>
        {selected.size > 0 && (
          <button type="button" className="linkbtn" onClick={onClear}>
            Clear {selected.size}
          </button>
        )}
      </div>
      {groups.map((g) => {
        const open = expanded.has(g.key);
        const list = open ? g.tags : g.tags.slice(0, SHOW);
        const label = g.key === 'yours' ? 'Your tags' : groupLabel(g.key, lenses);
        return (
          <section key={g.key} className="rail__group" aria-label={label}>
            <h3 className="rail__h">{label}</h3>
            <ul>
              {list.map(([tag, n]) => {
                const key = filterKey(g.key, tag);
                const on = selected.has(key);
                return (
                  <li key={tag}>
                    <button type="button" className="rail__tag" aria-pressed={on} onClick={() => onToggle(key)}>
                      <span>{tag}</span>
                      <span className="rail__n">{n}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {g.tags.length > SHOW && (
              <button
                type="button"
                className="linkbtn rail__more"
                onClick={() =>
                  setExpanded((s) => {
                    const n = new Set(s);
                    if (open) n.delete(g.key);
                    else n.add(g.key);
                    return n;
                  })
                }
              >
                {open ? 'Show fewer' : `Show all ${g.tags.length}`}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
