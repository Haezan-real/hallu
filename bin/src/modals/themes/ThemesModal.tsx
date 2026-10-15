//src/modals/themes/ThemesModal.tsx
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

// Modal dimensions for the Themes page
const MODAL_WIDTH = '480px';
const MODAL_HEIGHT = '72vh';

function savedThemePage(): string | null {
  const saved = readModalPageState('themes') as { themePage?: unknown } | undefined;
  return typeof saved?.themePage === 'string' && saved.themePage in getThemeLibrary().items ? saved.themePage : null;
}

function parentOf(page: string): string | null {
  return getThemeLibrary().items[page]?.parent ?? null;
}

export default function ThemesModal({ modalId, initialPage, onClose }: {
  modalId: number;
  initialPage?: string | null;
  onClose: () => void;
}) {
  const library = useThemeLibrary();
  const [selectedPage, setThemePage] = useState<string | null>(() => initialPage !== undefined ? initialPage : savedThemePage());
  const [activeTheme, setActiveThemeState] = useState(getActiveTheme);

  // A page whose folder or theme file was deleted falls back to the top level
  const themePage = selectedPage && library.items[selectedPage] ? selectedPage : null;
  const currentItem = themePage ? library.items[themePage] : undefined;

  // The exit shortcut steps back to the parent page before closing the modal
  const themePageRef = useRef(themePage);
  themePageRef.current = themePage;
  useEffect(() => {
    modalManager.registerBack(modalId, () => {
      const page = themePageRef.current;
      if (!page) return false;
      setThemePage(parentOf(page));
      return true;
    });
  }, [modalId]);

  const selectTheme = (themeId: string) => {
    if (activeTheme === themeId) {
      setThemePage(themeId);
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
        onClick={() => item.type === 'folder' ? setThemePage(item.id) : selectTheme(item.id)}
      />
    );
  });

  return (
    <DraggableModal
      title={getPathLabel(library, themePage)}
      onClose={onClose}
      className="settings-modal"
      style={{ width: MODAL_WIDTH, height: MODAL_HEIGHT, minHeight: MODAL_HEIGHT, maxHeight: MODAL_HEIGHT, overflow: 'hidden' }}
      persistenceKey="themes"
      pageState={{ themePage, activeTheme }}
      headerLeft={themePage && <BackButton onClick={() => setThemePage(parentOf(themePage))} />}
      body={
        <>
          {!themePage && <IconTileGrid>{renderTiles(library.topLevel)}</IconTileGrid>}
          {currentItem?.type === 'folder' && <IconTileGrid rowGap={4}>{renderTiles(currentItem.children)}</IconTileGrid>}
          {currentItem?.type === 'theme' && themePage && (
            <ThemeColorEditor themeName={themePage} closeThemes={onClose} reopenThemes={() => OpenThemes(themePage)} />
          )}
        </>
      }
    />
  );
}

export function OpenThemes(initialPage?: string | null) {
  return openModal('themes', (close, modalId) => <ThemesModal modalId={modalId} initialPage={initialPage} onClose={close} />);
}
