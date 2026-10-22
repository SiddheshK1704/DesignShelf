import type { Lens, TagGroupDef } from './types';

/** Groups every lens shares. This is the tag vocabulary used across the app. */
export const BASE_GROUPS: TagGroupDef[] = [
  { key: 'form', label: 'Form', hint: 'shape language, proportion, edges and radii' },
  { key: 'material', label: 'Material', hint: 'materials and how they are made' },
  { key: 'colour', label: 'Colour', hint: 'colours named plainly, e.g. warm grey, sage green' },
  { key: 'mood', label: 'Mood', hint: 'how it feels, e.g. calm, technical, playful' },
  { key: 'details', label: 'Details', hint: 'specific features a designer would point at' },
];

export const BUILT_IN_LENSES: Lens[] = [
  {
    id: 'general',
    name: 'General',
    focus: 'what any designer would notice first: form, material, colour, mood and standout details',
    groups: [],
  },
  {
    id: 'industrial',
    name: 'Industrial',
    focus: 'product form, ergonomics, manufacturing cues and how the object is used',
    groups: [{ key: 'function', label: 'Use and ergonomics', hint: 'grip, controls, interaction with the body' }],
  },
  {
    id: 'vehicle',
    name: 'Vehicle',
    focus: 'proportion, stance, surfacing, graphics and how the vehicle meets the road',
    groups: [{ key: 'proportion', label: 'Proportion and stance', hint: 'wheel size, overhangs, height, visual weight' }],
  },
  {
    id: 'cmf',
    name: 'CMF',
    focus: 'colour, material and finish: gloss level, texture, coatings and how surfaces meet',
    groups: [{ key: 'finish', label: 'Finish and texture', hint: 'gloss, grain, coating, process marks' }],
  },
  {
    id: 'ui',
    name: 'UI/UX',
    focus: 'layout, hierarchy, type, spacing, components and interaction states',
    groups: [{ key: 'interaction', label: 'Layout and interaction', hint: 'grid, hierarchy, components, states' }],
  },
  {
    id: 'graphic',
    name: 'Graphic',
    focus: 'typography, grid, composition, image treatment and colour use',
    groups: [{ key: 'typography', label: 'Type and layout', hint: 'typefaces, scale, grid, alignment' }],
  },
  {
    id: 'interiors',
    name: 'Interiors',
    focus: 'space, light, materials, furniture and how people move through the room',
    groups: [{ key: 'space', label: 'Space and light', hint: 'volume, daylight, zoning, sightlines' }],
  },
  {
    id: 'fashion',
    name: 'Fashion',
    focus: 'silhouette, cut, construction, fabric and styling',
    groups: [{ key: 'construction', label: 'Cut and construction', hint: 'seams, fit, closures, drape' }],
  },
  {
    id: 'packaging',
    name: 'Packaging',
    focus: 'structure, shelf impact, opening experience, graphics and print finishes',
    groups: [{ key: 'structure', label: 'Structure and shelf impact', hint: 'format, opening, stacking, visibility' }],
  },
];

export function groupsFor(lens: Lens): TagGroupDef[] {
  return [...BASE_GROUPS, ...lens.groups];
}

/** Label for any group key, across built-in and custom lenses. */
export function groupLabel(key: string, lenses: Lens[]): string {
  const all = [...BASE_GROUPS, ...lenses.flatMap((l) => l.groups)];
  return all.find((g) => g.key === key)?.label ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function slugKey(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 32) || 'group'
  );
}
