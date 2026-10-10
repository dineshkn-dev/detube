// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateIcons } from '../scripts/icons.mjs';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SIZES = [16, 32, 48, 128];

let dir: string;
let files: string[];

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'dt-icons-'));
  files = await generateIcons(dir);
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('icon generator', () => {
  it('writes the four sizes Chrome needs', () => {
    expect(files.map((file) => path.basename(file)).sort()).toEqual([
      'icon-128.png',
      'icon-16.png',
      'icon-32.png',
      'icon-48.png',
    ]);
  });

  it('emits structurally valid PNGs at the declared dimensions', async () => {
    for (const size of SIZES) {
      const buffer = await readFile(path.join(dir, `icon-${size}.png`));

      expect(buffer.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
      // Byte 8..11 is the first chunk length, 12..15 its type.
      expect(buffer.subarray(12, 16).toString('latin1')).toBe('IHDR');
      expect(buffer.readUInt32BE(16)).toBe(size); // IHDR width
      expect(buffer.readUInt32BE(20)).toBe(size); // IHDR height
      expect(buffer.length).toBeGreaterThan(100);
      // Ends with an IEND chunk.
      expect(buffer.subarray(buffer.length - 8, buffer.length - 4).toString('latin1')).toBe('IEND');
    }
  });

  it('produces a mark with visible, non-uniform pixels', async () => {
    const buffer = await readFile(path.join(dir, 'icon-128.png'));
    const pixels = new Set<string>();
    for (let offset = 8 + 25; offset < buffer.length - 4; offset += 37) {
      pixels.add(`${buffer[offset]},${buffer[offset + 1]},${buffer[offset + 2]}`);
    }
    // A blank or single-colour icon would collapse to very few distinct values.
    expect(pixels.size).toBeGreaterThan(5);
  });
});
