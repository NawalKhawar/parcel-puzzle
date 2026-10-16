# ROADMAP — Parcel Packing Puzzle

This roadmap breaks the engineering work down into small, independently testable
milestones. It covers the **core polyomino packing puzzle** (grid, pieces, drag/snap,
solver, win detection) described in `docs/game_concept.pdf`. The surrounding meta loop
(paycheck, shop, apartment, narrative FTUE) is documented there for context but is
**out of scope** until the puzzle core is solid — later milestones are reserved for it
and will be expanded when we get there.

Each milestone lists:
- **Goal** — what it delivers.
- **Deliverables** — files/modules created or changed.
- **Definition of Done (DoD)** — a concrete CLI command or visual check that proves it works.

Design values that must stay tunable (not hardcoded) throughout, per the concept doc:
- Grid dimensions (rows x cols)
- Blocked/unusable cells per level
- Piece shapes and the set of shapes in use
- Number of pieces per level
- Orientation rules (currently: **no rotation**, fixed orientation only — but the engine
  should not assume this is permanent; see Milestone 1)

---

## Milestone 0 — Project & Tooling Alignment
**Goal:** Confirm the project builds and runs on the agreed stack before any game logic is written.

**Deliverables:**
- `package.json` dependency bump: `phaser` → `4.2.1` (currently `4.0.0` in both
  `package.json` and `node_modules`).
- Confirm `npm run dev` serves the stock template without errors.
- Confirm `npm run build` produces a `dist/` bundle without errors.

**DoD:**
- `npm install && npm run dev` starts the dev server on `http://localhost:8080` with no console errors.
- `npm run build` exits 0 and produces `dist/index.html`.

---

## Milestone 1 — Core Math Engine (pure, Phaser-free)
**Goal:** A standalone, framework-agnostic module that models polyomino shapes, grids,
and placement rules. This is the foundation the solver, the level validator, and the
Phaser scenes all build on — it must have zero dependency on Phaser so it can be unit
tested and reused by CLI scripts.

**Deliverables:**
- `src/core/Shape.js` — defines a polyomino shape as a set of relative `{row, col}`
  cells (fixed orientation, origin-normalized). Includes the base shape vocabulary
  (dot, domino_h, domino_v, tri_i, tri_l, square, bar4, l4, t4, s4, p5, plus) as data,
  not special-cased logic, so new shapes can be added without code changes.
- `src/core/Grid.js` — represents a level's board: dimensions, blocked cells, and
  currently-filled cells. Exposes `canPlace(shape, originRow, originCol)`,
  `place(...)`, `remove(...)`, and `isComplete()`.
- `src/core/Placement.js` — pure functions for translating a shape to board
  coordinates and checking bounds/overlap/blocked-cell conflicts.
- Shape and orientation logic is isolated so that adding rotation later (if the design
  changes) only requires extending `Shape.js`, not rewriting the engine.

**DoD:**
- A Node script (`node -e "..."` or a scratch script) can construct a `Grid`, place a
  few shapes, and correctly report `canPlace`/`isComplete` results with no Phaser import
  anywhere in the module graph (`grep -r "from 'phaser'" src/core` returns nothing).

---

## Milestone 2 — Fresh Level Data Schema & Loader
**Goal:** Define the new runtime level data format and a loader module. Legacy
`docs/level_data.md` is reference-only for shape vocabulary and difficulty ideas — it is
never imported at runtime.

**Deliverables:**
- `src/data/levels.schema.md` (or inline JSDoc typedef) describing the level shape:
  id, rows, cols, blocked cells, piece list (shape id + fixed board-relative position
  is NOT stored — pieces are unplaced at level start), difficulty metadata, etc.
- `src/data/levels.json` (or `.ts`) — a small starter set of hand-authored or
  solver-validated levels in the new schema (does not need to be 169 levels yet).
- `src/data/shapes.js` (or merged into `Shape.js`) — canonical shape definitions
  referenced by id from level data.
- `src/data/loadLevel.js` — loads/validates a level object against the schema at
  runtime (fails loudly on malformed data).

**DoD:**
- `node scripts/validate-levels.js` (built in Milestone 3, stubbed here if needed)
  or a simple assertion script loads every level in `levels.json` and confirms each
  parses into a valid `Grid` + piece list with no schema errors.

---

## Milestone 3 — Solver & Level Validator Script
**Goal:** A CLI tool (built on the Milestone 1 core engine) that brute-force/backtrack
solves a level, reports whether it's solvable, counts distinct solutions, and can
validate an entire level file in one pass — this is how we guarantee every shipped
level is actually completable before it reaches the game.

**Deliverables:**
- `scripts/solver.js` — exports a `solve(grid, pieces)` function returning solutions
  (or solution count, with an optional cap for performance).
- `scripts/validate-levels.js` — CLI entry point: loads `src/data/levels.json`, runs
  the solver on each level, prints a pass/fail report (solvable, unique vs. multiple
  solutions, piece count sanity, blocked-cell sanity).

**DoD:**
- `node scripts/validate-levels.js` runs against the current level set and exits 0
  when every level is solvable, printing a per-level summary table; exits non-zero
  and names the offending level if any level is unsolvable or malformed.

---

## Milestone 4 — Placeholder Phaser Scene (Board + Pieces, static)
**Goal:** Render a level's grid and its unplaced pieces in a Phaser scene using plain
colored rectangles/graphics — no drag, no interactivity yet. Proves the data pipeline
(Milestone 2) and rendering approach work together before interaction is layered on.

**Deliverables:**
- `src/game/scenes/PuzzleScene.js` — reads a level from `src/data/levels.json` via
  `loadLevel`, draws the grid (open cells vs. blocked cells visually distinct), and
  lays out the piece tray with each piece drawn as its true polyomino shape (placeholder
  colors, no art assets yet).
- `src/game/objects/GridView.js` and `src/game/objects/PieceView.js` — Phaser
  `GameObject`/Container wrappers that translate core-engine shape/grid data into
  drawn cells, using Phaser 4 APIs only.

**DoD:**
- `npm run dev`, navigate to the puzzle scene: the grid and all pieces for a chosen
  level render correctly and match the level's declared shape/blocked cells (visually
  verified against the level data).

---

## Milestone 5 — Drag & Snap Mechanics
**Goal:** Implement the core interaction loop described in the concept doc: drag a
piece, see it move with the pointer, and have it snap into the grid when the drop
position is a valid placement; reject/return the piece otherwise.

**Deliverables:**
- Pointer input wiring on `PieceView` (Phaser 4 input events).
- Snap logic bridging pointer/world coordinates to the Milestone 1 `Grid.canPlace`
  check, with visual snap-preview (e.g., ghost/highlight) while dragging.
- Invalid-drop handling: piece returns to the tray with no state change.
- Placed-piece locking: once placed, a piece occupies its cells and blocks further
  drags onto those cells.

**DoD:**
- In the running dev build, a piece can be dragged from the tray, previews a valid/
  invalid placement while hovering, snaps into place on a valid drop, and returns to
  the tray on an invalid drop — tested manually for at least one full level.

---

## Milestone 6 — Win Detection & Level Progression
**Goal:** Detect when the grid is fully and correctly filled, show a win state, and
allow moving to the next level.

**Deliverables:**
- Win check hooked to `Grid.isComplete()` after every successful placement.
- `src/game/scenes/WinScene.js` (or an in-scene win overlay).
- Basic level progression: load level N+1 from `levels.json` after a win.

**DoD:**
- Completing all placements on a level triggers the win state exactly once, and
  choosing "next" loads the following level cleanly (grid/pieces reset).

---

## Milestone 7 — Core Controls: Undo / Reset / Pause
**Goal:** Match the baseline controls shown in the concept art (Undo, Reset, Pause).

**Deliverables:**
- Placement history stack in the scene (or a small `PlacementHistory` core module)
  supporting undo of the last placement.
- Reset button clearing all placements for the current level.
- Pause overlay halting input (no real-time element to pause yet, but the control
  and state should exist).

**DoD:**
- Undo removes exactly the most recent placement and restores the piece to the tray;
  Reset returns the level to its initial unplaced state; Pause blocks board input
  until resumed.

---

## Milestone 8 — Unit & Regression Tests
**Goal:** Lock in correctness of the core engine and solver so future changes
(new shapes, grid sizes, orientation rules) can't silently break puzzle logic.

**Deliverables:**
- Test runner setup (lightweight — e.g. `node --test` or `vitest`, decide in this
  milestone and record the choice in `TRACKER.md`).
- `tests/core/` — unit tests for `Shape`, `Grid`, `Placement` (overlap, bounds,
  blocked cells, completion detection).
- `tests/solver/` — regression tests asserting known levels solve with expected
  solution counts.

**DoD:**
- A single command (e.g. `npm test`) runs all tests and exits 0; a deliberately broken
  placement rule causes a test to fail, proving the suite has teeth.

---

## Milestone 9 — UI & Win/Workday Screens
**Goal:** Build out the surrounding screens referenced in the concept doc's FTUE and
art reference: day/workday framing, truck counter, paycheck summary — scoped to what's
needed to present the puzzle loop clearly (full shop/apartment meta loop is future work,
tracked separately once the puzzle core is approved).

**Deliverables:**
- HUD elements: coin/paycheck display, undo/reset/pause buttons styled per concept art.
- "Workday complete" / shift summary screen (trucks completed, total earned) per the
  concept doc's art reference.
- Level/day select or sequential flow connecting multiple puzzle levels into a "shift."

**DoD:**
- Playing through several levels in sequence shows correct running totals and a
  shift-complete screen matching the data (trucks completed, earnings) at the end.

---

## Milestones 9.1 - 9.6 — Additions Requested After Milestone 9
These were requested directly after Milestone 9 was finished, so they sit between
Milestone 9 and Milestone 10 rather than being renumbered. All six are **done**; their
detailed decisions are in `TRACKER.md`'s Decision Log. Together they turn the single
"shift" of Milestone 9 into the real game structure: **30 levels (days), each made of
several trucks (puzzles)**, with a title screen at the front and a shop/apartment at the
back of each day.

### Milestone 9.1 — Title Screen, Day Flow & Persistent Pay (done)
**Goal:** The game opens on a title screen and plays as a sequence of days.

**Deliverables:**
- `TitleScene` ("Parcel Packing Puzzle" + a Play button that starts level 1, truck 1).
- Each truck's header reads "Level N · Truck k/total".
- Between trucks, `WinScene` shows the reward and the pay count; after a day's last truck,
  `DayCompleteScene` shows trucks completed + earnings with **Shop / Decorate / Next Day**
  (Next Day becomes **Finish** after level 30, returning to the title).
- The pay count carries over between days (it only resets on a new game).

**DoD:** Play -> every truck of a level -> day popup -> Next Day starts the next level,
with the coin total never resetting between days.

### Milestone 9.2 — 30 Levels, Generated (done)
**Goal:** Enough content, with a smooth difficulty ramp, without hand-authoring each puzzle.

**Deliverables:**
- `levels.json` restructured to levels (days) -> trucks (puzzles); `loadLevel.js` and
  `levels.schema.md` updated; `reward`, `difficulty` and `difficultyScore` per truck.
- `scripts/generate-levels.js`: seeded, solver-verified generator and difficulty scorer.
  Plan: level 1 = 3 easy trucks; levels 2-7 = 4 (2 easy, 2 medium); levels 8-12 = 5
  (2 easy, 2 medium, 1 hard); levels 13-30 = 6 (2 easy, 2 medium, 2 hard).
- `tests/data/levels.test.js` locks the plan in; `validate-levels.js` checks every truck.

**DoD:** `node scripts/validate-levels.js` reports all 160 trucks solvable and `npm test`
confirms the exact easy/medium/hard order of every level.

### Milestone 9.3 — Portrait / Square Boards (done)
**Goal:** Boards are square or portrait because they will represent the open back of a
mail truck.

**Deliverables:**
- Generator limited to portrait/square sizes (2-7 rows x 2-5 cols); levels regenerated.
- `PuzzleScene` sizes cells per truck so tall boards still leave room for the tray.
- A test that fails if any shipped board is landscape.

**DoD:** Every truck has rows >= cols and the tallest boards (7 rows) fit on screen with
their tray.

### Milestone 9.4 — Hint Button (done)
**Goal:** A once-per-truck hint, available from level 2 onwards.

**Deliverables:**
- Hint button in the HUD (hidden on level 1); faded and disabled after use.
- Pressing it **highlights**, with a pulsing gold overlay, the cells where one piece
  belongs. It never places, moves or removes anything: if the player's placements are a
  dead end the highlight can sit over their wrong pieces. The highlight stays until the
  right piece is placed there (and returns if that piece is undone).
- The solver moved to `src/core/Solver.js` (the game now uses it at runtime) with a
  `findHint` helper; tests cover it.

**DoD:** On level 2+, one press highlights a spot; placing the right piece by dragging
removes the highlight; the button stays faded for the rest of that truck.

### Milestone 9.5 — Shop UI (done, placeholder content)
**Goal:** The basic shop screen.

**Deliverables:**
- `ShopScene` with three horizontal tabs (Clothes, Accessories, Decor), each showing
  labelled placeholder boxes; content comes from `src/data/shop.json`.

**DoD:** Shop opens from the day popup, all three tabs switch, Back returns to the popup.
Nothing can be bought yet (see Future).

### Milestone 9.6 — Apartment UI (done, placeholder content)
**Goal:** The apartment where furniture is placed on a grid, in a 2.5D room.

**Deliverables:**
- `ApartmentScene` (the popup's Decorate button): flat back wall, angled floor/side walls,
  grid-based placement, an inventory of placeholder furniture of different sizes.
- Dragging shows a ghost (green = legal, red = not); letting go places the item; placed
  items can be picked up again or dragged back to the inventory; layout is remembered.
- Pure, unit-tested logic in `src/core/RoomProjection.js` (exactly invertible 2.5D
  mapping + box polygons) and `src/core/RoomGrid.js` (placement rules, back-to-front draw
  order so nearer items cover farther ones); data in `src/data/apartment.json`.

**DoD:** Items can be dragged in, placed, moved, overlapped correctly front-to-back,
rejected when illegal, and returned to the inventory.

---

## Milestone 10 — Visual Polish & Audio
**Goal:** Replace placeholder rectangles with real art/animation and add sound,
once the core loop (Milestones 1–9) is validated and stable.

**Deliverables:**
- Sprite-based piece/grid rendering (replacing Graphics placeholders).
- Snap/place/win sound effects and simple juice (tween on snap, win celebration).
- Art pass aligned with the reference screenshots in `docs/game_concept.pdf`.

**DoD:**
- A full level can be played start-to-finish with final art/audio in place and no
  placeholder graphics remaining in the puzzle scene.

---

## Future / Not Yet Scheduled
Explicitly deferred until the puzzle core above is approved and stable:
- Shop purchasing and spending coins; equipping clothes/accessories on a character; the
  apartment's real furniture/decor items (the UI and placement exist - see 9.5 / 9.6 - but
  with placeholder content only).
- Narrative FTUE panels (graduation → moving → job → apartment).
- Monetization (rewarded hint ads, interstitials).
- Progression/difficulty curve tuning across many workdays.

These remain in `docs/game_concept.pdf` as the source of truth for scope; they'll be
turned into their own milestones when we get there.
