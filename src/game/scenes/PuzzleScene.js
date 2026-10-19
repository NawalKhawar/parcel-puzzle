import { Scene } from 'phaser';

import { loadShapeLevels, createGridForTruck } from '../../data/loadLevel.js';
import { pickDayPuzzles } from '../../data/pickDayPuzzles.js';
import { findHint } from '../../core/Solver.js';
import { computeTrayLayout } from '../../core/TrayLayout.js';
import shapeLevelsRaw from '../../data/levels.shapes.json';
import { GridView } from '../objects/GridView.js';
import { PieceView } from '../objects/PieceView.js';
import { showNewPieceIntro } from '../objects/NewPieceIntro.js';
import { makePressable } from '../objects/pressFeedback.js';
import { UI_SCALE } from '../uiScale.js';

/**
 * PuzzleScene.js
 *
 * The core gameplay scene: loads one truck (puzzle) of one level (day) via
 * src/data/loadLevel.js, which validates it against the schema in
 * src/data/levels.schema.md, renders its grid with a GridView, and renders its unplaced
 * pieces as a row of PieceViews below the board.
 *
 * As of Milestone 5, this scene also owns the drag-and-drop/snap gameplay loop: it
 * listens for Phaser's scene-wide 'drag'/'dragend' events (every PieceView makes
 * itself draggable on creation — see PieceView.makeDraggable), and for each event asks
 * GridView.findNearestValidOrigin() for the best nearby legal placement (a generous,
 * "magnetic" search, not a pixel-perfect one), shows a ghost highlight on the board via
 * GridView.showGhost(), and on a legal drop commits the placement to the Grid and
 * snaps the piece into place. This is deliberately where that decision-making logic
 * lives rather than in PieceView/GridView: those two classes only know how to draw
 * themselves and report geometry — the actual "what does a drag mean for this puzzle"
 * decision belongs with the scene that owns the Grid (see "Architectural boundary" in
 * PROJECT_STRUCTURE.md).
 *
 * As of Milestone 6, this scene also owns win detection and level progression: every
 * successful placement checks src/core/Grid.isComplete(), and on the first placement
 * that completes the board, this scene pauses itself and launches an overlay on top
 * (handleWin()). The overlay's button starts a brand-new PuzzleScene instance at the
 * next truck (passed via Phaser's scene data, read in init()) — a full restart rather
 * than mutating this instance in place, so every truck begins from a clean Grid with
 * no leftover placements.
 *
 * Placed pieces are not locked: the player can pick one up again and drag it somewhere else
 * on the board, or drag it off the board to send it back to the tray (see pickUpFromBoard()
 * and the dragend handler). That is why there is no Undo button - moving pieces around by hand
 * replaces it, without a fixed button to reach for. Reset (clears the whole board back to the
 * tray) and Pause remain. Pause doesn't use Phaser's own scene.pause() (that would also
 * freeze the Resume button itself, since it lives in this same scene) — instead it shows an
 * overlay and disables dragging on every piece directly.
 *
 * Game structure (see docs/game_concept.pdf's Daily Loop): the game is a list of LEVELS
 * (each one in-game day), and each level holds several TRUCKS (one packing puzzle
 * each). This scene is started with { levelIndex, truckIndex } and plays that one truck.
 * Completing a truck earns its `reward` in coins, added to running totals kept in
 * Phaser's cross-scene Data Manager (`this.registry`) so they survive the "stop this
 * scene, start a fresh one for the next truck" restart pattern: 'dayTrucksCompleted' /
 * 'dayEarned' (reset whenever truck 0 of a level begins - see init()) and 'totalEarned',
 * the all-time pay count, which is NOT reset between days (only TitleScene's Play
 * resets it). The coin HUD shows that all-time total (createHud()); finishing a truck
 * that isn't the day's last goes straight on to the next truck, while the day's last shows
 * DayCompleteScene (see handleWin()), which offers Shop / Decorate / Next Day.
 *
 * From the second level onwards a Hint button is shown (createHud()): pressing it
 * highlights, on the board, the cells where one piece belongs (useHint(), built on
 * core/Solver.findHint) and fades the button out - one hint per truck. The hint only
 * nudges: it never places, moves or removes anything. The highlight stays until the
 * right piece is actually sitting there (see refreshHint()).
 *
 * On the first truck of a level that introduces new shapes, a "New piece!" popup shows (see
 * objects/NewPieceIntro.js) before the player can start.
 */

/** A single cell size is used for both the board and the tray so a piece doesn't change
 *  size when it snaps into place — see the Milestone 5 decision log entry in
 *  TRACKER.md for why that matters once pieces are actually draggable. Multiplied by
 *  UI_SCALE (see src/game/uiScale.js) along with every other pixel constant below, so
 *  the game renders at a sharper resolution without changing how big anything looks
 *  on screen — the canvas itself is bigger (set from the same UI_SCALE in main.js),
 *  so everything drawn onto it needs to grow by the same factor to end up the same
 *  on-screen size, just built from more real pixels. */
const MAX_CELL_SIZE = 72 * UI_SCALE;

/** Boards are square or portrait (they represent the open back of a truck), so some are
 *  taller than the screen has room for. A board is never drawn taller than this: tall
 *  boards get a smaller cell size instead (see create()), keeping room for the tray. */
const BOARD_MAX_HEIGHT = 360 * UI_SCALE;

/**
 * The artwork (assets/) is drawn at twice the design size for sharpness, so one art pixel is this
 * many game pixels. Everything sized from an image below is "art pixels x ART_SCALE".
 */
const ART_SCALE = UI_SCALE / 2;

/**
 * THE CONVEYOR BELT (assets/conveyor-belt-dark.png, 2560x800 art pixels).
 *
 * It fills the whole lower band of the screen: the full 1280 design width, and a height of at
 * most BELT_MAX_HEIGHT (230) so the biggest truck still fits above it. If the artwork's own
 * proportions would be taller than that it is squashed to fit, so export the art at about
 * 2560x440 (see README). The numbers below locate the dark belt surface inside the image: from
 * 5% to 87% of its height, centred at 46%, and about 90% of its width is usable.
 */
const BELT_MAX_HEIGHT = 230 * UI_SCALE;
/** The belt is pushed this far below the screen's bottom edge, so its lower rollers are cut off and
 *  it looks like it runs on past the edge of the screen. */
const BELT_BOTTOM_CLIP = 22 * UI_SCALE;
const BELT_SURFACE_TOP = 0.05;
const BELT_SURFACE_BOTTOM = 0.87;
const BELT_SURFACE_CENTER = 0.46;
const BELT_USABLE_WIDTH = 0.9;

/** How the parcels sit on the belt: a single row, drawn at about this size per cell (well below
 *  the board's 72, so they fit), with a small gap - or, when crowded, a slight overlap (see
 *  core/TrayLayout.js). On the board a piece is the board's cell size; it grows when picked up.
 *  Measured over all 800 puzzles: at 42 about a third overlap at all and none shrink below 77% of
 *  this; at 50 nearly half overlap; at 34 hardly any do but the parcels get hard to grab. */
const TRAY_CELL_SIZE = 52 * UI_SCALE;
const TRAY_PIECE_GAP = 8 * UI_SCALE;
const TRAY_MAX_OVERLAP_FRACTION = 0; // parcels never overlap: a crowded row shrinks instead
const TRAY_MAX_OVERLAP = 0;
/** The row may shrink to this fraction of its preferred size, no further. */
const TRAY_MIN_RELATIVE_SCALE = 0.5;
/** The tallest parcel may use at most this fraction of the belt surface's height. */
const TRAY_MAX_HEIGHT_FRACTION = 0.9;

/**
 * THE TRUCK (assets/truck-with-wheels.png, 912x984 art pixels): a frame around a grey opening,
 * with wheels under it. It is stretched to fit each board with a 9-slice: the four margins below
 * (in art pixels) never stretch - they hold the corners, bumper, tail lights and wheels - while
 * the plain strips between them stretch to make the frame as wide and tall as the board needs.
 * The bottom margin is the bumper bar plus the wheels. For a 5x5 board at full cell size the
 * opening is exactly the artwork's own 720x720, so nothing is stretched.
 */
const TRUCK_MARGINS = { left: 96, right: 96, top: 96, bottom: 168 };
/** How far the bottom of the truck (its wheels) tucks behind the belt's back rail. */
const TRUCK_BELT_OVERLAP = 12 * UI_SCALE;
/** The truck never gets closer than this to the top of the screen: if a board is so tall that the
 *  truck would, the cells shrink instead (see create()). Shorter trucks simply stand on the belt. */
const TRUCK_TOP_MARGIN = 10 * UI_SCALE;

/**
 * The soft shadow the bumper casts on the tops of the wheels, so they look tucked under the truck.
 * Measured on assets/truck-with-wheels.png (art pixels): the bumper ends 74 px above the image's
 * bottom edge, the left wheel spans x 24-95 and the right wheel 25-96 in from the right edge. The
 * shadow is a few stacked bands that fade out going down, each a transparent dark block.
 */
const WHEEL_TOP_FROM_BOTTOM = 74;
const WHEEL_SPANS = [{ fromLeft: 24, width: 72 }, { fromRight: 25, width: 72 }];
const WHEEL_SHADOW_BANDS = [0.55, 0.38, 0.22, 0.1]; // opacity of each band, top to bottom
const WHEEL_SHADOW_BAND_HEIGHT = 7; // art pixels per band

/** Draw depths (higher is in front): the truck, then the belt, then everything else at 0 and up. */
const TRUCK_DEPTH = -20;
const BELT_DEPTH = -10;
const PLACED_DEPTH = 10; // parcels on the board
const SHUTTER_DEPTH = 60; // covers the board, over the parcels placed on it
const DRAG_DEPTH = 500; // the parcel being carried

/** How long the shutter takes to roll down, and how long it rests before the overlay appears (ms). */
const SHUTTER_CLOSE_MS = 200;
const SHUTTER_HOLD_MS = 60;
/** The little bounce the truck gives when the shutter lands: total time, and how far it dips (px). */
const TRUCK_BOB_MS = 260;
const TRUCK_BOB_PX = 5 * UI_SCALE;

/** Size (design pixels) of the square HUD icon buttons (assets/*-icon.png are 96x96, drawn at half). */
const HUD_BUTTON_SIZE = 48 * UI_SCALE;

/** Coins awarded for completing a truck whose data doesn't set its own `reward` (see
 *  levels.schema.md) — every puzzle actually shipped in levels.shapes.json sets one explicitly,
 *  so this is purely a safety net for hand-edited/future level data that omits it. */
const DEFAULT_REWARD = 10;

export class PuzzleScene extends Scene
{
    constructor ()
    {
        super('PuzzleScene');
    }

    /**
     * Phaser calls init(data) before create(), with whatever data object was passed to
     * scene.start()/scene.launch() — TitleScene's Play button, handleWin()'s hop to the next truck
     * button and DayCompleteScene's "Next Day" button all pass { levelIndex, truckIndex }
     * here to say which truck to play. Defaults to level 1, truck 1 if started with no data.
     *
     * @param {{ levelIndex?: number, truckIndex?: number }} [data]
     */
    init (data)
    {
        this.levelIndex = data && typeof data.levelIndex === 'number' ? data.levelIndex : 0;
        this.truckIndex = data && typeof data.truckIndex === 'number' ? data.truckIndex : 0;

        // A day always begins at its first truck, so that's the one moment the day's
        // running totals start over (covers Play from the title screen and Next Day alike).
        if (this.truckIndex === 0)
        {
            this.registry.set('dayTrucksCompleted', 0);
            this.registry.set('dayEarned', 0);
        }

        this.hasWon = false;
        this.isPaused = false;
        /** Each truck allows one hint; a fresh scene instance per truck resets this. */
        this.hintUsed = false;
        /** The hinted target ({ shapeId, row, col }) once the hint has been used, else null. */
        this.hint = null;
        /** Whether the hint highlight is currently drawn on the board. */
        this.hintShowing = false;
        /** While a piece that came off the board is being carried: the board cell it came from ({ row, col }), else null. */
        this.pickedUpFrom = null;
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0xf5ead6);

        // loadShapeLevels throws loudly on any schema violation, so broken level data
        // fails fast and visibly here rather than producing a silently-wrong board.
        this.levels = loadShapeLevels(shapeLevelsRaw);
        this.levelData = this.levels[this.levelIndex];
        const truck = this.getDayPuzzles()[this.truckIndex];

        this.truck = truck;
        this.grid = createGridForTruck(truck);

        // Input is switched off while a truck closes (see handleWin); this scene instance is
        // reused for the next truck, so make sure it is back on.
        this.input.enabled = true;

        // The conveyor belt fills the whole lower band, behind everything but the truck.
        const belt = this.add.image(this.scale.width / 2, this.scale.height + BELT_BOTTOM_CLIP, 'conveyor-belt-dark').setOrigin(0.5, 1);
        const beltHeight = Math.min(BELT_MAX_HEIGHT, this.scale.width * (belt.height / belt.width));
        belt.setDisplaySize(this.scale.width, beltHeight).setDepth(BELT_DEPTH);
        this.belt = belt;
        const beltTop = belt.y - beltHeight;

        // One cell size is used for the board and the tray (see the note on MAX_CELL_SIZE).
        // Normally the maximum, but shrunk for tall boards so the board never exceeds
        // BOARD_MAX_HEIGHT, and further if the truck (board + its fixed frame) would not fit
        // between the top margin and the belt.
        const frameHeight = (TRUCK_MARGINS.top + TRUCK_MARGINS.bottom) * ART_SCALE;
        const roomForBoard = beltTop + TRUCK_BELT_OVERLAP - TRUCK_TOP_MARGIN - frameHeight;
        this.cellSize = Math.min(MAX_CELL_SIZE, BOARD_MAX_HEIGHT / truck.rows, roomForBoard / truck.rows);

        const boardPixelWidth = truck.cols * this.cellSize;
        const boardPixelHeight = truck.rows * this.cellSize;

        // The truck, stretched to fit this board. Its size in art pixels is the board (converted
        // from game pixels to art pixels) plus the fixed margins; it stands with its wheels just
        // behind the belt, and the board goes where the grey opening is.
        const truckArtWidth = boardPixelWidth / ART_SCALE + TRUCK_MARGINS.left + TRUCK_MARGINS.right;
        const truckArtHeight = boardPixelHeight / ART_SCALE + TRUCK_MARGINS.top + TRUCK_MARGINS.bottom;
        // Always standing on the belt, so each truck grows upward into the empty space above it;
        // the cell-size limit above guarantees it never reaches the top margin.
        const truckTop = beltTop + TRUCK_BELT_OVERLAP - truckArtHeight * ART_SCALE;
        const boardX = (this.scale.width - boardPixelWidth) / 2;
        const boardY = truckTop + TRUCK_MARGINS.top * ART_SCALE;
        this.truckFrame = this.add
            .nineslice(
                boardX - TRUCK_MARGINS.left * ART_SCALE,
                truckTop,
                'truck-with-wheels',
                undefined,
                truckArtWidth,
                truckArtHeight,
                TRUCK_MARGINS.left,
                TRUCK_MARGINS.right,
                TRUCK_MARGINS.top,
                TRUCK_MARGINS.bottom
            )
            .setOrigin(0, 0)
            .setScale(ART_SCALE)
            .setDepth(TRUCK_DEPTH);

        // Shadow on the wheel tops. Drawn just in front of the truck (still behind the belt).
        const truckLeft = this.truckFrame.x;
        const truckRight = truckLeft + truckArtWidth * ART_SCALE;
        const wheelTop = truckTop + (truckArtHeight - WHEEL_TOP_FROM_BOTTOM) * ART_SCALE;
        this.wheelShadow = this.add.graphics().setDepth(TRUCK_DEPTH + 1);
        for (const wheel of WHEEL_SPANS)
        {
            const x = wheel.fromLeft !== undefined
                ? truckLeft + wheel.fromLeft * ART_SCALE
                : truckRight - (wheel.fromRight + wheel.width) * ART_SCALE;
            WHEEL_SHADOW_BANDS.forEach((alpha, i) => {
                this.wheelShadow.fillStyle(0x000000, alpha);
                this.wheelShadow.fillRect(
                    x,
                    wheelTop + 1 * ART_SCALE + i * WHEEL_SHADOW_BAND_HEIGHT * ART_SCALE,
                    wheel.width * ART_SCALE,
                    WHEEL_SHADOW_BAND_HEIGHT * ART_SCALE
                );
            });
        }

        this.gridView = new GridView(this, boardX, boardY, this.grid, this.cellSize);

        // "Level N · Truck k/total" header, top right (the truck can reach the top-centre of
        // the screen on tall boards). The truck total is read from the level's own truck list, so
        // it stays correct automatically as levels are edited. Difficulty is shown too, which
        // makes the ramp visible.
        const trucksTotal = this.levelData.trucks.length;
        this.add
            .text(this.scale.width - 24 * UI_SCALE, 28 * UI_SCALE, `Level ${this.levelIndex + 1}  ·  Truck ${this.truckIndex + 1}/${trucksTotal}  ·  ${truck.difficulty ?? ''}`, {
                fontFamily: 'Arial',
                fontSize: 20 * UI_SCALE,
                color: '#3a362f',
            })
            .setOrigin(1, 0.5);

        this.layoutTray();
        this.wireDragEvents();
        this.createHud();

        // A level that introduces new shapes announces them once, at the start of the day (its
        // first truck; later trucks are fresh scene instances and must not repeat it).
        if (this.truckIndex === 0 && this.levelData.newShapes.length > 0)
        {
            showNewPieceIntro(this, this.levelData.newShapes);
        }
    }

    /**
     * The puzzles the player plays today, one per truck slot, in play order.
     *
     * Each truck slot in the level data holds a pool of alternative puzzles (see
     * data/pickDayPuzzles.js). When a day starts (truck 1) the puzzles are picked by ROTATING
     * through the pools: the first time a level is played it gets each pool's first puzzle, the
     * second time the second, and so on, so replays always give fresh puzzles. How many times
     * each level has been started is counted in the registry ('levelPlayCounts'), which lasts
     * as long as the game is open and is NOT reset by starting a new game (otherwise every new
     * game would begin with the same puzzles).
     *
     * The picks are then remembered in the registry for the rest of the day: every truck is a
     * fresh PuzzleScene instance, and picking again would count another play and hand out
     * different puzzles for the same truck. If the stored picks belong to another day (e.g. a
     * debug jump straight into the middle of a level), a fresh set is picked instead.
     *
     * @returns {Array<import('../../data/loadLevel.js').RawTruck>}
     */
    getDayPuzzles ()
    {
        const stored = this.registry.get('dayPuzzles');
        if (this.truckIndex !== 0 && stored && stored.levelIndex === this.levelIndex)
        {
            return stored.puzzles;
        }

        const playCounts = this.registry.get('levelPlayCounts') ?? {};
        const playNumber = playCounts[this.levelIndex] ?? 0;
        this.registry.set('levelPlayCounts', { ...playCounts, [this.levelIndex]: playNumber + 1 });

        const puzzles = pickDayPuzzles(this.levelData, playNumber);
        this.registry.set('dayPuzzles', { levelIndex: this.levelIndex, puzzles });
        return puzzles;
    }

    /**
     * Lays the level's parcels out in a single row along the conveyor belt, centred on the
     * belt surface, left to right. Each piece's position is remembered as its "home" — where it
     * goes back to when it is dropped somewhere illegal or taken off the board (see
     * wireDragEvents / returnToTray).
     *
     * The size and spacing come from core/TrayLayout.js: parcels are drawn smaller than the
     * board's cells so they fit on the belt, with a small gap between them; if the row is still
     * too wide, neighbours overlap slightly (later ones in front, so it reads as parcels sitting
     * in front of and behind each other, never hiding a shape); only after that do they shrink.
     * Every piece in a level shares one size.
     */
    layoutTray ()
    {
        const views = this.truck.pieces.map(
            (shapeId, index) => new PieceView(this, 0, 0, shapeId, this.cellSize, `tray-${index}`)
        );
        this.pieceViews = views;

        const beltTop = this.belt.y - this.belt.displayHeight;
        const surfaceCenterY = beltTop + this.belt.displayHeight * BELT_SURFACE_CENTER;
        const surfaceHeight = this.belt.displayHeight * (BELT_SURFACE_BOTTOM - BELT_SURFACE_TOP);

        const maxScale = Math.min(1, TRAY_CELL_SIZE / this.cellSize);
        const layout = computeTrayLayout(
            views.map((view) => ({ width: view.pixelWidth, height: view.pixelHeight })),
            {
                usableWidth: this.belt.displayWidth * BELT_USABLE_WIDTH,
                maxScale,
                minScale: maxScale * TRAY_MIN_RELATIVE_SCALE,
                maxHeight: surfaceHeight * TRAY_MAX_HEIGHT_FRACTION,
                gap: TRAY_PIECE_GAP,
                maxOverlapFraction: TRAY_MAX_OVERLAP_FRACTION,
                maxOverlapPx: TRAY_MAX_OVERLAP,
            }
        );

        const rowLeft = (this.scale.width - layout.rowWidth) / 2;
        views.forEach((view, index) => {
            view.setTrayScale(layout.scale);

            const homeX = rowLeft + layout.lefts[index];
            // Centred vertically on the belt (a container's position is its top-left corner).
            const homeY = surfaceCenterY - (view.pixelHeight * layout.scale) / 2;
            view.container.setPosition(homeX, homeY);

            // Remember where this piece started, so an invalid drop has somewhere to
            // snap back to (see wireDragEvents).
            view.homeX = homeX;
            view.homeY = homeY;

            // Later parcels are drawn in front of earlier ones where they overlap.
            view.trayDepth = index + 1;
            view.container.setDepth(view.trayDepth);
        });
    }

    /**
     * Creates the top-left HUD: the money panel, with the square icon buttons beside it on the
     * same row - Reset, Pause and (from level 2) Hint. The money panel is padded to the same
     * height as the squares, so the row reads as one bar. The buttons are separate,
     * always-interactive GameObjects (not PieceViews), so they keep working even while Pause
     * has disabled dragging on every piece.
     */
    createHud ()
    {
        // Reads the all-time pay count from the registry (see the class doc) rather
        // than tracking its own copy, so it's always correct immediately on a fresh
        // PuzzleScene instance, and carries over from day to day (the `?? 0` is a
        // safety net for an unset registry key).
        const totalEarned = this.registry.get('totalEarned') ?? 0;
        this.coinText = this.add.text(16 * UI_SCALE, 16 * UI_SCALE, `$${totalEarned}`, {
            fontFamily: 'Arial Black',
            fontSize: 18 * UI_SCALE,
            color: '#3a362f',
            backgroundColor: '#f6dca0',
            padding: { x: 14 * UI_SCALE, y: 8 * UI_SCALE },
        });
        // Pad the panel vertically so it is exactly as tall as the icon squares.
        const lineHeight = this.coinText.height - 16 * UI_SCALE;
        this.coinText.setPadding({ x: 14 * UI_SCALE, y: (HUD_BUTTON_SIZE - lineHeight) / 2 });

        const makeIconButton = (textureKey, onClick) => {
            const button = this.add
                .image(0, 0, textureKey)
                .setDisplaySize(HUD_BUTTON_SIZE, HUD_BUTTON_SIZE)
                .setInteractive({ useHandCursor: true });
            // Squashes when pressed (see objects/pressFeedback.js); these act in place, so no delay.
            makePressable(this, button, onClick);
            return button;
        };

        this.resetButton = makeIconButton('reset-icon', () => this.resetLevel());
        this.pauseButton = makeIconButton('pause-icon', () => this.togglePause());

        // The Hint button only exists from the second level onwards (level index 1+), so
        // the very first day stays hint-free.
        if (this.levelIndex >= 1)
        {
            this.hintButton = makeIconButton('hint-icon', () => this.useHint());
        }

        this.layoutHud();
    }

    /**
     * Places the HUD row: the icon buttons sit to the right of the money panel, level with it.
     * Called once when the HUD is built and again whenever the money total changes, since a
     * bigger total makes the panel wider.
     */
    layoutHud ()
    {
        const gap = 8 * UI_SCALE;
        const y = this.coinText.y;

        let x = this.coinText.x + this.coinText.width + gap;
        for (const button of [this.resetButton, this.pauseButton, this.hintButton])
        {
            if (!button)
            {
                continue;
            }
            // The buttons are positioned by their centres (so the press squash is centred).
            button.setPosition(x + HUD_BUTTON_SIZE / 2, y + HUD_BUTTON_SIZE / 2);
            x += HUD_BUTTON_SIZE + gap;
        }
    }

    /**
     * Hint button handler: highlights where one piece belongs, once per truck.
     *
     * The target comes from core/Solver.findHint: a piece the player has not placed yet,
     * in a spot that fits the pieces already on the board - or, if what they have placed is
     * a dead end, a piece of the true solution, in which case the highlighted area may
     * overlap their wrong pieces. Either way nothing the player has placed is touched; the
     * highlight is only a nudge (drawn by GridView.showHint above the pieces).
     *
     * The button is faded out and disabled as soon as the hint is used, and stays that way
     * even if the player then undoes/resets the board. A no-op while paused, after the truck
     * is won, or once the hint has been used.
     */
    useHint ()
    {
        if (this.hintUsed || this.isPaused || this.hasWon)
        {
            return;
        }

        const hint = findHint(this.grid, this.truck.pieces);
        if (!hint)
        {
            // Nothing left to point at (cannot happen for shipped data, where every truck is
            // validated solvable); bail out without spending the hint rather than crash.
            return;
        }

        this.hintUsed = true;
        this.hint = hint;
        this.hintButton.disableInteractive();
        this.tweens.add({ targets: this.hintButton, alpha: 0.3, duration: 400 });

        this.refreshHint();
    }

    /**
     * Keeps the hint highlight in step with the board. The highlight is shown while the
     * hinted piece is NOT in the hinted spot, and removed once the right piece (same shape,
     * same origin) is placed there. Because it is re-evaluated after every change to the
     * board, undoing or resetting that piece brings the highlight back. A no-op until the
     * hint has been used.
     */
    refreshHint ()
    {
        if (!this.hint)
        {
            return;
        }

        const { shapeId, row, col } = this.hint;
        const isSatisfied = [...this.grid.placements.values()].some(
            (placement) => placement.shapeId === shapeId && placement.originRow === row && placement.originCol === col
        );

        // Only touch the view when the state actually changes, so the pulse animation isn't
        // restarted by every unrelated placement.
        if (isSatisfied && this.hintShowing)
        {
            this.gridView.clearHint();
            this.hintShowing = false;
        }
        else if (!isSatisfied && !this.hintShowing)
        {
            this.gridView.showHint(shapeId, row, col);
            this.hintShowing = true;
        }
    }

    /**
     * Commits a piece to the board at a legal origin: records it on the Grid, snaps its view
     * into place, and fires win handling if that completed the board. Used by the drag-drop
     * handler; refreshes the hint highlight, since the piece just placed may be the one the
     * hint was pointing at.
     *
     * @param {PieceView} pieceView - a piece that is not currently on the board.
     * @param {number} row - board row of the piece's origin (must be a legal placement).
     * @param {number} col - board column of the piece's origin.
     */
    placePiece (pieceView, row, col)
    {
        this.grid.place(pieceView.placementId, pieceView.shapeId, row, col);

        const snapped = this.gridView.originToWorld(row, col);
        pieceView.container.setPosition(snapped.x, snapped.y);

        pieceView.markPlaced(row, col);
        pieceView.container.setDepth(PLACED_DEPTH);

        this.refreshHint();

        // hasWon guards against ever launching the win overlay twice: once every open
        // cell is filled, isComplete() keeps returning true, but there are no more
        // unplaced pieces left to drag anyway - the guard is cheap insurance.
        if (!this.hasWon && this.grid.isComplete())
        {
            this.hasWon = true;
            this.handleWin();
        }
    }

    /**
     * Attaches one shared set of scene-level drag listeners covering every PieceView
     * (rather than per-piece listeners) — this is the standard Phaser pattern for
     * draggable objects: a GameObject only needs setInteractive()+input.setDraggable()
     * (done in PieceView) to start emitting these events, and the scene decides what
     * they mean.
     */
    wireDragEvents ()
    {
        this.input.on('dragstart', (pointer, gameObject) => {
            // Draw the piece being dragged above every other piece and the board, so it
            // visibly sits "in hand" rather than being occluded while moving over them.
            gameObject.setDepth(DRAG_DEPTH);

            // Grabbing a piece that is on the board takes it off the Grid straight away, so
            // its own old cells don't count as occupied when it is dropped back nearby.
            const grabbed = gameObject.getData('pieceView');
            if (grabbed && grabbed.isPlaced)
            {
                this.pickUpFromBoard(grabbed);
            }

            // Pieces resting in a shrunk tray (see layoutTray/PieceView.trayScale) are
            // drawn at true size the moment they're picked up, so what the player drags
            // and previews over the board is always the same size as the board's own
            // cells — only the tray's resting appearance is ever shrunk.
            gameObject.setScale(1);
        });

        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            const pieceView = gameObject.getData('pieceView');
            if (!pieceView || pieceView.isPlaced)
            {
                return;
            }

            gameObject.x = dragX;
            gameObject.y = dragY;

            // The container's (x, y) is this piece's bounding-box top-left in world
            // space (see PieceView's class doc) — the same convention core/Placement.js
            // uses for a shape's placement origin.
            if (this.isNearBoard(gameObject.x, gameObject.y))
            {
                const { row, col, isValid } = this.gridView.findNearestValidOrigin(pieceView.shapeId, gameObject.x, gameObject.y);
                this.gridView.showGhost(pieceView.shapeId, row, col, isValid);
            }
            else
            {
                // Dragged well away from the board entirely (e.g. still over the tray):
                // there's nothing meaningful to preview, so don't leave a stale ghost
                // showing from the last time the piece was near the board.
                this.gridView.clearGhost();
            }
        });

        this.input.on('dragend', (pointer, gameObject) => {
            const pieceView = gameObject.getData('pieceView');
            this.gridView.clearGhost();

            if (!pieceView || pieceView.isPlaced)
            {
                return;
            }

            const { row, col, isValid } = this.gridView.findNearestValidOrigin(pieceView.shapeId, gameObject.x, gameObject.y);

            // Where this piece was before it was picked up, if it came off the board.
            const cameFrom = this.pickedUpFrom;
            this.pickedUpFrom = null;

            if (isValid)
            {
                this.placePiece(pieceView, row, col);
            }
            else if (cameFrom && this.isNearBoard(gameObject.x, gameObject.y))
            {
                // A piece lifted off the board and let go over the board again, but somewhere
                // illegal (overlapping another piece, say): put it back exactly where it was,
                // so a slip of the mouse doesn't cost the player a placement. (Its old cells
                // are free - it was taken off the Grid when picked up.)
                this.placePiece(pieceView, cameFrom.row, cameFrom.col);
            }
            else
            {
                // Dropped away from the board (this is how a player takes a piece OFF the
                // board), or a tray piece dropped somewhere illegal: it goes back to its tray
                // slot. The Grid already doesn't contain it, so there is nothing to undo
                // beyond the visual position and tray size.
                this.returnToTray(pieceView);
            }
        });
    }

    /**
     * Takes a piece that is on the board off the Grid, because the player has started
     * dragging it. Remembers where it was (in this.pickedUpFrom) so the dragend handler can
     * put it back if it is dropped somewhere illegal on the board.
     *
     * @param {PieceView} pieceView - a piece that is currently placed.
     */
    pickUpFromBoard (pieceView)
    {
        this.pickedUpFrom = pieceView.boardOrigin;
        this.grid.remove(pieceView.placementId);
        pieceView.isPlaced = false;
        pieceView.boardOrigin = null;

        // The board changed: if the hinted piece was the one picked up, its highlight returns.
        this.refreshHint();
    }

    /**
     * Sends a piece back to its slot in the tray (at its tray size). Assumes the piece is no
     * longer on the Grid.
     *
     * @param {PieceView} pieceView
     */
    returnToTray (pieceView)
    {
        pieceView.unlock();
        pieceView.container.setPosition(pieceView.homeX, pieceView.homeY);
        pieceView.container.setDepth(pieceView.trayDepth);
    }

    /**
     * Whether a world position is close enough to the board to be worth showing a
     * ghost preview for — expanded by one cell size beyond the board's actual edges so
     * the ghost (and the generous findNearestValidOrigin search behind it) kicks in
     * slightly before the piece is literally over the grid, rather than only once it's
     * already deep inside a cell.
     *
     * @param {number} worldX
     * @param {number} worldY
     * @returns {boolean}
     */
    isNearBoard (worldX, worldY)
    {
        const margin = this.cellSize;
        return (
            worldX > this.gridView.x - margin &&
            worldX < this.gridView.x + this.gridView.pixelWidth + margin &&
            worldY > this.gridView.y - margin &&
            worldY < this.gridView.y + this.gridView.pixelHeight + margin
        );
    }

    /**
     * Returns the board to its starting state: every placed piece comes off the Grid and goes
     * back to its slot in the tray. A no-op while paused (the board shouldn't change under a
     * pause overlay).
     */
    resetLevel ()
    {
        if (this.isPaused)
        {
            return;
        }

        for (const pieceView of this.pieceViews)
        {
            if (pieceView.isPlaced)
            {
                this.grid.remove(pieceView.placementId);
                this.returnToTray(pieceView);
            }
        }

        this.refreshHint();
    }

    /**
     * Toggles a pause overlay on/off. Deliberately does NOT use Phaser's own
     * this.scene.pause() (see the class doc) — that would also suspend input for the
     * Resume button sitting in this same scene, making it unclickable. Instead this
     * manually disables dragging on every piece (placed pieces can be picked up too) and
     * shows/hides a simple overlay.
     */
    togglePause ()
    {
        this.isPaused = !this.isPaused;

        for (const pieceView of this.pieceViews)
        {
            if (this.isPaused)
            {
                pieceView.container.disableInteractive();
            }
            else
            {
                pieceView.makeDraggable();
            }
        }

        // There is no separate "resume" icon, so the button is dimmed while the game is paused.
        this.pauseButton.setTint(this.isPaused ? 0xb8b0a0 : 0xffffff);

        if (this.isPaused)
        {
            const centerX = this.scale.width / 2;
            const centerY = this.scale.height / 2;
            this.pauseOverlay = this.add.container(0, 0, [
                this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.45),
                this.add
                    .text(centerX, centerY, 'Paused', {
                        fontFamily: 'Arial Black',
                        fontSize: 40 * UI_SCALE,
                        color: '#ffffff',
                        stroke: '#3a362f',
                        strokeThickness: 6 * UI_SCALE,
                    })
                    .setOrigin(0.5),
            ]);
            // The overlay would otherwise visually bury the Pause button (now reading
            // "Resume") under the dim layer, even though it would still technically
            // receive clicks — bring it above the overlay so the player can actually
            // see what to click to get back in.
            this.children.bringToTop(this.pauseButton);
        }
        else if (this.pauseOverlay)
        {
            this.pauseOverlay.destroy();
            this.pauseOverlay = undefined;
        }
    }

    /**
     * Called once, the moment the board's last open cell is filled. Credits this truck's reward
     * to the day's running totals kept in the registry (see the class doc), switches input off
     * (so the completed board can't be interacted with further), closes the truck (the shutter
     * animation, see closeTruck()), then pauses this scene and routes on: straight into the next truck if another follows today (no
     * overlay), or — after the day's last truck — DayCompleteScene with the
     * day's totals (trucks completed, truck earnings, any end-of-level bonuses, total earned)
     * and its Shop/Decorate/Next Day buttons.
     *
     * End-of-level bonuses (e.g. the first-day bonus) come from the level data's `bonuses`
     * list and are paid once, here, when the day's last truck is done - added to both the day's
     * earnings and the all-time total.
     */
    handleWin ()
    {
        const reward = this.truck.reward ?? DEFAULT_REWARD;
        const trucksCompleted = (this.registry.get('dayTrucksCompleted') ?? 0) + 1;
        const dayEarned = (this.registry.get('dayEarned') ?? 0) + reward;
        this.registry.set('dayTrucksCompleted', trucksCompleted);
        this.registry.set('dayEarned', dayEarned);
        let totalEarned = (this.registry.get('totalEarned') ?? 0) + reward;
        this.registry.set('totalEarned', totalEarned);

        const trucksTotal = this.levelData.trucks.length;
        const isLastTruck = this.truckIndex === trucksTotal - 1;

        // The day's last truck also pays out the level's bonuses, once.
        const bonuses = isLastTruck ? this.levelData.bonuses ?? [] : [];
        const bonusTotal = bonuses.reduce((sum, bonus) => sum + bonus.amount, 0);
        if (bonusTotal > 0)
        {
            this.registry.set('dayEarned', dayEarned + bonusTotal);
            totalEarned += bonusTotal;
            this.registry.set('totalEarned', totalEarned);
        }

        // Keep the HUD counter (visible dimmed behind the overlay) in step with the popup.
        this.coinText.setText(`$${totalEarned}`);
        this.layoutHud();

        this.gridView.clearHint();

        // Close the truck (the shutter rolls down over the board and the parcels), and only then
        // show the overlay. Input is switched off meanwhile, or a parcel could be picked up off
        // the board while the shutter is coming down.
        this.input.enabled = false;
        this.closeTruck(() => {
            if (isLastTruck)
            {
                this.scene.pause();
                this.scene.launch('DayCompleteScene', {
                    levelIndex: this.levelIndex,
                    trucksCompleted,
                    truckEarnings: dayEarned,
                    bonuses,
                    earned: dayEarned + bonusTotal,
                    isLastLevel: this.levelIndex === this.levels.length - 1,
                });
            }
            else
            {
                // Straight on to the next truck of the day - no overlay in between.
                this.scene.start('PuzzleScene', { levelIndex: this.levelIndex, truckIndex: this.truckIndex + 1 });
            }
        });
    }

    /**
     * The "truck is closed" moment: the shutter (assets/truck-shutter.png, 720x720 art pixels, the
     * size of the largest board) slides down over the board and the parcels in it, then rests
     * briefly, then `onDone` is called.
     *
     * The shutter is bigger than or equal to any board, so instead of resizing it, it is
     * CROPPED to the board's opening: as it slides, only the part of the image that is inside the
     * opening is shown. It starts with its bottom edge at the top of the opening (nothing visible)
     * and ends with its bottom edge - the handle - at the bottom of the opening, covering it.
     *
     * @param {() => void} onDone - called once the shutter has closed and rested.
     */
    closeTruck (onDone)
    {
        const openingX = this.gridView.x;
        const openingY = this.gridView.y;
        const openingWidth = this.gridView.pixelWidth;
        const openingHeight = this.gridView.pixelHeight;

        const shutter = this.add.image(0, 0, 'truck-shutter').setOrigin(0, 0).setScale(ART_SCALE).setDepth(SHUTTER_DEPTH);
        const size = shutter.displayWidth; // the shutter is square
        const left = openingX + openingWidth / 2 - size / 2;
        this.shutter = shutter;

        /** Puts the shutter's top edge at y and shows only the part inside the opening. */
        const place = (y) => {
            shutter.setPosition(left, y);
            const visibleTop = Math.max(openingY, y);
            const visibleBottom = Math.min(openingY + openingHeight, y + size);
            if (visibleBottom <= visibleTop)
            {
                shutter.setVisible(false);
                return;
            }
            shutter.setVisible(true);
            // setCrop works in the image's own (art) pixels, measured from its top-left corner.
            shutter.setCrop(
                (openingX - left) / ART_SCALE,
                (visibleTop - y) / ART_SCALE,
                openingWidth / ART_SCALE,
                (visibleBottom - visibleTop) / ART_SCALE
            );
        };

        const startY = openingY - size; // bottom edge at the top of the opening: not visible yet
        const endY = openingY + openingHeight - size; // bottom edge at the bottom of the opening
        place(startY);

        this.tweens.addCounter({
            from: startY,
            to: endY,
            duration: SHUTTER_CLOSE_MS,
            ease: 'Cubic.easeIn', // speeds up as it falls, like a shutter being let go
            onUpdate: (tween) => place(tween.getValue()),
            onComplete: () => {
                place(endY);
                this.bobTruck();
                this.time.delayedCall(TRUCK_BOB_MS + SHUTTER_HOLD_MS, onDone);
            },
        });
    }

    /**
     * The truck's "thunk" as the shutter lands: the truck, its shutter, the board and every parcel
     * on it dip down a few pixels and come back up, as if the shutter had pushed the truck down on
     * landing. One sine half-wave driven by a counter, so everything moves in lockstep.
     */
    bobTruck ()
    {
        const movers = [this.truckFrame, this.wheelShadow, this.shutter, this.gridView.container, ...this.pieceViews.map((v) => v.container ?? v)];
        const starts = movers.map((m) => ({ x: m.x, y: m.y }));
        this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: TRUCK_BOB_MS,
            onUpdate: (tween) => {
                const t = tween.getValue();
                // One smooth dip down and back up (sine half-wave), straight down - no sideways shake.
                const dy = Math.sin(t * Math.PI) * TRUCK_BOB_PX;
                movers.forEach((m, i) => m.setPosition(starts[i].x, starts[i].y + dy));
            },
            onComplete: () => movers.forEach((m, i) => m.setPosition(starts[i].x, starts[i].y)),
        });
    }
}
