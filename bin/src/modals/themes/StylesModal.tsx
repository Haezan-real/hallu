//src/modals/themes/StylesModal.tsx
import { useState, useEffect, useRef } from 'react';
import DraggableModal from '../../shared/ui/DraggableModal';
import BackButton from '../../shared/ui/BackButton';
import { IconTile, IconTileGrid } from '../../shared/ui/IconTile';
import { openModal } from '../../shared/modals/openModal';
import { modalManager } from '../../shared/modals/modalManager';
import { readModalPageState } from '../../shared/modals/modalPageState';
import { catalogIcon, getPathLabel } from './themeCatalog';
import { getActiveTheme, getThemeLibrary, setActiveTheme, useThemeLibrary } from './themes';
import ThemeColorEditor from './ThemeColorEditor';

// Modal dimensions for the Styles page
const MODAL_WIDTH = '480px';
const MODAL_HEIGHT = '72vh';

function savedStylePage(): string | null {
  const saved = readModalPageState('styles') as { stylePage?: unknown } | undefined;
  return typeof saved?.stylePage === 'string' && saved.stylePage in getThemeLibrary().items ? saved.stylePage : null;
}

function parentOf(page: string): string | null {
  return getThemeLibrary().items[page]?.parent ?? null;
}

export default function StylesModal({ modalId, initialPage, onClose }: {
  modalId: number;
  initialPage?: string | null;
  onClose: () => void;
}) {
  const library = useThemeLibrary();
  const [selectedPage, setStylePage] = useState<string | null>(() => initialPage !== undefined ? initialPage : savedStylePage());
  const [activeTheme, setActiveThemeState] = useState(getActiveTheme);

  // A page whose folder or theme file was deleted falls back to the top level
  const stylePage = selectedPage && library.items[selectedPage] ? selectedPage : null;
  const currentItem = stylePage ? library.items[stylePage] : undefined;

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

  const selectTheme = (themeId: string) => {
    if (activeTheme === themeId) {
      setStylePage(themeId);
      return;
    }
    setActiveThemeState(themeId);
    setActiveTheme(themeId);
  };

  const renderTiles = (itemIds: string[]) => itemIds.map(itemId => {
    const item = library.items[itemId];
    if (!item) return null;
    return (
      <IconTile
        key={item.id}
        label={item.label}
        icon={catalogIcon(item)}
        active={activeTheme === item.id}
        onClick={() => item.type === 'folder' ? setStylePage(item.id) : selectTheme(item.id)}
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
      pageState={{ stylePage, activeTheme }}
      headerLeft={stylePage && <BackButton onClick={() => setStylePage(parentOf(stylePage))} />}
      body={
        <>
          {!stylePage && <IconTileGrid>{renderTiles(library.topLevel)}</IconTileGrid>}
          {currentItem?.type === 'folder' && <IconTileGrid rowGap={4}>{renderTiles(currentItem.children)}</IconTileGrid>}
          {currentItem?.type === 'theme' && stylePage && (
            <ThemeColorEditor themeName={stylePage} closeStyles={onClose} reopenStyles={() => OpenStyles(stylePage)} />
          )}
        </>
      }
    />
  );
}

export function OpenStyles(initialPage?: string | null) {
  return openModal('styles', (close, modalId) => <StylesModal modalId={modalId} initialPage={initialPage} onClose={close} />);
}
