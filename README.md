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


## Assets setup

Binary image/GIF files are intentionally excluded from this repository.

Add local placeholder assets to `public/assets/` with the names documented in `public/assets/README.md` before running the UI if you want full visual presentation.
