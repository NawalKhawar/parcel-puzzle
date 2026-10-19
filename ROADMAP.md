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

## Milestones 9.1 - 9.17 — Additions Requested After Milestone 9
These were requested directly after Milestone 9 was finished, so they sit between
Milestone 9 and Milestone 10 rather than being renumbered. All seventeen are **done**; their
detailed decisions are in `TRACKER.md`'s Decision Log. Together they turn the single
"shift" of Milestone 9 into the real game structure: **30 levels (days), each made of
several trucks (puzzles)**, with a title screen at the front and a shop/apartment at the
back of each day.

### Milestone 9.1 — Title Screen, Day Flow & Persistent Pay (done)
**Goal:** The game opens on a title screen and plays as a sequence of days.

**Deliverables:**
- `TitleScene` ("Parcel Packing Puzzle" + a Play button that starts level 1, truck 1).
- Each truck's header reads "Level N · Truck k/total".
- Trucks of the same day follow each other with no pop-up in between (the shutter closes and the
  next truck starts); after a day's last truck, `DayCompleteScene` shows trucks completed + earnings with **Shop / Decorate / Next Day**
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
  right piece is placed there (and returns if that piece is lifted off the board or the
  board is reset).
- The solver moved to `src/core/Solver.js` (the game now uses it at runtime) with a
  `findHint` helper; tests cover it.

**DoD:** On level 2+, one press highlights a spot; placing the right piece by dragging
removes the highlight; the button stays faded for the rest of that truck.

### Milestone 9.5 — Shop UI (done, placeholder content)
**Goal:** The basic shop screen.

**Deliverables:**
- `ShopScene` showing a grid of labelled placeholder item boxes for the apartment; content
  comes from `src/data/shop.json`. (Built with Clothes / Accessories / Decor tabs; Milestone
  9.10 removed the tabs, and clothing, since the shop only sells apartment items.)

**DoD:** Shop opens from the day popup, shows the item boxes, Back returns to the popup.
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

### Milestone 9.7 — Shape-Gated Puzzle Pool (done)
**Goal:** A second set of puzzles in which piece shapes are introduced gradually, so complex
shapes only appear in later levels - the data needed to build the new shape progression.

**Deliverables:**
- `src/data/levels.shapes.json`: 800 puzzles, same level structure as `levels.json` (same
  trucks per day, same easy/medium/hard order) but each truck slot holds a **pool of 5**
  alternative puzzles. Levels 1-3 use only the simple shapes (dot, domino_h, domino_v,
  tri_i, square, bar4); level 4 adds tri_l and l4; levels 7, 10, 13 and 16 add t4, s4, p5
  and plus (originally levels 1-2 / 3 / 8, 13, 18, 23 - changed in Milestones 9.12 and 9.17). At a level
  that introduces shapes, every puzzle contains at least one.
- `generate-levels.js --shape-gated [--pool=N]` builds it (the normal `levels.json` output
  is unchanged), `loadShapeLevels` validates it, `validate-levels.js --shapes` solves every
  puzzle, and `tests/data/shapeLevels.test.js` locks the unlock plan in.

**DoD:** `node scripts/validate-levels.js --shapes` reports all 800 puzzles solvable and the
tests confirm no puzzle uses a shape before the level that introduces it.

### Milestone 9.8 — Shape Progression in Gameplay (done)
**Goal:** The game itself plays the shape-gated puzzles, so complex shapes only appear in later
levels - still 30 levels with the same trucks per day and easy/medium/hard order.

**Deliverables:**
- `PuzzleScene` plays `levels.shapes.json` instead of `levels.json`.
- `src/data/pickDayPuzzles.js`: at the start of each day one puzzle is picked from each truck
  slot's pool, ordered easiest to hardest, and remembered for the rest of the day so a truck
  never changes mid-day. (Milestone 9.9 changed the pick from random to rotating.)
- Tests for the selection (one per slot, from its own pool, never getting easier, only
  unlocked shapes).

**DoD:** Playing from the title screen shows puzzles from the pools; level 1-2 puzzles only
use simple shapes; new shapes first appear at levels 4, 7, 10, 13 and 16.
`levels.json` is no longer played; it stays as the original reference set for the generator,
validator and tests.

### Milestone 9.9 — Rotation, Free Piece Movement & New-Piece Popup (done)
**Goal:** Three gameplay refinements requested after the shape progression went in.

**Deliverables:**
- **Rotating puzzles:** each level's puzzles now rotate through the 5 in every pool - first play
  uses the first puzzle of each pool, the next play the second, and so on, wrapping after the
  fifth - instead of picking at random. The play count per level is kept for as long as the
  game is open (and is not reset by starting a new game).
- **Pieces can be picked up again:** a placed piece can be dragged to a new spot, or dragged off
  the board to send it back to the tray; dropped somewhere illegal over the board it snaps back to
  where it was. This replaces the **Undo button, which is removed** (moving pieces by hand
  does the job without a fixed button); Reset and Pause stay. Placed pieces use an exact-shape
  click area so neighbouring pieces never steal each other's clicks.
- **New-piece popup:** at the start of a level that introduces shapes (4, 7, 10, 13, 16) a
  "New piece!" popup shows the new shapes and their names; it pops in with an overshoot, stays
  about 2 seconds, then shrinks away. Input is blocked while it is up.

**DoD:** Replaying level 1 six times gives puzzles 1, 2, 3, 4, 5, 1; a placed piece can be moved or
dragged off the board; there is no Undo button; the popup appears at the five introduction
levels only, on their first truck.

### Milestone 9.10 — Simpler Shop, New Economy & End-of-Day Report (done)
**Goal:** Settle what the shop sells and how money works, and give the end-of-day popup its
final content.

**Deliverables:**
- **Shop is one list of apartment items:** the Clothes / Accessories / Decor tabs are gone (no
  clothing at all); `shop.json` is now just `{ items: [...] }`.
- **Economy:** a truck pays **$10 easy, $15 medium, $35 hard** (set once in the generator and
  written into every puzzle's `reward`). Day 1 also pays a **$10 first-day bonus**, so the player
  has **$40 after day 1** (3 easy trucks = $30, + $10). Bonuses are data (`bonuses` on a level in
  `levels.shapes.json`), so more can be added later without code changes.
- **End-of-day popup:** headed by the employer - **Cozy Cargo** (originally "Adequate Parcel
  Service" with a tagline; renamed in Milestone 9.15, tagline dropped), and the **Outbound Packing Department** in smaller type (all from
  `src/data/company.json`) - then trucks completed, truck earnings, any bonuses (e.g. the
  first-day bonus), and the total earned that day.

**DoD:** After day 1 the popup shows 3 trucks, $30 truck earnings, +$10 first-day bonus and $40
total, and the coin counter reads $40; the shop shows no tabs.

### Milestone 9.11 — 16:9 Screen (done)
**Goal:** The game was laid out for a squarish 4:3 screen (1024 x 768); it now uses a
widescreen 16:9 design size so it fills a normal monitor, ahead of the final art.

**Deliverables:**
- The design size is **1280 x 720** (was 1024 x 768). Piece/cell sizes are unchanged (72 px cells).
- The apartment, shop and loading screen were re-laid out for the new shape; the puzzle screen
  needed no change (its layout is centred, and the extra width gives the piece tray more room).

**DoD:** Every screen fills the 16:9 canvas with nothing off-screen, including the tallest boards
(7 rows) and the most crowded trays, and the apartment's drag placement still lands in the right cells.

### Milestone 9.12 — Faster Shape Introduction (done)
**Goal:** Introduce new piece shapes more quickly: the first irregular shapes later (level 5)
but each following shape only 3 levels apart instead of 5.

**Deliverables:**
- Unlock schedule changed to: levels 1-4 simple shapes only; level 5 adds the L pieces (tri_l,
  l4); then one new shape every 3 levels - t4 at 8, s4 at 11, p5 at 14, plus at 17. (Was: L pieces
  at 3, then t4 / s4 / p5 / plus at 8 / 13 / 18 / 23.)
- `levels.shapes.json` regenerated for the new schedule; the new-piece popup follows
  automatically (it reads the level data), so it now shows at levels 5, 8, 11, 14 and 17.
- Tests updated to the new levels.

**DoD:** No puzzle uses a shape before its level; every puzzle at levels 5/8/11/14/17 contains
that level's new shape; levels 1-4 use only the six simple shapes.

### Milestone 9.13 — Square HUD Buttons (done)
**Goal:** Make the Reset and Pause controls compact and read as icons.

**Deliverables:**
- Reset is a square with an "R"; Pause is a square with "II" (it shows a play symbol while paused).
  The squares are as tall as the money panel and sit on the same row beside it, so the HUD reads
  as one bar. The Hint button stays as a text button below the row.
- The squares move with the money panel when the total grows wider.

**DoD:** Reset and Pause sit level with the money panel and do what they did before; the row stays
clear of the panel as the total grows.

### Milestone 9.14 — First Art: Pieces, Conveyor, Buttons (done)
**Goal:** Replace the placeholder rectangles with the first real art. (This is part of what Milestone
10 lists as "sprite-based rendering"; the truck frame, character, speech bubbles, clipboard
panel, backgrounds, shop and apartment art, and all audio are still to come.)

**Deliverables:**
- The art lives in the top-level `assets/` folder and is loaded by the Preloader (one Vite glob
  import; each file's name is its texture key).
- The 12 pieces are drawn with their art images (`assets/<shape id>.png`), also used in the
  new-piece popup.
- A conveyor belt along the bottom of the screen; the level's pieces sit in a single row on it,
  centred, shrinking a little only if the row would not fit (most puzzles fit at full size, none
  need less than 80%).
- Reset, Pause and Hint are square icon buttons in one row beside the money panel (the Hint icon
  fades after use, the Pause icon dims while paused).
- The title screen uses the Start Packing button image; only the pill is clickable, not its glow.

**DoD:** Every piece, the belt, the three icons and the Start Packing button show in the game, in
the dev server and in a production build, and dragging between the belt and the board still works.

### Milestone 9.15 — Truck, Shutter, Dark Belt, Button Feedback (done)
**Goal:** Put the truck art around the board, make the parcels fit the new belt, close the truck
when a puzzle is solved, and give buttons click feedback.

**Deliverables:**
- **Truck:** `truck-with-wheels.png` is a 9-slice frame stretched to fit each board's size (wheels,
  bumper and lights stay a fixed size in the corners). The grid is drawn in the truck's grey with
  slightly darker lines, so it looks baked into the frame.
- **Belt:** the new, darker `conveyor-belt-dark.png`, shown at 58% of its file size so it and the
  largest truck both fit the screen. Parcels are smaller on the belt (about 42 px per cell instead of
  72) and may overlap slightly - later parcels in front - when a level has many; they grow to board
  size when picked up. The row maths is in `src/core/TrayLayout.js` (tested).
- **Shutter:** on a win, `truck-shutter.png` rolls down over the board and parcels (cropped to the
  board's opening), rests briefly, then the usual overlay appears. Input is off meanwhile.
- **Button feedback:** every button squashes when pressed and springs back (`pressFeedback.js`).
  Buttons that change scene wait ~0.12 s so the squash can be seen.
- Company renamed **Cozy Cargo**, no tagline.

**DoD:** The truck fits every board from 2x4 to 5x5 and the 7-row boards, parcels never overlap
more than slightly, the shutter fully covers the board before the overlay appears, and every
button visibly reacts to a press.

### Milestone 9.16 — Full-Width Belt, Faster Shutter, Straight to the Next Truck (done)
**Goal:** Fill the lower band with the belt, make closing a truck snappy, and remove the
stop between trucks of the same day.

**Deliverables:**
- **Belt:** fills the full 1280 px width, at most 230 design px tall (if the art is taller than that
  it is squashed, so export it at about 2560x440). It is pushed 22 px below the screen edge so
  the bottom rollers are clipped and it seems to run off-screen. Parcels are about 52 px per cell
  and **never overlap** (overlap switched off again; a crowded row shrinks instead, down to the
  tested minimum).
- **Truck placement:** the truck always stands on the belt and grows upward; if a board is so tall
  that the truck would touch the top of the screen, the cells shrink to fit.
- **Shutter:** closes in 0.2 s (was 0.65 s) and the truck, board and parcels give a short
  single small down-and-up bob (5 px, no sideways shake) as it lands.
- **Flow:** after the shutter, the next truck of the day starts straight away. Only the day's last
  truck shows the end-of-day pop-up. `WinScene` is removed.
- Fixed: input stayed off after a truck was closed (the scene instance is reused).

**DoD:** A day plays truck to truck with no pop-up in between, the end-of-day pop-up still appears
after the last truck, input works on every truck, and no truck touches the top of the screen.

### Milestone 9.17 — L Pieces at Level 4 (done)
**Goal:** Bring the first irregular shapes one level earlier, keeping the 3-level interval.

**Deliverables:**
- Unlock schedule is now: levels 1-3 simple shapes only; level 4 adds the L pieces (tri_l, l4);
  then t4 at 7, s4 at 10, p5 at 13, plus at 16.
- `levels.shapes.json` regenerated (`SHAPE_UNLOCKS` in the generator); the new-piece popup follows
  automatically and now shows at levels 4, 7, 10, 13 and 16. `levels.json` is unchanged.
- Tests updated to the new levels.

**DoD:** No puzzle uses a shape before its level; every puzzle at levels 4/7/10/13/16 contains that
level's new shape; levels 1-3 use only the six simple shapes; all 800 puzzles solvable.

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
- Shop purchasing and spending coins; the apartment's real furniture/decor items (the UI and placement exist - see 9.5 / 9.6 - but
  with placeholder content only).
- Narrative FTUE panels (graduation → moving → job → apartment).
- Monetization (rewarded hint ads, interstitials).
- Progression/difficulty curve tuning across many workdays.

These remain in `docs/game_concept.pdf` as the source of truth for scope; they'll be
turned into their own milestones when we get there.
