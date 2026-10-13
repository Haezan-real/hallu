//src/modals/themes/StylesModal.tsx
import { useState, useEffect, useRef } from 'react';
import DraggableModal from '../../shared/ui/DraggableModal';
import BackButton from '../../shared/ui/BackButton';
import { IconTile, IconTileGrid } from '../../shared/ui/IconTile';
import { openModal } from '../../shared/modals/openModal';
import { modalManager } from '../../shared/modals/modalManager';
import { readModalPageState } from '../../shared/modals/modalPageState';
import { catalogItems, getPathLabel, parentMap, topLevelItems } from './themeCatalog';
import { getActiveTheme, setActiveTheme } from './themes';
import ThemeColorEditor from './ThemeColorEditor';

// Modal dimensions for the Styles page
const MODAL_WIDTH = '480px';
const MODAL_HEIGHT = '72vh';

function savedStylePage(): string | null {
  const saved = readModalPageState('styles') as { stylePage?: unknown } | undefined;
  return typeof saved?.stylePage === 'string' && saved.stylePage in catalogItems ? saved.stylePage : null;
}

export default function StylesModal({ modalId, initialPage, onClose }: {
  modalId: number;
  initialPage?: string | null;
  onClose: () => void;
}) {
  const [stylePage, setStylePage] = useState<string | null>(() => initialPage !== undefined ? initialPage : savedStylePage());
  const [activeTheme, setActiveThemeState] = useState(getActiveTheme);

  // The exit shortcut steps back to the parent page before closing the modal
  const stylePageRef = useRef(stylePage);
  stylePageRef.current = stylePage;
  useEffect(() => {
    modalManager.registerBack(modalId, () => {
      const page = stylePageRef.current;
      if (!page) return false;
      setStylePage(parentMap[page] || null);
      return true;
    });
  }, [modalId]);

  const currentItem = stylePage ? catalogItems[stylePage] : undefined;

  const selectTheme = (themeId: string) => {
    if (activeTheme === themeId) {
      setStylePage(themeId);
      return;
    }
    setActiveThemeState(themeId);
    setActiveTheme(themeId);
  };

  return (
    <DraggableModal
      title={getPathLabel(stylePage)}
      onClose={onClose}
      className="settings-modal"
      style={{ width: MODAL_WIDTH, height: MODAL_HEIGHT, minHeight: MODAL_HEIGHT, maxHeight: MODAL_HEIGHT, overflow: 'hidden' }}
      persistenceKey="styles"
      pageState={{ stylePage, activeTheme }}
      headerLeft={stylePage && <BackButton onClick={() => setStylePage(parentMap[stylePage] || null)} />}
      body={
        <>
          {!stylePage && (
            <IconTileGrid>
              {topLevelItems.map(itemId => {
                const item = catalogItems[itemId];
                return item && <IconTile key={item.id} label={item.label} icon={item.icon} onClick={() => setStylePage(item.id)} />;
              })}
            </IconTileGrid>
          )}
          {currentItem?.type === 'folder' && (
            <IconTileGrid rowGap={4}>
              {currentItem.children?.map(childId => {
                const child = catalogItems[childId];
                if (!child) return null;
                return (
                  <IconTile
                    key={child.id}
                    label={child.label}
                    icon={child.icon}
                    active={activeTheme === child.id}
                    onClick={() => child.type === 'folder' ? setStylePage(child.id) : selectTheme(child.id)}
                  />
                );
              })}
            </IconTileGrid>
          )}
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
