//src/panels/timeline/useTimelineScrollZoom.ts
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { isWheelShortcutMatch } from '../../modals/settings/shortcuts';
import { readSetting } from '../../modals/settings/settingsStore';
import { clampZoom, frameToX, xToFrame } from './timelineGeometry';

/**
 * Wheel handling for the timeline: momentum scrolling, and smooth zooming around
 * the playneedle, the cursor or the middle of the view (the zoom epicenter setting).
 */
export function useTimelineScrollZoom(
  scrollRef: RefObject<HTMLDivElement | null>,
  playheadRef: MutableRefObject<number>,
) {
  const [zoom, setZoom] = useState(1);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const zoomTargetRef = useRef(1);
  const zoomRafRef = useRef<number | null>(null);
  const zoomScrollElRef = useRef<HTMLElement | null>(null);
  const zoomMouseXRef = useRef(0);
  const zoomBeforeFrameRef = useRef(0);
  const zoomCurrentRef = useRef(1);
  const zoomAnimatingRef = useRef(false);
  const [zoomAnimTrigger, setZoomAnimTrigger] = useState(0);
  const playheadScrollTargetRef = useRef<number | null>(null);
  const pendingScrollCorrection = useRef<{ el: HTMLElement; scrollLeft: number } | null>(null);

  useEffect(() => {
    zoomCurrentRef.current = zoom;
    if (!zoomAnimatingRef.current) zoomTargetRef.current = zoom;
  }, [zoom]);

  // Scroll positions computed for a zoom step are applied once that zoom has rendered
  useLayoutEffect(() => {
    if (!pendingScrollCorrection.current) return;
    const { el, scrollLeft } = pendingScrollCorrection.current;
    pendingScrollCorrection.current = null;
    el.scrollLeft = scrollLeft;
  });

  useEffect(() => {
    if (zoomRafRef.current !== null) return;

    const animateZoom = () => {
      const currentZoom = zoomCurrentRef.current;
      const targetZoom = zoomTargetRef.current;
      const diff = targetZoom - currentZoom;
      const smoothness = readSetting('scrollZoomSmoothness');
      const t = smoothness === 0 ? 1 : Math.pow(1 - smoothness / 100, 2) * 0.96 + 0.04;
      const done = Math.abs(diff) < 0.0001;
      const clampedZoom = done ? targetZoom : clampZoom(currentZoom + diff * t);

      zoomCurrentRef.current = clampedZoom;
      zoomAnimatingRef.current = !done;

      if (zoomScrollElRef.current) {
        const el = zoomScrollElRef.current;
        const zoomEpicenter = readSetting('zoomEpicenter');

        let targetScrollLeft: number;
        if (zoomEpicenter === 'playneedle') {
          if (playheadScrollTargetRef.current !== null) {
            const currentScroll = el.scrollLeft;
            const scrollSmoothFactor = readSetting('scrollSmooth');
            const st = scrollSmoothFactor === 0 ? 1 : 0.02 + (1 - scrollSmoothFactor / 100) * 0.18;
            const newScroll = currentScroll + (playheadScrollTargetRef.current - currentScroll) * st;
            const playheadViewportX = frameToX(playheadRef.current, clampedZoom) - newScroll;
            if (playheadViewportX >= el.clientWidth * 0.25 && playheadViewportX <= el.clientWidth * 0.75) {
              playheadScrollTargetRef.current = null;
            }
            targetScrollLeft = Math.max(0, newScroll);
          } else {
            targetScrollLeft = Math.max(0, frameToX(zoomBeforeFrameRef.current, clampedZoom) - zoomMouseXRef.current);
          }
        } else if (zoomEpicenter === 'middle') {
          targetScrollLeft = Math.max(0, frameToX(zoomBeforeFrameRef.current, clampedZoom) - el.clientWidth / 2);
        } else {
          targetScrollLeft = Math.max(0, frameToX(zoomBeforeFrameRef.current, clampedZoom) - zoomMouseXRef.current);
        }

        pendingScrollCorrection.current = { el, scrollLeft: targetScrollLeft };
      }

      setZoom(clampedZoom);

      if (done) {
        zoomRafRef.current = null;
      } else {
        zoomRafRef.current = requestAnimationFrame(animateZoom);
      }
    };

    if (Math.abs(zoomTargetRef.current - zoomCurrentRef.current) > 0.001) {
      zoomRafRef.current = requestAnimationFrame(animateZoom);
    }
  }, [zoomAnimTrigger]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (zoomRafRef.current !== null) cancelAnimationFrame(zoomRafRef.current);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const momentum = () => {
      const vel = velocityRef.current;
      if (Math.abs(vel) > 0.5) {
        el.scrollLeft += vel;
        const friction = 0.92 + (readSetting('scrollSmooth') / 100) * 0.06;
        velocityRef.current = vel * friction;
        rafRef.current = requestAnimationFrame(momentum);
      } else {
        velocityRef.current = 0;
        rafRef.current = null;
      }
    };

    const handler = (e: WheelEvent) => {
      if (isWheelShortcutMatch('timelineZoomToggle', e)) {
        e.preventDefault();
        velocityRef.current = 0;

        const zoomScale = 1 + readSetting('scrollZoomAmount') / 100;
        const scale = e.deltaY < 0 ? zoomScale : 1 / zoomScale;
        const targetZoom = clampZoom(zoomTargetRef.current * scale);
        const zoomEpicenter = readSetting('zoomEpicenter');

        if (zoomEpicenter === 'playneedle') {
          zoomBeforeFrameRef.current = playheadRef.current;
          const playheadViewportX = frameToX(playheadRef.current, zoomCurrentRef.current) - el.scrollLeft;
          zoomMouseXRef.current = playheadViewportX;
          if (playheadViewportX < 0 || playheadViewportX > el.clientWidth) {
            // Off screen: glide it to the middle while zooming
            const targetScrollLeft = frameToX(playheadRef.current, zoomCurrentRef.current) - el.clientWidth * 0.5;
            playheadScrollTargetRef.current = Math.max(0, targetScrollLeft);
          } else {
            playheadScrollTargetRef.current = null;
          }
        } else if (zoomEpicenter === 'cursor') {
          const mouseX = e.clientX - el.getBoundingClientRect().left;
          zoomBeforeFrameRef.current = xToFrame(el.scrollLeft + mouseX, zoomCurrentRef.current);
          zoomMouseXRef.current = mouseX;
        } else {
          const middleX = el.clientWidth / 2;
          zoomBeforeFrameRef.current = xToFrame(el.scrollLeft + middleX, zoomCurrentRef.current);
          zoomMouseXRef.current = middleX;
        }

        zoomTargetRef.current = targetZoom;
        zoomScrollElRef.current = el;
        setZoomAnimTrigger(n => n + 1);
        return;
      }

      const scrollSmoothFactor = readSetting('scrollSmooth');
      const rawDelta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
      const delta = rawDelta * (readSetting('scrollAmount') / 100);
      if (delta === 0) return;
      e.preventDefault();

      if (zoomAnimatingRef.current) {
        if (zoomRafRef.current !== null) { cancelAnimationFrame(zoomRafRef.current); zoomRafRef.current = null; }
        if (pendingScrollCorrection.current) {
          const { el: corrEl, scrollLeft } = pendingScrollCorrection.current;
          pendingScrollCorrection.current = null;
          corrEl.scrollLeft = scrollLeft;
        }
        zoomScrollElRef.current = null;
        zoomAnimatingRef.current = false;
        if (readSetting('cancelZoomOnScroll')) {
          zoomCurrentRef.current = zoomTargetRef.current;
          setZoom(zoomTargetRef.current);
        }
      }

      if (scrollSmoothFactor === 0) {
        el.scrollLeft += delta;
      } else {
        velocityRef.current += delta * 0.5;
        if (rafRef.current === null) rafRef.current = requestAnimationFrame(momentum);
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  return { zoom, setZoom };
}
