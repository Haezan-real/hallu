//src/app/titlebar/TitleBar.tsx
import { useDayNightIcon } from '../../shared/platform/useDayNightIcon';
import { ICON_BASE_SIZE_PX, ICON_CORNER_RADIUS_PX } from '../../shared/platform/appIcon';
import halluTextImage from '@assets/icons/app/hallu_text.webp';
import { useFrameRate } from './useFrameRate';
import MenuButtons from './MenuButtons';
import WindowControls from './WindowControls';

const HEADER_FONT_SIZE = 15;
const HALLU_TEXT_SIZE = 64; //px, width and height of the square hallu_text.webp
const HALLU_TEXT_MARGIN_LEFT = -5; //px between the webp's left edge and the app icon; negative overlaps
const HALLU_TEXT_MARGIN_RIGHT = -4; //px between the webp's right edge and the fps counter; negative overlaps

export default function TitleBar() {
  const fps = useFrameRate();
  const appIcon = useDayNightIcon();

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
