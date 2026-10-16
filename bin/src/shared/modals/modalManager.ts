import { onSettingChange, readSetting } from '../../modals/settings/settingsStore';
import { canOpenPanel, type PanelKind } from '../panels/panelPolicies';

//src/shared/modals/modalManager.ts

/** Modals share the panel kinds and their policies (panelPolicies.ts) */
export type ModalType = PanelKind;

export interface ModalManagerState {
  openModals: ModalInstance[];
  settings: {
    allowMultipleMenus: boolean;
    allowEditsWhenMenuOpen: boolean;
  };
}

export interface ModalInstance {
  id: number;
  type: ModalType;
}

interface ModalRegistration extends ModalInstance {
  close?: () => void;
  // Steps back one page inside the modal; returns false when already on its first page
  back?: () => boolean;
}

interface ModalRequest {
  allowed: boolean;
  reason?: string;
  id?: number;
}

class ModalManager {
  private state: ModalManagerState = {
    openModals: [],
    settings: {
      allowMultipleMenus: readSetting('allowMultipleMenus'),
      allowEditsWhenMenuOpen: readSetting('allowEditsWhenMenuOpen'),
    }
  };
  
  private listeners: Set<(state: ModalManagerState) => void> = new Set();
  private instances: ModalRegistration[] = [];
  private nextInstanceId = 1;
  private openPanelKinds: () => readonly PanelKind[] = () => [];
  
  constructor() {
    (['allowMultipleMenus', 'allowEditsWhenMenuOpen'] as const).forEach(key => {
      onSettingChange(key, value => {
        this.state.settings[key] = value;
        this.notifyListeners();
      });
    });
  }
  
  // Subscribe to state changes
  subscribe(listener: (state: ModalManagerState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  // Get current state
  getState(): ModalManagerState {
    return this.state;
  }

  /** Lets the panel registry's open tools count against the menu policy too */
  setOpenPanelsSource(source: () => readonly PanelKind[]) {
    this.openPanelKinds = source;
  }

  /** Kinds of every open modal, oldest first */
  openKinds(): PanelKind[] {
    return this.instances.map(instance => instance.type);
  }
  
  // Request to open a modal - returns whether it's allowed and optional reason
  requestOpen(modalType: ModalType): ModalRequest {
    const result = canOpenPanel(
      modalType,
      [...this.openKinds(), ...this.openPanelKinds()],
      this.state.settings.allowMultipleMenus,
    );
    if (!result.allowed) return result;
    
    const id = this.nextInstanceId++;
    this.instances.push({ id, type: modalType });
    this.state.openModals = [...this.state.openModals, { id, type: modalType }];
    this.notifyListeners();
    return { allowed: true, id };
  }

  registerClose(id: number, close: () => void): void {
    const instance = this.instances.find(item => item.id === id);
    if (instance) instance.close = close;
  }

  registerBack(id: number, back: () => boolean): void {
    const instance = this.instances.find(item => item.id === id);
    if (instance) instance.back = back;
  }

  unregister(id: number): void {
    this.removeInstance(id);
  }

  close(modalType: ModalType) {
    const instance = [...this.instances].reverse().find(item => item.type === modalType);
    if (instance) this.closeInstance(instance.id);
  }

  closeInstance(id: number): void {
    const instance = this.instances.find(item => item.id === id);
    if (!instance) return;
    this.removeInstance(id);
    instance.close?.();
  }

  closeTop(): boolean {
    const instance = this.instances[this.instances.length - 1];
    if (!instance) return false;
    this.closeInstance(instance.id);
    return true;
  }

  // Exit shortcut: back out of the top modal's sub-page if it has one, otherwise close it
  exitTop(): boolean {
    const instance = this.instances[this.instances.length - 1];
    if (!instance) return false;
    if (!instance.back?.()) this.closeInstance(instance.id);
    return true;
  }
  
  // Check if a specific modal is open
  isOpen(modalType: ModalType): boolean {
    return this.state.openModals.some(instance => instance.type === modalType);
  }
  
  // Get count of how many times a specific modal is open
  getOpenCount(modalType: ModalType): number {
    return this.instances.filter(instance => instance.type === modalType).length;
  }

  private removeInstance(id: number): void {
    const index = this.instances.findIndex(instance => instance.id === id);
    if (index === -1) return;
    this.instances.splice(index, 1);
    this.state.openModals = this.state.openModals.filter(instance => instance.id !== id);
    this.notifyListeners();
  }
  
  // Notify all listeners of state change
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }
}

// Singleton instance
export const modalManager = new ModalManager();
