(function initCombatRenderer(globalScope) {
  const DEFAULT_RIG_META = {
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 6,
    fps: 8
  };

  const LAYER_ORDER = ['base', 'hair', 'beard', 'helmet', 'weapon', 'shield'];
  const STYLE_VARIANTS = {
    hair: ['hair_01', 'hair_02', 'hair_03'],
    beard: ['beard_01', 'beard_02'],
    helmet: ['helmet_01', 'helmet_02'],
    weapon: ['weapon_sword', 'weapon_spear', 'weapon_trident'],
    shield: ['shield_round', 'shield_tower']
  };

  function pick(list, rng, fallback = null) {
    if (!Array.isArray(list) || !list.length) return fallback;
    return list[Math.floor(rng() * list.length)] || fallback;
  }

  function resolveWeapon(stats, rng) {
    if (stats && stats.AGI >= stats.STR + 2) return rng() > 0.5 ? 'weapon_spear' : 'weapon_trident';
    if (stats && stats.STR >= stats.AGI + 2) return rng() > 0.35 ? 'weapon_sword' : 'weapon_spear';
    return pick(STYLE_VARIANTS.weapon, rng, 'weapon_sword');
  }

  function buildAppearance(seed, rigType, gladiatorStats = {}) {
    const rng = globalScope.SeededRng.create(seed);
    const isHeavy = rigType === 'heavy';
    const isAgile = rigType === 'agile';

    return {
      layers: {
        base: 'base',
        hair: rng() > 0.15 ? pick(STYLE_VARIANTS.hair, rng, 'hair_01') : null,
        beard: rng() > 0.55 ? pick(STYLE_VARIANTS.beard, rng, 'beard_01') : null,
        helmet: rng() > (isAgile ? 0.72 : 0.38) ? pick(STYLE_VARIANTS.helmet, rng, 'helmet_01') : null,
        weapon: resolveWeapon(gladiatorStats, rng),
        shield: isHeavy ? (rng() > 0.12 ? pick(STYLE_VARIANTS.shield, rng, 'shield_round') : null) : (rng() > 0.65 ? 'shield_round' : null)
      },
      paletteVariant: {
        skinVariant: Math.floor(rng() * 3),
        hairVariant: Math.floor(rng() * 3),
        clothVariant: Math.floor(rng() * 3),
        metalVariant: Math.floor(rng() * 3),
        leatherVariant: Math.floor(rng() * 2),
        eyeVariant: Math.floor(rng() * 2)
      }
    };
  }

  class CombatRenderer {
    constructor({ canvas, leftGladiator, rightGladiator, seedLeft, seedRight, rigLeft = 'heavy', rigRight = 'agile' }) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.loader = new globalScope.SpriteSheetLoader();
      this.running = false;
      this.rafId = null;
      this.lastTs = 0;
      this.accumulator = 0;
      this.frameIndex = 0;
      this.stateExpireAt = { left: 0, right: 0 };
      this.state = { left: 'idle', right: 'idle' };
      this.meta = DEFAULT_RIG_META;

      this.fighters = {
        left: {
          seed: seedLeft,
          rigType: rigLeft,
          gladiator: leftGladiator || {},
          facing: 1,
          xRatio: 0.3,
          eventIntensity: 0,
          appearance: buildAppearance(seedLeft, rigLeft, leftGladiator?.stats || {})
        },
        right: {
          seed: seedRight,
          rigType: rigRight,
          gladiator: rightGladiator || {},
          facing: -1,
          xRatio: 0.7,
          eventIntensity: 0,
          appearance: buildAppearance(seedRight, rigRight, rightGladiator?.stats || {})
        }
      };

      this.assets = {
        left: { idle: {}, attack: {}, hit: {}, block: {}, death: {} },
        right: { idle: {}, attack: {}, hit: {}, block: {}, death: {} }
      };
    }

    async start() {
      await Promise.all([this.#prepareFighter('left'), this.#prepareFighter('right')]);
      this.running = true;
      this.lastTs = performance.now();
      this.rafId = requestAnimationFrame((ts) => this.#loop(ts));
    }

    stop() {
      this.running = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    triggerEvent(type, side) {
      if (!this.fighters[side]) return;
      const state = ['attack', 'hit', 'block', 'death'].includes(type) ? type : 'idle';
      this.state[side] = state;
      this.stateExpireAt[side] = Date.now() + (state === 'death' ? 999999 : 420);
      this.fighters[side].eventIntensity = state === 'hit' ? 1 : 0.35;
    }

    async #prepareFighter(side) {
      const fighter = this.fighters[side];
      const paletteData = await globalScope.PaletteSwap.loadCanonicalPalette();
      const swapMap = globalScope.PaletteSwap.buildSwapMap(fighter.appearance.paletteVariant, paletteData);

      const assetStates = ['idle', 'attack', 'hit', 'block', 'death'];
      await Promise.all(assetStates.map(async (stateName) => {
        await Promise.all(LAYER_ORDER.map(async (layerName) => {
          const layerId = fighter.appearance.layers[layerName];
          if (!layerId) return;
          const assetPath = `/sprites/rigs/${fighter.rigType}/${layerId}_${stateName}.png`;
          const loaded = await this.loader.load(assetPath, this.meta);
          if (!loaded) return;

          const recolored = globalScope.PaletteSwap.recolorSprite(loaded.image, swapMap, `${assetPath}|${fighter.seed}`);
          this.meta = {
            frameWidth: loaded.frameWidth,
            frameHeight: loaded.frameHeight,
            frameCount: loaded.frameCount,
            fps: loaded.fps
          };
          this.assets[side][stateName][layerName] = {
            ...loaded,
            image: recolored
          };
        }));
      }));
    }

    #loop(ts) {
      if (!this.running) return;
      const dt = ts - this.lastTs;
      this.lastTs = ts;
      this.accumulator += dt;

      const frameDuration = 1000 / (this.meta.fps || DEFAULT_RIG_META.fps);
      while (this.accumulator >= frameDuration) {
        this.frameIndex = (this.frameIndex + 1) % (this.meta.frameCount || DEFAULT_RIG_META.frameCount);
        this.accumulator -= frameDuration;
      }

      this.#draw();
      this.rafId = requestAnimationFrame((nextTs) => this.#loop(nextTs));
    }

    #draw() {
      const { width, height } = this.canvas;
      this.ctx.clearRect(0, 0, width, height);

      this.#drawFighter('left');
      this.#drawFighter('right');
    }

    #drawFighter(side) {
      const fighter = this.fighters[side];
      const now = Date.now();
      if (this.state[side] !== 'death' && now > this.stateExpireAt[side]) this.state[side] = 'idle';

      const activeStateAssets = this.assets[side][this.state[side]];
      const idleAssets = this.assets[side].idle;
      const ctx = this.ctx;

      const drawHeight = this.canvas.height * 0.55;
      const drawWidth = drawHeight;
      const groundY = this.canvas.height * 0.86;
      const drawX = this.canvas.width * fighter.xRatio;
      const drawY = groundY - drawHeight;

      ctx.save();
      if (fighter.eventIntensity > 0.01) {
        const shake = fighter.eventIntensity * 3;
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        fighter.eventIntensity *= 0.88;
      }
      if (fighter.facing < 0) {
        ctx.translate(drawX + drawWidth / 2, 0);
        ctx.scale(-1, 1);
        ctx.translate(-(drawX + drawWidth / 2), 0);
      }

      LAYER_ORDER.forEach((layerName) => {
        const sheet = activeStateAssets[layerName] || idleAssets[layerName];
        if (!sheet || !sheet.image) return;

        const sourceX = this.frameIndex * sheet.frameWidth;
        ctx.drawImage(
          sheet.image,
          sourceX,
          0,
          sheet.frameWidth,
          sheet.frameHeight,
          drawX - drawWidth / 2,
          drawY,
          drawWidth,
          drawHeight
        );
      });

      if (!Object.keys(activeStateAssets).length && !Object.keys(idleAssets).length) {
        ctx.fillStyle = side === 'left' ? 'rgba(240,200,120,.7)' : 'rgba(120,180,240,.7)';
        ctx.fillRect(drawX - 45, drawY + 24, 90, 170);
      }

      ctx.restore();
    }
  }

  globalScope.CombatRenderer = CombatRenderer;
})(window);
