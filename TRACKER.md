# TRACKER — Current Progress

Last updated: 2026-10-15

This file is the live checklist companion to `ROADMAP.md`. Update checkboxes and the
"Current Status" section as work completes so we stay aligned on where things stand.
See `PROJECT_STRUCTURE.md` for where each deliverable belongs.

## Current Status

**Phase:** Milestone 9 complete. Milestones 1-7 plus three rounds of UX fixes (no main
menu, generous/magnetic snap, fixed piece color with a board-side ghost preview, a
padded piece hit area, a Container-origin hit-testing fix, sharper full-screen/Retina
rendering via UI_SCALE, and tray pieces that shrink to fit) were already done; this
session added Milestone 8 (a `node --test` suite covering `src/core/` and the solver,
46 tests, `npm test`) and Milestone 9 (every level in levels.json now acts as one
"truck" in a single "shift" per docs/game_concept.pdf — a coin HUD, per-truck reward
text on WinScene, and a new ShiftCompleteScene showing final trucks-completed/
total-earned totals once the last level is finished, with a button that starts a fresh
shift). See Decision Log for both.
**2026-10-15 — Game flow & content pass (outside the numbered milestones, requested
directly):** the game now opens on a title screen (`TitleScene`, "Parcel Packing
Puzzle" + a Play button) and ships 30 levels (days) / 160 trucks (puzzles) — level 1 has
3 easy trucks, levels 2-7 have 4 (2 easy, 2 medium), levels 8-12 have 5 (+1 hard), levels 13-30 have 6 (2 hard).
Each truck shows "Level N · Truck k/total"; the last truck of a day opens
`DayCompleteScene` (trucks completed + earnings; Shop / Decorate / Next Day, where
Shop and Decorate are blank placeholder screens with a Back button). The data is
produced by the new `scripts/generate-levels.js`. 215 tests, `npm test`. See Decision
Log.
**Next step:** Start Milestone 10 (Visual Polish & Audio) — real shop/decorate content
(the blank screens above) remains deferred until then.

## Open Design Decisions / Flags

- [x] **Browser automation for UI verification**: this session had no working browser
      tool (no `chromium-cli`, no Claude-in-Chrome/computer-use, no project run skill).
      Resolved by installing `@playwright/test` + Chromium as a dev dependency and
      adding `scripts/screenshot.js` (see Decision Log) — `node scripts/screenshot.js`
      is now the standing way to visually verify `src/game/` changes, documented in
      `CLAUDE.md`'s new "Verifying UI work" section.
- [x] **Test runner choice**: `node --test` (Node's own built-in runner), not `vitest`
      or another added dependency — see Milestone 8's Decision Log entry for why.
- [x] Starter level count for Milestone 2 (new schema): 7 hand-constructed levels
      shipped as a pipeline-proving starter set (see Decision Log). Expanding the set
      (more levels, more variety, legacy-scale counts) is future content work, not a
      blocker for later milestones.

## Milestones

- [x] **Milestone 0 — Project & Tooling Alignment** (done 2026-10-14)
  - [x] Bump `phaser` to `4.2.1` in `package.json`
  - [x] Verify `npm run dev` works
  - [x] Verify `npm run build` works

- [x] **Milestone 1 — Core Math Engine** (done 2026-10-14)
  - [x] `src/core/Shape.js`
  - [x] `src/core/Grid.js`
  - [x] `src/core/Placement.js`
  - [x] Manual/script verification of `canPlace` / `isComplete`

- [x] **Milestone 2 — Fresh Level Data Schema & Loader** (done 2026-10-14)
  - [x] `src/data/levels.schema.md`
  - [x] `src/data/levels.json` (7 starter levels)
  - [x] `src/data/loadLevel.js`

- [x] **Milestone 3 — Solver & Level Validator Script** (done 2026-10-14)
  - [x] `scripts/solver.js`
  - [x] `scripts/validate-levels.js`
  - [x] Clean validator run against starter level set

- [x] **Milestone 4 — Placeholder Phaser Scene** (done 2026-10-14)
  - [x] `src/game/scenes/PuzzleScene.js`
  - [x] `src/game/objects/GridView.js`
  - [x] `src/game/objects/PieceView.js`
  - [x] Visual check in dev server (via `scripts/screenshot.js`, see Decision Log)

- [x] **Milestone 5 — Drag & Snap Mechanics** (done 2026-10-14)
  - [x] Pointer drag wiring
  - [x] Snap preview + valid/invalid feedback
  - [x] Placed-piece locking
  - [x] Manual playtest of one full level

- [x] **Milestone 6 — Win Detection & Level Progression** (done 2026-10-14)
  - [x] Win check wired to `Grid.isComplete()`
  - [x] `WinScene.js` / win overlay
  - [x] Next-level loading

- [x] **Milestone 7 — Undo / Reset / Pause** (done 2026-10-14)
  - [x] Placement history + undo
  - [x] Reset
  - [x] Pause overlay

- [x] **Milestone 8 — Unit & Regression Tests** (done 2026-10-14)
  - [x] Test runner chosen and configured (`node --test`)
  - [x] `tests/core/` suite (Shape, Grid, Placement — 35 tests)
  - [x] `tests/solver/` regression suite (micro-levels + all 7 shipped levels — 11 tests)
  - [x] `npm test` green (46/46), confirmed to actually catch regressions (see Decision Log)

- [x] **Milestone 9 — UI & Win/Workday Screens** (done 2026-10-14)
  - [x] HUD (coin/paycheck display + undo/reset/pause buttons)
  - [x] Workday/shift-complete screen (`ShiftCompleteScene.js`)
  - [x] Multi-level sequential flow (all of `levels.json` = one shift)

- [ ] **Milestone 10 — Visual Polish & Audio**
  - [ ] Sprite-based rendering
  - [ ] SFX
  - [ ] Art pass

## Deferred (not scheduled yet)
- [ ] Apartment decoration system & shop
- [ ] Narrative FTUE panels
- [ ] Monetization (rewarded ads, interstitials)
- [ ] Long-term difficulty/progression curve tuning

## Decision Log
*(Append here whenever a design decision changes mid-stream, with date.)*

- 2026-10-14 — Confirmed: `docs/level_data.md` is reference-only; runtime levels live
  in a brand-new `src/data/` schema (Milestone 2).
- 2026-10-14 — Confirmed: no piece rotation (per `docs/game_concept.pdf`), but the
  core engine (Milestone 1) must not hardcode this assumption in a way that blocks
  adding rotation later if design changes.
- 2026-10-14 — Milestone 0 done: `phaser` bumped `4.0.0` → `4.2.1` (confirmed 4.2.1 is
  a real published version), `npm install` clean, `npm run dev-nolog` boots on
  Vite 6.3.2/port 8080 with no errors, `npm run build-nolog` produces `dist/index.html`
  successfully (one harmless chunk-size warning from Phaser's own bundle, not an error).
  Pre-existing high-severity `npm audit` findings are all in vite's dev-only transitive
  deps (nanoid, picomatch, postcss, rollup, source-map-js, vite itself) — not introduced
  by this change, not shipped in the production bundle, left untouched pending a
  separate decision on `npm audit fix` (it may bump vite to a new major).
- 2026-10-14 — Milestone 1 done: added `src/core/Shape.js`, `Grid.js`, `Placement.js`
  (zero Phaser imports anywhere in `src/core`, confirmed via grep). Shape cell layouts
  for all 12 shapes (dot, domino_h/v, tri_i, tri_l, square, bar4, l4, t4, s4, p5, plus)
  were reverse-engineered from multiple cross-referenced worked examples in the legacy
  `docs/level_data.md` pictures, so the new engine's vocabulary matches what those shape
  ids meant there. Verified by reconstructing legacy Level 1 (4x5 grid, one blocked
  cell, 6 pieces) with `Grid` and confirming `canPlace`/`place`/`remove`/`isComplete`
  all behave correctly — `Grid.toDebugString()` output matched the level's picture in
  `docs/level_data.md` exactly, and an out-of-bounds placement, an overlap placement,
  and an undo-via-`remove()` were all exercised and behaved as expected.
- 2026-10-14 — Milestone 2 done: added `src/data/levels.schema.md`, `loadLevel.js`
  (`loadLevel`/`loadLevels`/`createGridForLevel`), and `levels.json` with 7 starter
  levels. Deviated from `PROJECT_STRUCTURE.md`'s original plan of a separate
  `src/data/shapes.js`: shape geometry already lives canonically in `core/Shape.js`
  (Milestone 1), so a second copy would just risk drifting out of sync — `loadLevel.js`
  validates level `pieces` entries against `core/Shape.js`'s `isKnownShape` instead.
  `PROJECT_STRUCTURE.md` updated to match. The 7 starter levels were NOT copied from
  `docs/level_data.md` (which stays reference-only per the user's instruction) — they
  were freshly constructed by a scratch greedy exact-cover generator script built on
  top of the new `Grid` class, each one verified solvable (`isComplete() === true`,
  full board tiled with no gaps/overlaps) before being written to `levels.json`, then
  re-verified by loading the final JSON through `loadLevel`/`loadLevels`. Negative-path
  validation (bad rows, unknown shape id, piece/cell-count mismatch, out-of-bounds
  blocked cell, duplicate level id) was also exercised and correctly rejected with
  descriptive errors. The 7 levels are a pipeline-proving starter set, not a curated
  content pass — expanding/tuning the level set is future work, not required for later
  engine milestones to proceed.
- 2026-10-14 — Milestone 3 done: added `scripts/solver.js` (backtracking exact-cover
  solver, pieces of the same shape treated as an interchangeable multiset so identical
  pieces swapping places doesn't inflate the solution count; `maxSolutions`/`maxNodes`
  caps to bound runtime) and `scripts/validate-levels.js` (CLI: schema-validates then
  solves every level in `levels.json`, prints a pass/fail table, exits non-zero naming
  any unsolvable/malformed level). `node scripts/validate-levels.js` run clean against
  all 7 starter levels (5 unique solutions, 2 with multiple solutions, 2-55 search nodes
  each — all fast). Failure path was explicitly tested too: a deliberately unsolvable
  3x3-grid-of-three-`tri_l` level (cell count matches but the fixed-orientation corner
  shape can't exact-cover a square alone) was swapped in temporarily, correctly reported
  as `FAIL ... UNSOLVABLE` with exit code 1, then the real `levels.json` was restored
  and re-validated clean. The malformed-schema exit path (bad JSON / failed `loadLevels`)
  reuses the same error-throwing validation already exercised in Milestone 2.
- 2026-10-14 — Milestone 4 done: added `src/game/scenes/PuzzleScene.js` (loads
  `levels[0]` via `loadLevels`, renders it), `src/game/objects/GridView.js` (renders a
  `Grid`'s cells, open vs. blocked, exposes `cellToWorld`/`worldToCell` for Milestone 5),
  and `src/game/objects/PieceView.js` (renders a shape's cells as colored squares,
  placeholder per-shape color palette). Wired into `src/game/main.js`'s scene list and
  `MainMenu.js`'s click-to-start target.
  This session initially had no working browser automation tool to visually verify it
  (checked for a project-level run skill — none exists; `chromium-cli` not installed;
  no Claude-in-Chrome/computer-use enabled) — asked the user how to proceed, and per
  their choice, installed `@playwright/test` + Chromium as a dev dependency and wrote
  `scripts/screenshot.js` (launches the dev server, drives headless Chromium through
  Boot -> Preloader -> MainMenu -> click -> PuzzleScene, saves a screenshot, reports
  console errors; handles the Windows `npm.cmd` spawn gotcha and tears the dev server
  down via `taskkill /T` since plain `.kill()` doesn't reach the grandchild vite
  process). Used it to confirm: level-001 (2x4, two `bar4`, no blocked cells) renders
  correctly; and, by temporarily pointing the scene at level-005 (4x5, one blocked cell
  at [1,2], pieces `p5`/`t4`/`domino_v`/`t4`/`domino_h`/`domino_h`), confirmed blocked
  cells render in the distinct dark fill at the correct position and all four of those
  shapes render matching their `core/Shape.js` definitions — then reverted the temp
  change back to `levels[0]`. No console errors in either run. `scripts/screenshot.js`
  is now the standing tool for verifying any future `src/game/` UI work (documented in
  `CLAUDE.md`).
- 2026-10-14 — Milestone 5 done: added drag/drop to `PieceView` (`makeDraggable()` —
  explicit `Geom.Rectangle` hit area since a Container has no intrinsic texture to infer
  one from; `setPreviewState('neutral'|'valid'|'invalid')` recolors the piece;
  `lockInPlace()` disables input once placed) and wired the actual gameplay logic into
  `PuzzleScene.wireDragEvents()` (scene-level `dragstart`/`drag`/`dragend` listeners —
  one shared set for every piece, standard Phaser pattern — reading which `PieceView` a
  drag belongs to via `getData('pieceView')`). Added `GridView.originToWorld(row, col)`
  (bounding-box top-left, distinct from the existing `cellToWorld`'s cell-center) for
  snapping a piece's container to its placed position.
  Collapsed the Milestone 4 board/tray cell-size split (`BOARD_CELL_SIZE` vs.
  `TRAY_CELL_SIZE`) down to one `CELL_SIZE` — a piece visually changing size the moment
  it's picked up or placed would break the snap fantasy the concept doc describes, so
  tray and board now share scale.
  Verified with a real Playwright drag simulation against `npm run dev-nolog` (mouse
  down/move/up, not just a static screenshot, since this behavior is inherently
  interactive) covering: hover-preview turns green over a valid empty spot and red both
  off-board and over an already-placed piece (overlap correctly rejected); an invalid
  drop (off-board) returns the piece to its exact tray home position with no Grid state
  change; a valid drop snaps the piece to the exact cell and locks it (no longer
  draggable); and placing both `bar4` pieces in level-001 fully tiles the 2x4 board with
  no gaps, matching `level-001`'s pre-validated solution. Zero console errors across the
  whole sequence. The one-off verification script lived at
  `scripts/.tmp-drag-test.mjs` only for the duration of this check and was deleted
  afterward — it was a manual-verification driver, not something to ship; Milestone 8
  will set up a real, permanent automated test suite.
- 2026-10-14 — Milestone 6 done: added `src/game/scenes/WinScene.js` (dimmed overlay
  over the completed board, "Level Complete!" + level id, a button labeled "Next Level"
  or "Play Again" on the final level) and wired win detection into
  `PuzzleScene` — `init(data)` now reads `data.levelIndex` (defaulting to 0) so the
  scene can be restarted at any level, and every successful placement in `dragend`
  checks `Grid.isComplete()`, guarded by a `hasWon` flag so the overlay can only ever
  launch once per level. `handleWin()` pauses PuzzleScene and launches WinScene with
  `nextLevelIndex = (levelIndex + 1) % levels.length` — wrapping back to level 0 after
  the last level rather than dead-ending, since there's no persistent "game complete"
  state yet (that's meta-loop/progression work, explicitly deferred in ROADMAP.md).
  WinScene's button explicitly stops both `PuzzleScene` and `WinScene` before starting a
  fresh `PuzzleScene` instance, so the next level always begins from a clean Grid.
  Verified with a Playwright run that placed both `level-001` pieces, confirmed
  WinScene appeared showing "level-001" with no earlier/duplicate trigger, clicked
  "Next Level", and confirmed `level-002` loaded with its own fresh grid (3x4) and
  correct pieces (`p5`, `p5`, `dot`, `dot`) rendered correctly. Zero console errors.
- 2026-10-14 — Milestone 7 done: added `src/game/objects/PlacementHistory.js` (plain
  ordered stack, no Phaser dependency) and wired Undo/Reset/Pause into `PuzzleScene` as
  three placeholder HUD buttons (top-left, matching the concept art's board reference).
  Every successful placement now pushes its `placementId` onto `this.history`;
  `undoLast()` pops it, frees the cells via `Grid.remove`, and calls the new
  `PieceView.unlock()` (reverses `lockInPlace()`: re-enables dragging by re-running
  `makeDraggable()`) to restore it to its stored tray home position. `resetLevel()` is
  deliberately just "call `undoLast()` until the history is empty" rather than separate
  logic, so it can't drift out of sync with Undo. `togglePause()` does NOT use Phaser's
  own `scene.pause()` — that would also freeze the Resume button living in the same
  scene, making it unclickable — instead it directly disables/re-enables dragging on
  every not-yet-placed piece and shows/hides a dim "Paused" overlay, explicitly bringing
  the Pause/Resume button above that overlay so it stays visible and clickable.
  Verified with a Playwright run: placed a piece, Undo restored it to its exact tray
  slot with the board empty again; placed it again, Reset cleared it; Pause showed the
  overlay and a drag attempt genuinely did not move/place the piece; Resume restored
  normal dragging, confirmed by successfully placing afterward. Zero console errors.
- 2026-10-14 — User-requested UX fixes on top of Milestone 7, applied directly (not
  tracked as a numbered milestone since they're corrections to existing work, not new
  scope):
  1. **No main menu.** Deleted `src/game/scenes/MainMenu.js`; `Preloader.create()` now
     starts `PuzzleScene` directly, and `main.js`'s scene list drops `MainMenu`. The
     game opens straight into level-001.
  2. **More generous snap margin.** Added `GridView.findNearestValidOrigin(shapeId,
     worldX, worldY)`: instead of requiring the piece's exact computed cell to be
     legal, it searches a small neighborhood (`SNAP_SEARCH_RADIUS = 1`, i.e. a 3x3
     block of candidate origins) around the nearest cell and snaps to whichever legal
     candidate is closest to the raw pointer position — a "magnetic" snap rather than a
     pixel-perfect one. `GridView.worldToCell()` (the old floor-based lookup) became
     unused once both the drag-hover and dragend handlers switched to this, so it was
     deleted rather than left dead.
  3. **Piece color never changes; ghost shows on the board instead.** Removed
     `PieceView.setPreviewState()` and the valid/invalid color constants entirely — a
     piece now always renders in its fixed per-shape color. Added
     `GridView.showGhost(shapeId, row, col, isValid)` / `clearGhost()`, which tint the
     board cells a candidate placement would occupy (green/red), added/removed each
     drag-move tick by `PuzzleScene`. A `PuzzleScene.isNearBoard()` check suppresses the
     ghost entirely while a piece is still over the tray, so nothing flickers far from
     the board.
  4. **More forgiving pickup area.** `PieceView.makeDraggable()`'s hit rectangle is now
     padded `HIT_AREA_PADDING = 10`px beyond the piece's visible bounds on every side
     (kept under half of `PuzzleScene.TRAY_PIECE_GAP` so adjacent tray pieces' padded
     areas can't overlap each other). Investigated the reported "clicking looks like
     it's outside the piece" symptom first via a Playwright diagnostic probing exact
     pixel offsets around a piece's rendered bounds — results were inconclusive/noisy
     (likely particular to the user's actual browser/display scaling, which this
     headless environment can't reproduce) rather than pointing at one clear coordinate
     bug, so the fix taken was the robust one: make the grabbable area generously
     larger than the visible piece regardless of root cause, which directly addresses
     the symptom either way.
  All four verified with real Playwright runs against `npm run dev-nolog`: confirmed
  the game loads straight into PuzzleScene with no click required; confirmed grabbing a
  piece from 8px outside its visible corner starts a drag; confirmed an 18px-off-target
  hover/drop over a valid cell still shows a green ghost on the board and snaps
  correctly on release, while the dragged piece's own color stayed fixed throughout;
  and confirmed a hover/drop far off-board shows no ghost, keeps the piece's color
  fixed, and correctly returns it to its tray home. Zero console errors across all runs.
- 2026-10-14 — Found and fixed the actual root cause of "I need to click a very
  specific square to pick up a piece" (the previous round's `HIT_AREA_PADDING` fix
  helped but didn't address the real bug). Diagnosed via a series of Playwright
  diagnostics against the live `PuzzleScene` (temporarily exposing the Phaser game
  instance on `window` to query live scene/input state, reverted after): per-cell click
  probing on a non-rectangular multi-cell piece (`p5`, 5 cells, bounding box 3 rows x 2
  cols) showed only the top ~half of the piece was ever pickable; a binary-search sweep
  down its height found the cutoff landed at exactly half its pixel height; querying
  the piece's `Container` directly confirmed why: `Container.setSize()` gives a
  Container a fixed `displayOriginX/Y` of half its width/height (origin (0.5, 0.5),
  **read-only** in this Phaser build — there's no `setOrigin()` to opt out), and
  Phaser's real input hit-testing (confirmed via `scene.input.hitTestPointer`, not just
  reasoning about the geometry) adds that offset to the pointer's local coordinates
  before testing against `hitArea` — while the piece's cells are drawn assuming local
  (0, 0) is the top-left corner, with no such shift. Rendering and hit-testing were
  silently using different coordinate conventions, which is why only cells in roughly
  the top-left/center region of a piece ever registered a click, worse for taller/wider
  pieces. Fixed in `PieceView.makeDraggable()` by shifting the hitArea rectangle's
  coordinates by `(pixelWidth/2, pixelHeight/2)` to cancel Phaser's internal offset
  back out, so the effective hit zone matches the intended top-left-based rectangle.
  Verified by re-running the same Y-sweep (now hits across the piece's full height,
  cutting off exactly at the padding boundary) and re-probing every individual cell of
  `p5` (5/5) and `tri_l` (3/3, an L-tromino with a real gap in its bounding box) —
  previously 1/5 and 1/3 respectively. Re-confirmed `bar4` (a solid rectangle, which
  happened to never exhibit the bug since all its cells sit in the top half of its own
  bounding box) still works, and re-ran a full level-complete + WinScene + Next Level
  regression to confirm nothing else broke. Zero console errors throughout. All
  diagnostic scripts and the temporary `window.__PHASER_GAME__` hook were removed
  afterward — none of this is shipped.
- 2026-10-14 — Two more user-reported fixes:
  1. **Blurry full-screen/Retina rendering.** Root cause: Phaser's `Scale.FIT` mode
     only ever resizes the canvas's on-screen *CSS* size to fill its parent — it never
     increases the canvas's own internal pixel buffer (confirmed by reading
     `ScaleManager.updateScale()`'s FIT branch directly: only `canvas.style.width/height`
     is touched there, never `canvas.width/height`). So a full-screen or Retina display
     was always showing a fixed 1024x768 image stretched larger by the browser. Phaser
     4.2.1 also has no built-in `resolution`/DPR config at all (confirmed absent from
     `ScaleManager.js`, `Game.js`, and the WebGL renderer — it existed in Phaser 3 but
     was dropped). Fixed by adding `src/game/uiScale.js`, exporting
     `UI_SCALE = min(devicePixelRatio, 2)`, and multiplying every fixed pixel constant
     in the game (canvas width/height in `main.js`, `CELL_SIZE` and all HUD/tray/board
     margins and font sizes in `PuzzleScene.js`, stroke widths and cell padding in
     `GridView.js`/`PieceView.js`, font sizes in `WinScene.js`, and `Preloader.js`'s
     progress bar, switched from hardcoded 512/384-style positions to
     `this.scale.width/height`-relative ones) by the same factor — the canvas has more
     real pixels now, but everything drawn onto it grows by the same amount, so nothing
     changes size on screen, it's just sharper. Verified via Playwright at a simulated
     1920x1080/DPR-2 "full-screen" viewport: canvas buffer is now 2048x1536 (previously
     would have stayed 1024x768 regardless of viewport/DPR) while the CSS size FIT
     computed is 1440x1080 — buffer resolution now exceeds CSS size, so the browser is
     downsampling rather than upsampling. Zero console errors; re-screenshotted the
     default 1024x768/DPR-1 case too and it's pixel-identical in layout to before.
  2. **Tray overflow with many-piece levels.** Levels with enough pieces to wrap onto
     several tray rows (e.g. `level-006`, 9 pieces) could run past the bottom of the
     screen, with no scrolling available to reach the rest. Fixed in
     `PuzzleScene.layoutTray()`: before placing any pieces, a new pure-simulation
     helper (`measureTrayLayout`, using `Shape.js`'s own bounding boxes, no PieceViews
     created) checks whether the full tray fits in the vertical space left below the
     board at true size; if not, it retries at progressively smaller scales (5% steps)
     down to a floor of `TRAY_MIN_SCALE = 0.5`. The chosen scale is applied uniformly
     via a new `PieceView.setTrayScale()` (shrinks the Container's visual transform
     only — `pixelWidth`/`pixelHeight`, used for hit-testing and drag math, stay at
     true size). A piece is scaled back up to 1 the instant it's picked up (`dragstart`)
     so it's always dragged/placed at the same size as the board's own cells, and
     restored to its tray scale if the drop is invalid or it's undone back to the tray.
     Verified via Playwright: `level-006` (9 pieces) at a 1024x768 viewport now lands at
     `trayScale ≈ 0.75` with its last piece's home position well within the screen
     (previously this ran off-screen); a 2-piece level (`level-001`) still lays out at
     `trayScale = 1`, confirming no regression for levels that already fit.
- 2026-10-14 — Milestone 8 done: chose `node --test` (Node's own built-in runner) over
  `vitest`. Reasoning: `scripts/solver.js`/`validate-levels.js` are already plain-Node,
  zero-dependency tooling per CLAUDE.md's architectural boundary, and `src/core/`'s
  entire design goal is being usable with nothing more than Node — adding a test-runner
  dependency to exercise code that intentionally has none felt backwards, and Node's
  built-in runner (stable since Node 20, this project runs on Node 25) needs no
  install, no config file, and already understands plain ESM + `node:assert/strict`.
  Added `tests/core/Shape.test.js`, `Placement.test.js`, `Grid.test.js` (35 tests
  covering normalization, bounds/overlap/blocked-cell legality, place/remove/isComplete,
  and toDebugString) and `tests/solver/solver.test.js` (11 tests: hand-built
  micro-levels with known solution counts — 1x1 single dot, 1x4 two dominoes, 2x2 four
  interchangeable dots, an impossible 1x1+domino_h case, grid-restored-after-solve,
  and `maxSolutions` capping — plus a regression test per shipped `levels.json` level,
  asserting each is solvable and matches its exact solution-count classification as
  captured by a real `node scripts/validate-levels.js` run: level-001 through -005
  unique, level-006/-007 "2 or more solutions"). `npm test` → `node --test
  tests/**/*.test.js` (a plain `tests/` directory argument was tried first and failed
  with a confusing `MODULE_NOT_FOUND` on Node 25 — the glob form is what actually
  works). Confirmed the suite has teeth per the DoD: temporarily replaced
  `isWithinBounds`'s real bounds check with `cells.every(() => true)`, re-ran the
  suite, watched 5 tests fail (including a `Grid.place` test asserting an
  out-of-bounds placement is rejected), then reverted and confirmed all 46 pass again.
- 2026-10-14 — Milestone 9 done. Read `docs/game_concept.pdf` directly (it renders as
  real pages, not just an outline) to ground this in the actual "Shift Complete!" /
  coin-HUD art reference rather than guessing layout — it shows a top-left "$48" coin
  display above Undo/Reset/Pause, and a "Shift Complete!" card with "Trucks completed:
  6" / "Total earned: $78". Design decisions made to fit that into the current
  single-level-set structure without inventing day/level-grouping data that doesn't
  exist yet:
  - **One shift = all of `levels.json`, in array order.** No new "day"/"shift" grouping
    field was added to the level schema — `levels.length` already defines how many
    "trucks" are in the shift, and adding a separate grouping concept before there's a
    second shift's worth of content to group would be speculative. Revisit if/when
    content needs to be split into multiple distinct shifts.
  - **Added an optional `reward` field to the level schema** (`levels.schema.md`,
    validated in `loadLevel.js`: positive integer if present) rather than deriving
    coins from `difficulty` via a hardcoded mapping table — per CLAUDE.md's "keep...
    data-driven, not hardcoded" design value. Falls back to `DEFAULT_REWARD = 10` in
    `PuzzleScene.js` if a level omits it (so hand-edited level data never *has* to set
    it), but all 7 shipped levels set it explicitly, loosely scaled with grid
    size/difficulty (8/10/12/14/16/20/20 — sums to a round $100 for the full shift).
  - **Running shift totals live in Phaser's registry** (`this.registry`, under
    `shiftTrucksCompleted`/`shiftTotalEarned`), not on the PuzzleScene instance itself —
    every level transition already tears down and recreates a fresh PuzzleScene (see
    Milestone 6's decision log), so anything that needs to survive that had to live
    somewhere else; the registry is the standard cross-scene Phaser Data Manager built
    for exactly this.
  - **WinScene now always means "next truck"** — reaching the shift's last level routes
    straight to the new `ShiftCompleteScene` instead (`PuzzleScene.handleWin()`), so
    WinScene no longer needs the old `isLastLevel`/wraparound branching it had for
    "Play Again" after the final level; that logic moved to ShiftCompleteScene's "Back
    to Home" button instead, which also resets the registry counters for a new shift.
  - **PuzzleScene's level title now reads "Truck N of <shift size>"** (e.g. "Truck 3 of
    7 · level-003 · medium"), derived from `levelIndex`/`levels.length` rather than a
    stored value, matching the concept art's "TRUCK 03" truck label.
  Verified via Playwright end-to-end: dragged level-001 for real (confirming the actual
  UI path, not just the data path, produces a correct win), then completed levels 2-7
  by placing each tray piece at a position from a real solver-computed solution
  (`scripts/solver.js`, one solution per level) via the same `Grid.place`/
  `PieceView.lockInPlace` calls the real drag handler uses, calling `handleWin()`
  exactly as the drag handler would. Confirmed: coin HUD starts at `$0`; each
  WinScene shows the correct per-level reward and running total (`+$8 · Total: $8`
  through `+$20 · Total: $80`); `ShiftCompleteScene` shows `Trucks completed: 7` /
  `Total earned: $100` (matching the sum of all 7 rewards exactly); "Back to Home"
  resets the registry to 0 and restarts cleanly at `level-001`, `Truck 1 of 7`. Zero
  console errors throughout. All temporary diagnostic scripts and the
  `window.__PHASER_GAME__` hook were removed afterward — none of this is shipped.

- 2026-10-15 — **Title screen, 30-day level set, and day-complete flow.** Requested
  directly (not a numbered milestone). Decisions:
  - **Vocabulary:** a *level* is now one in-game day; a *truck* is one packing puzzle
    inside it. `levels.json` is `[{ id, trucks: [...] }]` (was a flat list of puzzles);
    `loadLevel.js` gained `loadTruck`/`loadLevel`/`loadLevels` (+ `createGridForTruck`,
    replacing `createGridForLevel`). Truck ids are unique across the whole game.
    Schema in `src/data/levels.schema.md`.
  - **Level plan:** 30 levels. L1 = 3 trucks, all easy. L2-7 = 4 trucks, easy -> medium
    (last truck medium, none hard). L8-30 = 5 trucks, easy -> hard (last truck hard).
    Both ends of each day's ramp also creep upward over the levels (see
    `targetDifficulty()` in `scripts/generate-levels.js`), so the game gets harder within
    a day and across days. `tests/data/levels.test.js` locks this spec in.
  - **Levels are generated, not hand-written** (`node scripts/generate-levels.js`,
    ~90s, seeded so output is reproducible): random boards + random polyomino tilings
    (solvable by construction), every candidate re-checked by the real solver, then the
    candidate whose difficulty score is closest to the slot's target is kept. Score
    (0..1, stored as `difficultyScore`) = 40% board size + 20% irregular pieces +
    15% blocked cells + 15% piece count + 10% solver effort; easy < 0.34 <= medium <
    0.67 <= hard. Hard trucks also need <= 3 solutions, medium <= 5 (relaxed with a
    printed warning for 4 hard trucks where that rule couldn't be met). Trucks inside a
    day are sorted by score so difficulty never drops mid-day. Boards max out at
    5x7 / 9 pieces so board + tray always fit the 1024x768 screen (verified by
    screenshot at the hardest boards). The old 7 hand-made starter levels were retired.
  - **Rewards** are now `openCells + {easy 0, medium 4, hard 8}` per truck.
  - **Day totals** (`dayTrucksCompleted`, `dayEarned`) live in the Phaser registry and
    reset whenever truck 0 of a level starts (`PuzzleScene.init`), so Play and Next Day
    need no extra reset code. The HUD counter shows the day's running total.
  - **Per-truck popup kept:** between trucks in a day `WinScene` still shows
    ("Truck 2/4", +$ earned, today's total, Next Truck); only the day's last truck shows
    `DayCompleteScene`. `ShiftCompleteScene` was removed (superseded).
  - **DayCompleteScene** shows "Level N Complete!", trucks completed, earned today, and
    Shop / Decorate / Next Day. Shop and Decorate open `ShopScene` / `DecorateScene`
    (both tiny subclasses of `PlaceholderScreenScene`): an opaque blank screen with a
    title and a Back button that restarts the popup with the same data.
  - **Judgment call — after level 30** the third button reads "Finish" and returns to
    the title screen (there's no level 31), with a "That's every level" line.
  - Verified with Playwright: title -> Play (real click) -> level 1 truck 1 (first piece
    really dragged) -> all 3 trucks -> popup ("Trucks completed: 3", "Earned today:
    $26") -> Shop -> Back -> Decorate -> Back -> Next Day -> "Level 2 · Truck 1/4";
    jumped to the hardest boards (L8 T5, L30 T4/T5) to check layout; finished L30 ->
    Finish -> title. Zero console errors. Temporary hook/scripts removed afterward.

- 2026-10-15 — **Follow-up fixes to the level plan and pay count.**
  - **Pay count carries over between days.** New registry key `totalEarned` (all-time),
    reset only by TitleScene's Play; the HUD shows it, WinScene shows "+$X earned ·
    Total: $Y", and DayCompleteScene shows both "Earned today" and "Total earned". The
    per-day keys (`dayTrucksCompleted`, `dayEarned`) still reset at each day's truck 1.
  - **Level plan changed** (supersedes the easy -> medium/hard ramps above): L1 = 3 easy;
    L2-7 = 4 trucks (2 easy, 2 medium); L8-12 = 5 trucks (2 easy, 2 medium, 1 hard);
    L13-30 = 6 trucks (2 easy, 2 medium, 2 hard) - 160 trucks total. The plan now lives in
    `labelsForLevel()` in `scripts/generate-levels.js`; each truck's target difficulty
    comes from its label's band (trucks sharing a label are spread across the band, and
    bands creep harder with level number). `tests/data/levels.test.js` checks the exact
    label sequence per level. Regenerated; 215 tests pass. Three level-28/29/30 hard
    trucks relax the "<= 3 solutions" rule (generator prints a warning).
