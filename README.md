# Arena Scaffold

Minimal browser game scaffold with a Node.js + Express backend and plain HTML/CSS/JS frontend.

## Folder tree
```text
.
├── package.json
├── server
│   └── index.js
└── public
    ├── app.js
    ├── assets
    │   └── README.md
    ├── challenge.html
    ├── game.html
    ├── index.html
    ├── recruit.html
    ├── styles.css
    └── summary.html
```

## How to run locally
```bash
npm install
npm start
```

Optional dev mode:
```bash
npm run dev
```

Then open `http://localhost:3000`.

## UX Upgrade Phase

- A persistent HUD now appears on all pages with gold, fighter identity, inferred HP bar, stat chips, record, and settings toggles.
- **Audio** and **Reduce Motion** preferences persist in `localStorage`.
- Combat/training/rest flows now use upgraded overlays, toasts, and richer fight playback visuals while preserving backend rules.

Unified training now appears as a single **Train** action on the Game page, and each successful training randomly improves exactly one of Strength, Agility, or Endurance while keeping existing costs, timing, injuries, and overlays. The Game page also includes a responsive gladiator card that attempts to load `/gifs/gladiator-idle.gif` and cleanly falls back to placeholder text if the GIF is not present.

### Optional assets (safe fallbacks)

The UI tries to load these files and gracefully degrades if they are missing:

- `public/gifs/train.gif`, `public/gifs/rest.gif`
- `public/gifs/fight-left.gif`, `public/gifs/fight-right.gif`
- `public/gifs/recruit-1.gif`, `public/gifs/recruit-2.gif`, `public/gifs/recruit-3.gif`
- `public/images/bg-arena.jpg`
- `public/gifs/crowd-loop.gif`
- `public/audio/crowd-loop.mp3`, `public/audio/hit.mp3`, `public/audio/coin.mp3`, `public/audio/click.mp3`

Current implementation uses existing `/public/assets/*` placeholders where available.


## Assets setup

Binary image/GIF files are intentionally excluded from this repository.

Add local placeholder assets to `public/assets/` with the names documented in `public/assets/README.md` before running the UI if you want full visual presentation.
