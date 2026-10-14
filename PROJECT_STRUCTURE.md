# PROJECT STRUCTURE

Map of the folder/file architecture and what belongs where. This reflects the target
layout as milestones in `ROADMAP.md` are completed — not everything listed here exists
yet; check `TRACKER.md` for current progress.

```
parcel-puzzle/
├── docs/                       Reference material only — never imported at runtime.
│   ├── game_concept.pdf        Game design doc: core loop, FTUE, art reference, monetization.
│   └── level_data.md           Legacy solver-generated level examples (shape vocabulary
│                                and difficulty ideas only — NOT the runtime level format).
│
├── public/
│   └── assets/                 Static assets served as-is (images, audio). Referenced via
│                                Phaser Loader paths like 'assets/foo.png', copied verbatim
│                                into dist/ on build.
│
├── src/
│   ├── main.js                 App bootstrap: waits for DOMContentLoaded, starts the Phaser game.
│   │
│   ├── core/                   PURE game-rule engine. No Phaser imports allowed here —
│   │   │                       this is what makes the logic unit-testable and reusable by
│   │   │                       scripts/ (solver, validator) as well as the Phaser scenes.
│   │   ├── Shape.js            Polyomino shape definitions (relative cell coordinates) and
│   │   │                       the canonical shape vocabulary (dot, domino_h, l4, p5, etc).
│   │   ├── Grid.js             Board model: dimensions, blocked cells, filled cells;
│   │   │                       canPlace/place/remove/isComplete.
│   │   └── Placement.js        Pure helpers: translate a shape to board coords, check
│   │                           bounds/overlap/blocked-cell conflicts.
│   │
│   ├── data/                   Runtime level data — the NEW schema (replaces the legacy
│   │   │                       docs/level_data.md format entirely). Shape geometry itself
│   │   │                       is NOT duplicated here — levels reference shape ids that
│   │   │                       are defined once, canonically, in core/Shape.js.
│   │   ├── levels.json         Level definitions: id, rows, cols, blocked cells, piece list,
│   │   │                       difficulty metadata, optional reward (coins earned — see
│   │   │                       PuzzleScene.handleWin). (or levels.ts if we add typing later)
│   │   ├── levels.schema.md    Human-readable description of the level object shape.
│   │   └── loadLevel.js        Loads + validates a level object at runtime; throws loudly
│   │                           on malformed data instead of failing silently in-scene.
│   │
│   ├── game/                   Phaser-specific code. Everything here MAY import 'phaser'
│   │   │                       and should translate core/ + data/ into rendered, interactive
│   │   │                       game objects — it should not contain puzzle-rule logic itself.
│   │   ├── main.js             Phaser.Game config (scale, scenes list) and the StartGame()
│   │   │                       factory consumed by src/main.js.
│   │   ├── uiScale.js          Exports UI_SCALE (devicePixelRatio, capped at 2), used to
│   │   │                       multiply every pixel constant in src/game/ so the canvas
│   │   │                       stays sharp on full-screen/high-DPI displays (Scale.FIT only
│   │   │                       ever resizes the canvas's CSS size, never its pixel buffer).
│   │   ├── scenes/
│   │   │   ├── Boot.js         Minimal first scene; kicks off the Preloader.
│   │   │   ├── Preloader.js    Loads shared assets, then starts PuzzleScene directly —
│   │   │   │                   there is deliberately no main menu; the game opens
│   │   │   │                   straight into the first level.
│   │   │   ├── PuzzleScene.js  The core gameplay scene: renders a level's grid + piece
│   │   │   │                   tray, owns drag/snap interaction, win detection, the
│   │   │   │                   Undo/Reset/Pause + coin HUD, and the running shift totals
│   │   │   │                   (kept in the Phaser registry, not this scene instance,
│   │   │   │                   since a fresh PuzzleScene instance is created per level).
│   │   │   ├── WinScene.js     Per-level ("truck") complete overlay: reward earned +
│   │   │   │                   running shift total, button to start the next level.
│   │   │   ├── ShiftCompleteScene.js  Shown once every level in levels.json has been
│   │   │   │                   completed in order (one full "shift"): final trucks-
│   │   │   │                   completed/total-earned totals, button starts a new shift.
│   │   │   └── GameOver.js     Existing template scene — repurpose or remove once
│   │   │                       WinScene fully covers its role.
│   │   └── objects/
│   │       ├── GridView.js     Draws a Grid (core/Grid.js) as cells on screen; open vs.
│   │       │                   blocked cell styling; also owns ghost/snap-preview
│   │       │                   rendering for a piece being dragged.
│   │       ├── PieceView.js    Draws a single piece as its true polyomino shape; owns
│   │       │                   pointer input and drag state (not placement legality).
│   │       └── PlacementHistory.js  Ordered stack of placement ids for Undo/Reset.
│   │
│   └── (future) apartment/, shop/   Explicitly deferred — see ROADMAP.md "Future / Not Yet
│                                     Scheduled". Not created until those milestones start.
│
├── scripts/                    Node CLI tools. solver.js/validate-levels.js consume
│   │                           src/core and src/data directly (no Phaser dependency,
│   │                           run outside the browser); screenshot.js is the one
│   │                           exception (see below) — it drives the real browser build.
│   ├── solver.js               Backtracking solver: given a Grid + piece list, finds
│   │                           solution(s).
│   ├── validate-levels.js      CLI entry point: runs the solver against every level in
│   │                           src/data/levels.json, prints a pass/fail report.
│   ├── screenshot.js           Dev/QA helper: launches the dev server, drives headless
│   │                           Chromium (Playwright) through the boot sequence into
│   │                           PuzzleScene, saves a screenshot + reports console errors.
│   │                           This is how src/game/ UI work gets visually verified
│   │                           (Phaser renders to a single <canvas>, so there's no DOM
│   │                           to assert against any other way). Output goes to
│   │                           scripts/.screenshots/ (gitignored).
│   └── .screenshots/           Gitignored output directory for screenshot.js.
│
├── tests/                      Unit & regression tests, run via `npm test` (Node's
│   │                           built-in `node --test` — see TRACKER.md's Milestone 8
│   │                           decision log for why that was chosen over vitest/etc).
│   ├── core/                   Tests for Shape/Grid/Placement correctness.
│   └── solver/                 Regression tests asserting known levels solve as expected.
│
├── vite/
│   ├── config.dev.mjs          Dev server Vite config.
│   └── config.prod.mjs         Production build Vite config.
│
├── index.html                  HTML shell containing the #game-container element.
├── package.json                Dependencies/scripts (phaser, vite, terser, `npm test`).
├── CLAUDE.md                   Working agreements for AI-assisted development on this repo.
├── ROADMAP.md                  Milestone plan (see there for sequencing and DoD per milestone).
├── TRACKER.md                  Live checklist tracking progress against ROADMAP.md.
└── PROJECT_STRUCTURE.md        This file.
```

## Key architectural boundary

The single most important rule in this structure: **`src/core/` and `src/data/` never
import `phaser`.** That boundary is what lets `scripts/solver.js` and `scripts/validate-
levels.js` run in plain Node (fast, scriptable, CI-friendly) and what lets `tests/`
exercise puzzle logic without spinning up a browser or a Phaser game instance.
`src/game/` is the only layer allowed to depend on Phaser, and it should stay a thin
rendering/input layer over `core/` + `data/` rather than reimplementing puzzle rules.
