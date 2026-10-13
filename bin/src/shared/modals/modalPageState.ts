//src/shared/modals/modalPageState.ts

const pageStateKey = (persistenceKey: string) => `hallu.modal.${persistenceKey}.pageState`;

export function readModalPageState(persistenceKey: string): unknown {
  try {
    const saved = window.localStorage.getItem(pageStateKey(persistenceKey));
    return saved ? JSON.parse(saved) : undefined;
  } catch {
    return undefined;
  }
}

export function writeModalPageState(persistenceKey: string, pageState: unknown): void {
  try { window.localStorage.setItem(pageStateKey(persistenceKey), JSON.stringify(pageState)); } catch {}
}
