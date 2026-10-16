//src/modals/styles/StylesModal.tsx
import { useState, useEffect } from 'react';
import BackButton from '../../shared/ui/BackButton';
import { IconTile, IconTileGrid, PREVIEW_TILE_WIDTH, PreviewTile } from '../../shared/ui/IconTile';
import { readModalPageState, writeModalPageState } from '../../shared/modals/modalPageState';
import { closePanel, defineToolPanel, openPanel, usePanelBack } from '../../shared/panels/openPanel';
import { folderIcon, getPathLabel } from './styleCatalog';
import StyleTileIcon from './StyleTileIcon';
import { getStyleLibrary, useStyleLibrary } from './styleLibrary';
import { getActiveStyle, setActiveStyle } from './activeStyle';

const PAGE_STATE_KEY = 'styles';

function savedStylePage(): string | null {
  const saved = readModalPageState(PAGE_STATE_KEY) as { stylePage?: unknown } | undefined;
  return typeof saved?.stylePage === 'string' && saved.stylePage in getStyleLibrary().items ? saved.stylePage : null;
}

function parentOf(page: string): string | null {
  return getStyleLibrary().items[page]?.parent ?? null;
}

/** Picks the app's style; each pick repaints the real UI and its shader right away */
export default function Styles() {
  const library = useStyleLibrary();
  const [selectedPage, setStylePage] = useState<string | null>(savedStylePage);
  const [activeStyle, setActiveStyleState] = useState(getActiveStyle);

  // Pages are folders; one that was deleted falls back to the top level
  const selectedItem = selectedPage ? library.items[selectedPage] : undefined;
  const currentFolder = selectedItem?.type === 'folder' ? selectedItem : undefined;
  const stylePage = currentFolder ? selectedPage : null;

  useEffect(() => {
    writeModalPageState(PAGE_STATE_KEY, { stylePage, activeStyle });
  }, [stylePage, activeStyle]);

  // The exit shortcut steps back to the parent page before closing the panel
  usePanelBack(() => {
    if (!stylePage) return false;
    setStylePage(parentOf(stylePage));
    return true;
  });

  const selectStyle = (styleId: string) => {
    if (activeStyle === styleId) return;
    setActiveStyleState(styleId);
    setActiveStyle(styleId);
  };

  const renderTiles = (itemIds: string[]) => itemIds.map(itemId => {
    const item = library.items[itemId];
    if (!item) return null;
    if (item.type === 'folder') {
      return <IconTile key={item.id} label={item.label} icon={folderIcon} onClick={() => setStylePage(item.id)} />;
    }
    return (
      <PreviewTile
        key={item.id}
        label={item.label}
        preview={<StyleTileIcon style={item} />}
        active={activeStyle === item.id}
        onClick={() => selectStyle(item.id)}
      />
    );
  });

  return (
    <div className="styles-root">
      {stylePage && (
        <div className="tool-panel-nav">
          <BackButton onClick={() => setStylePage(parentOf(stylePage))} />
          <span className="panel-title">{getPathLabel(library, stylePage)}</span>
        </div>
      )}
      {currentFolder
        ? <IconTileGrid rowGap={4} columnWidth={PREVIEW_TILE_WIDTH} justify>{renderTiles(currentFolder.children)}</IconTileGrid>
        : <IconTileGrid columnWidth={PREVIEW_TILE_WIDTH} justify>{renderTiles(library.topLevel)}</IconTileGrid>}
    </div>
  );
}

defineToolPanel('styles', { title: 'Styles', component: Styles });

/** Opens Styles, or focuses it if it's open */
export function OpenStyles() {
  const id = openPanel('styles');
  return id ? () => closePanel(id) : undefined;
}
