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

## Adding a new palette group
1. Edit `/public/sprites/palettes/<rigType>.json`.
2. Add exact canonical colors under `groups.<name>`.
3. Add matching variant arrays in `PALETTE_PRESETS` in `public/render/combatRenderer.js`.
4. Palette swap maps exact RGBA colors once per asset + palette key and caches recolored sheets.

## Seed source
- Deterministic seed comes from `gladiator.id` when available.
- Fallback uses hash of `name + createdAt + userId` via `HashUtils.cyrb53`.
- See `showFightPlayback` in `public/app.js` and utilities in `public/utils/hash.js` + `public/utils/seededRng.js`.
