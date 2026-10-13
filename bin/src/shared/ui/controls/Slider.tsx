import React from 'react';
import { RotateCcw } from 'lucide-react';
//src/shared/ui/controls/Slider.tsx

const SLIDER_RESOLUTION = 1000;

// Maps a value to a slider position in [0, SLIDER_RESOLUTION] and back
export interface SliderScale {
  toPosition: (value: number) => number;
  fromPosition: (position: number) => number;
}

function linearScale(min: number, max: number): SliderScale {
  return {
    toPosition: value => ((value - min) / (max - min)) * SLIDER_RESOLUTION,
    fromPosition: position => min + (position / SLIDER_RESOLUTION) * (max - min),
  };
}

function logScale(min: number, max: number): SliderScale {
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  return {
    toPosition: value => ((Math.log10(value) - logMin) / (logMax - logMin)) * SLIDER_RESOLUTION,
    fromPosition: position => Math.pow(10, logMin + (position / SLIDER_RESOLUTION) * (logMax - logMin)),
  };
}

function snapToStep(value: number, step: number, min: number, max: number) {
  const snapped = Number((Math.round(value / step) * step).toFixed(10));
  return Math.min(max, Math.max(min, snapped));
}

interface SliderProps {
  label: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onReset: () => void;
  formatValue?: (v: number) => string;
  logScale?: boolean;
  scale?: SliderScale;
  // Labels under the track; defaults to the formatted min and max
  rangeLabels?: React.ReactNode[];
}

export function Slider({ label, value, min, max, step, onChange, onReset, formatValue, logScale: useLogScale, scale, rangeLabels }: SliderProps) {
  const defaultFormat = (v: number) => v.toFixed(3);
  const fmt = formatValue || defaultFormat;
  const displayValue = fmt(value);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(displayValue);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const sliderScale = scale ?? (useLogScale ? logScale(min, max) : linearScale(min, max));

  const handleBlur = () => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setEditValue(displayValue);
      setIsEditing(false);
    }
  };

  const handleClick = () => {
    setEditValue(displayValue);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const labels = rangeLabels ?? [fmt(min), fmt(max)];

  return (
    <div className="settings-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flex: 1, lineHeight: 1.2 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: 12,
                whiteSpace: 'nowrap',
                background: 'var(--bg-hover)',
                border: '1px solid var(--highlight-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 6px',
                width: 'ch',
                minWidth: 60,
                outline: 'none',
              }}
            />
          ) : (
            <span
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: 12,
                whiteSpace: 'nowrap',
                cursor: 'text',
                userSelect: 'all',
                padding: '2px 4px',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                transition: 'background 0.15s',
              }}
              onClick={handleClick}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title="Click to edit"
            >
              {displayValue}
            </span>
          )}
          <button type="button" className="icon-btn" onClick={onReset} title="Reset to default" style={{ padding: 4 }}><RotateCcw size={14} /></button>
        </div>
      </div>
      <input
        type="range"
        className="settings-range-input"
        min={0}
        max={SLIDER_RESOLUTION}
        step={1}
        value={sliderScale.toPosition(value)}
        onChange={e => onChange(snapToStep(sliderScale.fromPosition(Number(e.target.value)), step, min, max))}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
        {labels.map((rangeLabel, index) => <span key={index}>{rangeLabel}</span>)}
      </div>
    </div>
  );
}
