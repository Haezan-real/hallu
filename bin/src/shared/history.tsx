import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';

//src/shared/history.tsx

export type AppSnapshot = Record<string, unknown>; // opaque snapshot type (App decides structure)

export type HistoryAction = 'push' | 'undo' | 'redo' | 'clear';

export function logHistoryAction(
  scope: string,
  action: HistoryAction,
  detail?: Record<string, unknown>,
) {
  console.log(`[history:${scope}] ${action}`, {
    ...detail,
    timestamp: new Date().toISOString(),
  });
}

type HistoryStack<T> = {
  push: (snapshot: T) => void;
  undo: (currentSnapshot: T, restore: (snap: T) => void) => void;
  redo: (currentSnapshot: T, restore: (snap: T) => void) => void;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

function useHistoryStack<T>(scope: string, max = 200): HistoryStack<T> {
  const [undoStack, setUndoStack] = useState<T[]>([]);
  const [redoStack, setRedoStack] = useState<T[]>([]);
  const undoStackRef = useRef<T[]>([]);
  const redoStackRef = useRef<T[]>([]);

  const setStacks = useCallback((nextUndo: T[], nextRedo: T[]) => {
    undoStackRef.current = nextUndo;
    redoStackRef.current = nextRedo;
    setUndoStack(nextUndo);
    setRedoStack(nextRedo);
  }, []);

  const push = useCallback((snapshot: T) => {
    const previous = undoStackRef.current;
    const next = previous.concat([snapshot]);
    const nextUndoStack = next.length > max ? next.slice(next.length - max) : next;
    logHistoryAction(scope, 'push', {
      undoDepthBefore: previous.length,
      undoDepthAfter: nextUndoStack.length,
    });
    setStacks(nextUndoStack, []);
  }, [scope, max, setStacks]);

  // Pops the newest snapshot from `from` and moves the current snapshot onto `to`
  const step = useCallback((action: 'undo' | 'redo', currentSnapshot: T, restore: (snap: T) => void) => {
    const from = action === 'undo' ? undoStackRef.current : redoStackRef.current;
    const to = action === 'undo' ? redoStackRef.current : undoStackRef.current;
    if (from.length === 0) {
      logHistoryAction(scope, action, { result: 'noop', reason: `empty ${action} stack` });
      return;
    }
    const remaining = from.slice(0, -1);
    const toRestore = from[from.length - 1];
    const nextTo = to.concat([currentSnapshot]);
    logHistoryAction(scope, action, { depthAfter: remaining.length });
    if (action === 'undo') setStacks(remaining, nextTo);
    else setStacks(nextTo, remaining);
    restore(toRestore);
  }, [scope, setStacks]);

  const undo = useCallback((currentSnapshot: T, restore: (snap: T) => void) => step('undo', currentSnapshot, restore), [step]);
  const redo = useCallback((currentSnapshot: T, restore: (snap: T) => void) => step('redo', currentSnapshot, restore), [step]);

  const clear = useCallback(() => {
    logHistoryAction(scope, 'clear', {
      undoDepthBefore: undoStackRef.current.length,
      redoDepthBefore: redoStackRef.current.length,
    });
    setStacks([], []);
  }, [scope, setStacks]);

  return useMemo(() => ({
    push,
    undo,
    redo,
    clear,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  }), [push, undo, redo, clear, undoStack.length, redoStack.length]);
}

export function useLocalHistory<T>(scope: string, max = 200): HistoryStack<T> {
  return useHistoryStack<T>(scope, max);
}

type HistoryContextType = HistoryStack<AppSnapshot>;

const HistoryContext = createContext<HistoryContextType | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const value = useHistoryStack<AppSnapshot>('app');
  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory must be used within a HistoryProvider');
  return ctx;
}

export default HistoryProvider;
