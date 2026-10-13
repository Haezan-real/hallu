//src/modals/themes/themeCatalog.ts
// The folders and themes shown in the Styles browser

const folderIcon = 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2z';
const ogDarkIcon = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';
const ogLightIcon = 'M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z';
const monokaiIcon = 'm8 6-6 6 6 6M16 6l6 6-6 6';
const lavenderIcon = 'M12 22V8M9 11l3-3 3 3M10 11c0 1 1 2 2 2s2-1 2-2M10 8c0 1 1 2 2 2s2-1 2-2M9 5c0 1 1 2 3 2s3-1 3-2M11 14c0-1 1-2 1-3s-1-2-1-3M13 14c0-1-1-2-1-3s1-2 1-3';
const cyberpunkIcon = 'M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3M6 6h12v12H6zM10 10h4v4h-4z';
const oakIcon = 'M5 8a7 3 0 0 1 14 0v10a7 3 0 0 1-14 0V8zM8 8a4 1.5 0 0 1 8 0 4 1.5 0 0 1-8 0zM10 8a2 0.7 0 0 1 4 0 2 0.7 0 0 1-4 0z';
const forestIcon = 'M12 2L6 10h3l-4 6h3l-3 5h14l-3-5h3l-4-6h3L12 2zM10 21h4';
const aquaticIcon = 'M12 12c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7zm-5 0c0-2.5 2-4.5 4.5-4.5S11 9.5 11 12s-2 4.5-4.5 4.5S2 14.5 2 12zm10 0c0-1.5 1-3 3-3s3 1.5 3 3-1 3-3 3-3-1.5-3-3z';

export interface CatalogItem {
  id: string;
  label: string;
  type: 'theme' | 'folder';
  icon: string;
  children?: string[];
}

export const topLevelItems: string[] = ['vynelox-built-in-folder'];

export const catalogItems: Record<string, CatalogItem> = {
  'vynelox-built-in-folder': { id: 'vynelox-built-in-folder', label: 'By Vynelox', type: 'folder', icon: folderIcon, children: ['og-dark', 'og-light', 'monokai', 'lavender', 'cyberpunk', 'oak', 'forest', 'aquatic'] },
  'og-dark': { id: 'og-dark', label: 'og dark', type: 'theme', icon: ogDarkIcon },
  'og-light': { id: 'og-light', label: 'og light', type: 'theme', icon: ogLightIcon },
  'monokai': { id: 'monokai', label: 'monokai', type: 'theme', icon: monokaiIcon },
  'lavender': { id: 'lavender', label: 'lavender', type: 'theme', icon: lavenderIcon },
  'cyberpunk': { id: 'cyberpunk', label: 'cyberpunk', type: 'theme', icon: cyberpunkIcon },
  'oak': { id: 'oak', label: 'oak', type: 'theme', icon: oakIcon },
  'forest': { id: 'forest', label: 'forest', type: 'theme', icon: forestIcon },
  'aquatic': { id: 'aquatic', label: 'aquatic', type: 'theme', icon: aquaticIcon },
};

export const parentMap: Record<string, string | undefined> = Object.fromEntries(
  Object.values(catalogItems).flatMap(item => (item.children ?? []).map(childId => [childId, item.id])),
);

export function getPathLabel(itemId: string | null): string {
  if (!itemId) return 'Styles';
  const path: string[] = [];
  let currentId: string | undefined = itemId;
  while (currentId) {
    const item: CatalogItem | undefined = catalogItems[currentId];
    if (!item) break;
    path.unshift(item.label);
    currentId = parentMap[currentId];
  }
  const fullPath = 'Styles / ' + path.join(' / ');

  // If the path is too long, truncate the beginning with ellipsis
  if (fullPath.length > 40) {
    return '.../' + path.slice(-2).join(' / ');
  }
  return fullPath;
}
