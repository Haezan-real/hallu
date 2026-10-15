//src/modals/styles/styleLibrary.ts
// The styles found under user/styles: loose theme files and shader packs, read by the main process
import { useSyncExternalStore } from 'react';
import type { StyleLibrary, StyleLibraryItem } from '../../shared/platform/electronApi';

export type StyleItem = Extract<StyleLibraryItem, { type: 'style' }>;

export const DEFAULT_STYLE = 'default/og-dark';
const DEFAULT_FOLDER = 'default';

let library: StyleLibrary = { topLevel: [], items: {}, problems: [] };
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getStyleLibrary(): StyleLibrary {
  return library;
}

export function useStyleLibrary(): StyleLibrary {
  return useSyncExternalStore(subscribe, getStyleLibrary);
}

// Broken theme files and pack manifests are reported and skipped
export async function loadStyleLibrary() {
  const api = window.electronAPI;
  if (!api) return;
  library = await api.loadStyles();
  for (const problem of library.problems) console.warn(`Skipping style ${problem.file}: ${problem.message}`);
  listeners.forEach(listener => listener());
}

const isStyle = (id: string) => library.items[id]?.type === 'style';

// Accepts style ids, and names saved by older versions: bare "forest", or "default/cyberpunk" for what is now the cyberpunk pack
export function resolveStyleId(styleId: string): string | null {
  if (isStyle(styleId)) return styleId;
  const name = styleId.split('/').pop() ?? styleId;
  if (isStyle(`${DEFAULT_FOLDER}/${name}`)) return `${DEFAULT_FOLDER}/${name}`;
  const match = Object.values(library.items).find(item => item.type === 'style' && item.id.split('/').pop() === name);
  return match?.id ?? null;
}

export function findStyle(styleId: string): StyleItem | undefined {
  const id = resolveStyleId(styleId);
  const item = id ? library.items[id] : undefined;
  return item?.type === 'style' ? item : undefined;
}
