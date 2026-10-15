//src/modals/styles/themeColors.ts
// A style's theme colors, painted onto the app as CSS variables
import { colorFields, type ThemeColors } from './colorFields';
import { DEFAULT_STYLE, findStyle } from './styleLibrary';

// Colors a style leaves out come from the default style; '' means the stylesheet's own default
export function getThemeColors(styleId: string): ThemeColors {
  const fallback = findStyle(DEFAULT_STYLE);
  const style = findStyle(styleId) ?? fallback;
  const colors = {} as ThemeColors;
  for (const { varName } of colorFields) colors[varName] = style?.colors[varName] ?? fallback?.colors[varName] ?? '';
  return colors;
}

export function applyThemeToDocument(styleId: string) {
  const colors = getThemeColors(styleId);
  const rootStyle = document.documentElement.style;
  colorFields.forEach(({ varName }) => {
    if (colors[varName]) rootStyle.setProperty(varName, colors[varName]);
    else rootStyle.removeProperty(varName);
  });
}
