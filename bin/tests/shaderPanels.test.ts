import { afterEach, describe, expect, it } from 'vitest';
import { measureShaderPanels, MAX_SHADER_PANELS, registerShaderPanel, SHADER_PANEL_KIND } from '../src/features/shaders/shaderPanels';

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

const placed = <T extends Element>(element: T, bounds: DOMRect) => {
  element.getBoundingClientRect = () => bounds;
  return element;
};

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
  document.body.innerHTML = '';
});

describe('measureShaderPanels', () => {
  it('reports a framed panel by its frame, with the header height above its content', () => {
    const canvas = placed(document.createElement('canvas'), rect(0, 0, 1000, 800));
    canvas.width = 2000;
    canvas.height = 1600;
    const group = placed(document.createElement('div'), rect(100, 50, 400, 300));
    group.className = 'group';
    const content = placed(document.createElement('div'), rect(100, 80, 400, 270));
    group.append(content);
    document.body.append(canvas, group);
    cleanups.push(registerShaderPanel(content, SHADER_PANEL_KIND.viewer, '.group'));

    const rects = new Float32Array(MAX_SHADER_PANELS * 4);
    const info = new Int32Array(MAX_SHADER_PANELS * 4);
    expect(measureShaderPanels(canvas, rects, info)).toBe(1);
    // Canvas pixels are twice CSS pixels; y counts up from the bottom
    expect([...rects.slice(0, 4)]).toEqual([200, 900, 800, 600]);
    expect([...info.slice(0, 4)]).toEqual([SHADER_PANEL_KIND.viewer, 0, 60, 0]);
  });

  it('reports no header for a panel without a frame', () => {
    const canvas = placed(document.createElement('canvas'), rect(0, 0, 100, 100));
    canvas.width = 100;
    canvas.height = 100;
    const labels = placed(document.createElement('div'), rect(10, 10, 20, 50));
    document.body.append(canvas, labels);
    cleanups.push(registerShaderPanel(labels, SHADER_PANEL_KIND.timelineLabels));

    const info = new Int32Array(MAX_SHADER_PANELS * 4);
    measureShaderPanels(canvas, new Float32Array(MAX_SHADER_PANELS * 4), info);
    expect(info[2]).toBe(0);
  });
});
