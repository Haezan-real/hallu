//src/modals/themes/themeCatalog.ts
// Icons and titles for the Themes browser, which mirrors the user/themes folder
import type { ThemeLibrary, ThemeLibraryItem } from '../../shared/platform/electronApi';

const folderIcon = 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2z';
const paletteIcon = 'M12 22a10 10 0 1 1 10-10c0 2.5-2 4-4 4h-2a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 13.3 22H12zM7.5 11.5h.01M10.5 7.5h.01M15.5 8.5h.01';

// Hand-drawn icons for the built-in themes; any other theme gets the palette icon
const defaultThemeIcons: Record<string, string> = {
  'default/og-dark': 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  'default/og-light': 'M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  'default/monokai': 'm8 6-6 6 6 6M16 6l6 6-6 6',
  'default/lavender': 'M12 22V8M9 11l3-3 3 3M10 11c0 1 1 2 2 2s2-1 2-2M10 8c0 1 1 2 2 2s2-1 2-2M9 5c0 1 1 2 3 2s3-1 3-2M11 14c0-1 1-2 1-3s-1-2-1-3M13 14c0-1-1-2-1-3s1-2 1-3',
  'default/cyberpunk': 'M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3M6 6h12v12H6zM10 10h4v4h-4z',
  'default/oak': 'M5 8a7 3 0 0 1 14 0v10a7 3 0 0 1-14 0V8zM8 8a4 1.5 0 0 1 8 0 4 1.5 0 0 1-8 0zM10 8a2 0.7 0 0 1 4 0 2 0.7 0 0 1-4 0z',
  'default/forest': 'M12 2L6 10h3l-4 6h3l-3 5h14l-3-5h3l-4-6h3L12 2zM10 21h4',
  'default/aquatic': 'M12 12c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7zm-5 0c0-2.5 2-4.5 4.5-4.5S11 9.5 11 12s-2 4.5-4.5 4.5S2 14.5 2 12zm10 0c0-1.5 1-3 3-3s3 1.5 3 3-1 3-3 3-3-1.5-3-3z',
};

export function catalogIcon(item: ThemeLibraryItem): string {
  if (item.type === 'folder') return folderIcon;
  return defaultThemeIcons[item.id] ?? paletteIcon;
}

export function getPathLabel(library: ThemeLibrary, itemId: string | null): string {
  if (!itemId) return 'Themes';
  const path: string[] = [];
  let currentId: string | null = itemId;
  while (currentId) {
    const item: ThemeLibraryItem | undefined = library.items[currentId];
    if (!item) break;
    path.unshift(item.label);
    currentId = item.parent;
  }
  const fullPath = 'Themes / ' + path.join(' / ');

  // If the path is too long, truncate the beginning with ellipsis
  if (fullPath.length > 40) {
    return '.../' + path.slice(-2).join(' / ');
  }
  return fullPath;
}
