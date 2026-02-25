(function initPaletteSwap(globalScope) {
  const recolorCache = new Map();
  let palettePromise = null;

  function normalizeHexRgba(hex) {
    const cleaned = String(hex || '').trim().replace(/^#/, '').toUpperCase();
    if (cleaned.length !== 8) throw new Error(`Expected #RRGGBBAA color, got "${hex}".`);
    return `#${cleaned}`;
  }

  function rgbaHexToInt(hex) {
    return parseInt(normalizeHexRgba(hex).slice(1), 16) >>> 0;
  }

  function rgbaToInt(r, g, b, a) {
    return (((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | (a & 255)) >>> 0;
  }

  function intToRgba(intColor) {
    return [
      (intColor >>> 24) & 255,
      (intColor >>> 16) & 255,
      (intColor >>> 8) & 255,
      intColor & 255
    ];
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

  async function loadCanonicalPalette() {
    if (!palettePromise) {
      palettePromise = Promise.all([
        fetch('/sprites/palettes/canonical.json').then((res) => {
          if (!res.ok) throw new Error('Unable to load canonical palette.');
          return res.json();
        }),
        fetch('/sprites/palettes/variants.json').then((res) => {
          if (!res.ok) throw new Error('Unable to load palette variants.');
          return res.json();
        })
      ]).then(([canonical, variants]) => {
        const byName = new Map(Object.entries(canonical.colors || {}).map(([name, hex]) => [name, normalizeHexRgba(hex)]));
        const groups = canonical.groups || {};
        return { canonical, variants, byName, groups };
      });
    }

    return palettePromise;
  }

  function buildSwapMap(
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
      keys.forEach((key) => {
        const sourceHex = paletteData.byName.get(key);
        if (!sourceHex) throw new Error(`Unknown canonical key: ${key}`);
        const targetHex = normalizeHexRgba(variantEntry[key] || sourceHex);
        mapping[rgbaHexToInt(sourceHex)] = rgbaHexToInt(targetHex);
      });
    });

    return mapping;
  }

  function mappingKey(mapping) {
    return Object.entries(mapping)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([from, to]) => `${from}->${to}`)
      .join('|');
  }

  function recolorSprite(image, mapping, cacheKeyPrefix) {
    const key = `${cacheKeyPrefix}|${mappingKey(mapping)}`;
    if (recolorCache.has(key)) return recolorCache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const from = rgbaToInt(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]);
      const to = mapping[from];
      if (typeof to !== 'number') continue;
      const [r, g, b, a] = intToRgba(to);
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }

    ctx.putImageData(imgData, 0, 0);
    recolorCache.set(key, canvas);
    return canvas;
  }

  globalScope.PaletteSwap = {
    loadCanonicalPalette,
    buildSwapMap,
    recolorSprite
  };
})(window);
