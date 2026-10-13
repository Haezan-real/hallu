import { useEffect } from 'react';

//src/platform/useSuppressContextMenu.ts

// Blocks the browser's right-click menu everywhere in the app
export function useSuppressContextMenu() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('mousedown', handleMouseDown, true);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, []);
}
