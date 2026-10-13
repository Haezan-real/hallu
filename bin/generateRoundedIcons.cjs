const { app, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { roundIconCorners } = require('./iconRounding.cjs');
const iconConfig = require('./appIcon.json');

const ICON_SIZES = [256, 128, 64, 48, 32, 16];

function createMultiDibIco(source) {
  const entries = [];

  for (const size of ICON_SIZES) {
    const radius = (iconConfig.cornerRadiusPx * size) / iconConfig.baseSizePx;
    const resized = source.resize({ width: size, height: size, quality: 'best' });
    const bgra = roundIconCorners(resized.toBitmap(), size, radius);

    const xorSize = size * size * 4;
    const andRowBytes = Math.ceil(size / 32) * 4;
    const andSize = andRowBytes * size;
    const headerSize = 40;
    const totalImageSize = headerSize + xorSize + andSize;

    const imgBuf = Buffer.alloc(totalImageSize);
    // BITMAPINFOHEADER (40 bytes)
    imgBuf.writeUInt32LE(40, 0); // biSize
    imgBuf.writeInt32LE(size, 4); // biWidth
    imgBuf.writeInt32LE(size * 2, 8); // biHeight (doubled for ICO format)
    imgBuf.writeUInt16LE(1, 12); // biPlanes
    imgBuf.writeUInt16LE(32, 14); // biBitCount
    imgBuf.writeUInt32LE(0, 16); // biCompression = BI_RGB
    imgBuf.writeUInt32LE(xorSize, 20); // biSizeImage

    // XOR mask: scanlines stored bottom-to-top
    let dstOff = 40;
    for (let y = size - 1; y >= 0; y--) {
      const srcOff = y * size * 4;
      bgra.copy(imgBuf, dstOff, srcOff, srcOff + size * 4);
      dstOff += size * 4;
    }

    // AND mask: 1 bit per pixel, 1 where alpha == 0 (transparent), bottom-to-top
    for (let y = size - 1; y >= 0; y--) {
      const rowBuf = Buffer.alloc(andRowBytes);
      for (let x = 0; x < size; x++) {
        const alpha = bgra[(y * size + x) * 4 + 3];
        if (alpha === 0) {
          const byteIndex = Math.floor(x / 8);
          const bitIndex = 7 - (x % 8);
          rowBuf[byteIndex] |= (1 << bitIndex);
        }
      }
      rowBuf.copy(imgBuf, dstOff);
      dstOff += andRowBytes;
    }

    entries.push({ size, imgBuf });
  }

  const count = entries.length;
  const headerSize = 6 + count * 16;
  let totalSize = headerSize;
  for (const entry of entries) {
    totalSize += entry.imgBuf.length;
  }

  const icoBuf = Buffer.alloc(totalSize);
  icoBuf.writeUInt16LE(0, 0); // Reserved
  icoBuf.writeUInt16LE(1, 2); // ICO format
  icoBuf.writeUInt16LE(count, 4); // Image count

  let currentOffset = headerSize;
  for (let i = 0; i < count; i++) {
    const entry = entries[i];
    const entryOffset = 6 + i * 16;
    icoBuf.writeUInt8(entry.size >= 256 ? 0 : entry.size, entryOffset);
    icoBuf.writeUInt8(entry.size >= 256 ? 0 : entry.size, entryOffset + 1);
    icoBuf.writeUInt8(0, entryOffset + 2);
    icoBuf.writeUInt8(0, entryOffset + 3);
    icoBuf.writeUInt16LE(1, entryOffset + 4);
    icoBuf.writeUInt16LE(32, entryOffset + 6);
    icoBuf.writeUInt32LE(entry.imgBuf.length, entryOffset + 8);
    icoBuf.writeUInt32LE(currentOffset, entryOffset + 12);

    entry.imgBuf.copy(icoBuf, currentOffset);
    currentOffset += entry.imgBuf.length;
  }

  return icoBuf;
}

function buildRoundedIco(variant, assetsDir) {
  const pngPath = path.join(assetsDir, `hallu_${variant}.png`);
  const icoPath = path.join(assetsDir, `hallu_${variant}.ico`);

  const source = nativeImage.createFromPath(pngPath);
  if (source.isEmpty()) {
    throw new Error(`Failed to load source image: ${pngPath}`);
  }

  const icoBuf = createMultiDibIco(source);
  fs.writeFileSync(icoPath, icoBuf);
  console.log(`Generated rounded ICO: ${icoPath} (${icoBuf.length} bytes)`);
}

app.whenReady().then(() => {
  const root = path.resolve(__dirname, '..');
  const assetsDir = path.join(root, 'assets', 'icons', 'app');

  buildRoundedIco('day', assetsDir);
  buildRoundedIco('night', assetsDir);

  app.quit();
  process.exit(0);
});
