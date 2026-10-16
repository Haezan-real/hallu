//src/shared/ui/blockingDialogs.ts

// How many blocking dialogs are open; the background stays locked while any are
let open = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

/** Returns the function that unregisters it, once the dialog is gone */
export function registerBlockingDialog(): () => void {
  open++;
  emit();
  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    open--;
    emit();
  };
}

export function hasBlockingDialog(): boolean {
  return open > 0;
}

export function subscribeBlockingDialogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
