import { Scene } from 'phaser';

import { loadLevels, createGridForTruck } from '../../data/loadLevel.js';
import { getShapeBounds } from '../../core/Shape.js';
import { findHint } from '../../core/Solver.js';
import levelsRaw from '../../data/levels.json';
import { GridView } from '../objects/GridView.js';
import { PieceView } from '../objects/PieceView.js';
import { PlacementHistory } from '../objects/PlacementHistory.js';
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
 * locks the piece in place. This is deliberately where that decision-making logic
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
 * As of Milestone 7, this scene also owns Undo/Reset/Pause (see the concept art
 * reference in docs/game_concept.pdf, which shows these as the board's basic controls).
 * Undo and Reset both work by walking back through a PlacementHistory stack, freeing
 * each undone piece's cells on the Grid and calling PieceView.unlock() to restore it to
 * the tray — Reset is just "undo everything" rather than separate logic. Pause doesn't
 * use Phaser's own scene.pause() (that would also freeze the Resume button itself,
 * since it lives in this same scene) — instead it shows an overlay and disables
 * dragging on every not-yet-placed piece directly.
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
 * that isn't the day's last shows WinScene, while the day's last truck shows
 * DayCompleteScene (see handleWin()), which offers Shop / Decorate / Next Day.
 *
 * From the second level onwards a Hint button is shown (createHud()): pressing it
 * highlights, on the board, the cells where one piece belongs (useHint(), built on
 * core/Solver.findHint) and fades the button out - one hint per truck. The hint only
 * nudges: it never places, moves or removes anything. The highlight stays until the
 * right piece is actually sitting there (see refreshHint()).
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
const TRAY_PIECE_GAP = 24 * UI_SCALE;
const TRAY_TOP_MARGIN = 64 * UI_SCALE;
const TRAY_SIDE_MARGIN = 40 * UI_SCALE;
const TRAY_BOTTOM_MARGIN = 40 * UI_SCALE;

/** The smallest a level's tray pieces are ever shrunk to in order to fit on screen
 *  (see layoutTray) — below this, pieces would become too small to comfortably grab. */
const TRAY_MIN_SCALE = 0.5;

/** Shared placeholder styling for the Undo/Reset/Pause HUD buttons (Milestone 7) — Milestone 10 replaces these with real art. */
const HUD_BUTTON_STYLE = {
    fontFamily: 'Arial',
    fontSize: 16 * UI_SCALE,
    color: '#3a362f',
    backgroundColor: '#f0e4cc',
    padding: { x: 12 * UI_SCALE, y: 8 * UI_SCALE },
};

/** Coins awarded for completing a truck whose data doesn't set its own `reward` (see
 *  levels.schema.md) — every truck actually shipped in levels.json sets one explicitly,
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
     * scene.start()/scene.launch() — TitleScene's Play button, WinScene's "Next Truck"
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
        this.history = new PlacementHistory();
        /** @type {Map<string | number, PieceView>} placementId -> the PieceView placed under it, so undo can look a piece back up from the history stack. */
        this.pieceViewsById = new Map();
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0xf5ead6);

        // loadLevels throws loudly on any schema violation, so a broken levels.json
        // fails fast and visibly here rather than producing a silently-wrong board.
        this.levels = loadLevels(levelsRaw);
        this.levelData = this.levels[this.levelIndex];
        const truck = this.levelData.trucks[this.truckIndex];

        this.truck = truck;
        this.grid = createGridForTruck(truck);

        // One cell size is used for the board and the tray (see the note on
        // MAX_CELL_SIZE). Normally the maximum, but shrunk for tall boards so the board
        // never exceeds BOARD_MAX_HEIGHT (e.g. a 7-row board gets ~51px cells, not 72px).
        this.cellSize = Math.min(MAX_CELL_SIZE, BOARD_MAX_HEIGHT / truck.rows);

        const boardPixelWidth = truck.cols * this.cellSize;
        const boardX = (this.scale.width - boardPixelWidth) / 2;
        const boardY = 56 * UI_SCALE;

        this.gridView = new GridView(this, boardX, boardY, this.grid, this.cellSize);

        // "Level N · Truck k/total" header. The truck total is read from the level's own
        // truck list, so it stays correct automatically as levels are edited (no separate
        // constant to keep in sync). Difficulty is shown too, which makes the ramp visible.
        const trucksTotal = this.levelData.trucks.length;
        this.add
            .text(this.scale.width / 2, 24 * UI_SCALE, `Level ${this.levelIndex + 1}  ·  Truck ${this.truckIndex + 1}/${trucksTotal}  ·  ${truck.difficulty ?? ''}`, {
                fontFamily: 'Arial',
                fontSize: 20 * UI_SCALE,
                color: '#3a362f',
            })
            .setOrigin(0.5);

        this.layoutTray(boardY + this.gridView.pixelHeight);
        this.wireDragEvents();
        this.createHud();
    }

    /**
     * Lays out one PieceView per entry in the level's piece list, left to right,
     * wrapping to a new row if the tray would otherwise run off the right edge of the
     * screen. Each piece's final tray position is remembered as its "home" — where it
     * snaps back to on an invalid drop (see wireDragEvents' dragend handler).
     *
     * Levels with enough pieces can wrap onto several tray rows, and this game has no
     * way to scroll down to reach rows that run past the bottom of the screen — so
     * before placing anything, this first probes (via measureTrayLayout, a pure
     * simulation that doesn't create any PieceViews) whether the full tray fits in the
     * vertical space left below the board at true size, and if not, tries progressively
     * smaller uniform scales until one does (or TRAY_MIN_SCALE is reached). Every piece
     * in a level is shrunk by the same amount, so the tray stays visually consistent.
     *
     * @param {number} boardBottomY - world-space y of the bottom edge of the board, so
     *   the tray can be positioned below it with a fixed margin.
     */
    layoutTray (boardBottomY)
    {
        this.pieceViews = [];

        const trayStartX = TRAY_SIDE_MARGIN;
        const trayStartY = boardBottomY + TRAY_TOP_MARGIN;
        const maxTrayRight = this.scale.width - TRAY_SIDE_MARGIN;
        const availableHeight = this.scale.height - trayStartY - TRAY_BOTTOM_MARGIN;

        let trayScale = 1;
        while (
            trayScale > TRAY_MIN_SCALE &&
            this.measureTrayLayout(trayScale, trayStartX, maxTrayRight) > availableHeight
        )
        {
            trayScale = Math.max(TRAY_MIN_SCALE, trayScale - 0.05);
        }

        let cursorX = trayStartX;
        let cursorY = trayStartY;
        let rowHeight = 0;

        this.truck.pieces.forEach((shapeId, index) => {
            const pieceView = new PieceView(this, cursorX, cursorY, shapeId, this.cellSize, `tray-${index}`);
            pieceView.setTrayScale(trayScale);

            const width = pieceView.pixelWidth * trayScale;
            const height = pieceView.pixelHeight * trayScale;

            if (cursorX + width > maxTrayRight && cursorX > trayStartX)
            {
                // Wrap to a new row: move the piece we just created down to the new row.
                cursorX = trayStartX;
                cursorY += rowHeight + TRAY_PIECE_GAP;
                rowHeight = 0;
                pieceView.container.setPosition(cursorX, cursorY);
            }

            // Remember where this piece started, so an invalid drop has somewhere to
            // snap back to (see wireDragEvents).
            pieceView.homeX = cursorX;
            pieceView.homeY = cursorY;

            this.pieceViews.push(pieceView);
            this.pieceViewsById.set(pieceView.placementId, pieceView);

            cursorX += width + TRAY_PIECE_GAP;
            rowHeight = Math.max(rowHeight, height);
        });
    }

    /**
     * Pure simulation of layoutTray's wrapping logic at a given candidate scale,
     * using the shape vocabulary's own bounding boxes (src/core/Shape.js) rather than
     * constructing any actual PieceViews — used to probe whether a given tray scale
     * fits the available vertical space before committing to it.
     *
     * @param {number} scale - candidate tray scale to measure at (1 = true size).
     * @param {number} trayStartX
     * @param {number} maxTrayRight
     * @returns {number} total pixel height the tray would need at this scale.
     */
    measureTrayLayout (scale, trayStartX, maxTrayRight)
    {
        let cursorX = trayStartX;
        let rowHeight = 0;
        let totalHeight = 0;

        this.truck.pieces.forEach((shapeId) => {
            const bounds = getShapeBounds(shapeId);
            const width = bounds.cols * this.cellSize * scale;
            const height = bounds.rows * this.cellSize * scale;

            if (cursorX + width > maxTrayRight && cursorX > trayStartX)
            {
                cursorX = trayStartX;
                totalHeight += rowHeight + TRAY_PIECE_GAP;
                rowHeight = 0;
            }

            cursorX += width + TRAY_PIECE_GAP;
            rowHeight = Math.max(rowHeight, height);
        });

        return totalHeight + rowHeight;
    }

    /**
     * Creates the top-left HUD stack shown in the concept art's board reference
     * (docs/game_concept.pdf): a coin/paycheck display above the Undo/Reset/Pause
     * buttons, all simple placeholder text for now — real styling/iconography is
     * Milestone 10's job. The buttons are separate, always-interactive GameObjects
     * (not PieceViews), so they keep working even while Pause has disabled dragging on
     * every piece.
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

        const makeButton = (y, label, onClick) => {
            const button = this.add
                .text(16 * UI_SCALE, y, label, HUD_BUTTON_STYLE)
                .setInteractive({ useHandCursor: true });
            button.on('pointerdown', onClick);
            return button;
        };

        makeButton(56 * UI_SCALE, 'Undo', () => this.undoLast());
        makeButton(96 * UI_SCALE, 'Reset', () => this.resetLevel());
        this.pauseButton = makeButton(136 * UI_SCALE, 'Pause', () => this.togglePause());

        // The Hint button only exists from the second level onwards (level index 1+), so
        // the very first day stays hint-free.
        if (this.levelIndex >= 1)
        {
            this.hintButton = makeButton(176 * UI_SCALE, 'Hint', () => this.useHint());
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
     * Commits a piece to the board at a legal origin: records it on the Grid and in the
     * undo history, snaps and locks its view, and fires win handling if that completed
     * the board. Used by the drag-drop handler; refreshes the hint highlight, since the
     * piece just placed may be the one the hint was pointing at.
     *
     * @param {PieceView} pieceView - an unplaced piece.
     * @param {number} row - board row of the piece's origin (must be a legal placement).
     * @param {number} col - board column of the piece's origin.
     */
    placePiece (pieceView, row, col)
    {
        this.grid.place(pieceView.placementId, pieceView.shapeId, row, col);
        this.history.push(pieceView.placementId);

        const snapped = this.gridView.originToWorld(row, col);
        pieceView.container.setPosition(snapped.x, snapped.y);

        pieceView.lockInPlace();

        this.refreshHint();

        // hasWon guards against ever launching WinScene twice: once every open
        // cell is filled, isComplete() keeps returning true, but there are no
        // more unplaced pieces left to drag anyway — the guard is just cheap
        // insurance against launching the overlay a second time.
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
            // Bring the piece being dragged above every other piece/the board, so it
            // visibly sits "in hand" rather than being occluded while moving over them.
            this.children.bringToTop(gameObject);

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

            if (isValid)
            {
                this.placePiece(pieceView, row, col);
            }
            else
            {
                // Illegal drop (off the board, overlapping a blocked cell, overlapping
                // an already-placed piece, or nothing legal within the magnetic snap
                // search): return the piece to its tray slot untouched. The Grid itself
                // was never mutated in this branch, so there's no state to roll back
                // beyond the visual position. Restore its tray scale (set to 1 for
                // dragging, in the dragstart handler above) since it's going back to
                // rest in a possibly-shrunk tray.
                gameObject.setPosition(pieceView.homeX, pieceView.homeY);
                gameObject.setScale(pieceView.trayScale);
            }
        });
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
     * Undoes the single most recent placement: frees its cells on the Grid, restores
     * its PieceView to the tray (unlocked and back at its home position), and pops it
     * off the history stack. A no-op while paused (the board shouldn't change under a
     * pause overlay) or once nothing is left to undo.
     */
    undoLast ()
    {
        if (this.isPaused || this.history.isEmpty)
        {
            return;
        }

        const placementId = this.history.pop();
        this.grid.remove(placementId);

        const pieceView = this.pieceViewsById.get(placementId);
        pieceView.unlock();
        pieceView.container.setPosition(pieceView.homeX, pieceView.homeY);

        this.refreshHint();
    }

    /**
     * Returns the level to its initial, fully-unplaced state — implemented as "undo
     * everything" rather than separate logic, so Reset can never drift out of sync
     * with what a chain of individual Undos would produce.
     */
    resetLevel ()
    {
        while (!this.history.isEmpty)
        {
            this.undoLast();
        }
    }

    /**
     * Toggles a pause overlay on/off. Deliberately does NOT use Phaser's own
     * this.scene.pause() (see the class doc) — that would also suspend input for the
     * Resume button sitting in this same scene, making it unclickable. Instead this
     * manually disables dragging on every not-yet-placed piece and shows/hides a
     * simple overlay; already-placed pieces don't need to be touched since they're
     * already locked (non-draggable) regardless of pause state.
     */
    togglePause ()
    {
        this.isPaused = !this.isPaused;

        for (const pieceView of this.pieceViews)
        {
            if (pieceView.isPlaced)
            {
                continue;
            }
            if (this.isPaused)
            {
                pieceView.container.disableInteractive();
            }
            else
            {
                pieceView.makeDraggable();
            }
        }

        this.pauseButton.setText(this.isPaused ? 'Resume' : 'Pause');

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
     * Called once, the moment the board's last open cell is filled. Pauses this scene
     * (so the completed board can't be interacted with further — no more dragging
     * pieces that are, in any case, already all placed), credits this truck's reward
     * to the day's running totals kept in the registry (see the class doc), and routes
     * to whichever overlay fits: WinScene if another truck follows today (its button
     * starts that truck), or — after the day's last truck — DayCompleteScene with the
     * day's totals (trucks completed + coins earned) and its Shop/Decorate/Next Day
     * buttons.
     */
    handleWin ()
    {
        const reward = this.truck.reward ?? DEFAULT_REWARD;
        const trucksCompleted = (this.registry.get('dayTrucksCompleted') ?? 0) + 1;
        const dayEarned = (this.registry.get('dayEarned') ?? 0) + reward;
        this.registry.set('dayTrucksCompleted', trucksCompleted);
        this.registry.set('dayEarned', dayEarned);
        const totalEarned = (this.registry.get('totalEarned') ?? 0) + reward;
        this.registry.set('totalEarned', totalEarned);

        // Keep the HUD counter (visible dimmed behind the overlay) in step with the popup.
        this.coinText.setText(`$${totalEarned}`);

        this.gridView.clearHint();

        const trucksTotal = this.levelData.trucks.length;
        const isLastTruck = this.truckIndex === trucksTotal - 1;

        this.scene.pause();

        if (isLastTruck)
        {
            this.scene.launch('DayCompleteScene', {
                levelIndex: this.levelIndex,
                trucksCompleted,
                earned: dayEarned,
                totalEarned,
                isLastLevel: this.levelIndex === this.levels.length - 1,
            });
        }
        else
        {
            this.scene.launch('WinScene', {
                truckNumber: this.truckIndex + 1,
                trucksTotal,
                reward,
                totalEarned,
                levelIndex: this.levelIndex,
                nextTruckIndex: this.truckIndex + 1,
            });
        }
    }
}
