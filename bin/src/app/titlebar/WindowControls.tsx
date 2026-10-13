//src/app/titlebar/WindowControls.tsx

export const WINDOW_BUTTONS_SPACING = 10; //px
const WINDOW_BUTTONS_SIZE = 15; //px

// Minimize, maximize and close dots on the right of the title bar
export default function WindowControls() {
  const style = { width: WINDOW_BUTTONS_SIZE, height: WINDOW_BUTTONS_SIZE };
  return (
    <div style={{ marginLeft: 'auto', display: 'flex', gap: WINDOW_BUTTONS_SPACING, alignItems: 'center' }}>
      <button className="status-dot" data-color="yellow" title="Minimize" onClick={() => window.electronAPI?.minimizeWindow()} style={style} />
      <button className="status-dot" data-color="green" title="Maximize" onClick={() => window.electronAPI?.toggleMaximizeWindow()} style={style} />
      <button className="status-dot" data-color="red" title="Close" onClick={() => window.electronAPI?.closeWindow()} style={style} />
    </div>
  );
}
