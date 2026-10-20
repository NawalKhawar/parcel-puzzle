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

- [x] **Milestones 9.1-9.19 — Post-M9 additions** (done 2026-10-15/20; added to ROADMAP.md)
  - [x] 9.1 Title screen, day flow & persistent pay count
  - [x] 9.2 30 generated levels (3 / 4 / 5 / 6 trucks per day)
  - [x] 9.3 Portrait / square boards
  - [x] 9.4 Hint button (highlight-only)
  - [x] 9.5 Shop UI (placeholder tabs/items)
  - [x] 9.6 Apartment UI (grid placement, ghost, 2.5D room)
  - [x] 9.7 Shape-gated puzzle pool (800 puzzles)
  - [x] 9.8 Shape progression in gameplay (the game plays the pool)
  - [x] 9.9 Rotating puzzles, free piece movement (no Undo), new-piece popup
  - [x] 9.10 Simpler shop (no tabs/clothing), new economy, end-of-day report
  - [x] 9.11 16:9 screen (1280x720)
  - [x] 9.12 Faster shape introduction (L pieces at level 5, then every 3 levels)
  - [x] 9.13 Square HUD buttons (R and II beside the money panel)
  - [x] 9.14 First art: pieces, conveyor belt, icon buttons, Start Packing button
  - [x] 9.15 Truck frame + shutter, dark belt with smaller overlapping parcels, button feedback, Cozy Cargo
  - [x] 9.16 Full-width belt, faster shutter + truck bob, straight to the next truck (WinScene removed)
  - [x] 9.17 L pieces at level 4, then every 3 levels (7, 10, 13, 16)
  - [x] 9.18 Truck extras (side lights, handlebars, licence plate with truck number), Fredoka font
  - [x] 9.19 Worker character (idle bob + win reactions), day-complete difficulty breakdown, floating +$X reward, tab title/favicon

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

- 2026-10-15 — **All boards are now square or portrait** (rows >= cols), since the board
  will later represent the open back of a mail truck. Pieces are fixed-orientation, so
  boards weren't simply transposed: the generator's `BOARD_SIZES` is now portrait-only
  (2-7 rows x 2-5 cols) and the whole level set was regenerated (same plan: same truck
  counts, difficulty labels and rewards formula; the specific puzzles are new). A new test
  asserts `rows >= cols` for every truck. Tall boards would crowd out the piece tray, so
  `PuzzleScene` now sizes cells per truck: `cellSize = min(72, 360 / rows)` (replacing the
  fixed `CELL_SIZE`), so a 7-row board uses ~51px cells; the tray uses the same size so
  pieces don't change size when placed. Checked by screenshot on the tallest boards
  (7x5, 6x5, 6x3, 4x2). 216 tests pass.

- 2026-10-15 — **Hint button.** Shown from the second level (day) onwards only; pressing
  it places one unplaced piece in its correct spot, once per truck, then the button
  fades to 30% opacity and is disabled (it stays used through Undo/Reset; a new truck
  gets a fresh hint). Decisions: (1) the solver moved from `scripts/solver.js` to
  `src/core/Solver.js` because the game now needs it at runtime and game code shouldn't
  import from `scripts/` (all imports/docs updated); (2) new `findHint(grid, remaining)`
  solves from the board's *current* state, so the hint always agrees with whatever the
  player has already placed correctly, and picks the largest remaining piece (most
  informative); `solve()` now only reports pieces it placed itself, not ones already on
  the grid; (3) if the player's placements are a dead end (unsolvable), the board is
  cleared first (like Reset) and the hint comes from the empty board; (4) the drag-drop
  commit code was extracted into `PuzzleScene.placePiece()` so the hint and a normal drop
  share one path (including win detection - a hint that completes the board wins).
  Verified in the browser: no button on level 1; level 2 shows it; one click places the
  big piece and fades the button; a second click does nothing; the board can then be
  finished from the hinted state and reaches the day-complete popup; the dead-end case
  clears and re-hints; reset doesn't restore it. 220 tests pass (4 new for findHint).

- 2026-10-16 — **Shop UI and Apartment UI** (placeholder content, real interaction).
  - **Shop** (`ShopScene`): three horizontal tabs - Clothes, Accessories, Decor - each
    showing 8 labelled placeholder boxes; tabs/items come from `src/data/shop.json`.
    Nothing is purchasable yet. Replaces the old blank placeholder screen.
  - **Apartment** (`ApartmentScene`, opened by the popup's "Decorate" button; the old
    `DecorateScene`/`PlaceholderScreenScene` were removed). 8x6 floor grid, inventory panel
    of 8 placeholder furniture items with different footprints (1x1, 2x1, 3x1, 2x2, 2x3,
    3x2), from `src/data/apartment.json`. Drag from the inventory -> a ghost shows the
    snapped footprint (green = legal, red = not); release places it; click a placed item
    to pick it up again; drop it on the inventory panel to put it away; an illegal drop
    returns it to where it came from. Layout persists in the registry (`apartmentLayout`)
    across leaving/re-entering, and resets on Play from the title screen.
  - **The 2.5D maths** (`src/core/RoomProjection.js`, pure + unit-tested): the back wall is a
    flat rectangle; the floor is a trapezoid (narrow at the back, wide at the front), rows
    are horizontal lines, and column spacing widens linearly toward the viewer, so side walls
    angle outward. The mapping (u, v) -> (x, y) is exactly invertible, which is what lets the
    mouse position be turned back into a grid cell without off-by-one drift near the back.
    Rows are evenly spaced rather than bunching toward the back like a true perspective
    divide - a deliberate simplification that keeps the maths exact. Furniture is a box whose
    height is drawn straight up the screen, scaled by distance, with the inner side face
    shown (the side facing the room's centre line).
  - **Depth/overlap** (`src/core/RoomGrid.js`): items are drawn back to front by their
    *front edge* (row + depth), so a nearer item covers a farther one and a tall item hides
    what is behind it; clicking picks the front-most item under the mouse (hit-testing the
    box's faces, so a tall item can be grabbed by its body). Placement rule: inside the
    room, no overlaps - except **flat items (rugs)**, which normal items may sit on (my
    addition; two rugs or two normal items still cannot overlap).
  - **Judgment calls:** no wall-mounted items (the back wall is decorative only, with a
    window); each furniture item exists once (placing removes it from the inventory
    panel); the held item follows the mouse (drawn undistorted over the panel, since the
    projection would shear it far off the floor); the ghost also tints a faint box so item
    height is visible.
  - Verified with real mouse input in headless Chromium: all three shop tabs, valid drop
    (green ghost, placed), overlapping drop (red ghost, rejected, item back in inventory),
    placing all 8 items incl. a rug under a table/lamp, correct front/back overlap, picking
    up by the body and moving, illegal-drop snap-back (off-floor and onto another item),
    drag-to-inventory, and persistence after Back/Decorate. No console errors.
    255 tests pass (new: RoomProjection, RoomGrid, apartment/shop data).

- 2026-10-16 — **Hint button reworked: highlight instead of place.** The old hint placed a
  piece itself (and cleared the board on a dead end). Now it only nudges: pressing it draws a
  pulsing gold overlay (`GridView.showHint`, drawn above the pieces) on the cells where one
  piece belongs, and never places, moves or removes anything. `findHint(grid, allPieces)`
  (core/Solver.js) now takes every piece of the puzzle and returns `{shapeId, row, col}`:
  if the player's placements can still be completed it points at one of their *unplaced*
  pieces (largest first) in a free spot consistent with the board; if they are a dead end it
  solves an empty copy of the board and points at the largest piece of that solution not
  already correctly placed - the highlighted cells may then overlap their wrong pieces.
  `PuzzleScene.refreshHint()` re-evaluates after every placement/undo/reset: the highlight is
  shown while the hinted piece (same shape, same origin) is not placed there, removed when it
  is, and comes back if that piece is undone. It is also cleared on a win (a puzzle can have
  several solutions). Still one hint per truck; the button fades after use. Verified in the
  browser with real drags: highlight on an empty board; placing the hinted piece clears it,
  undo restores it; on a dead end the placements are untouched and the highlight overlays the
  wrong piece (2 cells overlapped); winning clears it. 256 tests pass.
  The roadmap now has Milestones 9.1-9.6 recording all of the post-M9 work.

- 2026-10-20 — **Shape-gated puzzle pool** (new data only; the game still plays levels.json).
  Requested so complex shapes only appear in later levels. Unlock plan (`SHAPE_UNLOCKS` in
  scripts/generate-levels.js): levels 1-2 simple shapes only (dot, domino_h, domino_v, tri_i,
  square, bar4); level 3 adds tri_l + l4; level 8 t4; level 13 s4; level 18 p5; level 23 plus
  (the order of the last four was my recommendation, confirmed). A shape unlocked at level N
  can be used from N onwards. Decisions:
  - **Separate file**, `src/data/levels.shapes.json`, so the live levels.json is untouched.
    Verified: regenerating levels.json after the generator refactor is byte-identical.
  - **Same structure as before:** same trucks per day and easy/medium/hard order (1: eee;
    2-7: eemm; 8-12: eemmh; 13-30: eemmhh), same scoring and reward formula.
  - **Pools:** every truck slot holds 5 distinct puzzles (800 total), the 5 closest to the
    slot's target difficulty out of ~50 acceptable candidates. The order within a slot is by
    score; ordering across slots is by label only, not exact score.
  - **Introduction guarantee:** at levels 3/8/13/18/23 every puzzle must contain at least one
    newly introduced shape (new shapes are also 3x more likely there, and these slots may use
    a wider range of board sizes since e.g. the plus needs a 3x3 area). Level 3 shows both
    tri_l and l4 across its pool.
  - **Honest caveats:** (1) 33 slots could not meet the "few solutions" rule (hard <= 3,
    medium <= 5) and relaxed it - expected for levels 1-7, where simple pieces allow many
    arrangements; the generator prints these as warnings. (2) Dots are still common in these
    puzzles (up to 2 per puzzle, as before). (3) Late levels use the newest shapes at normal
    weight, so e.g. s4 and plus are rare by level 30 (about 6 of 30 puzzles each).
  - **Code:** the generator takes an optional `ShapeRules` object (allowed / boost /
    requireOneOf) threaded through weightsFor, makeCandidate and the new findBestPuzzles;
    `loadShapeLevels` (src/data/loadLevel.js) validates the file; `validate-levels.js
    --shapes` solves all 800; tests/data/shapeLevels.test.js (17 tests) checks the unlock
    levels, that no puzzle uses a shape early, the introduction rule, pool size, labels,
    portrait boards, uniqueness and solvability. 272 tests pass.
  - **Next:** nothing reads the pool yet. Wiring it in means the game picking one puzzle per
    slot from a level's pool (random, rotating, or by player history) - not decided.

- 2026-10-20 — **The game now plays the shape-gated puzzles** (Milestone 9.8). PuzzleScene reads
  `levels.shapes.json` (validated with `loadShapeLevels`) instead of `levels.json`. Still 30
  levels, same trucks per day and easy/medium/hard order, so the rules are unchanged; what is new
  is which shapes can appear (levels 1-2 simple only; tri_l + l4 from 3; t4 from 8; s4 from 13;
  p5 from 18; plus from 23). Decisions:
  - **Choosing from the pools** (I flagged this as undecided; this is my pick): when a day starts,
    `pickDayPuzzles` (src/data/pickDayPuzzles.js) picks one random puzzle per truck slot, so
    replaying a level gives different puzzles. The day's picks are then **sorted by difficulty
    score** - two slots with the same label overlap in difficulty, and without the sort a random
    draw could give a harder puzzle before an easier one. Labels sit in separate score bands, so
    easy -> medium -> hard order is kept too.
  - **Remembered for the day:** the picks live in the registry (`dayPuzzles`, with the level they
    belong to), because every truck is a fresh PuzzleScene; re-picking would change the puzzle
    for a truck on every restart. Picked again at truck 1, or when the stored picks belong to a
    different level (e.g. a debug jump into the middle of a day).
  - **levels.json is no longer played.** It is kept as the original reference set (generator
    default output, validator, tests); `levels.shapes.json` is the file the game uses.
  - **Verified in the browser:** Play -> two full days via the real flow (7 different puzzles,
    each from its slot's pool, only unlocked shapes, headers correct); restarting a mid-day truck
    gives the same puzzle; every introduction level (3, 8, 13, 18, 23) shows its new shape in
    every truck, with the right easy/medium/hard order; no console errors. 279 tests pass (7 new
    for pickDayPuzzles).

- 2026-10-20 — **Rotation, free piece movement, new-piece popup** (Milestone 9.9).
  - **Rotation replaces random picking** (supersedes the 9.8 entry): `pickDayPuzzles(level,
    playNumber)` is now deterministic - play 0 takes the first puzzle of every pool, play 1 the
    second, ... wrapping per pool. `PuzzleScene.getDayPuzzles` counts plays per level in the
    registry (`levelPlayCounts`), bumped once when a day starts (truck 1); the day's picks are
    still stored for the rest of the day. The count is **not** reset by Play on the title
    screen (otherwise every new game would start with the same puzzles); it does reset when the
    page is reloaded, since nothing is saved to disk yet. Pools are stored easiest to hardest,
    so successive plays get very slightly harder; days are still sorted by score.
  - **Dragging placed pieces:** a placed piece can be grabbed again. On pick-up it is taken off
    the Grid immediately (so its own cells don't block its new spot). Dropped on a legal spot ->
    placed there. Dropped away from the board (the way to take a piece off) -> back to its tray
    slot. Dropped over the board but somewhere illegal -> **snaps back to where it was** (my
    judgment call: a slip shouldn't cost a placement; a tray piece dropped illegally still just
    returns to the tray). Reset (clear the whole board) and Pause stay; pausing now disables
    placed pieces too.
  - **Undo removed**, as requested; `PlacementHistory.js` deleted (Reset now loops over the
    pieces instead of replaying a history). This supersedes the Undo part of Milestone 7. HUD
    buttons moved up: Reset, Pause, Hint.
  - **Exact hit areas for placed pieces:** a bounding box (let alone a padded one) would let
    neighbouring pieces steal each other's clicks - an L piece's box covers the notch another
    piece sits in. `PieceView` now sets its hit area once, with a test that checks `isPlaced` each
    time: padded box in the tray, the piece's own cells on the board. (Phaser keeps the first
    hit area it is given, so swapping it on the fly would not have worked.) `lockInPlace` became
    `markPlaced(row, col)`, which also records `boardOrigin` for the snap-back.
  - **Hint interaction:** the hint highlight reappears if the hinted piece is lifted off the
    board (and on Reset), and clears once it is placed there again.
  - **New-piece popup** (`src/game/objects/NewPieceIntro.js`): shown at the start of the first
    truck of levels 3, 8, 13, 18 and 23 only. Pops in over 450 ms with a Back.easeOut overshoot
    (measured peak scale about 1.1), holds 2 s (first built at 3 s, shortened on request), shrinks away over 300 ms with Back.easeIn - about
    2.75 s in total - and a full-screen dimming blocker swallows all input meanwhile (no
    skip-by-click; not requested). It shows each new shape in its tray colour with a name (new
    `SHAPE_NAMES` / `getShapeName` in core/Shape.js: Corner, L-piece, T-piece, Zig-zag, P-piece,
    Plus). It replays whenever such a level starts again.
  - **Verified in the browser** (real mouse drags): rotation 1,2,3,4,5,1 across six plays; no Undo
    button (HUD: Reset, Pause, Hint); a placed piece moved to a new cell; dragged off the board
    back to the tray; dropped on another piece it snapped back; pressing a piece sitting in an L
    piece's notch lifted the notch piece, not the L; paused pieces not draggable and draggable
    again after resume; Reset clears the board; hint highlight returns on lift-off; popup
    overshoot, duration, and blocked input confirmed; no popup on levels 1, 2, 4 or on a later
    truck; no console errors. 286 tests pass (new: rotation tests, shape names).

- 2026-10-20 — **Shop simplified, economy changed, end-of-day report** (Milestone 9.10).
  - **Shop:** no tabs and no clothing - the shop only sells apartment items. `shop.json` is now
    `{ items: [...] }` (8 placeholder boxes labelled "Apartment Item N"); `loadShop` and its tests
    updated; ShopScene is one grid. This also removes clothing from the future plans (ROADMAP
    "Future" no longer mentions equipping clothes). The Accessories/Decor tabs went too, since
    "no category tabs are needed".
  - **Economy:** a truck pays $10 easy / $15 medium / $35 hard. It is set once in the generator
    (`REWARD_BY_DIFFICULTY`) and written into every puzzle's `reward`, replacing the old
    "open cells + 0/4/8" formula. Both data files were regenerated; puzzle content is unchanged
    (rewards are not part of the generator's randomness) - only `reward` values changed, plus
    the new level `bonuses` field in levels.shapes.json.
  - **First-day bonus:** +$10 at the end of level 1, as data (`bonuses: [{ id, label, amount }]`
    on a level, `LEVEL_BONUSES` in the generator, validated by `loadShapeLevels`). Level 1 is
    always 3 easy trucks, so day 1 = $30 + $10 = **$40** whichever puzzles are dealt (tested).
    The bonus is paid once, in `PuzzleScene.handleWin` when the day's last truck is done, and
    goes into both the day's earnings and the coin counter. The legacy levels.json has no
    bonuses (it is no longer played).
  - **End-of-day popup** (`DayCompleteScene`): header Adequate Parcel Service / "Arrives Intact,
    Mostly" / "OUTBOUND PACKING DEPARTMENT" (smaller; my pick for the job title - one line in
    `src/data/company.json` to change), then a payslip-style list: trucks completed; if the day
    has bonuses, truck earnings and each bonus (+$, green); then **Total earned today**. On days
    without a bonus the list is just trucks completed + total (otherwise "truck earnings" and
    "total" would repeat the same number). The "Total earned (all-time)" line was dropped to
    match the content you listed; the coin counter behind the popup still shows the wallet. The
    panel sizes itself to its rows. "Level N complete" stays as a small line under the header.
  - **Verified in the browser** (real flow from the title screen, real clicks): day 1 trucks paid
    $10 each (HUD $10, $20, then $40 once the bonus landed); the day-1 popup showed 3 trucks,
    $30 truck earnings, +$10 first day bonus, $40 total; day 2 paid $10 + $10 + $15 + $15 = $50
    (popup: 4 trucks, $50, no bonus row; HUD $90); the shop showed 8 boxes and no tabs, and Back
    returned to the same popup; level 30 shows the "every level" note with Finish; no console
    errors. Puzzle content in both data files is unchanged (checked: identical apart from
    reward/bonuses). 292 tests pass (new: economy and bonus tests, shop tests rewritten).

- 2026-10-20 — **Switched to a 16:9 design size: 1280 x 720** (was 4:3, 1024 x 768; Milestone 9.11).
  Done before the final art so graphics can be made to the right shape.
  - **Config:** `main.js` width/height are 1280 and 720 (times UI_SCALE, as before; `Scale.FIT`
    still letterboxes on other window shapes - on a 16:9 window there are no bars). Piece and
    cell sizes did not change: 72 px cells, boards capped at 360 px tall, tray margins as before.
  - **Puzzle screen needed no layout change.** I re-ran the tray-fit rule (the same algorithm as
    PuzzleScene.layoutTray) over all 800 puzzles at the new size: none overflow, and the smallest
    tray scale actually improved from 0.60 to 0.75, because the wider screen fits more pieces
    per tray row. (Tested alternatives with a shorter board cap; not needed.)
  - **Re-laid out:** the **apartment** (room centred in the space left of the inventory, 480/800 px
    back/front width, floor from y 240 to 660, wall top 88; inventory panel moved to x 1056 and
    shortened to 600 px so it ends on screen); the **shop** (panel centred from the screen width
    instead of a fixed x); the **loading screen** (bar sizes for the new shape; the template's
    1024x768 background is scaled to cover the canvas); the unused template scenes (centred from
    the screen size). `scripts/screenshot.js` now uses a 1280x720 viewport.
  - **Verified in the browser** at a 1280x720 window (canvas 1280x720), 1920x1080 (same canvas,
    scaled to 16:9, no bars) and 1024x768 (letterboxed to 1024x576): title, puzzle, the tallest
    7-row board, a crowded hard board, the new-piece popup, the day-complete popup, the shop and
    the apartment all fit; five real drags in the apartment landed in the intended cells; the
    inventory stays on screen; no console errors.

- 2026-10-20 — **Shape unlock schedule changed** (Milestone 9.12; supersedes the schedule in the
  9.7 entries). New plan (`SHAPE_UNLOCKS` in scripts/generate-levels.js): levels 1-4 simple shapes
  only; **level 5** adds tri_l + l4; then one shape every 3 levels - **t4 at 8, s4 at 11, p5 at 14,
  plus at 17**. Before: simple only for levels 1-2, L pieces at 3, then t4/s4/p5/plus at 8/13/18/23.
  The order of the four later shapes is unchanged (t4, s4, p5, plus). Consequences: levels 3-4
  went back to simple shapes only, and from level 17 on every shape is available (13 levels of
  full variety, versus 8 before). I read "after 3-level intervals" as 3 levels between
  introductions (5 -> 8 -> 11 -> 14 -> 17). `levels.shapes.json` was regenerated (same
  structure and economy; the puzzles are new wherever the allowed shapes changed); no code
  changed besides the table, since the new-piece popup, loader and picker read it from the data.
  Tests updated.
  Verified: the data's first appearance of each shape is tri_l/l4 at 5, t4 at 8, s4 at 11, p5 at 14,
  plus at 17; every puzzle at those five levels contains its new shape; levels 1-4 allow only the
  six simple shapes; 36 slots relaxed the "few solutions" rule (33 before - levels 3-4 now use only
  simple pieces, which allow many arrangements); in the browser the popup showed on levels 5, 8, 11,
  14 and 17 only (L-pieces popup: "New pieces! / Corner / L-piece"). 292 tests pass.

- 2026-10-20 — **Square HUD buttons** (Milestone 9.13). Reset is now a square with "R" and Pause a
  square with "II" (play symbol while paused), placed on the same row as the money panel and sized
  to its height. `createHud` builds them and `layoutHud` positions them; it runs again whenever the
  money total changes, so the squares follow a wider panel. Hint stays a text button below. Verified
  in the browser: squares level with the money panel and not overlapping it, still aligned after the
  total grew to $1234, pause toggles II/play, Reset clears placed pieces, the hint still highlights
  and clears on the right placement, no console errors. Note: while building this I accidentally
  removed three methods (useHint, refreshHint, placePiece) with the old HUD block; they were restored
  verbatim and the tests and browser checks cover them again.

- 2026-10-20 — **First real art added** (Milestone 9.14): the 12 pieces, the conveyor belt, the
  Reset / Pause / Hint icon buttons and the Start Packing button, from the new top-level
  `assets/` folder.
  - **Loading:** `assets/` is not under `public/`, so Vite does not serve it by itself. Rather than
    copying the files (two copies would drift), the Preloader imports them with one Vite glob
    (`import.meta.glob('../../../assets/*.png', { query: '?url' })`) and loads each under its file
    name minus .png - which is why the pieces are named after the shape ids. New PNGs dropped into
    `assets/` are picked up automatically. Verified in both the dev server and a production
    build (all 19 image requests 200, art bundled into dist/assets).
  - **Pieces:** the files are exactly 2x the planned size (144 px per cell). `PieceView` now draws
    the image at the piece's bounding box instead of coloured squares (the per-shape colour table
    is gone); the new-piece popup uses the same images. The hit-testing, drag and snap logic is
    unchanged.
  - **Conveyor + tray (layout change):** the belt (2560x400, shown 1280x200) sits at the bottom of
    the screen, behind everything. The belt art's usable surface is only ~113 px tall, so the old
    "wrap pieces into several rows" tray is replaced by **one row on the belt**, centred, with the
    pieces vertically centred on the belt surface (tall pieces stick out above and below it a
    little - a deliberate look, not a bug). All pieces share one scale: full size when the row fits
    across the screen (682 of 800 puzzles), otherwise shrunk uniformly - never below 80% for the
    shipped puzzles (min 0.5 as a safety floor). The tallest piece is also kept clear of the board.
    Tested by simulating all 800 puzzles before building it. Note for the truck frame: the belt
    starts at y 520, so a frame taller than ~456 px starting at y 56 would overlap it.
  - **HUD:** Reset, Pause and Hint are now 48x48 icon images (the 96x96 files at half size) in one
    row beside the money panel, which is padded to the same 48 px height. The Hint icon is faded
    after use as before. There is no "play" icon, so while paused the Pause icon is dimmed
    instead of swapped - say if you want a separate resume icon.
  - **Title:** the Start Packing image (2048x768, a pill with a soft glow) is shown at 390x146
    (pill ~375x88). Only the pill responds to clicks - a click on the glow above it does nothing
    (tested). The game's title text above it is still a plain text placeholder.
  - **Verified in the browser:** all 17 textures load; title, level 1/2, the 7-row board, a
    crowded 6-piece board, the paused state, the hint highlight and the level-5 popup all render
    correctly; dragging belt -> board and board -> belt works; no console errors.
    292 tests pass.

- 2026-10-20 — **Truck, shutter, dark belt, button feedback, Cozy Cargo** (Milestone 9.15).
  Measured the new art first (pixel analysis in the installed browser): the truck is 912x984 art px
  with a 720x720 grey opening at (96, 96) and margins left 96 / right 96 / top 96 / bottom 168 (the
  bumper bar plus the wheels); the wheels sit entirely inside the two bottom corners, so a 9-slice
  never stretches them. The grey is 0x777975. The shutter is 720x720, fully opaque. The new belt is
  2560x800 (the old 2560x400 file is gone; it is now `conveyor-belt-dark`).
  - **Layout problem I had to solve (please check this is what you want):** at full width the new
    belt is 400 design px tall, and a 5x5 truck is 492 tall - more than the 720 px screen together.
    I kept the art undistorted and showed the belt at **58% of its file size (742 x 232)**, centred
    along the bottom (so it does not run end to end any more), with the truck standing just behind
    its back rail (wheels tucked 12 px) and bottom-aligned to it. The largest truck then spans
    y 8-500, and the belt starts at y 488. Making the belt full width would need either a
    non-uniform stretch (squashing the rollers into ellipses) or a smaller/shorter truck. The two
    numbers to change are `BELT_SCALE` and the board's height cap in PuzzleScene.
  - **Truck frame:** a Phaser 9-slice sized to each board: art width = board width (in art px) +
    96 + 96, height = board height + 96 + 168. A 5x5 board at full cell size is exactly the
    artwork's own size (nothing stretched). Header text moved to the top right because tall trucks
    now reach the top-centre of the screen.
  - **Grid baked in:** open cells are the truck's grey (0x777975) with darker lines (0x676964, 1.5
    px), cells share edges (no padding), so it reads as part of the frame. Blocked cells stay dark.
  - **Parcels on the belt:** drawn at ~42 px per cell (the board's cell is 72) in a single row, with
    the layout maths in the new pure module `src/core/TrayLayout.js` (+ tests): full size with 8 px
    gaps if they fit; else the gaps close; else neighbours overlap by at most 20% of the narrower
    piece or 14 px, spread evenly; only then everything shrinks (floor: half of the preferred
    size). Later parcels are drawn in front. Measured over all 800 puzzles: 42 px gives overlap in
    32% of puzzles and never shrinks anything below 77% of target; 50 px (my first try) overlapped
    44%, so I went smaller as you asked. The most crowded puzzle (9 parcels on a 7-row board) still
    reads clearly. Parcels grow to board size when picked up (unchanged). Hit areas are now each
    piece's own cells (padded a little in the tray), so overlapping parcels and L-shaped notches
    behave: the front one gets the click.
  - **Shutter:** on a win, the shutter image is cropped to the board's opening and slides down
    (650 ms, accelerating) until its handle edge reaches the bottom, rests 300 ms, then the usual
    Win/Day-complete overlay appears (~1.1 s after the last piece). Input is off meanwhile. It is
    cropped rather than resized because it is square at the largest board's size, so it covers
    any smaller board.
  - **Button feedback:** new `pressFeedback.js`. A pressed button shrinks to 90% in 70 ms and
    springs back (with a small overshoot) in 170 ms on release or if the pointer leaves, centred on
    its middle whatever its origin. Applied to the HUD icons, Start Packing, Next Truck, the day
    popup's Shop / Decorate / Next Day / Finish, and the Back buttons. Scene-changing buttons wait
    ~0.12-0.14 s before acting (and ignore a second click) so the squash is visible; Reset / Pause /
    Hint act instantly. No separate "pressed" artwork is needed.
  - **Company:** Cozy Cargo, no tagline (the department line remains).
  - **Verified in the browser:** the truck fits a 4x2, 5x4, 6x5 and 6x4 board with its top at y 8 or
    lower on screen; belt and truck positions measured; press scale 0.5 -> 0.45 -> 0.5 with the
    position restored; a win played the shutter (crop grew 2 -> 126 -> 720 art px) and the overlay
    came ~1.1 s later with input off in between; no console errors. 304 tests pass (new: TrayLayout).

- 2026-10-21 — **Full-width belt, faster shutter, no stop between trucks** (Milestone 9.16).
  - Belt now spans the full 1280 width, capped at 230 design px tall (the most that fits under
    the largest 492 px truck with a 10 px top margin). The current 2560x800 art is squashed to
    that until a 2560x440 version is supplied. Parcels 52 px/cell, 90% of the belt usable.
  - Truck still stands on the belt (an earlier lift left the wheels floating); it grows upward,
    and `create()` shrinks the cell size if a truck would come within 10 px of the screen top.
  - Shutter 200 ms, plus a 320 ms damped bob/shake of truck, shutter, board and parcels.
  - Decision: `WinScene` deleted. `handleWin()` now starts the next truck directly; only the last
    truck of a day launches `DayCompleteScene`. (Earlier entries mentioning WinScene are history.)
  - Bug fixed: `this.input.enabled = false` (set while closing) persisted into the next truck;
    `create()` now re-enables it.
  - Verified in headless Chromium: three wins in a row go truck 1 -> 2 -> 3 -> day pop-up, no
    console errors; 304 tests pass.
- 2026-10-21 — **Polish on 9.16:** the bob is now one 5 px down-and-up dip (no x shake, 260 ms);
  the belt sits 22 px below the screen bottom so its lower rollers are clipped; parcel overlap is
  switched off again (`TRAY_MAX_OVERLAP*` = 0, crowded rows shrink instead; the every-puzzle test
  still passes with the smallest parcel >= 60% of its preferred size).
- 2026-10-21 — **Wheel shadow:** four stacked transparent black bands (fading 55% to 10%) over the top of each wheel, just under the bumper, so the wheels look tucked under the truck. Constants `WHEEL_*` in PuzzleScene; it moves with the truck bob.
- 2026-10-21 — **Progression shifted one level earlier** (Milestone 9.17). `SHAPE_UNLOCKS` is now
  level 4 (tri_l, l4), 7 (t4), 10 (s4), 13 (p5), 16 (plus). Regenerated `levels.shapes.json`
  (800 puzzles, all solvable per `validate-levels.js --shapes`; `levels.json` byte-identical).
  Tests and docs updated; the new-piece popup needed no code change. Because the puzzles were
  regenerated, every pool is different from before.
- 2026-10-21 — **Truck extras + Fredoka** (Milestone 9.18). `side-light` 128x448, `handlebar-*` 29x160,
  `license-plate` 256x106 (art px) are placed after the 9-slice by `addTruckExtras`: lights shown
  at 40% of normal art scale (they are drawn large), handlebars and plate at 100% / 75%. Plate text is
  "TRUCK 0k" in Fredoka 600 (new dev dependency `@fontsource/fredoka`, loaded in Preloader). Fredoka
  is only used on the plate so far; the other text is still Arial / Arial Black.
- 2026-10-21 — **9.18 adjustment:** side lights and handlebars now sit centred on the frame's side pillars (inside the frame, not hanging off its edges). The truck now stands 10 px clear of the belt's top edge (`TRUCK_BELT_GAP`, replaces the old 12 px tuck-behind overlap), so the board-height cap is unchanged at 360.
- 2026-10-21 — **Truck positioning:** trucks are now centred vertically in the free space between the top of the screen (16 px margin) and the belt (28 px clear under the wheels), instead of standing near the belt. A board too tall for that space gets smaller cells (e.g. 5x7 -> ~56 px cells). Checked 2x4, 3x3, 5x7 in the browser.
- 2026-10-21 — **Pool variety:** the 5-puzzle pools were only rotated on replays, and a normal run plays each level once, so players always saw puzzle 1 of every pool. `getDayPuzzles()` now adds a random per-session start offset (registry `poolOffset`) to each level's play count. Six fresh sessions started level 1 truck 1 with p5, p2, p4, p1, p3, p5.
- 2026-10-21 — **Shutter feel:** shutter descent slowed to 340 ms (was 200), rest after the bob before the next truck / day pop-up raised to 520 ms (was 60), and a dust puff (soft round particles, Phaser particle emitter, texture 'dust' generated in code) bursts at each wheel base and each bottom corner of the opening when the shutter lands. Constants `SHUTTER_*` and `DUST_*` in PuzzleScene.
- 2026-10-21 — **Ambient sparkles:** small 4-point stars drift and twinkle in the empty margins on either side of the truck (new texture 'sparkle-star', drawn once in code). Two particle emitters, one per side, confined to a zone clear of the HUD, header and belt; spawn rate scales with the margin's area so a wide margin doesn't look emptier than a narrow one. Constants `SPARKLE_*` in PuzzleScene. Verified in headless Chromium (no console errors) and by eye in a screenshot.
- 2026-10-21 — **Reverted the ambient sparkles** (removed SPARKLE_* constants, addAmbientSparkles(), the sparkle-star texture and the call site) - not kept. Belt pushed further below the screen edge: BELT_BOTTOM_CLIP 22 -> 40px, giving trucks more vertical room to grow into on tall boards.
- 2026-10-21 — **Background art added** (assets/background.png, 2560x1440, drawn first in create() at a new BACKGROUND_DEPTH below the truck/belt). Hit a key collision: Boot.js's stock template already loads public/assets/bg.png under the texture key 'background', so the new art was silently losing that race (Phaser kept the 1024x768 template placeholder - a flat blue/cyan gradient, visible as a wrong-colored block in the corner). Fixed by loading the new asset under 'warehouse-background' instead (Preloader.js), leaving the untouched template leftovers (Boot.js, bg.png, Game.js, GameOver.js) alone. Checked on the 2x4 and the tallest 5x7 truck in the browser.
- 2026-10-21 — **Fixed overlapping truck extras on compact boards:** the handlebar (0.42 of the opening's height) and the side light (0.8) were each clamped independently to stay inside a short opening, so on a 3x3 or smaller board they landed on top of each other. addTruckExtras now lays them out as a pair: computes both preferred positions, pushes them apart to a minimum 6px gap if needed (around their shared midpoint), then slides the pair together to stay inside the opening. Verified on a 3x3 board (level 1 truck 2) in the browser - no more overlap.
- 2026-10-21 — **Side lights now shrink on compact trucks too** (not just get pushed as close to the handlebar as the minimum gap allows). Scale factor based on the opening's height in rows: full size at 5 rows or more, shrinking linearly down to 55% of normal at the shortest boards (SIDE_LIGHT_MIN_SCALE_FRACTION / SIDE_LIGHT_FULL_SIZE_ROWS). Checked a 3x3 (small, clear gap under the handlebar) and a 5-row truck (full size, as before).
- 2026-10-21 — **Ground shadow added under the truck** (TRUCK SHADOW section, PuzzleScene): a soft smudge on the floor under the wheels, three overlapping semi-transparent ellipses (Graphics fillEllipse, since there's no native blur) fading outward, centred and sized off the same truckArtWidth/Height as the frame so it always matches the truck - including moving with it on resize and on the landing bob. Checked on a 2x4 and a 5-row truck.
- 2026-10-21 — **Ground shadow reworked** per feedback: replaced the layered-ellipse soft shadow with a single flat rounded rectangle at one opacity (TRUCK_SHADOW_ALPHA 0.16), flush with the bottom of the wheels and stretching down/forward from there rather than straddling that line - matching the mockup's look of a shadow cast toward the viewer. New constants TRUCK_SHADOW_DEPTH_FRACTION (how far it reaches) and TRUCK_SHADOW_CORNER_RADIUS_FRACTION; TRUCK_SHADOW_LAYERS/HEIGHT_RATIO/Y_OFFSET removed. Checked on a 2x4 and a 5x6 truck.
- 2026-10-21 — **Moved the ground shadow under the truck** per feedback: it previously started exactly flush with the frame's bottom edge, which - because of the small transition at the wheel's own edge - still read as floating a few px below the wheels. Pulled its top edge up by 16px (new TRUCK_SHADOW_Y_OVERLAP) to overlap the wheels slightly (the overlap is hidden behind them, drawn on top), so it now reads as emerging from under the truck rather than sitting in a gap behind it. Checked on a 2x4 and a 5x6 truck.
- 2026-10-21 — **Ground shadow enlarged** per the marked-up mockup: now wider than the truck itself (bulges past both side pillars, WIDTH_FRACTION 0.82 -> 1.12), reaches up to about tail-light height instead of just the wheels (Y_OVERLAP 16px -> 90 art px), and extends further down toward the viewer (DEPTH_FRACTION 0.22 -> 0.5, now relative to the truck's own width rather than the shadow's wider width, so widening it didn't also balloon its depth). Checked on a 2x4 and a 5x6 truck.
- 2026-10-21 — **Shortened the ground shadow:** it was reaching the belt on some trucks. TRUCK_SHADOW_DEPTH_FRACTION 0.5 -> 0.3, so it stays a compact rounded rectangle close around the truck, extended only slightly back rather than stretching the full way to the belt. Checked on a 2x4 and the tallest 5x7 truck.
- 2026-10-21 — **Ground shadow now a trapezoid, matching the floor's perspective:** assets/background.png draws the floor in one-point perspective (converging toward the garage door), so a shadow with straight parallel sides sat at the wrong angle. Narrower at the top (TRUCK_SHADOW_TOP_WIDTH_FRACTION 0.8) and wider at the bottom (TRUCK_SHADOW_BOTTOM_WIDTH_FRACTION 1.2, both relative to the truck's width), corners cut at a bevel (no native polygon rounding in Graphics; TRUCK_SHADOW_CORNER_RADIUS_FRACTION replaced by TRUCK_SHADOW_BEVEL_FRACTION). Drawn with fillPoints instead of fillRoundedRect. Checked on a 2x4 and a 5x6 truck.
- 2026-10-21 — **Simplified the ground shadow to a clean 4-point trapezoid** per feedback: the bevelled-corner version (8 points) read as an irregular shape, not a rectangle in perspective. Dropped TRUCK_SHADOW_BEVEL_FRACTION and the corner cuts; it's now just a flat top edge, a flat bottom edge and two straight slanted sides - the shape a rectangle on the ground becomes once drawn in the same one-point perspective as the floor (and the apartment room). Checked in the browser.
- 2026-10-21 — **New-piece popup simplified:** removed the shape name label under each piece (e.g. 'L-piece', 'Corner') per feedback - now just the piece art under the 'New piece(s)!' heading. Panel height shrunk to match (no label row). getShapeName import dropped from NewPieceIntro.js (still used elsewhere: Shape.js, ShapeNames.test.js). Checked level 4's intro (tri_l + l4) in the browser.
- 2026-10-22 — **Title screen art + tab metadata.** TitleScene now shows assets/title-bg.png full-screen (the 'Cozy Couriers' logo and two characters are baked into the art, so the separate text title was removed) with the Start Packing button placed in the open floor gap between the characters (BUTTON_X/Y_FRACTION, measured against that gap - re-measure if title-bg.png is replaced). The new start-packing.png button art re-measured for its clickable pill rect (20,132,2006,496 in its own 2048x768 pixels, alpha>220 threshold). index.html <title> changed from the stock 'Phaser - Template' to 'Cozy Couriers'; public/favicon.png replaced (was the stock Phaser logo) with a 64x64 export of assets/dot.png (the single-box piece art), generated in-browser via canvas since no image library is installed. Verified in headless Chromium: title screen renders, the button's click still starts PuzzleScene, and the tab title reads 'Cozy Couriers'.
- 2026-10-22 — **Worker character, difficulty breakdown, floating reward, tab metadata**
  (Milestone 9.19).
  - New `objects/WorkerCharacter.js`: three poses (worker-neutral/happy/celebrate.png, 160x120 art
    px each), neutral idles with an endless Sine.easeInOut yoyo bob, `react(pose)` swaps texture
    with a Back.easeOut pop and stops the bob. Stands at CHARACTER_X in PuzzleScene, feet on
    `truckBottomY` (the same floor line the ground shadow uses).
  - `handleWin()` now also: tracks `dayByDifficulty` in the registry (reset at truck 0 alongside
    `dayEarned`/`dayTrucksCompleted`), calls `worker.react('celebrate')` for a hard truck or
    `'happy'` otherwise, and calls the new `showFloatingReward(reward)`.
  - `showFloatingReward`: a "+$X" text, depth above even the shutter, rising via one tween while a
    second tween fades it in/hold/out (alpha + `hold`), so the rise doesn't reverse with the fade.
  - DayCompleteScene's rows now include one line per difficulty played (easy/medium/hard order),
    replacing the old single "Truck earnings" line; verified against level 1's known economy
    (3 easy trucks -> "3 Easy trucks  $30", "First day bonus  +$10", "Total earned today  $40").
  - TitleScene rebuilt around assets/title-bg.png (full-screen, the "Cozy Couriers" logo baked in,
    so the old separate text title was removed) with the Start Packing button placed in the art's
    open floor gap (BUTTON_X/Y_FRACTION, re-measured for the new start-packing.png art too).
    scripts/screenshot.js's click position updated to match.
  - index.html `<title>` "Phaser - Template" -> "Cozy Couriers"; public/favicon.ico (replacing
    favicon.png) is the supplied cozy-couriers-favicon.ico.
  - **Debugging note for future me:** chased a false "DayCompleteScene never launches" bug for a
    while - it was a headless-Chromium artifact (an uninterrupted `waitForTimeout` throttles
    requestAnimationFrame, so Phaser's Clock/delayedCall barely progresses) and not a real bug;
    confirmed by polling with short waits instead of one long one. Not a concern in a real browser
    tab, just a testing-harness gotcha worth remembering.
  - Verified in headless Chromium: idle bob visibly drifts frame to frame, happy pose + "+$10" on
    an easy win, celebrate pose + "+$35" on a hard win, and the full truck1->2->3->DayComplete
    flow with the correct difficulty breakdown. 304 tests pass; build clean.
- 2026-10-22 — **Worker character polish:** idle bob reworked to a slow (1.8s) squash/stretch on scaleY only (feet anchored exactly at floorY, since origin is bottom-centre and only the vertical scale is tweened - verified sprite.y never moves while scaleY breathes between ~0.65 and ~0.67). Worker art updated by the user to 480x360 (3x the old 160x120, and meant to read larger on screen, not just sharper); CHARACTER_SCALE recalculated to 0.65 (~225 design px tall, up from ~150). Added a flat elliptical shadow under its feet (new worker-owned, not reused from the truck's trapezoid - a single standing figure doesn't need 'a rectangle in perspective'), same SHADOW_ALPHA as TRUCK_SHADOW_ALPHA so both read as the same light on the same floor. Verified in the browser: feet pinned during the breathing animation, shadow renders, no HUD/truck overlap at the new size.
- 2026-10-22 — **Worker position/scale now adapt to the truck, per feedback:**
  - **Shadow moved up:** its centre now sits slightly ABOVE the feet (SHADOW_Y_OFFSET flipped to
    -10px) rather than below, so the character's legs overlap and hide its upper half - standing
    'in the middle of it' as asked, instead of the whole ellipse trailing out behind.
  - **Position + size now track the truck's own left edge** (interpolated between the truck's
    measured narrowest/widest left-edge positions): a narrow truck leaves more floor, so the
    worker stands closer to it, at up to 2x its previous size (CHARACTER_SCALE_MAX 1.3); a wide
    truck pushes it back toward the HUD and shrinks it down to roughly its original size
    (CHARACTER_SCALE_MIN 0.65). CHARACTER_GAP_FROM_TRUCK (70px) is always kept clear between the
    worker and the truck for a possible future speech bubble.
  - **Y-axis fixed:** the worker's feet now rest at a constant height (freeBottom, the same fixed
    'floor' line the truck is vertically centred above - not truckBottomY, which moves with each
    truck's own height) instead of following the truck's own wheel line, which used to shift
    between puzzles of different board heights.
  - Verified in the browser on a 2x4 (narrow - big, close), a 5x5 (wide - small, further back) and
    a 5x7 (tall) truck: the character's feet sit at the exact same screen height in all three.
- 2026-10-22 — **Worker scaled down 1.5x** per feedback (too big): CHARACTER_SCALE_MAX/MIN 1.3/0.65 -> 0.87/0.43, same ratio kept. Checked on the narrow 2x4 truck.
- 2026-10-22 — **Reverted the adaptive position/scale** per feedback: the worker is back to a fixed CHARACTER_X (240px) and CHARACTER_SCALE (0.87, the top end of the previous range), no longer resizing or shuffling with the truck's width. Checked it stays clear of the truck on both the narrowest (2x4) and widest (5x5) boards. Also softened the idle breathing: IDLE_STRETCH 1.035 -> 1.02 (WorkerCharacter.js).
- 2026-10-22 — **Switched every font to Fredoka.** All Arial/Arial Black text across the game (HUD, headers, DayCompleteScene's report, ShopScene, ApartmentScene, NewPieceIntro, FurnitureView, even the unreachable template-leftover Game.js/GameOver.js) now uses Fredoka, with fontStyle '700' standing in for the old Arial Black and '400' for plain Arial (the licence plate's existing '600' usage was left as-is). Preloader now loads and waits for all three weights (400/600/700) instead of just 600. Verified in the browser: PuzzleScene header/HUD, DayCompleteScene, and ShopScene all render in Fredoka; no Arial fallback visible.
