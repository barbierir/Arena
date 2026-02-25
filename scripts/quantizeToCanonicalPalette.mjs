import fs from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = process.cwd();
const canonicalPath = path.join(ROOT, 'public', 'sprites', 'palettes', 'canonical.json');
const defaultScanDir = path.join(ROOT, 'public', 'sprites', 'rigs');

function normalizeHexRgba(hex) {
  const clean = String(hex || '').trim().replace(/^#/, '').toUpperCase();
  if (clean.length !== 8) throw new Error(`Expected #RRGGBBAA, got "${hex}"`);
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

async function walkPngFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkPngFiles(fullPath);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.png') && !entry.name.endsWith('.quantized.png')) return [fullPath];
    return [];
  }));
  return nested.flat();
}

async function resolveTargets(args) {
  if (!args.length) return walkPngFiles(defaultScanDir);

  const targets = [];
  for (const raw of args) {
    const absolute = path.resolve(ROOT, raw);
    const stat = await fs.stat(absolute);
    if (stat.isDirectory()) {
      targets.push(...await walkPngFiles(absolute));
    } else if (stat.isFile() && absolute.toLowerCase().endsWith('.png')) {
      targets.push(absolute);
    }
  }
  return Array.from(new Set(targets));
}

async function main() {
  const canonicalRaw = JSON.parse(await fs.readFile(canonicalPath, 'utf8'));
  const transparent = normalizeHexRgba(canonicalRaw.transparent);
  const palette = Object.values(canonicalRaw.colors || {}).map(normalizeHexRgba).filter((hex) => hex !== transparent);

  const targets = await resolveTargets(process.argv.slice(2));
  if (!targets.length) {
    console.log('No PNG files found to quantize.');
    return;
  }

  for (const filePath of targets.sort()) {
    const source = PNG.sync.read(await fs.readFile(filePath));
    const replacementStats = new Map();
    let changed = 0;
    let opaquePixels = 0;

    for (let i = 0; i < source.data.length; i += 4) {
      const rgba = [source.data[i], source.data[i + 1], source.data[i + 2], source.data[i + 3]];
      if (rgba[3] === 0) continue;

      opaquePixels += 1;
      const originalHex = rgbaToHex(...rgba);
      let best = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const candidateHex of palette) {
        const candidate = hexToRgbaArray(candidateHex);
        const d = distSq(rgba, candidate);
        if (d < bestDist) {
          best = candidate;
          bestDist = d;
        }
      }

      if (best && (best[0] !== rgba[0] || best[1] !== rgba[1] || best[2] !== rgba[2] || best[3] !== rgba[3])) {
        source.data[i] = best[0];
        source.data[i + 1] = best[1];
        source.data[i + 2] = best[2];
        source.data[i + 3] = best[3];
        changed += 1;
        const toHex = rgbaToHex(...best);
        const key = `${originalHex} -> ${toHex}`;
        replacementStats.set(key, (replacementStats.get(key) || 0) + 1);
      }
    }

    const outputPath = filePath.replace(/\.png$/i, '.quantized.png');
    await fs.writeFile(outputPath, PNG.sync.write(source));

    const relIn = path.relative(ROOT, filePath);
    const relOut = path.relative(ROOT, outputPath);
    const changedPct = opaquePixels ? ((changed / opaquePixels) * 100).toFixed(2) : '0.00';

    console.log(`\n${relIn}`);
    console.log(`  output: ${relOut}`);
    console.log(`  opaque pixels changed: ${changed}/${opaquePixels} (${changedPct}%)`);

    const top = [...replacementStats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!top.length) {
      console.log('  replacements: none');
    } else {
      console.log('  top replacements:');
      top.forEach(([key, count]) => console.log(`    - ${key}: ${count}`));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
