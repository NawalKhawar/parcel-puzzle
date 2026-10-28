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
├── assets/                     The game's art and audio (WebP - or PNG - drawn at 2x the design size; MP3),
│   │                            sorted into subfolders. The folder is for tidiness only: Preloader
│   │                            loads everything with a Vite glob and uses each file's NAME (minus
│   │                            .webp / .png / .mp3) as its texture or sound key, so file names must be
│   │                            unique across all folders (Preloader throws if two collide) and
│   │                            moving a file between folders never needs a code change.
│   ├── pieces/                 The 12 piece images, named after their shape ids (plus.png ...).
│   ├── characters/             The worker poses (worker-neutral/happy/happy2/celebrate/thinking).
│   ├── truck/                  Truck frame + shutter, conveyor belt, side light, handlebars,
│   │                           licence plate.
│   ├── backgrounds/            Warehouse background, title screen, end-of-day clipboard (landscape).
│   ├── mobile/                 The hand-made PORTRAIT (phone) paintings, as WebP: title-bg-portrait,
│   │                           gameplay-bg-portrait, promotion-portrait, bonus-portrait,
│   │                           clipboard-screen-portrait (trimmed, alpha) and conveyor-belt-portrait (trimmed,
│   │                           alpha: the one big tray), wall-portrait and floor-portrait (the phone apartment's room, only
│   │                           a 760 px slice of each kept). Converted from assets-original/mobile/*.png by
│   │                           scripts/convert-mobile-art.cjs. Everything else in assets/ is shared by both layouts.
│   ├── ui/                     HUD icons and panels, the Start Packing button, the wood panel.
│   ├── apartment/              The apartment: apartment-wall.png (448x96), apartment-floor.png
│   │                           (448x256), and the furniture art as item-<id>.png.
│   ├── audio/
│   │   ├── music/              Title and gameplay music.
│   │   └── sfx/                Pop, level complete, cash register.
│   └── branding/               Source favicon (the live one is public/favicon.ico).
│
├── assets-original/            Full-size PNG / 256 kbps masters of everything in assets/, kept from
│                                before the 2026-10-26 size optimisation (not bundled - Preloader only
│                                reads assets/). Re-export from here if art needs editing.
│
├── public/                     Copied verbatim into dist/: favicon.ico and style.css.
│
├── src/
│   ├── main.js                 App bootstrap: waits for DOMContentLoaded, starts the Phaser game.
│   ├── analytics.js            The ONLY file that talks to GameAnalytics (npm "gameanalytics"): initAnalytics() + trackDayStart / trackDayComplete /
│   │                           trackTruckStart / trackTruckComplete / trackTutorialStep / trackHintUsed / trackReset / trackPurchase /
│   │                           trackApartmentOpened / trackShopOpened / trackMenuChoice. Every call is try/catch + a no-op if analytics is off.
│   ├── analyticsConfig.js      Game Key, Secret Key and the build string (do NOT commit to a public repo).
│   ├── save.js                 The ONLY file that touches localStorage: loadSave() / writeSave(state) /
│   │                           clearSave(), key "parcel_save_v1", every call in try/catch (never throws). It
│   │                           knows nothing about the save's contents, so another backend (a platform SDK)
│   │                           can replace it without changing any game code.
│   │
│   ├── core/                   PURE game-rule engine. No Phaser imports allowed here —
│   │   │                       this is what makes the logic unit-testable and reusable by
│   │   │                       scripts/ (solver, validator) as well as the Phaser scenes.
│   │   ├── Shape.js            Polyomino shape definitions (relative cell coordinates) and
│   │   │                       the canonical shape vocabulary (dot, domino_h, l4, p5, etc) and
│   │   │                       their player-facing names (SHAPE_NAMES / getShapeName).
│   │   ├── Solver.js           Backtracking exact-cover solver: solve() counts/finds
│   │   │                       solutions; findHint() works out where one piece belongs for
│   │   │                       the in-game Hint button (a highlight only). Used by scripts/
│   │   │                       and the game.
│   │   ├── Grid.js             Board model: dimensions, blocked cells, filled cells;
│   │   │                       canPlace/place/remove/isComplete.
│   │   ├── pickReaction.js     Random worker pose on a solved truck, never the same twice in a row.
│   │   ├── ftueTrail.js        The first-day trail (paycheck -> shop -> apartment, switched off by a skipped tutorial): FTUE_ITEM_ID ('clock') and
│   │   │                       ftueTrailStage() = 'shop' | 'decorate' | 'free', worked out from what the player owns.
│   │   ├── badges.js           When the red dots show: shopHasBuyable(day, state, config, categories?) for the Shop button / shop tabs,
│   │   │                       apartmentHasNew(owned, seen) for the Decorate button.
│   │   ├── saveState.js        The save FORMAT: SAVE_VERSION, defaultSaveState(), and mergeSave(raw) which
│   │   │                       merges a stored object over the new-game defaults field by field (bad or missing
│   │   │                       fields fall back; a newer version or a non-save gives null). Includes 'truck' + 'truckLog' (trucks
│   │   │                       packed in the saved day, kept in agreement). Pure, no storage.
│   │   ├── economy.js          The game's MONEY RULES as pure functions (config passed in): payForTruck,
│   │   │                       dayPay, workloadForDay, bonusForDay / claimBonuses (each paid once),
│   │   │                       promotionRank, hintCost / purchaseHint, overtimeOffer / overtimePay,
│   │   │                       shopStatus / purchaseItem, save/restore of the economy state, and
│   │   │                       simulateShopper, promotionRaisePercent and dayStartScreens (which of the
│   │   │                       promotion / bonus screens a day opens with). Whole dollars only; rounding goes up.
│   │   ├── Placement.js        Pure helpers: translate a shape to board coords, check
│   │   │                       bounds/overlap/blocked-cell conflicts.
│   │   ├── roomConfig.js       Apartment size constants: TILE, ROOM_W, ROOM_H, WALL_ROWS, WALL_HANG_ROWS,
│   │   │                       PIXEL_ART, MAX_HEIGHT_ROWS, HEADROOM_ROWS.
│   │   ├── RoomLayout.js       Apartment logic on one top-down tile grid (wall strip rows
│   │   │                       on top, floor below): placement rules (bounds, per-layer
│   │   │                       overlap - wall / rug / furniture), draw order, picking by
│   │   │                       sprite bounds, save/load, footprint -> sprite pixel maths,
│   │   │                       and findNearestValid (where an illegal drop lands instead).
│   │   ├── TrayLayout.js       Conveyor-belt maths: how big the parcels are and where each
│   │   │                       goes in the single row - full size with gaps, then a slight
│   │   │                       overlap when crowded, then shrinking as a last resort. Also
│   │   │                       computeTrayRows / planTrayRows: the portrait (phone) tray, which wraps
│   │   │                       the parcels onto 1-3 conveyor lanes at one shared size.
│   │   └── orientation.js      Landscape vs portrait: windowIsPortrait and gameSizeForWindow (landscape is
│   │                           always exactly 1280x720; portrait is 720 wide, 1000-1560 tall). Pure.
│   │
│   ├── data/                   Runtime level data — the NEW schema (replaces the legacy
│   │   │                       docs/level_data.md format entirely). Shape geometry itself
│   │   │                       is NOT duplicated here — levels reference shape ids that
│   │   │                       are defined once, canonically, in core/Shape.js.
│   │   ├── economy.json        EVERY money number: tier units (easy 2 / medium 3 / hard 7), pay ranks
│   │   │                       (unit value $5 / $6 / $7 from day 1 / 20 / 40), trucks per day, one-off
│   │   │                       bonuses (enabled flag; `screen: true` = paid on its own bonus screen before the day, else on the paycheck), hint cost, overtime (flag, day list,
│   │   │                       multiplier) and the shop price list (price, unlockDay, category, enabled).
│   │   ├── loadEconomy.js      Validates economy.json (loadEconomy); exports TIER_IDS, SHOP_CATEGORIES.
│   │   ├── levels.json         The original 50 levels (days), each a list of 3-6 trucks
│   │   │                       (puzzles): id, rows, cols, blocked cells, piece list,
│   │   │                       difficulty label + score (no money data). GENERATED by scripts/
│   │   │                       generate-levels.js. NO LONGER PLAYED by the game - kept as
│   │   │                       the reference set for the generator, validator and tests.
│   │   ├── levels.shapes.json  Second puzzle set (~1200 puzzles: a pool of 5 per truck slot)
│   │   │                       where shapes are introduced one at a time (dot + square at
│   │   │                       level 1, then one every 3 levels, then every 4, then every 5: all 12 by level 38).
│   │   │                       GENERATED (generate-levels.js --shape-gated). THIS is the file
│   │   │                       the game plays (see pickDayPuzzles.js).
│   │   ├── levels.schema.md    Human-readable description of the level object shape.
│   │   ├── items.json          The furniture catalogue: id, name, footprint {w,h},
│   │   │                       heightRows, wallMounted, flat (rugs), intoWall (may back into
│   │   │                       the wall's cleared bottom row - the fridge), sprite key,
│   │   │                       placeholder colour. Look and floor space only - prices and unlock days
│   │   │                       are in economy.json. The apartment and the shop both use it.
│   │   ├── company.json        The employer shown on the end-of-day popup: name (Cozy
│   │   │                       Cargo) and department.
│   │   ├── wallpapers.json     Wall colours: id, name, colour (price / unlock day: economy.json).
│   │   ├── loadWallpapers.js   Validates wallpapers.json (file order).
│   │   ├── loadItems.js        Validates items.json (loadItems).
│   │   ├── loadLevel.js        Loads + validates levels/trucks at runtime (loadTruck,
│   │   │                       loadLevel, loadLevels, loadShapeLevels, createGridForTruck); throws loudly
│   │   │                       on malformed data instead of failing silently in-scene.
│   │   └── pickDayPuzzles.js   Picks one puzzle per truck slot (rotating through each pool on replays) when a day
│   │                           starts, ordered easiest to hardest; pickOvertimePuzzle picks the extra
│   │                           overtime truck (highest tier, not already played today).
│   │
│   ├── game/                   Phaser-specific code. Everything here MAY import 'phaser'
│   │   │                       and should translate core/ + data/ into rendered, interactive
│   │   │                       game objects — it should not contain puzzle-rule logic itself.
│   │   ├── main.js             Phaser.Game config (scale, scenes list) and the StartGame()
│   │   │                       factory consumed by src/main.js.
│   │   ├── economy.js          The validated economy config (one shared copy) and the registry-backed
│   │   │                       economy state: getEconomyState / setEconomyState / resetEconomy / getMoney.
│   │   ├── dayFlow.js          startDay: the screens between Next Day and gameplay (promotion, then bonus), one
│   │   │                       scene each, then the day's first truck.
│   │   ├── layout.js           ORIENTATION: isPortrait(scene), gameSizeForWindow, and watchOrientation(game) -
│   │   │                       resizes the canvas and restarts the active scene when the window flips between
│   │   │                       wide and tall (a scene may define getRelayoutData / relayoutBlocked).
│   │   ├── fonts.css           The Fredoka @font-face rules (Latin 400 / 600 / 700, .woff2 only), imported by Preloader.
│   │   ├── progress.js         Save / load glue: initSave (Boot, once), hasSave, commitTruck (a truck was packed),
│   │   │                       commitDay (end of a workday: saves the NEXT day), saveProgress (shop purchase /
│   │   │                       apartment change), saveMute (rewrites the last saved state with new mute
│   │   │                       choices), startNewGame, continueGame (resumes at the next unpacked truck). A save
│   │   │                       always describes the START of a truck; the pay of a won-but-uncommitted truck
│   │   │                       (last truck / overtime) is held back, so a reload never pays it twice.
│   │   ├── uiScale.js          Exports UI_SCALE (devicePixelRatio, capped at 2), used to
│   │   │                       multiply every pixel constant in src/game/ so the canvas
│   │   │                       stays sharp on full-screen/high-DPI displays (Scale.FIT only
│   │   │                       ever resizes the canvas's CSS size, never its pixel buffer).
│   │   ├── scenes/
│   │   │   ├── Boot.js         Minimal first scene (loads nothing); kicks off the Preloader, whose
│   │   │   │                   loading screen is a plain cream colour with a brown progress bar.
│   │   │   ├── Preloader.js    Loads the art from assets/, then starts TitleScene.
│   │   │   ├── TitleScene.js   Title screen: the game's name + the Start Packing
│   │   │   │                   button image, which starts level 1, truck 1. No other items.
│   │   │   ├── PuzzleScene.js  The core gameplay scene: plays one truck (puzzle) of one
│   │   │   │                   level (day) — started with { levelIndex, truckIndex }; the
│   │   │   │                   day's puzzles rotate through the pools (picked at truck 1) and are kept
│   │   │   │                   in the registry.
│   │   │   │                   Renders the 9-sliced truck frame sized to the board,
│   │   │   │                   the conveyor belt with the parcels in one row on it,
│   │   │   │                   the shutter that closes the truck on a win, owns drag/snap, win
│   │   │   │                   detection, the coin HUD with the Reset/Pause/Hint icon
│   │   │   │                   buttons, dragging placed pieces off the board, the "Level N ·
│   │   │   │                   Truck k/total" header, pays each truck from the economy rules,
│   │   │   │                   offers overtime after the last truck on the configured days,
│   │   │   │                   pays one-off bonuses at the end of the day, and sells extra
│   │   │   │                   hints (money only) once the day's free hint is spent. The wallet and
│   │   │   │                   the day's truck log live in the Phaser registry, since a fresh
│   │   │   │                   PuzzleScene instance is created per truck.
│   │   │   ├── DayCompleteScene.js  The paycheck after a level's last truck: one line per truck
│   │   │   │                   (tier + amount, overtime marked), each bonus on its own line, a
│   │   │   │                   promotion notice, the total and the new balance, under the company
│   │   │   │                   header (company.json), and Shop / Decorate / Next Day buttons (Next
│   │   │   │                   Day becomes Finish after the last level, and goes via the promotion
│   │   │   │                   screen when the next day brings a raise).
│   │   │   ├── PromotionScene.js  The promotion screen (assets/promotion.png, before days 20 and 40): the
│   │   │   │                   raise (20% / 40% of starting pay) written in the art's blank; fanfare;
│   │   │   │                   lower-right arrow carries on.
│   │   │   ├── BonusScene.js   The bonus screen (assets/bonus.png, before days 7 and 30): pays the one-time
│   │   │   │                   bonus and writes the amount in the art's blank; fanfare; arrow carries on.
│   │   │   ├── ShopScene.js    The shop: the shop list from economy.json as pages of horizontal item
│   │   │   │                   cards (unlocked first, then dimmed "Unlocks Day N" cards), flipped
│   │   │   │                   with the on-screen or keyboard left/right arrows. Clicking a card BUYS
│   │   │   │                   it (cash register); owned cards read "Owned". Back returns to the paycheck - or, when opened
│   │   │   │                   from the pause menu (data.returnTo), to the truck that was being played.
│   │   │   └── ApartmentScene.js  The apartment (the popup's "Decorate" button): a
│   │   │   │                   top-down 3/4 tile room (wall strip above a square-tile
│   │   │   │                   floor) drawn at a whole-number scale; drag furniture from
│   │   │   │                   the inventory (only items the player has bought) with a green/red ghost, tap a placed item to
│   │   │   │                   put it away, undo/redo/clear. Layout is kept in
│   │   │   │                   the registry ('apartmentLayout').
│   │   └── objects/
│   │       ├── GridView.js     Draws a Grid (core/Grid.js) as cells on screen: open
│   │       │                   cells are the truck's grey with darker grid lines, so the grid
│   │       │                   looks baked into the truck; blocked cell styling; also owns ghost/snap-preview
│   │       │                   rendering for a piece being dragged and the pulsing
│   │       │                   hint highlight (showHint/clearHint).
│   │       ├── artBounds.js    Finds the visible rectangle of an image (art is centred on a bigger
│   │       │                   canvas): used to stand apartment items on their floor tile and to fit
│   │       │                   shop/inventory icons to their square (addFittedIcon).
│   │       ├── money.js        Money display: "[note icon] 40" (addMoneyText) instead of a "$" sign,
│   │       │                   plus the small smoothed copy of the big currency note art.
│   │       ├── MoneyHud.js     The money counter panel (gameplay HUD and shop, the shop's larger).
│   │       ├── DayStartPopup.js  The popup opening each day (replaces NewPieceIntro): day number, truck count,
│   │       │                   a rotating action line, any new pieces, and the boss head.
│   │       ├── BossPanel.js    The speech panel (character head + message + optional Next button), sized to fit its text; vertical or compact horizontal layout, any head.
│   │       ├── OfferPopup.js   The boss's two popups over the puzzle: the overtime offer ("One more truck?
│   │       │                   Time and a half.") and the extra-hint offer (ad = free / buy with money).
│   │       ├── fullScreenArt.js  addCoverArt (a picture fitted to cover the canvas, text placed by fractions of
│   │       │                   the picture) and addProceedButton (the lower-right next-page arrow) for the
│   │       │                   promotion and bonus screens.
│   │       ├── pillButton.js   addPillButton: the rounded orange text button used by those popups and the promotion screen.
│   │       ├── cornerTip.js    A short corner popup from a character (worker head), for the shop / apartment tips.
│   │       ├── pulse.js        addPulse: a steady grow-and-shrink on a button, pausing on hover (leads the player to Shop, Decorate).
│   │       ├── FtueGuide.js    First-day guide for the very first puzzle: boss panel beside the truck, Next button,
│   │       │                   then highlights a parcel + its spot, then a 3s "not bad" message and it leaves.
│   │       ├── skipButton.js   addSkipButton: the "skip tutorial >" picture button (assets/ui/skip-tut-button.webp) a returning player uses to skip the whole tutorial.
│   │       ├── GuideCursor.js  The pointing-hand cursor (assets/ui/hand-cursor.webp) that SHOWS the player what to do: playDrag
│   │       │                   (press, drag, release, loop) and playTap (press, bounce, fade, loop). Only a picture - never touches
│   │       │                   the real parcels / buttons / furniture. Used by the first-day guide, paycheck and apartment.
│   │       ├── audioToggle.js  Square music/SFX mute toggle for the pause menu (drawn note / speaker icon).
│   │       ├── badge.js        The red dot drawn on the corner of a button (addBadgeToImage / addBadgeToBox).
│   │       ├── imageButton.js  addImageButton: a picture button sized by design height (assets/ui/button-*).
│   │       ├── pressFeedback.js  Click feedback for any button: squashes when pressed with a mouse,
│   │       │                   GROWS while a finger is down on a phone, springs back on release; optional short delay so scene-
│   │       │                   changing buttons show it before they act.
│   │       └── PieceView.js    Draws a single piece using its art image (assets/<shape id>.png); owns
│   │                           pointer input and drag state (not placement legality). Placed
│   │                           pieces stay draggable, with an exact-shape hit area.
│   │
│   (Real art for the six luxury placeholder items, and a real rewarded-ad provider, remain
│    future work - see ROADMAP.md.)
│
├── scripts/                    Node CLI tools. convert-mobile-art.cjs turns the portrait paintings in
│   │                           assets-original/mobile/ into assets/mobile/*.webp (trims the clipboard and the tray,
│   │                           clears stray near-invisible pixels; needs the sharp package, which is not a
│   │                           project dependency - see its header).
│   │                           validate-levels.js/generate-levels.js consume
│   │                           src/core and src/data directly (no Phaser dependency,
│   │                           run outside the browser); screenshot.js is the one
│   │                           exception (see below) — it drives the real browser build.
│   ├── validate-levels.js      CLI entry point: runs the solver against every truck of
│   │                           every level in src/data/levels.json (or, with --shapes,
│   │                           every puzzle in levels.shapes.json), prints a pass/fail
│   │                           report.
│   ├── generate-levels.js      Authoring tool: (re)generates src/data/levels.json — the
│   │                           30-level plan, random solvable boards, difficulty scoring
│   │                           (seeded/deterministic). With --shape-gated it instead builds
│   │                           levels.shapes.json (shape unlock plan, pools per slot). Uses
│   │                           the solver to check each puzzle.
│   ├── simulate-economy.js     Plays economy.json forward for a model player (no Phaser): pay per
│   │                           rank, 50-day totals and the day each shop item is bought.
│   ├── screenshot.js           Dev/QA helper: launches the dev server, drives headless
│   │                           Chromium (Playwright) through the boot sequence, clicks
│   │                           Play, saves title + puzzle screenshots, reports console
│   │                           errors.
│   │                           This is how src/game/ UI work gets visually verified
│   │                           (Phaser renders to a single <canvas>, so there's no DOM
│   │                           to assert against any other way). Output goes to
│   │                           scripts/.screenshots/ (gitignored).
│   └── .screenshots/           Gitignored output directory for screenshot.js.
│
├── tests/                      Unit & regression tests, run via `npm test` (Node's
│   │                           built-in `node --test` — see TRACKER.md's Milestone 8
│   │                           decision log for why that was chosen over vitest/etc).
│   ├── core/                   Tests for Shape/Grid/Placement, RoomLayout and economy (pay by rank, day pay,
│   │                           bonuses once across save/load, hints, overtime, shop rules, the buy-out
│   │                           simulation, whole-dollar checks) and saveState (what a damaged, partial or
│   │                           too-new save turns into) and ftueTrail (which step of the first-day trail a
│   │                           player is on, and that an unbuyable clock skips it).
│   ├── solver/                 Solver micro-tests + a check that every shipped truck solves.
│   └── data/                   loadLevel validation tests + checks that levels.json matches
│                               the design spec (50 levels, trucks per level, difficulty ramp);
│                               items.json validation; economy.json validation, the shop vs the art
│                               files and the levels vs the workload table; the shape-gated pool
│                               (unlock levels, no early shapes, pool size, solvability);
│                               pickDayPuzzles (one per slot, never getting easier); the first-day trail item
│                               (the clock is on sale from day 1, affordable from day 1's pay, and fits on the wall).
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
import `phaser`.** That boundary is what lets `src/core/Solver.js` and `scripts/validate-
levels.js` run in plain Node (fast, scriptable, CI-friendly) and what lets `tests/`
exercise puzzle logic without spinning up a browser or a Phaser game instance.
`src/game/` is the only layer allowed to depend on Phaser, and it should stay a thin
rendering/input layer over `core/` + `data/` rather than reimplementing puzzle rules.
