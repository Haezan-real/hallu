//src/window/TitleBar.tsx
import { useEffect, useState } from 'react';
import { OpenSettings } from '../modals/Settings';
import { OpenShaderSelector } from '../modals/ShaderSelector';
import { useDayNightIcon } from '../platform/useDayNightIcon';
import { ICON_BASE_SIZE_PX, ICON_CORNER_RADIUS_PX } from '../platform/appIcon';
import halluTextImage from '@assets/icons/app/hallu_text.webp';

const WINDOW_BUTTONS_SPACING = 10; //px
const WINDOW_BUTTONS_SIZE = 15; //px
const TOP_BAR_MENU_BUTTONS_SPACING = 0; //px
const HEADER_FONT_SIZE = 15;
const HALLU_TEXT_SIZE = 64; //px, width and height of the square hallu_text.webp
const HALLU_TEXT_MARGIN_LEFT = -5; //px between the webp's left edge and the app icon; negative overlaps
const HALLU_TEXT_MARGIN_RIGHT = -4; //px between the webp's right edge and the fps counter; negative overlaps

// Measures the app window's frame rate, updated once per second
function useFrameRate(): number | null {
  const [fps, setFps] = useState<number | null>(null);

  useEffect(() => {
    let rafId = 0;
    let frameCount = 0;
    let fpsStartTime = performance.now();

    const measureFps = () => {
      frameCount++;
      const now = performance.now();
      const elapsed = now - fpsStartTime;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        fpsStartTime = now;
      }
      rafId = requestAnimationFrame(measureFps);
    };
    rafId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return fps;
}

interface TitleBarProps {
  onOpenStyles: () => void;
}

export default function TitleBar({ onOpenStyles }: TitleBarProps) {
  const fps = useFrameRate();
  const appIcon = useDayNightIcon();
  const windowButtonStyle = { width: WINDOW_BUTTONS_SIZE, height: WINDOW_BUTTONS_SIZE };

  return (
    <header className="app-header">
      {/* gap is 0 so the hallu_text margins are the only spacing around it */}
      <div className="app-logo" style={{ gap: 0 }}>
        <img src={appIcon} alt="Hallu" style={{ width: ICON_BASE_SIZE_PX, height: ICON_BASE_SIZE_PX, borderRadius: ICON_CORNER_RADIUS_PX, transform: 'translateY(0px)', }} />

        {/*Hallu title*/}
        <img
          src={halluTextImage}
          alt="Hallu"
          draggable={false}
          style={{
            width: HALLU_TEXT_SIZE,
            height: HALLU_TEXT_SIZE,
            marginLeft: HALLU_TEXT_MARGIN_LEFT,
            marginRight: HALLU_TEXT_MARGIN_RIGHT,
            flexShrink: 0,
            alignSelf: 'center',
            transformOrigin: 'center',
            // The image is taller than the header; its transparent overflow must not block clicks below.
            pointerEvents: 'none',
          }}
        />

        <span style={{
          fontSize: HEADER_FONT_SIZE,
          color: 'var(--text-secondary)',
          fontWeight: 500,
          verticalAlign: 'bottom',
          transform: 'translateY(1px)',
          position: 'relative',
          minWidth: '200px',      // 🔥 Reserve space for "fps: 999"
          }}>| fps: {fps ?? '--'}</span>
        {/* fps counter title */}
      </div>

      <div style={{ display: 'flex', gap: TOP_BAR_MENU_BUTTONS_SPACING, alignItems: 'center', marginLeft: WINDOW_BUTTONS_SPACING }}>
        <button className="icon-btn" onClick={onOpenStyles} title="Style">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C12 2 5 10 5 15c0 3.866 3.134 7 7 7s7-3.134 7-7c0-5-7-13-7-13z"/>
          </svg>
        </button>
        <button className="icon-btn" onClick={() => OpenShaderSelector()} title="Shaders">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L6.82 21 12 17.27 17.18 21l-.64-7.26L22 9.24l-7.19-.61z"/>
          </svg>
        </button>
        <button className="icon-btn" onClick={() => OpenSettings()} title="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: WINDOW_BUTTONS_SPACING, alignItems: 'center' }}>
        <button className="status-dot" data-color="yellow" title="Minimize" onClick={() => window.electronAPI?.minimizeWindow()} style={windowButtonStyle} />
        <button className="status-dot" data-color="green" title="Maximize" onClick={() => window.electronAPI?.toggleMaximizeWindow()} style={windowButtonStyle} />
        <button className="status-dot" data-color="red" title="Close" onClick={() => window.electronAPI?.closeWindow()} style={windowButtonStyle} />
      </div>
    </header>
  );
}
