# TouchGame

TouchGame is a retro touch arcade collection for quick classroom mini games.

## Features

- 60 touch-friendly mini games
- Category filters for speed, brain, math, knowledge, co-op, and puzzle games
- Quick select filters for short games, two-player games, co-op games, and puzzles
- Offline-ready static site with a service worker
- Local metadata-driven game registration
- Vercel-ready static deployment

## Local Check

```bash
npm run verify
```

For a local preview, serve the folder with any static server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Add A Game

Create a folder under `games/{folder}` with these files:

```text
games/{folder}/
  game.json
  index.html
  style.css
  game.js
```

Then run:

```bash
npm run register:game -- games/{folder}
npm run verify
```

The registration script fills missing classification metadata where it can and adds the folder to `games/registry.json`.

See [docs/ADDING_GAMES.md](docs/ADDING_GAMES.md) for the full game metadata format.

## Vercel Deployment

This is a static site. Vercel can deploy it directly from the repository root.

- Framework preset: Other
- Build command: empty
- Output directory: empty/root
- Install command: default or empty

`vercel.json` keeps service worker and manifest files fresh for deployed visitors.
