//src/modals/styles/StylesModal.tsx
import { useState, useEffect, useRef } from 'react';
import DraggableModal from '../../shared/ui/DraggableModal';
import BackButton from '../../shared/ui/BackButton';
import { IconTile, IconTileGrid, PREVIEW_TILE_WIDTH, PreviewTile } from '../../shared/ui/IconTile';
import { openModal } from '../../shared/modals/openModal';
import { modalManager } from '../../shared/modals/modalManager';
import { readModalPageState } from '../../shared/modals/modalPageState';
import { folderIcon, getPathLabel } from './styleCatalog';
import StyleTileIcon from './StyleTileIcon';
import { getStyleLibrary, useStyleLibrary } from './styleLibrary';
import { getActiveStyle, setActiveStyle } from './activeStyle';

// Modal dimensions for the Styles page
const MODAL_WIDTH = '480px';
const MODAL_HEIGHT = '72vh';

function savedStylePage(): string | null {
  const saved = readModalPageState('styles') as { stylePage?: unknown } | undefined;
  return typeof saved?.stylePage === 'string' && saved.stylePage in getStyleLibrary().items ? saved.stylePage : null;
}

function parentOf(page: string): string | null {
  return getStyleLibrary().items[page]?.parent ?? null;
}

export default function StylesModal({ modalId, onClose }: { modalId: number; onClose: () => void }) {
  const library = useStyleLibrary();
  const [selectedPage, setStylePage] = useState<string | null>(savedStylePage);
  const [activeStyle, setActiveStyleState] = useState(getActiveStyle);

  // Pages are folders; one that was deleted falls back to the top level
  const selectedItem = selectedPage ? library.items[selectedPage] : undefined;
  const currentFolder = selectedItem?.type === 'folder' ? selectedItem : undefined;
  const stylePage = currentFolder ? selectedPage : null;

  // The exit shortcut steps back to the parent page before closing the modal
  const stylePageRef = useRef(stylePage);
  stylePageRef.current = stylePage;
  useEffect(() => {
    modalManager.registerBack(modalId, () => {
      const page = stylePageRef.current;
      if (!page) return false;
      setStylePage(parentOf(page));
      return true;
    });
  }, [modalId]);

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
    <DraggableModal
      title={getPathLabel(library, stylePage)}
      onClose={onClose}
      className="settings-modal"
      style={{ width: MODAL_WIDTH, height: MODAL_HEIGHT, minHeight: MODAL_HEIGHT, maxHeight: MODAL_HEIGHT, overflow: 'hidden' }}
      persistenceKey="styles"
      pageState={{ stylePage, activeStyle }}
      headerLeft={stylePage && <BackButton onClick={() => setStylePage(parentOf(stylePage))} />}
      body={
        currentFolder
          ? <IconTileGrid rowGap={4} columnWidth={PREVIEW_TILE_WIDTH} justify>{renderTiles(currentFolder.children)}</IconTileGrid>
          : <IconTileGrid columnWidth={PREVIEW_TILE_WIDTH} justify>{renderTiles(library.topLevel)}</IconTileGrid>
      }
    />
  );
}

export function OpenStyles() {
  return openModal('styles', (close, modalId) => <StylesModal modalId={modalId} onClose={close} />);
}
