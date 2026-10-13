//src/features/torus/TorusMenu.tsx

import { useEffect, useState, useRef } from 'react';
import type { CSSProperties } from 'react';
import { evaluateGraph, type GraphPoint } from '../../shared/lib/graph';
import { useSetting } from '../../modals/settings/settingsStore';
import type { TorusScrollingDisabled } from '../../modals/settings/settingsDefaults';
import { getSavedSizeGraph, getSavedSegmentHandleValues } from './torusSettings';
import { annularSectorPath, sectorDelaySeconds } from './torusGeometry';
import { edgeItems, insideItems, type MenuItem, type TorusEditActions } from './torusMenuItems';
import type { TorusTarget } from './torusTarget';
import { useTorusAudio } from './useTorusAudio';

// Module-level singleton that persists across TorusMenu instances.
// Prevents entrance animation from replaying when component remounts.
let torusMenuHasAnimated = false;

const THOCK_VOLUME = 0.7;
const BIG_WOOSH_VOLUME = 0.7;
const SMALL_WOOSH_VOLUME = 0.7;

const MAX_SECTORS = 6;
// Matches the max value of the hover scale slider
const MAX_HOVER_SCALE = 1.5;

interface Props extends Partial<TorusEditActions> {
  pos: { x: number; y: number };
  target: TorusTarget;
  onClose?: () => void;
  showCloseButton?: boolean;

  // Geometry
  cx?: number;
  innerR?: number;
  outerR?: number;
  rotationOffset?: number;

  // Animation (fall back to the saved settings)
  duration?: number;
  delay?: number;
  sizeGraph?: GraphPoint[];
  segmentHandleValues?: number[];
  hoverScale?: number;

  closeOnBackgroundClick?: boolean;
  disableScrolling?: TorusScrollingDisabled;
}

const noop = () => {};

export default function TorusMenu({
  pos,
  target,
  onClose = noop,
  onSplit = noop,
  onTrimLatter = noop,
  onTrimFormer = noop,
  onStep = noop,
  onRoll = noop,
  showCloseButton = false,
  duration: durationProp,
  delay: delayProp,
  sizeGraph: sizeGraphProp,
  segmentHandleValues: segmentHandleValuesProp,
  cx: propCx = 120,
  innerR = 52,
  outerR = 100,
  rotationOffset = -Math.PI / 6,
  closeOnBackgroundClick = true,
  hoverScale: hoverScaleProp,
  disableScrolling = 'none',
}: Props) {
  const [savedDuration] = useSetting('torusDuration');
  const [savedDelay] = useSetting('torusDelay');
  const [savedHoverScale] = useSetting('torusHoverScale');
  const duration = durationProp ?? savedDuration;
  const delay = delayProp ?? savedDelay;
  const hoverScale = hoverScaleProp ?? savedHoverScale;

  const { ready: audioReady, play: playSound } = useTorusAudio();

  // Read the saved graph once per mount so a new array reference doesn't restart the animation
  const [stableSizeGraph] = useState(() => sizeGraphProp ?? getSavedSizeGraph());
  const [stableSegmentHandles] = useState(() => segmentHandleValuesProp ?? getSavedSegmentHandleValues());
  const sizeGraph = sizeGraphProp ?? stableSizeGraph;
  const segmentHandleValues = segmentHandleValuesProp ?? stableSegmentHandles;

  // The center must be far enough from the edge to fit a fully hovered sector without clipping
  const maxPossibleR = outerR * MAX_HOVER_SCALE;
  const cx = Math.max(propCx, maxPossibleR);
  const cy = cx;

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const getOuterR = (index: number) => (hoveredIndex === index ? outerR * hoverScale : outerR);

  const actions: TorusEditActions = { onSplit, onTrimLatter, onTrimFormer, onStep, onRoll };
  const items: MenuItem[] = target.kind === 'edge' || target.kind === 'cut' ? edgeItems(actions) : insideItems(actions);
  const sectorAngle = (Math.PI * 2) / MAX_SECTORS;
  const getSectorDelay = (index: number) => sectorDelaySeconds(index, items.length, delay);

  // Play a woosh for each sector as it pops in
  useEffect(() => {
    if (!audioReady) return;
    const timeouts = items.map((_, i) => window.setTimeout(() => {
      playSound('bigWoosh', BIG_WOOSH_VOLUME);
    }, getSectorDelay(i) * 1000));
    return () => timeouts.forEach(id => clearTimeout(id));
  }, [items.length, delay, audioReady]);

  const ref = useRef<HTMLDivElement>(null);
  const sectorGroupRefs = useRef<(SVGGElement | null)[]>([]);

  // Track if the entrance animation has already played (persists across component instances)
  const hasAnimatedRef = useRef(torusMenuHasAnimated);

  useEffect(() => {
    // Allow the very first render to have the animation style.
    // After one frame, lock it so subsequent re-renders/remounts
    // won't trigger the animation again.
    const rafId = requestAnimationFrame(() => {
      torusMenuHasAnimated = true;
      hasAnimatedRef.current = true;
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Remove animation styles from sectors after entrance completes.
  // This prevents CSS animation replay on re-mounts even if DOM nodes are recreated.
  useEffect(() => {
    if (!hasAnimatedRef.current) return;
    const timer = setTimeout(() => {
      sectorGroupRefs.current.forEach(group => {
        if (group) {
          group.style.animation = 'none';
          group.style.opacity = '1';
          group.style.transform = 'scale(1)';
        }
      });
    }, duration + delay + 100);
    return () => clearTimeout(timer);
  }, [duration, delay]);

  // Scroll-to-close and background-click-to-close
  useEffect(() => {
    let mousePosition: { x: number; y: number } | null = null;
    const scrollHandler = (e: Event) => {
      if (disableScrolling === 'none' || !ref.current) return;
      const position = mousePosition;
      if (!position) return onClose();
      const el = document.elementFromPoint(position.x, position.y);
      if (disableScrolling === 'annular sectors only' && el?.closest('.torus-sector')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (el && ref.current.contains(el)) {
        if (disableScrolling === 'whole torus menu') {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      onClose();
    };
    const mouseMoveHandler = (e: MouseEvent) => {
      mousePosition = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('scroll', scrollHandler, true);
    window.addEventListener('mousemove', mouseMoveHandler, true);

    const handleOutsidePointer = (e: MouseEvent | PointerEvent) => {
      const targetEl = e.target as HTMLElement;
      if (targetEl.closest('.torus-toggle-btn') || targetEl.closest('.torus-center-btn')) return;
      if (disableScrolling === 'annular sectors only') {
        if (!targetEl.closest('.torus-sector')) onClose();
        return;
      }
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const distance = Math.hypot(e.clientX - rect.left - cx, e.clientY - rect.top - cy);
      if (distance > outerR) onClose();
    };
    if (closeOnBackgroundClick) {
      window.addEventListener('mousedown', handleOutsidePointer);
      window.addEventListener('pointerdown', handleOutsidePointer);
    }

    return () => {
      window.removeEventListener('scroll', scrollHandler, true);
      window.removeEventListener('mousemove', mouseMoveHandler, true);
      if (closeOnBackgroundClick) {
        window.removeEventListener('mousedown', handleOutsidePointer);
        window.removeEventListener('pointerdown', handleOutsidePointer);
      }
    };
  }, [onClose, closeOnBackgroundClick, disableScrolling, outerR, cx, cy]);

  const hasSizeGraph = Array.isArray(sizeGraph) && sizeGraph.length >= 2;

  const getSectorStyle = (index: number): CSSProperties => ({
    cursor: 'pointer',
    animation: 'none !important',
    transition: '0.15s ease-out',
    fill: hoveredIndex === index ? 'var(--hover-background, var(--input-field-bg))' : 'var(--input-field-bg)',
  });

  const getGroupStyle = (): CSSProperties | undefined => {
    if (!hasSizeGraph) return undefined;
    return {
      transformOrigin: `${cx}px ${cy}px`,
      transformBox: 'view-box',
      opacity: 0,
      transform: `scale(${sizeGraph[0]?.size ?? 0})`,
    };
  };

  useEffect(() => {
    if (!hasSizeGraph || !audioReady) return;

    const sortedGraph = sizeGraph.slice().sort((a, b) => a.time - b.time);
    const initialSize = sortedGraph[0]?.size ?? 0;
    const animDuration = Math.max(duration, 1);
    let frameId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      let stillAnimating = false;

      items.forEach((_, index) => {
        const group = sectorGroupRefs.current[index];
        if (!group) return;

        const elapsed = now - startTime - getSectorDelay(index) * 1000;
        if (elapsed < 0) {
          group.style.opacity = '0';
          group.style.transform = `scale(${initialSize})`;
          stillAnimating = true;
          return;
        }

        const linearProgress = Math.min(1, elapsed / animDuration);
        const size = evaluateGraph(linearProgress, sortedGraph, segmentHandleValues);
        group.style.opacity = '1';
        group.style.transform = `scale(${size})`;
        if (linearProgress < 1) stillAnimating = true;
      });

      if (stillAnimating) frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [hasSizeGraph, audioReady, sizeGraph, segmentHandleValues, duration, delay, cx, cy]);

  const handleSectorClick = (item: MenuItem) => {
    playSound('thock', THOCK_VOLUME);
    item.action();
    onClose();
  };

  const svgContent = (
    <svg width={cx * 2} height={cy * 2} viewBox={`0 0 ${cx * 2} ${cy * 2}`}>
      <defs>
        <clipPath id="torus-clip">
          <circle cx={cx} cy={cy} r={maxPossibleR} />
        </clipPath>
      </defs>
      <g clipPath="url(#torus-clip)">
      {Array.from({ length: MAX_SECTORS }).map((_, i) => {
        if (i >= items.length) {
          return (
            <g
              key={i}
              ref={el => { sectorGroupRefs.current[i] = el; }}
              style={{ opacity: 0, pointerEvents: 'none' }}
            >
              <path
                d={annularSectorPath(cx, cy, innerR, outerR, 0, 0)}
                fill="none"
                stroke="none"
              />
            </g>
          );
        }

        const item = items[i];
        const startAngle = i * sectorAngle - Math.PI / 2 + rotationOffset;
        const endAngle = (i + 1) * sectorAngle - Math.PI / 2 + rotationOffset;
        const midAngle = (startAngle + endAngle) / 2;

        const dynamicOuterR = getOuterR(i);
        const labelR = (innerR + dynamicOuterR) / 2;
        const labelX = cx + labelR * Math.cos(midAngle);
        const labelY = cy + labelR * Math.sin(midAngle);

        return (
          <g
            key={i}
            ref={el => { sectorGroupRefs.current[i] = el; }}
            style={getGroupStyle()}
            onMouseEnter={() => {
              setHoveredIndex(i);
              playSound('smallWoosh', SMALL_WOOSH_VOLUME);
            }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <path
              d={annularSectorPath(cx, cy, innerR, dynamicOuterR, startAngle, endAngle)}
              fill="var(--input-field-bg)"
              stroke="var(--border-mid)"
              strokeWidth={0.5}
              className="torus-sector"
              style={getSectorStyle(i)}
              onClick={(e) => { e.stopPropagation(); handleSectorClick(item); }}
            />
            <foreignObject
              x={labelX - 36}
              y={labelY - 16}
              width={72}
              height={32}
              className="torus-sector"
              style={{
                cursor: 'pointer',
                overflow: 'visible',
                transform: hoveredIndex === i ? `scale(${hoverScale})` : 'scale(1)',
                transformOrigin: `${labelX}px ${labelY}px`,
                transition: 'transform 0.15s ease-out',
                ...getSectorStyle(i)
              }}
              onClick={(e) => { e.stopPropagation(); handleSectorClick(item); }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  color: item.color,
                  fontSize: 10,
                  lineHeight: 1.1,
                  textAlign: 'center',
                  gap: 1,
                }}
              >
                <span style={{ color: item.color, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
              </div>
            </foreignObject>
          </g>
        );
      })}
      </g>
    </svg>
  );

  return (
    <>
      <style>{`
        @keyframes torus-sector-pop {
          0% { opacity: 0; transform: scale(0); }
          60% { opacity: 1; }
          100% { opacity: 1; transform: scale(1); }
        }
        .torus-overlay.torus-overlay--no-scroll {
          pointer-events: none;
        }
        .torus-overlay.torus-overlay--no-scroll > * {
          pointer-events: auto;
        }
      `}</style>
      <div
        className={`torus-overlay${disableScrolling === 'none' ? ' torus-overlay--no-scroll' : ''}`}
        ref={ref}
        style={{
          left: pos.x - cx,
          top: pos.y - cy,
          width: cx * 2,
          height: cy * 2,
          transformOrigin: `${cx}px ${cy}px`,
          transformBox: 'view-box',
        }}
        onMouseDown={(e) => {
          const targetEl = e.target as HTMLElement;
          if (disableScrolling !== 'annular sectors only' || targetEl.closest('.torus-sector')) {
            e.stopPropagation();
          }
        }}
      >
        {svgContent}
        {showCloseButton && (
          <button
            type="button"
            className="torus-center-btn"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            title="Close"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '2px solid var(--highlight-color)',
              background: 'rgba(56,189,248,0.2)',
              color: 'var(--highlight-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
    </>
  );
}
