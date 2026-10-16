import { describe, expect, it } from 'vitest';
import { KeyRouter, installKeyRouter, isTypingTarget, type KeyHandler } from '../src/shared/keyboard/keyRouter';

function key(name: string, target: EventTarget | null = document.body) {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

/** A handler that records what it saw and uses only `uses` */
function recorder(log: string[], name: string, uses: string[]): KeyHandler {
  return e => {
    log.push(`${name}:${e.key}`);
    return uses.includes(e.key);
  };
}

function setup(focused: string | null = 'timeline') {
  const router = new KeyRouter();
  let current = focused;
  router.setFocusSource(() => current);
  return { router, focus: (id: string | null) => { current = id; } };
}

describe('key routing', () => {
  it('gives the focused panel the key first, and stops it there when used', () => {
    const { router } = setup();
    const log: string[] = [];
    router.registerGlobal(recorder(log, 'global', ['ArrowLeft']));
    router.registerPanel('timeline', recorder(log, 'timeline', ['ArrowLeft']));
    const event = key('ArrowLeft');
    expect(router.route(event)).toBe(true);
    expect(log).toEqual(['timeline:ArrowLeft']);
    expect(event.defaultPrevented).toBe(true);
  });

  it('lets keys the panel passes on fall through to the global shortcuts', () => {
    const { router } = setup();
    const log: string[] = [];
    router.registerGlobal(recorder(log, 'global', [' ']));
    router.registerPanel('timeline', recorder(log, 'timeline', ['ArrowLeft']));
    expect(router.route(key(' '))).toBe(true);
    expect(log).toEqual(['timeline: ', 'global: ']);
  });

  it('only asks the focused panel, and follows the focus as it moves', () => {
    const { router, focus } = setup('viewer');
    const log: string[] = [];
    router.registerPanel('timeline', recorder(log, 'timeline', ['ArrowLeft']));
    router.registerPanel('tool.torusMenuEditor', recorder(log, 'torus', ['q']));
    router.registerGlobal(recorder(log, 'global', ['q']));

    expect(router.route(key('ArrowLeft'))).toBe(false);
    router.route(key('q'));
    focus('tool.torusMenuEditor');
    router.route(key('q'));
    focus(null);
    router.route(key('q'));
    expect(log).toEqual(['global:ArrowLeft', 'global:q', 'torus:q', 'global:q']);
  });

  it('asks the newest handler of a panel first, e.g. a graph editor inside its editor', () => {
    const { router } = setup('tool.playneedleEditor');
    const log: string[] = [];
    router.registerPanel('tool.playneedleEditor', recorder(log, 'editor', ['z']));
    router.registerPanel('tool.playneedleEditor', recorder(log, 'graph', ['z']));
    router.route(key('z'));
    expect(log).toEqual(['graph:z']);
  });

  it('puts blocking dialogs ahead of the focused panel', () => {
    const { router } = setup();
    const log: string[] = [];
    router.registerPanel('timeline', recorder(log, 'timeline', ['Escape']));
    const closeDialog = router.registerDialog(recorder(log, 'dialog', ['Escape']));
    router.route(key('Escape'));
    closeDialog();
    router.route(key('Escape'));
    expect(log).toEqual(['dialog:Escape', 'timeline:Escape']);
  });

  it('never routes keys typed into inputs, text areas, selects or editable elements', () => {
    const { router } = setup();
    const log: string[] = [];
    router.registerPanel('timeline', recorder(log, 'timeline', [' ']));
    router.registerGlobal(recorder(log, 'global', [' ']));
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    for (const target of [document.createElement('input'), document.createElement('textarea'), document.createElement('select'), editable]) {
      const event = key(' ', target);
      expect(router.route(event)).toBe(false);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(log).toEqual([]);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
  });

  it('stops routing to handlers once they unregister', () => {
    const { router } = setup();
    const log: string[] = [];
    const remove = router.registerPanel('timeline', recorder(log, 'timeline', ['ArrowLeft']));
    remove();
    expect(router.route(key('ArrowLeft'))).toBe(false);
    expect(log).toEqual([]);
  });

  it('listens on the window after elements had their chance to stop the key', () => {
    const { router } = setup();
    const log: string[] = [];
    router.registerGlobal(recorder(log, 'global', ['z']));
    const uninstall = installKeyRouter(window, router);

    const recorderChip = document.createElement('div');
    document.body.appendChild(recorderChip);
    recorderChip.addEventListener('keydown', e => e.stopPropagation());
    recorderChip.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    uninstall();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    recorderChip.remove();

    expect(log).toEqual(['global:z']);
  });
});
