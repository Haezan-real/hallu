//src/panels/timeline/TimelineRuler.tsx
import { HEADER_H, type RulerTick } from './timelineGeometry';

export function TimelineRuler({ ticks, totalWidth }: { ticks: RulerTick[]; totalWidth: number }) {
  return (
    <div className="tl-ruler" style={{ height: HEADER_H, width: totalWidth }}>
      {ticks.map((t, i) => (
        <div key={i} className="ruler-tick" style={{ left: t.x }}>
          <span className="ruler-label">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// The ruler's tick lines continued down over the tracks
export function TimelineGrid({ ticks, totalWidth }: { ticks: RulerTick[]; totalWidth: number }) {
  return (
    <div className="tl-grid-overlay" style={{ position: 'absolute', top: HEADER_H, left: 0, width: totalWidth, height: `calc(100% - ${HEADER_H}px)`, pointerEvents: 'none', zIndex: 1 }}>
      {ticks.map((t, i) => (
        <div key={i} className="ruler-tick" style={{ left: t.x }} />
      ))}
    </div>
  );
}
