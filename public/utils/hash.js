(function initHashUtils(globalScope) {
  function cyrb53(value, seed = 0) {
    const text = String(value || '');
    let h1 = 0xDEADBEEF ^ seed;
    let h2 = 0x41C6CE57 ^ seed;

    for (let index = 0; index < text.length; index += 1) {
      const charCode = text.charCodeAt(index);
      h1 = Math.imul(h1 ^ charCode, 2654435761);
      h2 = Math.imul(h2 ^ charCode, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  globalScope.HashUtils = {
    cyrb53
  };
})(window);
