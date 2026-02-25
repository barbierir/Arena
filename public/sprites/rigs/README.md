# Arena sprite rigs

## Naming contract
- Files live under `/public/sprites/rigs/<rigType>/`.
- Naming pattern: `<layerId>_<state>.png`.
- Required base layer for each state: `base_<state>.png`.
- Optional layers: `hair_*`, `beard_*`, `helmet_*`, `weapon_*`, `shield_*`.
- Supported states in renderer: `idle`, `attack`, `hit`, `block`, `death`.

Example:
- `base_idle.png`
- `hair_01_attack.png`
- `weapon_sword_hit.png`

## Adding a new layer
1. Add sprite-sheet PNGs for each state using the same frame geometry as the rig base.
2. Keep top-left alignment and transparent background so overlays line up.
3. Use a unique layer id prefix (`helmet_03`, `weapon_axe`, etc.).
4. Update style pools in `public/render/combatRenderer.js` if you want deterministic picker support.

## Palette system (canonical only)
1. Source of truth is `/public/sprites/palettes/canonical.json`.
2. Variant targets are in `/public/sprites/palettes/variants.json`.
3. Sprite files may only contain colors from canonical (plus `#00000000`).
4. Validate with `npm run validate:sprites`.
5. Optional dev repair: `npm run quantize:sprites -- <file-or-folder>`.
6. Runtime swap only maps exact canonical keys within declared groups and caches recolored assets once.

## Seed source
- Deterministic seed comes from `gladiator.id` when available.
- Fallback uses hash of `name + createdAt + userId` via `HashUtils.cyrb53`.
- See `showFightPlayback` in `public/app.js` and utilities in `public/utils/hash.js` + `public/utils/seededRng.js`.
