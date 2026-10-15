//src/modals/styles/styleCatalog.ts
// Folder icon and titles for the Styles browser, which mirrors the user/styles folder
import type { StyleLibrary, StyleLibraryItem } from '../../shared/platform/electronApi';

export const folderIcon = 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2z';

export function getPathLabel(library: StyleLibrary, itemId: string | null): string {
  if (!itemId) return 'Styles';
  const path: string[] = [];
  let currentId: string | null = itemId;
  while (currentId) {
    const item: StyleLibraryItem | undefined = library.items[currentId];
    if (!item) break;
    path.unshift(item.label);
    currentId = item.parent;
  }
  const fullPath = 'Styles / ' + path.join(' / ');

  // If the path is too long, truncate the beginning with ellipsis
  if (fullPath.length > 40) {
    return '.../' + path.slice(-2).join(' / ');
  }
  return fullPath;
}
