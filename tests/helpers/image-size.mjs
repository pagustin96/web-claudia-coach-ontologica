// Minimal pure-JS image size reader for PNG, JPEG and WebP (VP8, VP8L, VP8X).
// Returns { width, height } or throws on unsupported/corrupt data.

function png(buf) {
  if (buf.length < 24 || buf.toString('latin1', 1, 4) !== 'PNG') throw new Error('not a PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpeg(buf) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = buf.readUInt16BE(i + 2);
    // SOF0-SOF15 except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  throw new Error('JPEG SOF marker not found');
}

function webp(buf) {
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') {
    throw new Error('not a WebP');
  }
  const kind = buf.toString('latin1', 12, 16);
  if (kind === 'VP8 ') {
    // Lossy: 3-byte frame tag, 3-byte start code, then 14-bit width/height.
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (kind === 'VP8L') {
    // Lossless: signature byte 0x2f, then 14 bits width-1 and 14 bits height-1.
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8X') {
    // Extended: 24-bit little-endian canvas width-1 / height-1.
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  }
  throw new Error(`unsupported WebP chunk ${kind}`);
}

export function imageSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return png(buf);
  if (buf[0] === 0xff && buf[1] === 0xd8) return jpeg(buf);
  if (buf.toString('latin1', 0, 4) === 'RIFF') return webp(buf);
  throw new Error('unsupported image format');
}
