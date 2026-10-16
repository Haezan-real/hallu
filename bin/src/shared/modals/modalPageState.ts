//src/shared/modals/modalPageState.ts

const pageStateKey = (persistenceKey: string) => `hallu.modal.${persistenceKey}.pageState`;

export function readModalPageState(persistenceKey: string): unknown {
  let saved: string | null;
  try {
    saved = window.localStorage.getItem(pageStateKey(persistenceKey));
  } catch {
    return undefined;
  }
  if (!saved) return undefined;
  try {
    return JSON.parse(saved);
  } catch {
    // settings.json stores string states unquoted, and loading it back writes them as they are
    return saved;
  }
}

export function writeModalPageState(persistenceKey: string, pageState: unknown): void {
  try { window.localStorage.setItem(pageStateKey(persistenceKey), JSON.stringify(pageState)); } catch {}
}
