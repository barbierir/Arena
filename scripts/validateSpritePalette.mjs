import fs from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = process.cwd();
const rigsDir = path.join(ROOT, 'public', 'sprites', 'rigs');
const canonicalPath = path.join(ROOT, 'public', 'sprites', 'palettes', 'canonical.json');

function normalizeHexRgba(hex) {
  const clean = String(hex || '').trim().replace(/^#/, '').toUpperCase();
  if (clean.length !== 8) {
    throw new Error(`Expected #RRGGBBAA, got "${hex}"`);
  }
  return `#${clean}`;
}

function rgbaToHex(r, g, b, a) {
  return `#${[r, g, b, a].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('')}`;
}

function hexToRgbaArray(hex) {
  const h = normalizeHexRgba(hex).slice(1);
  return [0, 2, 4, 6].map((start) => parseInt(h.slice(start, start + 2), 16));
}

function distSq(a, b) {
  return ((a[0] - b[0]) ** 2) + ((a[1] - b[1]) ** 2) + ((a[2] - b[2]) ** 2) + ((a[3] - b[3]) ** 2);
}

async function readPng(filePath) {
  const data = await fs.readFile(filePath);
  return PNG.sync.read(data);
}

async function walkPngFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkPngFiles(fullPath);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) return [fullPath];
    return [];
  }));
  return nested.flat();
}

function closestColorSuggestion(illegalHex, allowedHexes) {
  const illegal = hexToRgbaArray(illegalHex);
  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const allowed of allowedHexes) {
    const d = distSq(illegal, hexToRgbaArray(allowed));
    if (d < bestDist) {
      best = allowed;
      bestDist = d;
    }
  }
  return { color: best, distanceSq: bestDist };
}

async function main() {
  const canonicalRaw = JSON.parse(await fs.readFile(canonicalPath, 'utf8'));
  const transparent = normalizeHexRgba(canonicalRaw.transparent);
  const colorEntries = Object.entries(canonicalRaw.colors || {}).map(([name, hex]) => [name, normalizeHexRgba(hex)]);
  const allowedSet = new Set([transparent, ...colorEntries.map(([, hex]) => hex)]);
  const allowedHexes = [...allowedSet];

  const pngFiles = await walkPngFiles(rigsDir);
  if (!pngFiles.length) {
    console.log('No sprite PNGs found under public/sprites/rigs. Nothing to validate.');
    return;
  }

  let hadViolation = false;

  for (const filePath of pngFiles.sort()) {
    const png = await readPng(filePath);
    const counts = new Map();
    for (let i = 0; i < png.data.length; i += 4) {
      const hex = rgbaToHex(png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]);
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }

    const unique = [...counts.keys()].sort();
    const rel = path.relative(ROOT, filePath);
    console.log(`\n${rel}`);
    console.log(`  unique colors: ${unique.length}`);
    console.log(`  colors: ${unique.join(', ')}`);

    const illegal = unique.filter((hex) => !allowedSet.has(hex));
    if (!illegal.length) continue;

    hadViolation = true;
    console.error('  ❌ illegal colors detected:');
    for (const hex of illegal) {
      const suggestion = closestColorSuggestion(hex, allowedHexes);
      console.error(
        `    - ${hex}: ${counts.get(hex)} px (closest: ${suggestion.color}, dist²=${suggestion.distanceSq})`
      );
    }
  }

  if (hadViolation) {
    console.error('\nSprite palette validation failed. Use canonical palette colors only.');
    process.exit(1);
  }

  console.log('\nSprite palette validation passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
