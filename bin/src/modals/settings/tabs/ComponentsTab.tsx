//src/modals/settings/tabs/ComponentsTab.tsx
import { IconTile, IconTileGrid } from '../../../shared/ui/IconTile';
import PlayneedleIcon from '../../../features/playneedle/PlayneedleIcon';
import { OpenTorusMenuEditor } from '../../torusEditor/TorusMenuEditor';
import { OpenPlayneedleEditor } from '../../playneedleEditor/PlayneedleEditor';

const TORUS_ICON = 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M12 3v4 M12 17v4 M3 12h4 M17 12h4';

// Each editor replaces Settings; its back button reopens Settings on this tab
export default function ComponentsTab({ onClose, reopenSettings }: { onClose: () => void; reopenSettings: () => void }) {
  return (
    <IconTileGrid>
      <IconTile label="Torus Menu Editor" icon={TORUS_ICON} onClick={() => { onClose(); OpenTorusMenuEditor(reopenSettings); }} />
      <IconTile label="Playneedle Editor" icon={<PlayneedleIcon />} onClick={() => { onClose(); OpenPlayneedleEditor(reopenSettings); }} />
    </IconTileGrid>
  );
}
