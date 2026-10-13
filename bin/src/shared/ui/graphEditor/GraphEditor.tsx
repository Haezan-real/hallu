import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import { useLocalHistory } from '../../history';
import { formatShortcutLabel, isShortcutMatch } from '../../../modals/settings/shortcuts';
import { formatSensitivity, adjustSensitivity, DEFAULT_SENSITIVITY, DISPLAY_DURATION_MS } from './sensitivity';
import { evaluateSegment, type GraphPoint } from '../../lib/graph';
import {
  buildSmoothCurvePath, clamp, getGraphMetrics, graphCoordsFromEvent, graphPointToSvg,
  handleOffsetToValue, segmentHandleRange, type GraphConfig,
} from './graphGeometry';

//src/shared/ui/graphEditor/GraphEditor.tsx

export type SizeGraphPoint = GraphPoint;
export type { GraphConfig };

export interface GraphSnapshot {
  graph: SizeGraphPoint[];
  easingOffsets: number[];
}

export const EASE_HANDLE_DIAMETER_PX = 6;
export const EASE_HANDLE_RING_THICKNESS_PX = 2;
export const GRAPH_LINE_COLOR = 'var(--automation-line)';
export const EASE_HANDLE_COLOR = 'var(--automation-line)';
export const ANCHOR_OUTER_COLOR = 'var(--automation-line)';
export const ANCHOR_INNER_COLOR = 'var(--input-field-bg)';
export const ANCHOR_DIAMETER_PX = 12;
export const ANCHOR_BORDER_THICKNESS_PX = 2;

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  width: 260,
  height: 180,
  padding: 40,
  minTimeDelta: 0.01,
};

function cloneGraphSnapshot(graph: SizeGraphPoint[], easingOffsets: number[]): GraphSnapshot {
  return {
    graph: graph.map(p => ({ ...p })),
    easingOffsets: [...easingOffsets],
  };
}

function snapshotsEqual(a: GraphSnapshot, b: GraphSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return !!element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);
}

export default function GraphEditor({
  graph,
  onChange,
  config = DEFAULT_GRAPH_CONFIG,
  Y_label = 'value',
  X_label = 'time',
  onEasingChange,
  initialEasingOffsets,
}: {
  graph: SizeGraphPoint[];
  onChange: Dispatch<SetStateAction<SizeGraphPoint[]>>;
  config?: GraphConfig;
  Y_label?: string;
  X_label?: string;
  onEasingChange?: (handleValues: number[]) => void;
  initialEasingOffsets?: number[];
}) {
  const [, setSelectedPointIndex] = useState<number | null>(null);
  const [svgWidth, setSvgWidth] = useState(config.width);
  const [easingOffsets, setEasingOffsets] = useState<number[]>(() => initialEasingOffsets ?? []);
  const [dragSensitivity, setDragSensitivity] = useState(DEFAULT_SENSITIVITY);
  const [showSensitivityDisplay, setShowSensitivityDisplay] = useState(false);
  const sensitivityHideTimeoutRef = useRef<number | null>(null);
  
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingPointIndex = useRef<number | null>(null);
  const draggingEasingIndex = useRef<number | null>(null);
  const preDragSnapshot = useRef<GraphSnapshot | null>(null);
  const graphRef = useRef(graph);
  const easingOffsetsRef = useRef(easingOffsets);
  const graphHistory = useLocalHistory<GraphSnapshot>('graph');
  
  // Track drag start position for sensitivity calculations
  const dragStartPositionRef = useRef<{ clientX: number; clientY: number } | null>(null);
  
  // Helper to show sensitivity display temporarily
  const showSensitivityDisplayTemporarily = useCallback(() => {
    setShowSensitivityDisplay(true);
    if (sensitivityHideTimeoutRef.current !== null) {
      window.clearTimeout(sensitivityHideTimeoutRef.current);
    }
    sensitivityHideTimeoutRef.current = window.setTimeout(() => {
      setShowSensitivityDisplay(false);
      sensitivityHideTimeoutRef.current = null;
    }, DISPLAY_DURATION_MS);
  }, []);
  
  // Handle wheel event during drag to adjust sensitivity
  const handleWheelDuringDrag = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setDragSensitivity(prev => adjustSensitivity(prev, e.deltaY));
    showSensitivityDisplayTemporarily();
  }, [showSensitivityDisplayTemporarily]);
  
  // Lock pointer to element during drag using Pointer Lock API
  const lockPointer = useCallback((element: Element) => {
    if (element.requestPointerLock) {
      element.requestPointerLock();
    }
  }, []);
  
  const unlockPointer = useCallback(() => {
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  }, []);

  useEffect(() => { graphRef.current = graph; }, [graph]);
  useEffect(() => { easingOffsetsRef.current = easingOffsets; }, [easingOffsets]);

  const sortedGraph = useMemo(() => graph.slice().sort((a, b) => a.time - b.time), [graph]);

  const getCurrentSnapshot = useCallback((): GraphSnapshot => {
    const sorted = graphRef.current.slice().sort((a, b) => a.time - b.time);
    return cloneGraphSnapshot(sorted, easingOffsetsRef.current);
  }, []);

  const restoreSnapshot = useCallback((snap: GraphSnapshot) => {
    onChange(snap.graph);
    setEasingOffsets(snap.easingOffsets);
  }, [onChange]);

  const handleUndo = useCallback(() => {
    graphHistory.undo(getCurrentSnapshot(), restoreSnapshot);
  }, [graphHistory, getCurrentSnapshot, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    graphHistory.redo(getCurrentSnapshot(), restoreSnapshot);
  }, [graphHistory, getCurrentSnapshot, restoreSnapshot]);

  const pushHistorySnapshot = useCallback((snapshot: GraphSnapshot) => {
    graphHistory.push(snapshot);
  }, [graphHistory]);

  const beginDragSnapshot = useCallback(() => {
    preDragSnapshot.current = getCurrentSnapshot();
  }, [getCurrentSnapshot]);

  const commitDragSnapshot = useCallback(() => {
    if (!preDragSnapshot.current) return;
    const current = getCurrentSnapshot();
    if (!snapshotsEqual(preDragSnapshot.current, current)) {
      pushHistorySnapshot(preDragSnapshot.current);
    }
    preDragSnapshot.current = null;
  }, [getCurrentSnapshot, pushHistorySnapshot]);

  // Refs to hold latest versions of handleUndo and handleRedo for stable event listener
  const handleUndoRef = useRef(handleUndo);
  const handleRedoRef = useRef(handleRedo);

  useEffect(() => {
    handleUndoRef.current = handleUndo;
    handleRedoRef.current = handleRedo;
  }, [handleUndo, handleRedo]);
  
  useEffect(() => {
    // Only reset to defaults if no saved offsets were provided
    if (initialEasingOffsets && initialEasingOffsets.length > 0) return;
    setEasingOffsets(sortedGraph.slice(0, -1).map((point, index) =>
      segmentHandleRange(config, point, sortedGraph[index + 1], svgWidth).mid,
    ));
  }, [sortedGraph.length, svgWidth, config, initialEasingOffsets]);

  const segmentHandleValues = useMemo(() => sortedGraph.slice(0, -1).map((pointA, index) =>
    handleOffsetToValue(config, pointA, sortedGraph[index + 1], svgWidth, easingOffsets[index]),
  ), [sortedGraph, easingOffsets, svgWidth, config]);

  const graphPath = useMemo(() => buildSmoothCurvePath(config, sortedGraph, svgWidth, segmentHandleValues), [sortedGraph, svgWidth, segmentHandleValues, config]);

  useEffect(() => {
    onEasingChange?.(segmentHandleValues);
  }, [segmentHandleValues, onEasingChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (isShortcutMatch('undo', e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleUndoRef.current();
        return;
      }
      if (isShortcutMatch('redo', e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleRedoRef.current();
      }
    };
    
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const pointIndex = draggingPointIndex.current;
      const easingIndex = draggingEasingIndex.current;
      const sensitivity = dragSensitivity;
      
      // Use relative movement so the mouse doesn't need to move far
      const relX = e.movementX * sensitivity;
      const relY = e.movementY * sensitivity;
      
      if (pointIndex !== null) {
        // Store current graph position and apply relative movement
        const currentGraph = graphRef.current.slice().sort((a, b) => a.time - b.time);
        const currentPoint = currentGraph[pointIndex];
        if (!currentPoint) return;
        
        // Convert relative pixel movement to graph coordinate changes
        const svg = svgRef.current;
        if (!svg) return;
        const { plotWidth, plotHeight } = getGraphMetrics(config, svgWidth);
        
        // Approximate conversion: movement in pixels -> space in graph units
        // For x (time): movement / plotWidth
        // For y (size): -movement / plotHeight (inverted because SVG Y is flipped)
        const timeDelta = relX / plotWidth;
        const sizeDelta = -relY / plotHeight;
        
        let newTime = currentPoint.time + timeDelta;
        const newSize = clamp(currentPoint.size + sizeDelta, 0, 1);
        
        // Constrain time based on neighboring points
        if (pointIndex !== 0 && pointIndex !== currentGraph.length - 1) {
          const minTime = currentGraph[pointIndex - 1].time + config.minTimeDelta;
          const maxTime = currentGraph[pointIndex + 1].time - config.minTimeDelta;
          newTime = clamp(newTime, minTime, maxTime);
        }
        
        onChange(prev => {
          const next = prev.slice().sort((a, b) => a.time - b.time);
          if (pointIndex === 0 || pointIndex === next.length - 1) {
            next[pointIndex] = {
              ...next[pointIndex],
              size: newSize,
            };
            return next;
          }
          next[pointIndex] = {
            time: newTime,
            size: newSize,
          };
          return next;
        });
      } else if (easingIndex !== null) {
        // For easing handles, only vertical movement matters
        const currentOffset = easingOffsetsRef.current[easingIndex] ?? 0;
        const { min, max } = segmentHandleRange(config, sortedGraph[easingIndex], sortedGraph[easingIndex + 1], svgWidth);
        const constrainedY = clamp(currentOffset + relY, min, max);
        
        setEasingOffsets(prev => {
          const next = [...prev];
          next[easingIndex] = constrainedY;
          return next;
        });
      }
    };

    const handlePointerUp = () => {
      const wasDragging = draggingPointIndex.current !== null || draggingEasingIndex.current !== null;
      if (wasDragging) {
        commitDragSnapshot();
      }
      draggingPointIndex.current = null;
      draggingEasingIndex.current = null;
      dragStartPositionRef.current = null;
      unlockPointer();
    };

    // Handle case where user presses Esc to exit pointer lock
    const handlePointerLockChange = () => {
      if (!document.pointerLockElement) {
        if (draggingPointIndex.current !== null || draggingEasingIndex.current !== null) {
          commitDragSnapshot();
          draggingPointIndex.current = null;
          draggingEasingIndex.current = null;
          dragStartPositionRef.current = null;
        }
      }
    };

    window.addEventListener('wheel', handleWheelDuringDrag, { passive: false });
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      window.removeEventListener('wheel', handleWheelDuringDrag);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [onChange, svgWidth, commitDragSnapshot, config, sortedGraph, handleWheelDuringDrag, unlockPointer, dragSensitivity]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const nextWidth = container.clientWidth || config.width;
      setSvgWidth(prev => (prev === nextWidth ? prev : nextWidth));
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [config.width]);

  const undoShortcutLabel = formatShortcutLabel('undo');
  const redoShortcutLabel = formatShortcutLabel('redo');

  return (
    <div ref={containerRef} className="settings-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, width: '100%', position: 'relative', zIndex: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, lineHeight: 1.2 }}>{Y_label} over {X_label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            className="icon-btn"
            onClick={handleUndo}
            disabled={!graphHistory.canUndo}
            title={`Undo (${undoShortcutLabel})`}
            style={{ padding: 4, opacity: graphHistory.canUndo ? 1 : 0.4 }}
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={handleRedo}
            disabled={!graphHistory.canRedo}
            title={`Redo (${redoShortcutLabel})`}
            style={{ padding: 4, opacity: graphHistory.canRedo ? 1 : 0.4 }}
          >
            <Redo2 size={14} />
          </button>
        </div>
      </div>
      <svg
        ref={svgRef}
        width="100%"
        height={config.height}
        viewBox={`0 0 ${svgWidth} ${config.height}`}
        onPointerDown={e => {
          if (e.button !== 0) return; // Only respond to left-click
          if ((e.target as SVGElement).tagName.toLowerCase() === 'circle') return;
          const coords = graphCoordsFromEvent(config, e, svgRef.current, svgWidth);
          if (!coords) return;
          const time = clamp(coords.time, 0.01, 0.99);
          if (sortedGraph.some(p => Math.abs(p.time - time) < config.minTimeDelta)) return;
          const size = clamp(coords.size, 0, 1);
          pushHistorySnapshot(cloneGraphSnapshot(sortedGraph, easingOffsets));
          const next = [...sortedGraph, { time, size }].sort((a, b) => a.time - b.time);
          const newIndex = next.findIndex(p => p.time === time && p.size === size);
          onChange(next);
          setSelectedPointIndex(newIndex);
          draggingPointIndex.current = newIndex;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', cursor: 'crosshair' }}
      >
        <rect x={0} y={0} width={svgWidth} height={config.height} fill="transparent" />
        <g stroke="var(--border-mid)" strokeWidth={1} fill="none">
          <line x1={config.padding} y1={config.padding} x2={config.padding} y2={config.height - config.padding} />
          <line x1={config.padding} y1={config.height - config.padding} x2={svgWidth - config.padding} y2={config.height - config.padding} />
        </g>
        <path d={graphPath} fill="none" stroke={GRAPH_LINE_COLOR} strokeWidth={2} />
        {showSensitivityDisplay && (
          <text
            x={config.padding + 10}
            y={config.padding + 20}
            fill="var(--highlight-color)"
            fontSize="12"
            fontFamily="monospace"
            fontWeight="bold"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            Sens: {formatSensitivity(dragSensitivity)}
          </text>
        )}
        {sortedGraph.slice(0, -1).map((point, index) => {
          const nextPoint = sortedGraph[index + 1];
          // The handle sits on the curve at the segment's time midpoint
          const handleX = graphPointToSvg(config, { time: (point.time + nextPoint.time) / 2, size: 0 }, svgWidth).x;
          const curveSize = point.size + (nextPoint.size - point.size) * evaluateSegment(0.5, segmentHandleValues[index] ?? 0);
          const handleY = graphPointToSvg(config, { time: 0, size: curveSize }, svgWidth).y;

          return (
            <g key={`easing-${index}`} style={{ cursor: 'ns-resize', zIndex: 5 }}>
              <circle
                cx={handleX}
                cy={handleY}
                r={16}
                fill="transparent"
                onPointerDown={e => {
                  if (e.button !== 0) return; // Only respond to left-click
                  e.stopPropagation();
                  beginDragSnapshot();
                  draggingEasingIndex.current = index;
                  dragStartPositionRef.current = { clientX: e.clientX, clientY: e.clientY };
                  e.currentTarget.setPointerCapture(e.pointerId);
                  lockPointer(e.currentTarget);
                }}
              />
              <circle
                cx={handleX}
                cy={handleY}
                r={EASE_HANDLE_DIAMETER_PX / 2 + 1}
                fill="var(--bg-elevated)"
                style={{ pointerEvents: 'none' }}
              />
              <circle
                cx={handleX}
                cy={handleY}
                r={EASE_HANDLE_DIAMETER_PX / 2}
                fill="none"
                stroke={EASE_HANDLE_COLOR}
                strokeWidth={EASE_HANDLE_RING_THICKNESS_PX}
                style={{ pointerEvents: 'none' }}
              />
            </g>
          );
        })}
        {sortedGraph.map((point, index) => {
          const svgPoint = graphPointToSvg(config, point, svgWidth);
          return (
            <circle
              key={`point-${index}`}
              cx={svgPoint.x}
              cy={svgPoint.y}
              r={ANCHOR_DIAMETER_PX / 2}
              fill={index === 0 || index === sortedGraph.length - 1 ? 'var(--highlight-color)' : ANCHOR_INNER_COLOR}
              stroke={ANCHOR_OUTER_COLOR}
              strokeWidth={ANCHOR_BORDER_THICKNESS_PX}
              style={{ cursor: index === 0 || index === sortedGraph.length - 1 ? 'default' : 'grab', zIndex: 10 }}
              onPointerDown={e => {
                e.stopPropagation();
                
                // Handle right-click for deletion
                if (e.button === 2) {
                  e.preventDefault();
                  if (index === 0 || index === sortedGraph.length - 1) return;
                  pushHistorySnapshot(cloneGraphSnapshot(sortedGraph, easingOffsets));
                  onChange(prev => {
                    const next = prev.slice().sort((a, b) => a.time - b.time);
                    next.splice(index, 1);
                    return next;
                  });
                  setSelectedPointIndex(null);
                  return;
                }
                
                // Only respond to left-click for dragging
                if (e.button !== 0) return;
                
                beginDragSnapshot();
                draggingPointIndex.current = index;
                dragStartPositionRef.current = { clientX: e.clientX, clientY: e.clientY };
                setSelectedPointIndex(index);
                e.currentTarget.setPointerCapture(e.pointerId);
                lockPointer(e.currentTarget);
              }}
              onClick={e => {
                e.stopPropagation();
                setSelectedPointIndex(index);
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
