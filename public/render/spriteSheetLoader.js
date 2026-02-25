(function initSpriteSheetLoader(globalScope) {
  class SpriteSheetLoader {
    constructor() {
      this.cache = new Map();
    }

    async load(path, metadata = {}) {
      const cacheKey = `${path}|${JSON.stringify(metadata)}`;
      if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

      const pending = this.#loadSprite(path, metadata).catch(() => null);
      this.cache.set(cacheKey, pending);
      return pending;
    }

    async #loadSprite(path, metadata) {
      const image = await this.#loadImage(path);
      const frameHeight = metadata.frameHeight || image.height;
      const frameWidth = metadata.frameWidth || frameHeight;
      const inferredCount = Math.max(1, Math.floor(image.width / frameWidth));
      const frameCount = metadata.frameCount || inferredCount;
      const fps = metadata.fps || 8;

      return {
        path,
        image,
        frameHeight,
        frameWidth,
        frameCount,
        fps
      };
    }

    #loadImage(path) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = path;
      });
    }
  }

  globalScope.SpriteSheetLoader = SpriteSheetLoader;
})(window);
