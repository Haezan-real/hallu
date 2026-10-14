//src/modals/shaders/ShaderSelector.tsx
import { useState, useEffect } from 'react';
import DraggableModal from '../../shared/ui/DraggableModal';
import { IconTile, IconTileGrid } from '../../shared/ui/IconTile';
import { openModal } from '../../shared/modals/openModal';
import type { ShaderPackInfo } from '../../shared/platform/electronApi';
import { getActiveShader, listShaderPacks, setActiveShader } from '../../features/shaders/shaderRegistry';

// Shader icon - star/reflective glass vibes
const shaderIcon = 'M12 2L9.19 8.63 2 9.24l5.46 4.73L6.82 21 12 17.27 17.18 21l-.64-7.26L22 9.24l-7.19-.61z';

export function OpenShaderSelector() {
  return openModal('shaderSelector', close => <ShaderSelectorModal onClose={close} />);
}

export default function ShaderSelectorModal({ onClose }: { onClose: () => void }) {
  const [packs, setPacks] = useState<ShaderPackInfo[]>([]);
  const [activeShader, setActiveShaderState] = useState(getActiveShader);

  const selectShader = (packId: string) => {
    setActiveShaderState(packId);
    setActiveShader(packId);
  };

  // A saved pack whose folder was deleted falls back to the first one available
  useEffect(() => {
    let cancelled = false;
    void listShaderPacks().then(found => {
      if (cancelled) return;
      setPacks(found);
      if (found.length > 0 && !found.some(pack => pack.id === getActiveShader())) selectShader(found[0].id);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <DraggableModal
      title="Shaders"
      onClose={onClose}
      className="settings-modal"
      style={{ width: '480px', height: '72vh', minHeight: '72vh', maxHeight: '72vh', overflow: 'hidden' }}
      persistenceKey="shaderSelector"
      body={
        <IconTileGrid>
          {packs.map(pack => (
            <IconTile
              key={pack.id}
              label={pack.name}
              icon={shaderIcon}
              active={activeShader === pack.id}
              onClick={() => selectShader(pack.id)}
            />
          ))}
        </IconTileGrid>
      }
    />
  );
}
