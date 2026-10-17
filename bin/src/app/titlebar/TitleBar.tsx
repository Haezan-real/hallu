//src/app/titlebar/TitleBar.tsx
import { useEffect, useRef } from 'react';
import { useDayNightIcon } from '../../shared/platform/useDayNightIcon';
import { ICON_BASE_SIZE_PX, ICON_CORNER_RADIUS_PX } from '../../shared/platform/appIcon';
import halluTextImage from '@assets/icons/app/hallu_text.webp';
import { useFrameRate } from './useFrameRate';
import MenuButtons from './MenuButtons';
import WindowControls from './WindowControls';
import { resetLayout } from '../dock/dockLayout';
import { registerShaderPanel, SHADER_PANEL_KIND } from '../../features/shaders/shaderPanels';
import { useShaderPaintsMasterTitleBar } from '../../features/shaders/shaderOptIns';

const HEADER_FONT_SIZE = 15;
/** Added to the title bar colour's HSV value (0-1) for the line under it; 0 matches the title bar */
const WINDOW_DASHBAR_UNDERLINE_BRIGHTEN_AMOUNT = 0.0; //default is 0.08
const HALLU_TEXT_SIZE = 64; //px, width and height of the square hallu_text.webp
const HALLU_TEXT_MARGIN_LEFT = -5; //px between the webp's left edge and the app icon; negative overlaps
const HALLU_TEXT_MARGIN_RIGHT = -4; //px between the webp's right edge and the fps counter; negative overlaps

/** Each press of a title bar button turns it clockwise or anticlockwise at random */
function randomizePressDirection(event: React.PointerEvent) {
  const button = (event.target as Element).closest<HTMLElement>('.title-menu .icon-btn, .title-app-icon');
  button?.style.setProperty('--title-press-direction', Math.random() < 0.5 ? '1' : '-1');
}

export default function TitleBar() {
  const fps = useFrameRate();
  const appIcon = useDayNightIcon();
  const headerRef = useRef<HTMLElement>(null);
  const shaderPaintsTitleBar = useShaderPaintsMasterTitleBar();

  // Only packs that opted in see it, so the rest never draw a panel under the opaque bar
  useEffect(() => {
    const header = headerRef.current;
    if (!shaderPaintsTitleBar || !header) return;
    return registerShaderPanel(header, SHADER_PANEL_KIND.masterTitleBar);
  }, [shaderPaintsTitleBar]);

  return (
    <header
      ref={headerRef}
      className="app-header"
      onPointerDownCapture={randomizePressDirection}
      style={{ '--window-dashbar-underline-brighten': WINDOW_DASHBAR_UNDERLINE_BRIGHTEN_AMOUNT } as React.CSSProperties}
    >
      {/* gap is 0 so the hallu_text margins are the only spacing around it */}
      <div className="app-logo" style={{ gap: 0 }}>
        <img
          src={appIcon}
          alt="Hallu"
          className="title-app-icon"
          title="Double-click to reset the layout"
          draggable={false}
          onDoubleClick={resetLayout}
          style={{ width: ICON_BASE_SIZE_PX, height: ICON_BASE_SIZE_PX, borderRadius: ICON_CORNER_RADIUS_PX }}
        />

        {/*Hallu title*/}
        <img
          src={halluTextImage}
          alt="Hallu"
          draggable={false}
          style={{
            width: HALLU_TEXT_SIZE,
            // Cropped to the header: overflowing it put the image's layer over the dock and
            // shader canvas below, which made it flash. Cover keeps it drawn at 64x64, centred.
            height: `min(${HALLU_TEXT_SIZE}px, var(--bar-height-lg))`,
            objectFit: 'cover',
            marginLeft: HALLU_TEXT_MARGIN_LEFT,
            marginRight: HALLU_TEXT_MARGIN_RIGHT,
            flexShrink: 0,
            alignSelf: 'center',
            transformOrigin: 'center',
            pointerEvents: 'none',
          }}
        />

        {/* fps counter */}
        <span style={{
          fontSize: HEADER_FONT_SIZE,
          color: 'var(--text-secondary)',
          fontWeight: 500,
          verticalAlign: 'bottom',
          transform: 'translateY(1px)',
          position: 'relative',
          minWidth: '200px', // Reserve space for "fps: 999"
          }}>| fps: {fps ?? '--'}</span>
      </div>

      <MenuButtons />
      <WindowControls />
    </header>
  );
}
