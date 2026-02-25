# Sprite Palette Rules (Exact Color Index Strategy)

To keep runtime palette swapping deterministic, every sprite pixel must come from `/public/sprites/palettes/canonical.json` only.

## Hard rules
- No anti-aliasing.
- No gradients.
- Use only canonical palette colors.
- Export as PNG with transparency.
- Do not add outlines using off-palette colors.
- Transparent pixels must be exactly `#00000000`.

## Validation + repair workflow
1. Run `npm run validate:sprites` before committing.
2. If errors appear, either re-export with the exact palette or run:
   - `npm run quantize:sprites -- <path-or-folder>`
3. Review generated `.quantized.png` files and re-export clean art when possible.

## AI prompt addendum
When using AI to generate source art, append this instruction block:

- Use EXACT these colors only: `#F2C6A0FF #DFAF8AFF #B77D5AFF #3A2A1AFF #2A1A10FF #8A1C1CFF #5A0F0FFF #C9A24EFF #8B6A2BFF #7A4A2DFF #4C2A18FF #1C5AA6FF #00000000`.
- No intermediate shades.
- Hard pixel edges.
- Flat separated color zones.
- No anti-aliased edges.
