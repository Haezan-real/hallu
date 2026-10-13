//src/features/playneedle/FormulaPlayneedle.tsx
import { useMemo } from 'react';
import { playneedleButtonCenter, playneedlePath, type PlayneedleParams } from './playneedleFormula';

interface Props {
  height?: number;      // total height in pixels
  maxWidth: number;     // maximum width in pixels
  color?: string;
  params: PlayneedleParams;
  onClick?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export default function FormulaPlayneedle({
  height = 200,
  maxWidth,
  color = '#f5f5f5',
  params,
  onClick,
  onMouseDown,
}: Props) {
  const svgPath = useMemo(() => playneedlePath(params, height, maxWidth), [height, maxWidth, params]);

  const buttonCenterY = playneedleButtonCenter(params) * height;
  const buttonCenterX = maxWidth / 2;

  return (
    <svg
      width={maxWidth}
      height={height}
      viewBox={`0 0 ${maxWidth} ${height}`}
      style={{ overflow: 'visible', display: 'block', width: '100%', height: '100%' }}
    >
      <defs>
        <filter id="playneedle-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={svgPath}
        fill={color}
        filter="url(#playneedle-glow)"
        style={{ cursor: 'pointer' }}
        onClick={onClick}
        onMouseDown={onMouseDown}
      />
      {/* Invisible larger click target for the button area */}
      <circle
        cx={buttonCenterX}
        cy={buttonCenterY}
        r={10}
        fill="transparent"
        style={{ cursor: 'pointer' }}
        onClick={onClick}
        onMouseDown={onMouseDown}
      />
    </svg>
  );
}
