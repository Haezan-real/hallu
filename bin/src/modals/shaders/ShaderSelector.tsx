//src/modals/shaders/ShaderSelector.tsx
import { useState, useEffect } from 'react';
import DraggableModal from '../../shared/ui/DraggableModal';
import { IconTile, IconTileGrid } from '../../shared/ui/IconTile';
import { openModal } from '../../shared/modals/openModal';
import { getActiveShader, listShaders, setActiveShader } from './shaderRegistry';

// Shader icon - star/reflective glass vibes
const shaderIcon = 'M12 2L9.19 8.63 2 9.24l5.46 4.73L6.82 21 12 17.27 17.18 21l-.64-7.26L22 9.24l-7.19-.61z';

const displayName = (shaderName: string) => shaderName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

export function OpenShaderSelector() {
  return openModal('shaderSelector', close => <ShaderSelectorModal onClose={close} />);
}

export default function ShaderSelectorModal({ onClose }: { onClose: () => void }) {
  const [shaders] = useState(listShaders);
  const [activeShader, setActiveShaderState] = useState(getActiveShader);

  const selectShader = (shaderName: string) => {
    setActiveShaderState(shaderName);
    setActiveShader(shaderName);
  };

  // A saved shader whose folder was deleted falls back to the first one available
  useEffect(() => {
    if (!shaders.includes(activeShader)) selectShader(shaders[0]);
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
          {shaders.map(shaderName => (
            <IconTile
              key={shaderName}
              label={displayName(shaderName)}
              icon={shaderIcon}
              active={activeShader === shaderName}
              onClick={() => selectShader(shaderName)}
            />
          ))}
        </IconTileGrid>
      }
    />
  );
}
