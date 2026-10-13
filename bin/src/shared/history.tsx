import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { readSetting } from '../modals/settings/settingsStore';

//src/shared/history.tsx

export type AppSnapshot = Record<string, unknown>; // opaque snapshot type (App decides structure)

function snapshotMeta(snapshot: AppSnapshot): { type?: string } | undefined {
  return typeof snapshot.__meta === 'object' && snapshot.__meta !== null
    ? snapshot.__meta as { type?: string }
    : undefined;
}

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

interface HistoryOptions<T> {
  max?: number;
  // Snapshots matching this are stepped over (and carried to the other stack) on undo/redo
  shouldSkip?: (snapshot: T) => boolean;
}

function useHistoryStack<T>(scope: string, { max = 200, shouldSkip }: HistoryOptions<T> = {}): HistoryStack<T> {
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
      meta: (snapshot as AppSnapshot | undefined)?.__meta,
    });
    setStacks(nextUndoStack, []);
  }, [scope, max, setStacks]);

  // Pops the newest restorable snapshot from `from`, moving skipped ones and the current snapshot onto `to`
  const step = useCallback((action: 'undo' | 'redo', currentSnapshot: T, restore: (snap: T) => void) => {
    const from = action === 'undo' ? undoStackRef.current : redoStackRef.current;
    const to = action === 'undo' ? redoStackRef.current : undoStackRef.current;
    if (from.length === 0) {
      logHistoryAction(scope, action, { result: 'noop', reason: `empty ${action} stack` });
      return;
    }
    const remaining = [...from];
    const skipped: T[] = [];
    while (remaining.length > 0 && shouldSkip?.(remaining[remaining.length - 1])) {
      skipped.push(remaining.pop()!);
    }
    if (remaining.length === 0) {
      logHistoryAction(scope, action, { result: 'noop', reason: 'only skipped snapshots remaining' });
      return;
    }
    const toRestore = remaining.pop()!;
    const nextTo = to.concat([currentSnapshot], skipped.reverse());
    logHistoryAction(scope, action, { depthAfter: remaining.length, skippedSnapshots: skipped.length });
    if (action === 'undo') setStacks(remaining, nextTo);
    else setStacks(nextTo, remaining);
    restore(toRestore);
  }, [scope, shouldSkip, setStacks]);

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
  return useHistoryStack<T>(scope, { max });
}

type HistoryContextType = HistoryStack<AppSnapshot>;

const HistoryContext = createContext<HistoryContextType | null>(null);

const isSkippedResize = (snapshot: AppSnapshot) =>
  !readSetting('includeResizeInUndo') && snapshotMeta(snapshot)?.type === 'resize';

export function HistoryProvider({ children }: { children: ReactNode }) {
  const value = useHistoryStack<AppSnapshot>('app', { shouldSkip: isSkippedResize });
  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory must be used within a HistoryProvider');
  return ctx;
}

export default HistoryProvider;
