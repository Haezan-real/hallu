//src/modals/themes/ThemeColorEditor.tsx
import { useState, useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { OpenColorPicker } from '../colorPicker/ColorPicker';
import { toHexColor } from '../../shared/lib/color';
import { colorFields, type ColorVarName } from './colorFields';
import { applyThemeToDocument, getThemeColors } from './themes';

// Swatches for each theme color. Picking a color swaps Themes for the color picker,
// and closing the picker calls `reopenThemes`.
export default function ThemeColorEditor({ themeName, closeThemes, reopenThemes }: {
  themeName: string;
  closeThemes: () => void;
  reopenThemes: () => void;
}) {
  const [colors, setColors] = useState<Record<string, string>>(() => {
    const styles = getComputedStyle(document.documentElement);
    const initial: Record<string, string> = {};
    colorFields.forEach(c => { initial[c.varName] = toHexColor(styles.getPropertyValue(c.varName).trim() || '#000000'); });
    return initial;
  });
  const prevThemeRef = useRef(themeName);

  // Only reset colors when the theme actually changes, not on re-mount
  useEffect(() => {
    if (prevThemeRef.current !== themeName) {
      prevThemeRef.current = themeName;
      applyThemeToDocument(themeName);
      setColors({ ...getThemeColors(themeName) });
    }
  }, [themeName]);

  function setColor(varName: string, hex: string) {
    document.documentElement.style.setProperty(varName, hex);
    setColors(prev => ({ ...prev, [varName]: hex }));
  }

  function handleColorClick(varName: string, currentValue: string) {
    const colorField = colorFields.find(c => c.varName === varName);
    closeThemes();
    OpenColorPicker({
      value: currentValue,
      onChange: (hex: string) => setColor(varName, hex),
      targetElement: colorField ? colorField.label : 'Color',
      onClose: reopenThemes,
    });
  }

  const defaultColors = getThemeColors(themeName);

  return (
    <div style={{ flex: 1, padding: 12, overflow: 'auto' }}>
      <div className="appearance-plain">
        {colorFields.map(field => {
          const isCustom = colors[field.varName] !== defaultColors[field.varName];
          return (
            <div key={field.varName} className="color-field">
              <div className="color-label">{field.label}</div>
              <div className="color-controls">
                <button type="button" className="color-swatch" style={{ backgroundColor: colors[field.varName] || '#000000' }} onClick={() => handleColorClick(field.varName, colors[field.varName] || '#000000')} title="Click to pick a color" />
                {isCustom && (
                  <button type="button" className="icon-btn" onClick={() => setColor(field.varName, defaultColors[field.varName as ColorVarName])} title="Reset to default" style={{ width: 24, height: 24, color: 'var(--text-muted)' }}>
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
