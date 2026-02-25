const DEFAULT_CANONICAL_URL = '/sprites/palettes/canonical.json';
const DEFAULT_VARIANTS_URL = '/sprites/palettes/variants.json';

let palettePromise = null;

function normalizeHexRgba(hex) {
  const cleaned = String(hex || '').trim().replace(/^#/, '').toUpperCase();
  if (cleaned.length !== 8) throw new Error(`Expected #RRGGBBAA color, got "${hex}".`);
  return `#${cleaned}`;
}

function rgbaHexToInt(hex) {
  return parseInt(normalizeHexRgba(hex).slice(1), 16) >>> 0;
}

function pickVariantEntry(groupVariants, selector) {
  if (!Array.isArray(groupVariants) || !groupVariants.length) {
    throw new Error('Variant group is missing or empty.');
  }

  if (typeof selector === 'number') {
    const index = Math.max(0, Math.min(groupVariants.length - 1, selector));
    return groupVariants[index];
  }

  if (selector && typeof selector === 'object') {
    return selector;
  }

  return groupVariants[0];
}

export async function loadCanonicalPalette({
  canonicalUrl = DEFAULT_CANONICAL_URL,
  variantsUrl = DEFAULT_VARIANTS_URL,
  fetchImpl = fetch
} = {}) {
  if (!palettePromise) {
    palettePromise = Promise.all([
      fetchImpl(canonicalUrl).then((res) => {
        if (!res.ok) throw new Error(`Failed to load canonical palette: ${canonicalUrl}`);
        return res.json();
      }),
      fetchImpl(variantsUrl).then((res) => {
        if (!res.ok) throw new Error(`Failed to load variants palette: ${variantsUrl}`);
        return res.json();
      })
    ]).then(([canonical, variants]) => {
      const byName = new Map(Object.entries(canonical.colors || {}).map(([key, hex]) => [key, normalizeHexRgba(hex)]));
      const groups = canonical.groups || {};
      const transparentHex = normalizeHexRgba(canonical.transparent || '#00000000');

      return {
        canonical,
        variants,
        byName,
        groups,
        transparentHex,
        transparentInt: rgbaHexToInt(transparentHex)
      };
    });
  }

  return palettePromise;
}

export function buildSwapMap(
  { skinVariant, hairVariant, clothVariant, metalVariant, leatherVariant, eyeVariant } = {},
  paletteData
) {
  if (!paletteData) throw new Error('paletteData is required. Call loadCanonicalPalette first.');

  const selectors = {
    skin: skinVariant,
    hair: hairVariant,
    cloth: clothVariant,
    metal: metalVariant,
    leather: leatherVariant,
    eye: eyeVariant
  };

  const mapping = Object.create(null);

  Object.entries(paletteData.groups).forEach(([groupName, keys]) => {
    const variantEntry = pickVariantEntry(paletteData.variants[groupName], selectors[groupName]);

    keys.forEach((colorKey) => {
      const sourceHex = paletteData.byName.get(colorKey);
      if (!sourceHex) throw new Error(`Canonical color key missing: ${colorKey}`);

      const targetHex = normalizeHexRgba(variantEntry[colorKey] || sourceHex);
      mapping[rgbaHexToInt(sourceHex)] = rgbaHexToInt(targetHex);
    });
  });

  return mapping;
}
