import { Scene } from 'phaser';

import { loadLevels, createGridForLevel } from '../../data/loadLevel.js';
import { getShapeBounds } from '../../core/Shape.js';
import levelsRaw from '../../data/levels.json';
import { GridView } from '../objects/GridView.js';
import { PieceView } from '../objects/PieceView.js';
import { PlacementHistory } from '../objects/PlacementHistory.js';
import { UI_SCALE } from '../uiScale.js';

/**
 * PuzzleScene.js
 *
 * The core gameplay scene: loads a level (via src/data/loadLevel.js, which validates
 * it against the schema in src/data/levels.schema.md), renders its grid with a
 * GridView, and renders its unplaced pieces as a row of PieceViews below the board.
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
 * that completes the board, this scene pauses itself and launches WinScene on top
 * (handleWin()). WinScene's "Next Level" button starts a brand-new PuzzleScene
 * instance at the next levelIndex (passed via Phaser's scene data, read in init()) —
 * a full restart rather than mutating this instance in place, so the next level always
 * begins from a clean Grid with no leftover placements.
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
 * As of Milestone 9, every level in levels.json is treated as one "truck" in a single
 * "shift" (per docs/game_concept.pdf's Daily Loop/"Shift Complete!" art reference):
 * completing a level earns its `reward` in coins, added to a running shift total kept
 * in Phaser's cross-scene Data Manager (`this.registry`, under 'shiftTrucksCompleted'/
 * 'shiftTotalEarned') so it survives the "stop this scene, start a fresh one for the
 * next level" restart pattern WinScene already used. A coin HUD shows that running
 * total (see createHud()); completing the shift's last level routes to
 * ShiftCompleteScene instead of WinScene (see handleWin()), which shows the final
 * totals and starts a brand-new shift (resetting the registry counters) on its button.
 */

/** A single cell size is used for both the board and the tray so a piece doesn't change
 *  size when it snaps into place — see the Milestone 5 decision log entry in
 *  TRACKER.md for why that matters once pieces are actually draggable. Multiplied by
 *  UI_SCALE (see src/game/uiScale.js) along with every other pixel constant below, so
 *  the game renders at a sharper resolution without changing how big anything looks
 *  on screen — the canvas itself is bigger (set from the same UI_SCALE in main.js),
 *  so everything drawn onto it needs to grow by the same factor to end up the same
 *  on-screen size, just built from more real pixels. */
const CELL_SIZE = 72 * UI_SCALE;
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

/** Coins awarded for completing a level whose data doesn't set its own `reward` (see
 *  levels.schema.md) — every level actually shipped in levels.json sets one explicitly,
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
     * scene.start()/scene.launch() — WinScene's "Next Level" button passes
     * { levelIndex } here to pick up where the player left off. Defaults to the first
     * level when started with no data (e.g. the very first time, straight from Preloader).
     *
     * @param {{ levelIndex?: number }} [data]
     */
    init (data)
    {
        this.levelIndex = data && typeof data.levelIndex === 'number' ? data.levelIndex : 0;
        this.hasWon = false;
        this.isPaused = false;
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
        const level = this.levels[this.levelIndex];

        this.level = level;
        this.grid = createGridForLevel(level);

        const boardPixelWidth = level.cols * CELL_SIZE;
        const boardX = (this.scale.width - boardPixelWidth) / 2;
        const boardY = 56 * UI_SCALE;

        this.gridView = new GridView(this, boardX, boardY, this.grid, CELL_SIZE);

        // "Truck N of <shift size>" framing per docs/game_concept.pdf's art reference
        // (the truck itself is labeled "TRUCK 03" there) — levels.json's own array
        // order/length is what defines the shift, so this stays correct automatically
        // as levels are added/removed, no separate "shift size" constant to keep in sync.
        this.add
            .text(this.scale.width / 2, 24 * UI_SCALE, `Truck ${this.levelIndex + 1} of ${this.levels.length}  ·  ${level.id}  ·  ${level.difficulty ?? ''}`, {
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

        this.level.pieces.forEach((shapeId, index) => {
            const pieceView = new PieceView(this, cursorX, cursorY, shapeId, CELL_SIZE, `tray-${index}`);
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

        this.level.pieces.forEach((shapeId) => {
            const bounds = getShapeBounds(shapeId);
            const width = bounds.cols * CELL_SIZE * scale;
            const height = bounds.rows * CELL_SIZE * scale;

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
        // Reads the running shift total from the registry (see the class doc) rather
        // than tracking its own copy, so it's always correct immediately on a fresh
        // PuzzleScene instance — including the very first truck of a shift, where it
        // reads back the 0 that ShiftCompleteScene's "Back to Home" button just reset
        // it to (or Phaser's own default of `undefined` on the very first load ever,
        // handled by the `?? 0` fallback the same way handleWin() does).
        const totalEarned = this.registry.get('shiftTotalEarned') ?? 0;
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
                this.grid.place(pieceView.placementId, pieceView.shapeId, row, col);
                this.history.push(pieceView.placementId);

                const snapped = this.gridView.originToWorld(row, col);
                gameObject.setPosition(snapped.x, snapped.y);

                pieceView.lockInPlace();

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
        const margin = CELL_SIZE;
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
     * pieces that are, in any case, already all placed), credits this level's reward
     * to the running shift totals kept in the registry (see the class doc), and routes
     * to whichever overlay fits: WinScene for an ordinary level (its button starts the
     * next one), or — once the last level in levels.json is reached — straight to
     * ShiftCompleteScene with the shift's final totals, skipping WinScene entirely
     * (there's no "next truck" to offer once the shift itself is done). There's no
     * persistent "game complete" state beyond a single shift yet — starting a new one
     * is meta-loop/progression work, out of scope for now per ROADMAP.md's
     * "Future / Not Yet Scheduled" (the apartment/shop step of the Daily Loop).
     */
    handleWin ()
    {
        const reward = this.level.reward ?? DEFAULT_REWARD;
        const trucksCompleted = (this.registry.get('shiftTrucksCompleted') ?? 0) + 1;
        const totalEarned = (this.registry.get('shiftTotalEarned') ?? 0) + reward;
        this.registry.set('shiftTrucksCompleted', trucksCompleted);
        this.registry.set('shiftTotalEarned', totalEarned);

        const isLastLevel = this.levelIndex === this.levels.length - 1;

        this.scene.pause();

        if (isLastLevel)
        {
            this.scene.launch('ShiftCompleteScene', { trucksCompleted, totalEarned });
        }
        else
        {
            this.scene.launch('WinScene', {
                levelId: this.level.id,
                reward,
                totalEarned,
                nextLevelIndex: this.levelIndex + 1,
            });
        }
    }
}
