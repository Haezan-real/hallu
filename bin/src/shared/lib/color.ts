//src/shared/lib/color.ts

function clampByte(n: number) { return Math.min(255, Math.max(0, Math.round(n))); }

export function hexToRgb(hex: string) {
  if (!hex) return { r: 0, g: 0, b: 0 };
  const h = hex.replace('#','');
  if (h.length === 3) {
    return {
      r: parseInt(h[0]+h[0], 16),
      g: parseInt(h[1]+h[1], 16),
      b: parseInt(h[2]+h[2], 16),
    };
  }
  return {
    r: parseInt(h.substring(0,2), 16),
    g: parseInt(h.substring(2,4), 16),
    b: parseInt(h.substring(4,6), 16),
  };
}



export function rgbToHex(r: number, g: number, b: number) {
  const toHex = (n: number) => clampByte(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// h in [0,360], s,l in [0,1]
export function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hh >= 0 && hh < 1) { r1 = c; g1 = x; b1 = 0; }
  else if (hh >= 1 && hh < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (hh >= 2 && hh < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (hh >= 3 && hh < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (hh >= 4 && hh < 5) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  const m = l - c/2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

export function hslToHex(h: number, s: number, l: number) {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

export function hexToHsl(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

export function hslCss(h: number, s: number, l: number) {
  return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

// Converts a computed CSS color (#rgb, #rrggbb or rgb()/rgba()) to #rrggbb
export function toHexColor(raw: string) {
  if (!raw) return '#000000';
  const v = raw.trim();
  if (v.startsWith('#')) {
    if (v.length === 4) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    return v;
  }
  if (v.startsWith('rgb')) {
    const nums = v.replace(/rgba?\(|\)/g, '').split(',').map(s => Number(s.trim()));
    return '#' + nums.slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('');
  }
  return '#000000';
}
