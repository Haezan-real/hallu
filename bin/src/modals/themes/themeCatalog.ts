//src/modals/themes/themeCatalog.ts
// Folder icon and titles for the Themes browser, which mirrors the user/themes folder
import type { ThemeLibrary, ThemeLibraryItem } from '../../shared/platform/electronApi';

export const folderIcon = 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2z';

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
