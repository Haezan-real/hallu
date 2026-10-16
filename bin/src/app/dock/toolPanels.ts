//src/app/dock/toolPanels.ts
// Each tool defines its panel when its module loads; importing them all here means they're
// defined before the dock restores its saved layout, so restorable tools come back
import '../../modals/settings/Settings';
import '../../modals/styles/StylesModal';
import '../../modals/torusEditor/TorusMenuEditor';
import '../../modals/playneedleEditor/PlayneedleEditor';
import '../../modals/export/ExportModal';
import '../../modals/colorPicker/ColorPicker';
