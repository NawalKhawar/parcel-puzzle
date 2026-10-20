import { Scene } from 'phaser';

import { loadShapeLevels, createGridForTruck } from '../../data/loadLevel.js';
import { pickDayPuzzles } from '../../data/pickDayPuzzles.js';
import { findHint } from '../../core/Solver.js';
import { computeTrayLayout } from '../../core/TrayLayout.js';
import shapeLevelsRaw from '../../data/levels.shapes.json';
import { GridView } from '../objects/GridView.js';
import { PieceView } from '../objects/PieceView.js';
import { showNewPieceIntro } from '../objects/NewPieceIntro.js';
import { WorkerCharacter } from '../objects/WorkerCharacter.js';
import { makePressable } from '../objects/pressFeedback.js';
import { UI_SCALE } from '../uiScale.js';
import { playSfx, playBgm, GAMEPLAY_BGM_VOLUME } from '../audio.js';
import { addUiPanel } from '../objects/uiPanel.js';

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
const BELT_BOTTOM_CLIP = 40 * UI_SCALE;
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
/** The truck is centred vertically in the space between the top of the screen and the belt, so
 *  small trucks float in the middle and big ones fill it. It keeps at least this much clear space
 *  above the belt (under the wheels) and below the top of the screen; a board so tall that the
 *  truck would not fit gets smaller cells instead (see create()). */
const TRUCK_BELT_GAP = 28 * UI_SCALE;
const TRUCK_TOP_MARGIN = 16 * UI_SCALE;

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

/**
 * THE GROUND SHADOW: a single flat shape on the floor under and around the truck, so the truck
 * looks like it's grounded on the warehouse floor rather than floating in front of the
 * background - a plain shape at one opacity (not layered/blurred). It's a plain, clean TRAPEZOID
 * (four straight sides - a flat top edge, a flat bottom edge, and two straight slanted sides; no
 * extra bevelled corners), the shape a rectangle lying flat on the ground becomes once drawn in
 * perspective: assets/background.png draws its floor that way (the grout lines converge upward,
 * toward the garage door - the same treatment the apartment room's floor uses), so a shadow with
 * straight, PARALLEL sides would sit at the wrong angle for it. Narrower at the top (nearer the
 * vanishing point, by the wheels) and wider at the bottom (nearer the viewer) reads as a rectangle
 * lying flat on that same floor, the way the truck's own tail lights and wheel track do.
 */
const TRUCK_SHADOW_TOP_WIDTH_FRACTION = 0.8; // relative to the truck's full art width, at the top edge
const TRUCK_SHADOW_BOTTOM_WIDTH_FRACTION = 1.2; // relative to the truck's full art width, at the bottom edge
const TRUCK_SHADOW_DEPTH_FRACTION = 0.3; // how far it reaches forward, relative to the truck's own width
const TRUCK_SHADOW_ALPHA = 0.16;
/** Pulls the shadow's top edge up from the truck's bottom, so it reaches roughly as high as the
 *  tail lights rather than only the wheels - the truck's whole lower half then appears to sit
 *  inside the shadow. The overlapped part is simply hidden behind the truck, drawn on top. */
const TRUCK_SHADOW_Y_OVERLAP = 90 * ART_SCALE;

/**
 * THE TRUCK EXTRAS: separate images placed on the frame AFTER it has been stretched to the board
 * (assets/side-light.png 128x448, handlebar-left/right.png 29x160, license-plate.png 256x106, all
 * art pixels). They sit ON the frame's side pillars (centred in the 96 px side margins, which
 * never stretch sideways), so they need no stretching: a light and a handlebar on each side, and a licence plate on the bumper that shows the truck's number
 * (set in the game's font, Fredoka). Each *_SCALE is relative to the normal art scale, because
 * the pieces were drawn larger than they should appear on the truck.
 */
const SIDE_LIGHT_SCALE = 0.4;
const SIDE_LIGHT_CENTER = 0.8; // how far down the opening the light's centre sits (0 top, 1 bottom)
/** On a compact (few-row) truck the opening isn't tall enough for a full-size light to sit clear
 *  of the handlebar above it, so the light also shrinks with the opening - down to this fraction
 *  of its normal size at most - rather than just being pushed as close to the handlebar as the
 *  minimum gap allows. An opening this many rows tall (or taller) uses the light at full size. */
const SIDE_LIGHT_MIN_SCALE_FRACTION = 0.55;
const SIDE_LIGHT_FULL_SIZE_ROWS = 5;
const HANDLEBAR_SCALE = 1;
const HANDLEBAR_CENTER = 0.42; // how far down the opening the handlebar's centre sits
const PLATE_SCALE = 0.75;
const PLATE_FROM_BOTTOM = 115; // art px from the truck's bottom edge up to the plate's centre
const PLATE_FONT_SIZE = 17 * UI_SCALE; // game px, at the plate's own scale
const PLATE_TEXT_COLOR = '#5a4a3f';
const EXTRAS_DEPTH = -18; // in front of the frame and the wheel shadow, behind the belt

/** Draw depths (higher is in front): the background, then the truck, then the belt, then
 *  everything else at 0 and up. */
const BACKGROUND_DEPTH = -30;
const TRUCK_DEPTH = -20;
const BELT_DEPTH = -10;
const PLACED_DEPTH = 10; // parcels on the board
const CHARACTER_DEPTH = 15; // the worker character, standing just in front of everything so far
const SHUTTER_DEPTH = 60; // covers the board, over the parcels placed on it
const FLOATING_REWARD_DEPTH = 70; // the rising "+$X" text, above even the shutter
const DRAG_DEPTH = 500; // the parcel being carried
const PAUSE_DEPTH = 1000; // the pause overlay: above the whole scene (worker included), below the new-piece popup

/** The worker "thinks" (see WorkerCharacter.think) after this long with no clicks/drags (ms)... */
const THINK_IDLE_MS = 12000;
/** ...or after this long on the same truck since he last thought, even if the player is busy (ms). */
const THINK_SLOW_MS = 35000;

/** If the player goes this long without clicking or dragging, the Hint button pulses (ms). */
const HINT_PULSE_IDLE_MS = 5500;
/** How long one pulse lasts before the button settles back to its normal size (ms). */
const HINT_PULSE_MS = 3000;
/** How much bigger the Hint button gets at the top of each beat (1 = normal size). */
const HINT_PULSE_GROW = 1.12;
/** Length of one grow-or-shrink beat of the pulse (ms). */
const HINT_PULSE_BEAT_MS = 500;
/** The pulse repeats every HINT_PULSE_IDLE_MS while the player stays idle, but never more than
 *  this many times in a row - any click/drag resets the streak, letting it nudge again later. */
const HINT_PULSE_MAX_STREAK = 2;

/** How long the shutter takes to roll down, and how long the closed truck rests (after its bob)
 *  before the next truck starts or the overlay appears (ms). */
const SHUTTER_CLOSE_MS = 340;
const SHUTTER_HOLD_MS = 520;
/** The dust puff when the shutter lands: how many puffs at each wheel and at each bottom corner of
 *  the opening, how long each lives (ms), and the pale colour of the dust. */
const DUST_WHEEL_COUNT = 9;
const DUST_CORNER_COUNT = 5;
const DUST_LIFESPAN_MS = 600;
const DUST_COLOR = 0xcfc3a8;
/** The little bounce the truck gives when the shutter lands: total time, and how far it dips (px). */
const TRUCK_BOB_MS = 260;
const TRUCK_BOB_PX = 5 * UI_SCALE;

/** Size (design pixels) of the square HUD icon buttons (assets/*-icon.png are 96x96, drawn at half). */
const HUD_BUTTON_SIZE = 48 * UI_SCALE;

/** assets/money-HUD.png is 270x96 (a cash icon on its left third, blank panel on the right) -
 *  drawn at the same height as the icon squares, keeping its own aspect ratio for the width. */
const MONEY_PANEL_HEIGHT = HUD_BUTTON_SIZE;
const MONEY_PANEL_WIDTH = MONEY_PANEL_HEIGHT * (270 / 96);
/** How far from the panel's right edge the amount is right-aligned (design pixels before UI_SCALE). */
const MONEY_TEXT_RIGHT_PADDING = 16 * UI_SCALE;

/** assets/whiteboard-HUD.png is 440x240 art pixels: a calendar icon (centred ~y81) above a truck
 *  icon (centred ~y172), both on the left, with blank board to their right for the numbers.
 *  Drawn at half size (220x120), pinned to the top-right corner. */
const WHITEBOARD_SCALE = 0.5 * UI_SCALE;
const WHITEBOARD_WIDTH = 440 * WHITEBOARD_SCALE;
const WHITEBOARD_HEIGHT = 240 * WHITEBOARD_SCALE;
/** Where the numbers start, and the heights of the two rows - all in the art's own pixels. */
const WHITEBOARD_TEXT_X = 150;
const WHITEBOARD_DAY_Y = 82;
const WHITEBOARD_TRUCK_Y = 172;

/**
 * THE WORKER CHARACTER (see objects/WorkerCharacter.js): stands in the left margin, at a fixed
 * position and size regardless of the truck's own width (an earlier pass made both adapt to the
 * truck - dropped again, so the worker no longer visibly resizes/shuffles between puzzles).
 *
 * Its vertical position is NOT tied to the truck either (the truck's own height varies board to
 * board, see the "Centred in the free space" comment above) - the worker always stands at the
 * same fixed height, flush with the floor every truck's wheels rest at when there's room to (see
 * freeBottom below), so it never visibly shifts up or down between puzzles the way the truck does.
 */
const CHARACTER_X = 240 * UI_SCALE;
const CHARACTER_SCALE = 0.87; // on top of UI_SCALE - see WorkerCharacter's own scale doc

/** The "+$X" that floats up and fades when a truck is solved: how far it rises and how long each
 *  stage takes (ms) - fades in, holds at full opacity, then fades out, while rising the whole time. */
const FLOATING_REWARD_RISE = 70 * UI_SCALE;
const FLOATING_REWARD_FADE_MS = 350;
const FLOATING_REWARD_HOLD_MS = 650;

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
            // Earnings so far today, broken down by truck difficulty - e.g.
            // { easy: { count: 2, earned: 20 }, hard: { count: 1, earned: 35 } } - shown as a
            // breakdown on DayCompleteScene. Only difficulties actually played appear as keys.
            this.registry.set('dayByDifficulty', {});
        }

        this.hasWon = false;
        this.isPaused = false;
        /** True while the "New piece!" popup is up (the thinking clocks don't run then). */
        this.introShowing = false;
        /** Milliseconds since the last click/drag, and since the worker last thought (or the truck began). */
        this.idleMs = 0;
        this.slowMs = 0;
        /** Milliseconds since the last click/drag, for the repeating Hint pulse. */
        this.hintIdleMs = 0;
        /** How many pulses have fired back-to-back with no click/drag in between (caps at HINT_PULSE_MAX_STREAK). */
        this.hintPulseStreak = 0;
        /** The running Hint pulse tween, if any. */
        this.hintPulseTween = undefined;
        /** The Hint button's normal scale, captured when it is built, to pulse from and settle back to. */
        this.hintBaseScale = undefined;
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
        // Fallback fill, in case the background image is ever missing or doesn't quite cover the
        // canvas (e.g. an unusual aspect ratio under Scale.FIT) - picked to match the floor colour
        // in assets/background.png so a sliver of it showing through is not jarring.
        this.cameras.main.setBackgroundColor(0xe8d9c3);

        // The warehouse scene behind the truck (assets/background.png, 2560x1440 art pixels - full
        // screen at the same 2x-design scale as the rest of the art). Drawn first so everything
        // else sits on top of it.
        this.add.image(0, 0, 'warehouse-background').setOrigin(0, 0).setScale(ART_SCALE).setDepth(BACKGROUND_DEPTH);

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
        const roomForBoard = beltTop - TRUCK_BELT_GAP - TRUCK_TOP_MARGIN - frameHeight;
        this.cellSize = Math.min(MAX_CELL_SIZE, BOARD_MAX_HEIGHT / truck.rows, roomForBoard / truck.rows);

        const boardPixelWidth = truck.cols * this.cellSize;
        const boardPixelHeight = truck.rows * this.cellSize;

        // The truck, stretched to fit this board. Its size in art pixels is the board (converted
        // from game pixels to art pixels) plus the fixed margins; it floats clear of the belt, centred
        // above it, and the board goes where the grey opening is.
        const truckArtWidth = boardPixelWidth / ART_SCALE + TRUCK_MARGINS.left + TRUCK_MARGINS.right;
        const truckArtHeight = boardPixelHeight / ART_SCALE + TRUCK_MARGINS.top + TRUCK_MARGINS.bottom;
        // Centred in the free space between the top margin and the belt gap. The cell-size limit
        // above guarantees the truck is never taller than that space.
        const freeTop = TRUCK_TOP_MARGIN;
        const freeBottom = beltTop - TRUCK_BELT_GAP;
        const truckTop = freeTop + (freeBottom - freeTop - truckArtHeight * ART_SCALE) / 2;
        const boardX = (this.scale.width - boardPixelWidth) / 2;
        const boardY = truckTop + TRUCK_MARGINS.top * ART_SCALE;

        // The ground shadow, drawn before (so: behind) the truck itself. Centred under the truck
        // and sized off the same truckArtWidth used for the frame, so it always matches and grows
        // with it. Its top edge reaches up close to the tail lights, so the truck's lower half
        // sits inside it, then it stretches on down towards the viewer, flaring outward as it
        // goes (see THE GROUND SHADOW) to sit at the same angle as the floor beneath it.
        const truckWidthPx = truckArtWidth * ART_SCALE; // the truck's own width, used for every *_FRACTION above
        const shadowCenterX = boardX - TRUCK_MARGINS.left * ART_SCALE + truckWidthPx / 2;
        const shadowTop = truckTop + truckArtHeight * ART_SCALE - TRUCK_SHADOW_Y_OVERLAP;
        const shadowHeight = truckWidthPx * TRUCK_SHADOW_DEPTH_FRACTION;
        const shadowBottom = shadowTop + shadowHeight;
        const topHalfWidth = (truckWidthPx * TRUCK_SHADOW_TOP_WIDTH_FRACTION) / 2;
        const bottomHalfWidth = (truckWidthPx * TRUCK_SHADOW_BOTTOM_WIDTH_FRACTION) / 2;
        this.truckShadow = this.add.graphics().setDepth(BACKGROUND_DEPTH + 1);
        this.truckShadow.fillStyle(0x000000, TRUCK_SHADOW_ALPHA);
        // A plain four-point trapezoid: a flat top edge, a flat bottom edge, and two straight
        // slanted sides joining them - no extra corner cuts, so it reads as a clean rectangle
        // laid flat on a floor drawn in perspective, not an odd many-sided shape.
        this.truckShadow.fillPoints(
            [
                { x: shadowCenterX - topHalfWidth, y: shadowTop },
                { x: shadowCenterX + topHalfWidth, y: shadowTop },
                { x: shadowCenterX + bottomHalfWidth, y: shadowBottom },
                { x: shadowCenterX - bottomHalfWidth, y: shadowBottom },
            ],
            true
        );

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

        // Where the dust puffs when the truck closes: the bottom of each wheel.
        const truckBottomY = truckTop + truckArtHeight * ART_SCALE;
        this.wheelDustPoints = WHEEL_SPANS.map((wheel) => ({
            x: wheel.fromLeft !== undefined
                ? truckLeft + (wheel.fromLeft + wheel.width / 2) * ART_SCALE
                : truckRight - (wheel.fromRight + wheel.width / 2) * ART_SCALE,
            y: truckBottomY,
        }));

        this.truckExtras = this.addTruckExtras(truckLeft, truckRight, truckBottomY, boardY, boardPixelHeight);

        // The worker, at a fixed position and size (see THE WORKER CHARACTER above) - its feet
        // rest at the same fixed height every truck (not truckBottomY - that moves with each
        // truck's own vertical centring, see freeBottom above), idly bobbing in its neutral pose
        // until handleWin() switches it to a reaction pose once this truck is solved.
        this.worker = new WorkerCharacter(this, CHARACTER_X, freeBottom, {
            scale: CHARACTER_SCALE,
            depth: CHARACTER_DEPTH,
        });

        this.gridView = new GridView(this, boardX, boardY, this.grid, this.cellSize);

        // Whiteboard HUD, top right: "Day N" beside the calendar and "k/total" beside the truck
        // icon. The truck total is read from the level's own truck list, so it stays correct
        // automatically as levels are edited.
        const trucksTotal = this.levelData.trucks.length;
        const boardLeft = this.scale.width - 16 * UI_SCALE - WHITEBOARD_WIDTH;
        const boardTop = 16 * UI_SCALE;
        this.add.image(boardLeft, boardTop, 'whiteboard-HUD').setOrigin(0, 0).setScale(WHITEBOARD_SCALE);
        const whiteboardTextStyle = {
            fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
            fontSize: 26 * UI_SCALE,
            color: '#3a362f',
        };
        this.add
            .text(boardLeft + WHITEBOARD_TEXT_X * WHITEBOARD_SCALE, boardTop + WHITEBOARD_DAY_Y * WHITEBOARD_SCALE, `Day ${this.levelIndex + 1}`, whiteboardTextStyle)
            .setOrigin(0, 0.5);
        this.add
            .text(boardLeft + WHITEBOARD_TEXT_X * WHITEBOARD_SCALE, boardTop + WHITEBOARD_TRUCK_Y * WHITEBOARD_SCALE, `${this.truckIndex + 1}/${trucksTotal}`, whiteboardTextStyle)
            .setOrigin(0, 0.5);

        this.layoutTray();
        this.wireDragEvents();
        this.createHud();

        // A level that introduces new shapes announces them once, at the start of the day (its
        // first truck; later trucks are fresh scene instances and must not repeat it).
        if (this.truckIndex === 0 && this.levelData.newShapes.length > 0)
        {
            this.introShowing = true;
            showNewPieceIntro(this, this.levelData.newShapes, () => {
                this.introShowing = false;
            });
        }

        // Gameplay music. If it is already playing (this is the next truck of the same day) it
        // just carries on; it is stopped by DayCompleteScene and restarted here on the next day.
        playBgm(this, 'gameplay-bgm', GAMEPLAY_BGM_VOLUME);

        // Any press or release counts as the player being active, which restarts the idle clock
        // and - since the player is no longer idle - resets the Hint pulse streak too, so a later
        // idle spell can nudge them again.
        const noteActivity = () => { this.idleMs = 0; this.hintIdleMs = 0; this.hintPulseStreak = 0; };
        this.input.on('pointerdown', noteActivity);
        this.input.on('pointerup', noteActivity);
    }

    /**
     * Per-frame: runs the clocks that make the worker think. They only advance while the player
     * could actually be playing (not paused, not solved, not during the new-piece popup).
     *
     * @param {number} time - total game time in ms (unused).
     * @param {number} delta - milliseconds since the last frame.
     */
    update (time, delta)
    {
        if (this.isPaused || this.hasWon || this.introShowing || !this.worker)
        {
            return;
        }
        this.idleMs += delta;
        this.slowMs += delta;
        if (this.idleMs >= THINK_IDLE_MS || this.slowMs >= THINK_SLOW_MS)
        {
            this.worker.think();
            // Start both clocks over, so the next thought is a full interval away.
            this.idleMs = 0;
            this.slowMs = 0;
        }

        // The Hint button nudges the player if they've gone quiet for a while, repeating every
        // HINT_PULSE_IDLE_MS as long as they stay idle, up to HINT_PULSE_MAX_STREAK times in a row.
        if (this.hintButton && !this.hintUsed && this.hintPulseStreak < HINT_PULSE_MAX_STREAK)
        {
            this.hintIdleMs += delta;
            if (this.hintIdleMs >= HINT_PULSE_IDLE_MS)
            {
                this.hintIdleMs = 0;
                this.hintPulseStreak += 1;
                this.pulseHint();
            }
        }
    }

    /**
     * Makes the Hint button grow and shrink gently for HINT_PULSE_MS. The tween runs an even
     * number of legs (grow, shrink, grow, ...) so it finishes back at the button's normal size.
     */
    pulseHint ()
    {
        const button = this.hintButton;
        this.hintPulseTween = this.tweens.add({
            targets: button,
            scaleX: this.hintBaseScale.x * HINT_PULSE_GROW,
            scaleY: this.hintBaseScale.y * HINT_PULSE_GROW,
            duration: HINT_PULSE_BEAT_MS,
            ease: 'Sine.easeInOut',
            yoyo: true,
            // Each repeat adds a grow and a shrink, so this gives HINT_PULSE_MS / beat legs in total.
            repeat: HINT_PULSE_MS / HINT_PULSE_BEAT_MS / 2 - 1,
        });
    }

    /**
     * Cancels a running Hint pulse and snaps the button straight back to its normal size - no
     * eased return. Called when the player presses the button (so the press squash starts from
     * the normal size), when the hint is used, and when a piece is picked up mid-pulse.
     */
    stopHintPulse ()
    {
        if (this.hintPulseTween)
        {
            this.hintPulseTween.stop();
            this.hintPulseTween = undefined;
            this.hintButton.setScale(this.hintBaseScale.x, this.hintBaseScale.y);
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
     * The rotation does not always begin at the pool's first puzzle: each time the game is opened a
     * random starting offset is chosen ('poolOffset' in the registry) and added to every level's
     * play count. Without it a player who only ever plays each level once would see the first puzzle
     * of every pool, every time, and the other four would never appear. The rotation order itself
     * stays the same, so replays within a session still never repeat until the pool has been used up.
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

        // Random start within the pools, chosen once per session (see above). pickDayPuzzles wraps
        // the number around each pool, so any whole number is fine.
        let poolOffset = this.registry.get('poolOffset');
        if (poolOffset === undefined)
        {
            poolOffset = Math.floor(Math.random() * 1000);
            this.registry.set('poolOffset', poolOffset);
        }

        const puzzles = pickDayPuzzles(this.levelData, poolOffset + playNumber);
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
     * Creates the top-left HUD: a column of square icon buttons - Pause, then (from level 2)
     * Hint, then Reset - with the money panel to the right of Pause on the top row. The money
     * panel is padded to the same height as the squares, so the top row reads as one bar. The buttons are separate,
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
        // The art itself is the panel (cash icon plus a blank strip to its right); the amount is
        // a plain text object drawn on top of that blank strip, right-aligned, with no "$" -
        // the icon is what says "this is money" now.
        this.moneyPanel = this.add.image(0, 0, 'money-HUD').setOrigin(0, 0).setDisplaySize(MONEY_PANEL_WIDTH, MONEY_PANEL_HEIGHT);
        this.coinText = this.add
            .text(0, 0, `${totalEarned}`, {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: 18 * UI_SCALE,
                color: '#3a362f',
            })
            .setOrigin(1, 0.5);

        const makeIconButton = (textureKey, onClick, onPress) => {
            const button = this.add
                .image(0, 0, textureKey)
                .setDisplaySize(HUD_BUTTON_SIZE, HUD_BUTTON_SIZE)
                .setInteractive({ useHandCursor: true });
            // Registered before makePressable so the press handles the button's normal size, not a
            // mid-pulse one (see stopHintPulse).
            if (onPress)
            {
                button.on('pointerdown', onPress);
            }
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
            this.hintButton = makeIconButton('hint-icon', () => this.useHint(), () => this.stopHintPulse());
            this.hintBaseScale = { x: this.hintButton.scaleX, y: this.hintButton.scaleY };
        }

        this.layoutHud();
    }

    /**
     * Places the HUD: the icon buttons stack down the left edge (Pause, Hint if present, Reset),
     * and the money panel sits to the right of the Pause button on the top row. Called once when
     * the HUD is built and again whenever the money total changes (the panel's width changes,
     * though its left edge doesn't, so this is cheap and safe to repeat).
     */
    layoutHud ()
    {
        const gap = 8 * UI_SCALE;
        const margin = 16 * UI_SCALE;

        let y = margin;
        for (const button of [this.pauseButton, this.hintButton, this.resetButton])
        {
            if (!button)
            {
                continue;
            }
            // The buttons are positioned by their centres (so the press squash is centred).
            button.setPosition(margin + HUD_BUTTON_SIZE / 2, y + HUD_BUTTON_SIZE / 2);
            y += HUD_BUTTON_SIZE + gap;
        }

        // The money panel: level with the top button (Pause), just to its right. The amount sits
        // right-aligned near the panel's right edge, vertically centred on it.
        const panelX = margin + HUD_BUTTON_SIZE + gap;
        this.moneyPanel.setPosition(panelX, margin);
        this.coinText.setPosition(panelX + MONEY_PANEL_WIDTH - MONEY_TEXT_RIGHT_PADDING, margin + MONEY_PANEL_HEIGHT / 2);
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
        this.stopHintPulse();
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
            playSfx(this, 'pop');

            // Picking up a piece mid-pulse cuts the Hint button back to its normal size right
            // away, rather than letting it finish its current beat (stopHintPulse already does
            // this snap, not an eased return).
            this.stopHintPulse();

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
                playSfx(this, 'pop-high');
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

        if (this.isPaused)
        {
            this.createPauseMenu();
        }
        else if (this.pauseOverlay)
        {
            this.pauseOverlay.destroy();
            this.pauseOverlay = undefined;
        }
    }

    /**
     * Builds the pause menu: a dim layer over the WHOLE scene (it sits at PAUSE_DEPTH, above the
     * worker and every other object, and swallows clicks so nothing underneath can be touched)
     * with a small panel holding a Resume button and a Quit button (back to the title screen).
     */
    createPauseMenu ()
    {
        const S = UI_SCALE;
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // A small local helper keeps both buttons' styling identical.
        const makeButton = (y, label, fill, onClick, delay) => {
            const button = this.add
                .text(centerX, y, label, {
                    fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                    fontSize: 28 * S,
                    color: '#3a362f',
                    backgroundColor: fill,
                    padding: { x: 36 * S, y: 14 * S },
                })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });
            makePressable(this, button, onClick, { delay });
            return button;
        };

        const blocker = this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.55).setInteractive();
        // The panel's wood frame is ~37px thick, so the paper to lay content on is the panel
        // minus that on every side. The content (title, two buttons, even gaps) is centred
        // vertically in that paper, hence the symmetric offsets below.
        const panel = addUiPanel(this, centerX, centerY, 360 * S, 350 * S);
        const title = this.add
            .text(centerX, centerY - 86 * S, 'Paused', {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: 44 * S,
                color: '#3a362f',
            })
            .setOrigin(0.5);
        const resume = makeButton(centerY - 5 * S, 'Resume', '#a3d29c', () => this.togglePause(), 0);
        // Quit leaves the scene, so a short delay lets the press squash be seen first.
        const quit = makeButton(centerY + 81 * S, 'Quit', '#8fc1e3', () => this.scene.start('TitleScene'), 140);

        this.pauseOverlay = this.add.container(0, 0, [blocker, panel, title, resume, quit]).setDepth(PAUSE_DEPTH);
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

        // Fold this truck's reward into today's running breakdown by difficulty (see init()).
        const byDifficulty = { ...(this.registry.get('dayByDifficulty') ?? {}) };
        const difficultyKey = this.truck.difficulty;
        const soFar = byDifficulty[difficultyKey] ?? { count: 0, earned: 0 };
        byDifficulty[difficultyKey] = { count: soFar.count + 1, earned: soFar.earned + reward };
        this.registry.set('dayByDifficulty', byDifficulty);

        // The worker's reaction scales with difficulty: happy (easy), happy2 (medium), celebrate
        // (hard). The reward floats up over the board - both fire right away, not after the
        // shutter closes, so the player sees them as part of "I just solved this" rather than
        // the truck leaving.
        const reactionPose = { easy: 'happy', medium: 'happy2', hard: 'celebrate' }[difficultyKey] ?? 'happy';
        this.worker.react(reactionPose);
        this.showFloatingReward(reward);
        playSfx(this, 'cash-register'); // in step with the rising "+$N" text

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
        this.coinText.setText(`${totalEarned}`);
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
                    byDifficulty,
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
     * The "+$X" that floats up from the middle of the board and fades away, shown the instant a
     * truck is solved (see handleWin()). It rises steadily for its whole lifetime while its
     * opacity fades in, holds, then fades out again - two separate tweens on the same text object,
     * since a single tween's yoyo would also send the rise back downward, which isn't wanted here.
     * Drawn above even the shutter (FLOATING_REWARD_DEPTH), so it stays visible as the truck closes.
     *
     * @param {number} amount - the coins this truck paid, shown as "+$amount".
     */
    showFloatingReward (amount)
    {
        const x = this.gridView.x + this.gridView.pixelWidth / 2;
        const y = this.gridView.y + this.gridView.pixelHeight / 2;

        const text = this.add
            .text(x, y, `+$${amount}`, {
                fontFamily: 'Fredoka, Arial Black',
                fontStyle: '600',
                fontSize: 40 * UI_SCALE,
                color: '#3f7d4e',
                stroke: '#faf3e4',
                strokeThickness: 6 * UI_SCALE,
            })
            .setOrigin(0.5)
            .setAlpha(0)
            .setDepth(FLOATING_REWARD_DEPTH);

        const totalMs = FLOATING_REWARD_FADE_MS * 2 + FLOATING_REWARD_HOLD_MS;
        this.tweens.add({
            targets: text,
            y: y - FLOATING_REWARD_RISE,
            duration: totalMs,
            ease: 'Sine.easeOut',
        });
        this.tweens.add({
            targets: text,
            alpha: 1,
            duration: FLOATING_REWARD_FADE_MS,
            ease: 'Sine.easeOut',
            yoyo: true,
            hold: FLOATING_REWARD_HOLD_MS,
            onComplete: () => text.destroy(),
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
                this.puffDust();
                this.time.delayedCall(TRUCK_BOB_MS + SHUTTER_HOLD_MS, onDone);
            },
        });
    }

    /**
     * Adds the truck's side lights, handlebars and licence plate (see THE TRUCK EXTRAS) around the
     * already-stretched frame, and returns them so they can move with the truck.
     *
     * @param {number} left - x of the frame's left edge.
     * @param {number} right - x of the frame's right edge.
     * @param {number} bottom - y of the frame's bottom edge (under the wheels).
     * @param {number} openingY - y of the top of the board's opening.
     * @param {number} openingHeight - height of the board's opening.
     * @returns {Phaser.GameObjects.GameObject[]} everything that was added.
     */
    addTruckExtras (left, right, bottom, openingY, openingHeight)
    {
        const extras = [];
        const add = (object) => {
            object.setDepth(EXTRAS_DEPTH);
            extras.push(object);
            return object;
        };
        // The side pillars are TRUCK_MARGINS.left / .right wide; things on them are centred in them.
        const pillarLeftX = left + (TRUCK_MARGINS.left / 2) * ART_SCALE;
        const pillarRightX = right - (TRUCK_MARGINS.right / 2) * ART_SCALE;

        // The handlebar and the light below it are laid out as a PAIR, not independently, because
        // on a short (few-row) truck the opening isn't tall enough for both to sit at their
        // preferred fractions (0.42 and 0.8) without touching - see the screenshot that prompted
        // this. So: start from their preferred positions, then if they'd be closer than GAP apart,
        // push them apart (equally, around their shared midpoint) until there's a clear gap, and
        // finally slide the whole pair up/down together - keeping that gap - so neither pokes
        // outside the opening. Only on a truck too short for both even edge-to-edge (rare, smaller
        // than two cells) do they end up touching again, which is the best that fits.
        // Shrink the light with how short the opening is (in cells, not raw pixels, since a short
        // truck can still have full-size cells - see MAX_CELL_SIZE / BOARD_MAX_HEIGHT above).
        const openingRows = openingHeight / this.cellSize;
        const lightShrink = Math.max(SIDE_LIGHT_MIN_SCALE_FRACTION, Math.min(1, openingRows / SIDE_LIGHT_FULL_SIZE_ROWS));
        const lightScale = ART_SCALE * SIDE_LIGHT_SCALE * lightShrink;
        const barScale = ART_SCALE * HANDLEBAR_SCALE;
        const lightLeft = add(this.add.image(pillarLeftX, 0, 'side-light').setScale(lightScale));
        const lightRight = add(this.add.image(pillarRightX, 0, 'side-light').setScale(lightScale).setFlipX(true));
        const barLeft = add(this.add.image(pillarLeftX, 0, 'handlebar-left').setScale(barScale));
        const barRight = add(this.add.image(pillarRightX, 0, 'handlebar-right').setScale(barScale));

        const GAP = 6 * ART_SCALE; // minimum clear space kept between the handlebar and the light
        const halfBar = barLeft.displayHeight / 2;
        const halfLight = lightLeft.displayHeight / 2;
        const required = halfBar + GAP + halfLight; // minimum centre-to-centre distance

        let barY = openingY + openingHeight * HANDLEBAR_CENTER;
        let lightY = openingY + openingHeight * SIDE_LIGHT_CENTER;
        if (lightY - barY < required)
        {
            const mid = (barY + lightY) / 2;
            barY = mid - required / 2;
            lightY = mid + required / 2;
        }
        // Slide the pair together (not independently, or the gap above would be undone) to stay
        // inside the opening's top and bottom.
        if (barY - halfBar < openingY)
        {
            const shift = openingY - (barY - halfBar);
            barY += shift;
            lightY += shift;
        }
        if (lightY + halfLight > openingY + openingHeight)
        {
            const shift = lightY + halfLight - (openingY + openingHeight);
            barY -= shift;
            lightY -= shift;
        }

        barLeft.setY(barY);
        barRight.setY(barY);
        lightLeft.setY(lightY);
        lightRight.setY(lightY);

        // Licence plate on the bumper, centred, with the truck's number on it ("TRUCK 03").
        const plateX = (left + right) / 2;
        const plateY = bottom - PLATE_FROM_BOTTOM * ART_SCALE;
        add(this.add.image(plateX, plateY, 'license-plate').setScale(ART_SCALE * PLATE_SCALE));
        add(
            this.add
                .text(plateX, plateY, `TRUCK ${String(this.truckIndex + 1).padStart(2, '0')}`, {
                    fontFamily: 'Fredoka, Arial',
                    fontStyle: '600',
                    fontSize: PLATE_FONT_SIZE,
                    color: PLATE_TEXT_COLOR,
                })
                .setOrigin(0.5)
        );
        return extras;
    }

    /**
     * A little cloud of dust thrown up when the shutter lands: a burst at the base of each wheel and
     * a smaller one at each bottom corner of the opening. The puffs are soft round dots that drift
     * outwards and up, grow a little and fade. The dot texture is drawn once and kept.
     */
    puffDust ()
    {
        if (!this.textures.exists('dust'))
        {
            const dot = this.make.graphics({ x: 0, y: 0 }, false);
            dot.fillStyle(0xffffff, 1);
            dot.fillCircle(16, 16, 16);
            dot.generateTexture('dust', 32, 32);
            dot.destroy();
        }

        const burst = (x, y, count, spread) => {
            const emitter = this.add.particles(x, y, 'dust', {
                emitting: false,
                lifespan: DUST_LIFESPAN_MS,
                speed: { min: 20 * UI_SCALE, max: 70 * UI_SCALE * spread },
                angle: { min: 180, max: 360 }, // fan out sideways and up
                gravityY: -20 * UI_SCALE,
                scale: { start: 0.5 * UI_SCALE * spread, end: 1.2 * UI_SCALE * spread },
                alpha: { start: 0.7, end: 0 },
                tint: DUST_COLOR,
            });
            emitter.setDepth(EXTRAS_DEPTH + 1);
            emitter.explode(count);
            // Remove the emitter once its last puff has faded.
            this.time.delayedCall(DUST_LIFESPAN_MS + 100, () => emitter.destroy());
        };

        for (const point of this.wheelDustPoints)
        {
            burst(point.x, point.y, DUST_WHEEL_COUNT, 1);
        }
        const bottom = this.gridView.y + this.gridView.pixelHeight;
        burst(this.gridView.x, bottom, DUST_CORNER_COUNT, 0.6);
        burst(this.gridView.x + this.gridView.pixelWidth, bottom, DUST_CORNER_COUNT, 0.6);
    }

    /**
     * The truck's "thunk" as the shutter lands: the truck, its shutter, the board and every parcel
     * on it dip down a few pixels and come back up, as if the shutter had pushed the truck down on
     * landing. One sine half-wave driven by a counter, so everything moves in lockstep.
     */
    bobTruck ()
    {
        const movers = [this.truckFrame, this.wheelShadow, this.truckShadow, ...this.truckExtras, this.shutter, this.gridView.container, ...this.pieceViews.map((v) => v.container ?? v)];
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
