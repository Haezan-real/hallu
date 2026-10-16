//src/shared/keyboard/keyRouter.ts
import { useContext, useEffect, useRef } from 'react';
import { DockPanelContext } from '../dock/dockPanel';

/** Returns true when it used the key, so nothing after it sees it */
export type KeyHandler = (e: KeyboardEvent) => boolean;

type KeyEventLike = Pick<KeyboardEvent, 'target' | 'preventDefault' | 'stopPropagation'>;

/** Keys typed into a text field (or any input, select or editable element) are never shortcuts */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.tagName !== 'string') return false;
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT' || element.isContentEditable === true;
}

function add(list: KeyHandler[], handler: KeyHandler): () => void {
  list.unshift(handler);
  return () => {
    const index = list.indexOf(handler);
    if (index !== -1) list.splice(index, 1);
  };
}

/**
 * Sends each key to blocking dialogs first, then to the focused dock panel, then to the global
 * shortcuts; the first handler that uses it stops it there. Within each, newer handlers go first.
 */
export class KeyRouter {
  private dialog: KeyHandler[] = [];
  private panels = new Map<string, KeyHandler[]>();
  private global: KeyHandler[] = [];
  private focusedPanel: () => string | null = () => null;

  /** Where the router learns which dock panel has the focus; the dock provides it once ready */
  setFocusSource(source: () => string | null) {
    this.focusedPanel = source;
  }

  registerDialog(handler: KeyHandler): () => void {
    return add(this.dialog, handler);
  }

  registerPanel(panelId: string, handler: KeyHandler): () => void {
    let list = this.panels.get(panelId);
    if (!list) this.panels.set(panelId, (list = []));
    const remove = add(list, handler);
    return () => {
      remove();
      if (list.length === 0 && this.panels.get(panelId) === list) this.panels.delete(panelId);
    };
  }

  registerGlobal(handler: KeyHandler): () => void {
    return add(this.global, handler);
  }

  /** Returns whether a handler used the key; if so its default action and propagation are stopped */
  route(e: KeyEventLike): boolean {
    if (isTypingTarget(e.target)) return false;
    const focused = this.focusedPanel();
    const chain = [...this.dialog, ...(focused ? this.panels.get(focused) ?? [] : []), ...this.global];
    for (const handler of chain) {
      if (!handler(e as KeyboardEvent)) continue;
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    return false;
  }
}

export const keyRouter = new KeyRouter();

/**
 * Listens on the window in the bubble phase, so an element that handles its own keys (a slider,
 * the shortcut recorder) and stops them gets them first
 */
export function installKeyRouter(target: Pick<Window, 'addEventListener' | 'removeEventListener'>, router = keyRouter): () => void {
  const listener = (e: KeyboardEvent) => { router.route(e); };
  target.addEventListener('keydown', listener);
  return () => target.removeEventListener('keydown', listener);
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** Keys for the dock panel this renders in, while that panel has the focus */
export function usePanelKeys(handler: KeyHandler) {
  const panel = useContext(DockPanelContext);
  const latest = useLatest(handler);
  useEffect(() => {
    if (!panel) return;
    return keyRouter.registerPanel(panel.id, e => latest.current(e));
  }, [panel, latest]);
}

/** Keys anything may use, once the focused panel has passed on them */
export function useGlobalKeys(handler: KeyHandler) {
  const latest = useLatest(handler);
  useEffect(() => keyRouter.registerGlobal(e => latest.current(e)), [latest]);
}

/** Keys for an open blocking dialog, ahead of every panel */
export function useDialogKeys(handler: KeyHandler) {
  const latest = useLatest(handler);
  useEffect(() => keyRouter.registerDialog(e => latest.current(e)), [latest]);
}
