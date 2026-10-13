import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { modalManager, type ModalType } from './modalManager';
import { MULTIPLE_MENUS_DISABLED } from './modalPermissions';
import { showToast } from '../ui/Toast';

//src/shared/modals/openModal.tsx

// Renders into its own root on document.body; the returned function unmounts it
export function mountDetached(render: (unmount: () => void) => ReactNode): () => void {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let mounted = true;
  const unmount = () => {
    if (!mounted) return;
    mounted = false;
    root.unmount();
    container.remove();
  };
  root.render(render(unmount));
  return unmount;
}

// Opens a modal if the modal manager allows it; `close` unmounts it and frees its slot
export function openModal(type: ModalType, render: (close: () => void, modalId: number) => ReactNode): (() => void) | undefined {
  const result = modalManager.requestOpen(type);
  if (!result.allowed) {
    showToast(result.reason || MULTIPLE_MENUS_DISABLED);
    return undefined;
  }
  const id = result.id!;
  let unmount = () => {};
  const close = () => {
    modalManager.unregister(id);
    unmount();
  };
  modalManager.registerClose(id, close);
  unmount = mountDetached(() => render(close, id));
  return close;
}
