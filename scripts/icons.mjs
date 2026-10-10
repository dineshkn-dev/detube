/**
 * Zero-dependency extension icon generator.
 *
 * Chrome MV3 requires raster icons (SVG is not supported for `icons` /
 * `action.default_icon`), and pulling in a native image library (sharp/canvas)
 * would add supply-chain risk the project explicitly avoids. So the prism mark
 * is rasterised here with signed-distance-function geometry and 4–6x
 * supersampling, then encoded as PNG with only `node:zlib`.
 *
 * Usage: node scripts/icons.mjs [outDir]   (default: dist/icons)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const SIZES = [16, 32, 48, 128];

/* ------------------------------------------------------------------ PNG ---- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // compression, filter, interlace are already 0.

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------- geometry ---- */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (a, b, t) => a + (b - a) * t;

const SPECTRUM_STOPS = [
  [124, 92, 255], // violet
  [91, 140, 255], // indigo
  [34, 211, 238], // cyan
  [52, 211, 153], // emerald
  [251, 191, 36], // amber
  [251, 113, 133], // rose
];

/** Smooth spectral ramp. */
function spectrum(t) {
  const scaled = clamp(t, 0, 1) * (SPECTRUM_STOPS.length - 1);
  const index = Math.min(SPECTRUM_STOPS.length - 2, Math.floor(scaled));
  const f = scaled - index;
  const a = SPECTRUM_STOPS[index];
  const b = SPECTRUM_STOPS[index + 1];
  return [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)];
}

/** Three discrete, high-contrast bands — reads far crisper than a ramp at 16px. */
const SPECTRUM_BANDS = [
  [124, 92, 255],
  [34, 211, 238],
  [251, 191, 36],
];

function sdSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
}

function sdRoundRect(px, py, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(px - cx) - (halfW - radius);
  const qy = Math.abs(py - cy) - (halfH - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function inTriangle(px, py, a, b, c) {
  const edge = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const d1 = edge([px, py], a, b);
  const d2 = edge([px, py], b, c);
  const d3 = edge([px, py], c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function sdTriangle(px, py, a, b, c) {
  const distance = Math.min(
    sdSegment(px, py, a[0], a[1], b[0], b[1]),
    sdSegment(px, py, b[0], b[1], c[0], c[1]),
    sdSegment(px, py, c[0], c[1], a[0], a[1]),
  );
  return inTriangle(px, py, a, b, c) ? -distance : distance;
}

/* ------------------------------------------------------------- artwork ----- */

const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

/** Source-over compositing in straight-alpha space. */
function over(dst, colour, alpha) {
  if (alpha <= 0) return dst;
  const outAlpha = alpha + dst.a * (1 - alpha);
  if (outAlpha <= 0) return TRANSPARENT;
  return {
    r: (colour[0] * alpha + dst.r * dst.a * (1 - alpha)) / outAlpha,
    g: (colour[1] * alpha + dst.g * dst.a * (1 - alpha)) / outAlpha,
    b: (colour[2] * alpha + dst.b * dst.a * (1 - alpha)) / outAlpha,
    a: outAlpha,
  };
}

/**
 * Every size shares the same dark squircle base, so the icon is recognisably the
 * same mark at 16px and 128px. Only the foreground detail is reduced as the
 * canvas shrinks — sub-pixel rays would just alias into mush.
 */
function baseLayer(u, v, size) {
  const inset = 1.0 / size;
  if (sdRoundRect(u, v, 0.5, 0.5, 0.5 - inset, 0.5 - inset, 0.235) > 0) return TRANSPARENT;

  const t = clamp(v, 0, 1);
  const out = { r: mix(28, 9, t), g: mix(34, 12, t), b: mix(50, 18, t), a: 1 };
  const sheen = 0.12 * Math.max(0, 1 - Math.hypot(u - 0.28, v - 0.08) / 0.6);
  return over(out, [255, 255, 255], sheen);
}

const PRISM_TIERS = {
  full: { apex: [0.42, 0.28], left: [0.145, 0.7], right: [0.63, 0.7] },
  medium: { apex: [0.4, 0.27], left: [0.11, 0.72], right: [0.665, 0.72] },
  small: { apex: [0.5, 0.16], left: [0.12, 0.84], right: [0.88, 0.84] },
};

// Endpoints stay clear of the squircle edge so the mark keeps breathing room.
const RAYS = [
  [[0.565, 0.475], [0.885, 0.345], 0.1],
  [[0.63, 0.52], [0.905, 0.525], 0.5],
  [[0.565, 0.565], [0.885, 0.7], 0.9],
];

function tierFor(size) {
  if (size >= 128) return 'full';
  if (size >= 48) return 'medium';
  return 'small';
}

function sample(u, v, size) {
  const base = baseLayer(u, v, size);
  if (base.a === 0) return base;

  const tier = tierFor(size);
  const { apex, left, right } = PRISM_TIERS[tier];
  let out = base;

  const t = clamp((v - apex[1]) / (left[1] - apex[1]), 0, 1);
  const prismDistance = sdTriangle(u, v, apex, left, right);
  if (prismDistance <= 0) {
    let colour;
    if (tier === 'small') {
      colour = [...SPECTRUM_BANDS[Math.min(2, Math.floor(t * 3))]];
      const edge = clamp((-prismDistance * size) / 1.1, 0, 1);
      const shade = 0.82 + 0.18 * edge;
      colour = colour.map((channel) => channel * shade);
    } else {
      colour = spectrum(t * 0.72);
    }
    out = over(out, colour, 1);
  }

  // Incoming white light only where there is room for it to read.
  if (tier === 'full' && sdSegment(u, v, 0.045, 0.49, 0.165, 0.49) <= 0.014) {
    out = over(out, [236, 240, 247], 1);
  }

  if (tier !== 'small') {
    const thickness = tier === 'full' ? 0.017 : 0.024;
    for (const [from, to, stop] of RAYS) {
      if (sdSegment(u, v, from[0], from[1], to[0], to[1]) <= thickness) {
        out = over(out, spectrum(stop), 1);
      }
    }
  }

  return out;
}

function renderIcon(size) {
  const samples = size <= 32 ? 6 : 4;
  const buffer = Buffer.alloc(size * size * 4);
  const total = samples * samples;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let premulR = 0;
      let premulG = 0;
      let premulB = 0;
      let alphaSum = 0;

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const u = (x + (sx + 0.5) / samples) / size;
          const v = (y + (sy + 0.5) / samples) / size;
          const pixel = sample(u, v, size);
          // Accumulate premultiplied so transparent samples don't darken edges.
          premulR += pixel.r * pixel.a;
          premulG += pixel.g * pixel.a;
          premulB += pixel.b * pixel.a;
          alphaSum += pixel.a;
        }
      }

      const index = (y * size + x) * 4;
      const alpha = alphaSum / total;
      buffer[index] = Math.round(clamp(alphaSum > 0 ? premulR / alphaSum : 0, 0, 255));
      buffer[index + 1] = Math.round(clamp(alphaSum > 0 ? premulG / alphaSum : 0, 0, 255));
      buffer[index + 2] = Math.round(clamp(alphaSum > 0 ? premulB / alphaSum : 0, 0, 255));
      buffer[index + 3] = Math.round(clamp(alpha * 255, 0, 255));
    }
  }

  return buffer;
}

export async function generateIcons(outDir) {
  await mkdir(outDir, { recursive: true });
  const written = [];
  for (const size of SIZES) {
    const png = encodePng(size, size, renderIcon(size));
    const file = path.join(outDir, `icon-${size}.png`);
    await writeFile(file, png);
    written.push(file);
  }
  return written;
}

export { renderIcon, encodePng, SIZES };

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'dist/icons');
  generateIcons(outDir)
    .then((files) => {
      for (const file of files) console.log(`icon → ${path.relative(root, file)}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
