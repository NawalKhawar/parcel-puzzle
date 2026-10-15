# CLAUDE.md

Working agreements for AI-assisted development on **Parcel Packing Puzzle**.

## Project Overview

A cozy polyomino packing puzzle game (Phaser + Vite). Players drag fixed-orientation
polyomino pieces onto a grid board to completely fill a level's shape. See
`docs/game_concept.pdf` for the full design (core loop, FTUE, art reference,
monetization) and `docs/level_data.md` for legacy level examples. **Both files under
`docs/` are reference-only** — `docs/level_data.md` in particular must never be
imported or read by runtime code; the game consumes a brand-new level schema under
`src/data/`.

Planning documents, read in this order when picking up work:
1. `ROADMAP.md` — milestone plan with Definition of Done per milestone.
2. `TRACKER.md` — live checklist of current progress; update it as milestones complete.
3. `PROJECT_STRUCTURE.md` — where each file/module belongs and why.

## Tech Stack — read this before writing any code

- **Phaser 4.2.1** (not 4.0.0, not Phaser 3) with **Vite**.
- Always write **Phaser 4 syntax and APIs**. Phaser 4 introduced architectural changes
  from Phaser 3 (e.g. Render Nodes, the unified Filters system, updated GameObjects
  internals) — use these current APIs. **Never use deprecated Phaser 3 patterns** even
  if they still technically run; if unsure whether an API is current for 4.x, check the
  installed package (`node_modules/phaser/package.json` version) and official Phaser 4
  docs rather than assuming Phaser 3 knowledge carries over.
- `phaser@4.2.1` is installed (bumped from the stock template's `4.0.0` in Milestone 0).

## Code Standards

- **All code written in `src/` and `scripts/` must be thoroughly commented**, so the
  logic and mechanics are easy to follow:
  - Every exported function/class gets a JSDoc block (`@param`, `@returns`, and a
    one-line description of purpose).
  - Add inline comments wherever the logic isn't obvious from reading the code alone —
    especially grid/coordinate math, placement/overlap checks, and solver backtracking
    logic, since these are the parts most likely to be revisited or extended later.
  - Prefer comments that explain *why* a non-obvious approach was chosen, in addition to
    *what* the code does — this project is being read and extended by a non-engineer
    collaborator, so err on the side of more explanation rather than less.
- Keep `src/core/` and `src/data/` free of any `import ... from 'phaser'` — see
  "Architectural boundary" in `PROJECT_STRUCTURE.md`. This is what keeps the puzzle
  logic unit-testable and usable from plain Node scripts (`scripts/solver.js`,
  `scripts/validate-levels.js`) without a browser.
- Keep piece shapes, grid dimensions, blocked-cell layouts, and piece counts
  **data-driven** (via `src/data/`), not hardcoded into scene/engine code — the design
  doc explicitly calls out that these need to flex as difficulty/levels evolve.

## Verifying UI work

Phaser renders everything to a single `<canvas>` — there's no DOM to inspect or assert
against, so "it builds" is not evidence a scene looks right. Before reporting any
`src/game/` change as done, run `node scripts/screenshot.js` (launches the dev server,
drives headless Chromium via Playwright through Boot -> Preloader -> TitleScene -> click
Play -> PuzzleScene, saves screenshots, and reports any console errors) and actually look
at the resulting image. `@playwright/test` + a Chromium binary are installed as dev
dependencies specifically for this.

## Workflow

- Don't start a milestone's implementation without checking `TRACKER.md` for its
  current status and any open design decisions flagged there.
- When a milestone is completed, update the corresponding checkboxes in `TRACKER.md`
  and note the date; log any design decisions that changed along the way in its
  "Decision Log" section.
- `docs/level_data.md` is large (169 legacy levels) — read it selectively (grep/offset)
  rather than loading it in full when only the shape vocabulary or format is needed.
