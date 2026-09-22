// Generates scripts/app-icon.png (1024x1024 RGBA) without any image dependency:
// indigo->blue diagonal gradient, rounded square, white rounded bar-chart glyph.
import zlib from 'node:zlib';
import fs from 'node:fs';

const W = 1024, H = 1024, R = 180;

// --- PNG chunk helpers ---
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

// --- draw ---
const px = new Uint8Array(W * H * 4);
const lerp = (a, b, t) => a + (b - a) * t;
const inRound = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
};
const bar = { w: 110, gap: 35, base: 780, r: 26, xs: [306, 451, 596], hs: [260, 420, 560] };

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (!inRound(x, y, 0, 0, W - 1, H - 1, R)) { px[i + 3] = 0; continue; }
    const t = (x + y) / (W + H);
    px[i] = Math.round(lerp(0x25, 0x4f, t));   // blue-600 -> indigo-600
    px[i + 1] = Math.round(lerp(0x63, 0x46, t));
    px[i + 2] = Math.round(lerp(0xeb, 0xe5, t));
    px[i + 3] = 255;
    // bars
    for (let b = 0; b < 3; b++) {
      const x0 = bar.xs[b], x1 = x0 + bar.w, y0 = bar.base - bar.hs[b];
      if (x >= x0 && x <= x1 && y >= y0 && y <= bar.base) {
        const cx = Math.min(Math.max(x, x0 + bar.r), x1 - bar.r);
        const cy = Math.min(Math.max(y, y0 + bar.r), bar.base);
        if ((x - cx) ** 2 + (y - cy) ** 2 <= bar.r * bar.r) {
          px[i] = 255; px[i + 1] = 255; px[i + 2] = 255;
        }
      }
    }
  }
}

// --- encode ---
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0;
  Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync('scripts/app-icon.png', png);
console.log('wrote scripts/app-icon.png', png.length, 'bytes');
