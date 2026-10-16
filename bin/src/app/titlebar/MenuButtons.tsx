//src/app/titlebar/MenuButtons.tsx
import { OpenSettings } from '../../modals/settings/Settings';
import { OpenStyles } from '../../modals/styles/StylesModal';
import { CORE_PANELS, resetLayout, type CorePanelId } from '../dock/dockLayout';
import { corePanels, useCorePanelOpen } from '../dock/corePanels';
import { closePanel, usePanelOpen } from '../../shared/panels/openPanel';

const TOP_BAR_MENU_BUTTONS_SPACING = 0; //px

const CORE_PANEL_ICONS: Record<CorePanelId, React.ReactNode> = {
  mediaPool: (
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  ),
  viewer: (
    <>
      <rect x="2" y="4" width="20" height="14" rx="2"/>
      <path d="M10 8.5v5l4-2.5z M8 21h8"/>
    </>
  ),
  timeline: (
    <path d="M3 6h10 M7 12h14 M3 18h12"/>
  ),
};

/** Opens or closes a core panel; lit while it's open */
function CorePanelButton({ id }: { id: CorePanelId }) {
  const open = useCorePanelOpen(id);
  const { title } = CORE_PANELS[id];
  return (
    <button
      className={`icon-btn panel-toggle${open ? ' is-open' : ''}`}
      onClick={() => corePanels.toggle(id)}
      title={open ? `Close ${title}` : `Open ${title}`}
      aria-pressed={open}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {CORE_PANEL_ICONS[id]}
      </svg>
    </button>
  );
}

// Buttons that toggle the core panels, reset the panel layout and open the Styles and Settings modals
export default function MenuButtons({ style }: { style?: React.CSSProperties }) {
  const stylesOpen = usePanelOpen('styles');
  const settingsOpen = usePanelOpen('settings');
  return (
    <div className="title-menu" style={{ gap: TOP_BAR_MENU_BUTTONS_SPACING, ...style }}>
      <CorePanelButton id="mediaPool" />
      <CorePanelButton id="viewer" />
      <CorePanelButton id="timeline" />
      <button className="icon-btn" onClick={resetLayout} title="Reset layout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="1"/>
          <path d="M3 15h18 M9 3v12"/>
        </svg>
      </button>
      <button
        className={`icon-btn panel-toggle${stylesOpen ? ' is-open' : ''}`}
        onClick={() => (stylesOpen ? closePanel('styles') : OpenStyles())}
        title={stylesOpen ? 'Close Styles' : 'Styles'}
        aria-pressed={stylesOpen}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C12 2 5 10 5 15c0 3.866 3.134 7 7 7s7-3.134 7-7c0-5-7-13-7-13z"/>
        </svg>
      </button>
      <button
        className={`icon-btn panel-toggle${settingsOpen ? ' is-open' : ''}`}
        onClick={() => (settingsOpen ? closePanel('settings') : OpenSettings())}
        title={settingsOpen ? 'Close Settings' : 'Settings'}
        aria-pressed={settingsOpen}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>
  );
}
