// Applies anti-aliased rounded corners to a square BGRA bitmap
// (the format produced by Electron's NativeImage#toBitmap).
function roundIconCorners(bitmap, size, radius) {
  const output = Buffer.from(bitmap);
  const half = size / 2;
  const inner = half - radius;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.max(Math.abs(x + 0.5 - half) - inner, 0);
      const dy = Math.max(Math.abs(y + 0.5 - half) - inner, 0);
      const coverage = Math.min(1, Math.max(0, 0.5 - (Math.hypot(dx, dy) - radius)));
      if (coverage === 1) continue;

      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel++) {
        output[offset + channel] = Math.round(output[offset + channel] * coverage);
      }
    }
  }
  return output;
}

module.exports = { roundIconCorners };
