//src/shared/ui/blockingDialogs.ts

// Open blocking dialogs, newest last: the exit shortcut closes the newest, and the background stays locked while any are open
const closers: (() => void)[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

/** Returns the function that unregisters it, once the dialog is gone */
export function registerBlockingDialog(close: () => void): () => void {
  closers.push(close);
  emit();
  return () => {
    const index = closers.lastIndexOf(close);
    if (index === -1) return;
    closers.splice(index, 1);
    emit();
  };
}

/** Exit shortcut: closes the newest blocking dialog. Returns whether there was one */
export function closeTopBlockingDialog(): boolean {
  const close = closers[closers.length - 1];
  if (!close) return false;
  close();
  return true;
}

export function hasBlockingDialog(): boolean {
  return closers.length > 0;
}

export function subscribeBlockingDialogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
