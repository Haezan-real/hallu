import appIconConfig from '../config/appIcon.json';

// Single source of truth lives in src/config/appIcon.json (also read by main.cjs).
export const ICON_CORNER_RADIUS_PX: number = appIconConfig.cornerRadiusPx;
export const ICON_BASE_SIZE_PX: number = appIconConfig.baseSizePx;

// The radius is defined at the base (header) size and scales with the icon.
export function scaledIconRadius(sizePx: number): number {
  return (ICON_CORNER_RADIUS_PX * sizePx) / ICON_BASE_SIZE_PX;
}

export function renderRoundedIcon(src: string, sizePx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = sizePx;
      canvas.height = sizePx;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('2D canvas is unavailable'));
        return;
      }
      context.beginPath();
      context.roundRect(0, 0, sizePx, sizePx, scaledIconRadius(sizePx));
      context.clip();
      context.drawImage(image, 0, 0, sizePx, sizePx);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error(`Could not load icon: ${src}`));
    image.src = src;
  });
}
