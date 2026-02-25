(function initPaletteSwap(globalScope) {
  const recolorCache = new Map();

  function normalizeHex(hex) {
    const clean = String(hex || '').replace('#', '').trim();
    if (clean.length === 3) {
      return clean.split('').map((char) => char + char).join('');
    }
    return clean.padStart(6, '0').slice(0, 6);
  }

  function hexToRgba(hex) {
    const normalized = normalizeHex(hex);
    return [
      parseInt(normalized.slice(0, 2), 16),
      parseInt(normalized.slice(2, 4), 16),
      parseInt(normalized.slice(4, 6), 16),
      255
    ];
  }

  function buildMapping(canonicalGroups, selectedGroups) {
    const mapping = new Map();
    Object.keys(canonicalGroups || {}).forEach((groupName) => {
      const source = canonicalGroups[groupName] || [];
      const target = selectedGroups[groupName] || source;
      const targetCycle = target.length || source.length || 1;
      source.forEach((sourceColor, index) => {
        const sourceRgba = hexToRgba(sourceColor);
        const targetRgba = hexToRgba(target[index % targetCycle] || sourceColor);
        mapping.set(sourceRgba.join(','), targetRgba);
      });
    });
    return mapping;
  }

  function mappingKey(mapping) {
    return Array.from(mapping.entries()).map(([from, to]) => `${from}->${to.join(',')}`).join('|');
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
      const sourceKey = `${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`;
      const replacement = mapping.get(sourceKey);
      if (!replacement) continue;
      pixels[i] = replacement[0];
      pixels[i + 1] = replacement[1];
      pixels[i + 2] = replacement[2];
      pixels[i + 3] = replacement[3];
    }
    ctx.putImageData(imgData, 0, 0);
    recolorCache.set(key, canvas);
    return canvas;
  }

  globalScope.PaletteSwap = {
    buildMapping,
    recolorSprite
  };
})(window);
