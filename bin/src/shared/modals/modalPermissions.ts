import { modalManager } from './modalManager';
import type { ModalPermission, ModalType } from './modalManager';

//src/shared/modals/modalPermissions.ts

export const MULTIPLE_MENUS_DISABLED = '⚠ <br/>opening multiple menus is disabled';

const exclusiveMenuPermission = (allowDuplicateThemes = false): ModalPermission['canOpen'] => state => {
  if (state.settings.allowMultipleMenus) return { allowed: true };
  if (allowDuplicateThemes && state.settings.allowDuplicateMenus && state.openModals.some(modal => modal.type === 'themes')) {
    return { allowed: true };
  }
  if (state.openModals.length > 0) {
    return { allowed: false, reason: MULTIPLE_MENUS_DISABLED };
  }
  return { allowed: true };
};

const alwaysAllowed: ModalPermission['canOpen'] = () => ({ allowed: true });

// This exhaustive table is the single source of truth for modal permissions.
// Adding a ModalType without adding a policy here is a compile-time error.
const modalPolicies: Record<ModalType, ModalPermission['canOpen']> = {
  settings: exclusiveMenuPermission(),
  themes: exclusiveMenuPermission(true),
  export: exclusiveMenuPermission(),
  torusMenuEditor: exclusiveMenuPermission(),
  playneedleEditor: exclusiveMenuPermission(),
  colorPicker: alwaysAllowed,
  rollDialog: alwaysAllowed,
  shaderSelector: exclusiveMenuPermission(),
};

export function registerModalPermissions(): void {
  (Object.keys(modalPolicies) as ModalType[]).forEach(id => {
    modalManager.registerPermission({ id, canOpen: modalPolicies[id] });
  });
}