import { useSyncExternalStore } from 'react';
import { BUILT_IN_LENSES } from './lenses';
import type { Lens } from './types';

/**
 * Browser-only settings. The Gemini key never leaves this browser except in
 * requests to Google.
 */

const KEYS = {
  geminiKey: 'designshelf.geminiKey',
  models: 'designshelf.models',
  defaultLens: 'designshelf.lens.default',
  customLenses: 'designshelf.lenses.custom',
  fastMode: 'designshelf.fast',
} as const;

export interface ModelChoice {
  generate?: string;
  embed?: string;
}

export interface Settings {
  geminiKey: string;
  models: ModelChoice;
  defaultLensId: string;
  customLenses: Lens[];
  /** Turn the model's thinking down for quicker replies. */
  fastMode: boolean;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeKey(key: string, value: unknown) {
  try {
    if (value === undefined || value === '') localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the setting lasts for this visit only.
  }
}

let current: Settings = {
  geminiKey: read(KEYS.geminiKey, ''),
  models: read(KEYS.models, {}),
  defaultLensId: read(KEYS.defaultLens, 'general'),
  customLenses: read(KEYS.customLenses, []),
  fastMode: read(KEYS.fastMode, true),
};

const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  if ('geminiKey' in patch) writeKey(KEYS.geminiKey, patch.geminiKey?.trim());
  if ('models' in patch) writeKey(KEYS.models, patch.models);
  if ('defaultLensId' in patch) writeKey(KEYS.defaultLens, patch.defaultLensId);
  if ('customLenses' in patch) writeKey(KEYS.customLenses, patch.customLenses);
  if ('fastMode' in patch) writeKey(KEYS.fastMode, patch.fastMode);
  listeners.forEach((l) => l());
}

export function subscribeSettings(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings);
}

export function allLenses(s: Settings = current): Lens[] {
  return [...BUILT_IN_LENSES, ...s.customLenses];
}

export function findLens(id: string, s: Settings = current): Lens {
  return allLenses(s).find((l) => l.id === id) ?? BUILT_IN_LENSES[0];
}

export function clearSettings() {
  Object.values(KEYS).forEach((k) => writeKey(k, undefined));
  current = { geminiKey: '', models: {}, defaultLensId: 'general', customLenses: [], fastMode: true };
  listeners.forEach((l) => l());
}
