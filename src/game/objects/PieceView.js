import { Geom } from 'phaser';

import { getShapeCells, getShapeBounds } from '../../core/Shape.js';
import { UI_SCALE } from '../uiScale.js';

/**
 * PieceView.js
 *
 * A Phaser Container that renders a single polyomino piece as its true fixed-orientation
 * shape (one square per cell in src/core/Shape.js's definition for that shape id), using
 * placeholder flat colors — Milestone 10 swaps these for real art once the core loop is
 * validated. Positioned so (x, y) is the world-space top-left corner of the piece's own
 * bounding box, matching the same "origin = bounding-box corner" convention Shape.js and
 * Placement.js use, so the pixel layout here stays consistent with the grid-coordinate
 * math everywhere else in the engine.
 *
 * As of Milestone 5, every PieceView is draggable from the moment it's created (see the
 * constructor): it makes itself hit-testable and tells Phaser's input plugin it can be
 * dragged, but it does NOT decide what a drag means — PuzzleScene owns that (listening
 * for the scene-wide 'drag'/'dragend' events, checking src/core/Grid.canPlace, and
 * calling back into this class via lockInPlace()/unlock()). Keeping "can this be picked
 * up" here, and "what does a drop actually do to the puzzle" in the scene, mirrors the
 * engine/rendering split used everywhere else (see "Architectural boundary" in
 * PROJECT_STRUCTURE.md): this class still holds no puzzle-rule logic of its own.
 *
 * A piece's own color is always fixed — valid/invalid drop feedback while dragging is
 * shown as a ghost highlight on the board itself (see GridView.showGhost), not by
 * recoloring the piece, so the player always has a stable, unambiguous answer to
 * "what piece am I holding" while dragging.
 *
 * The hit area used for picking a piece up (see makeDraggable) is deliberately padded
 * a bit larger than the piece's visible bounds, so a slightly-off click still grabs it.
 */

/**
 * Placeholder per-shape colors, purely so different shapes are visually distinguishable
 * in the tray before real art exists. Not meaningful game state.
 */
const SHAPE_COLORS = {
    dot: 0xe08283,
    domino_h: 0xf0b86e,
    domino_v: 0xf0b86e,
    tri_i: 0xf5d76e,
    tri_l: 0xa4c77a,
    square: 0x7fb3d5,
    bar4: 0xf0b86e,
    l4: 0xa4c77a,
    t4: 0xb48ead,
    s4: 0x9fd6c5,
    p5: 0x7fb3d5,
    plus: 0xd98fa3,
};
const DEFAULT_COLOR = 0xbfbfbf;
const CELL_PADDING = 3 * UI_SCALE; // px gap between adjacent cell squares, purely cosmetic.

/** How far beyond the piece's visible bounds its clickable/draggable hit area extends
 *  on every side, so the player doesn't have to click pixel-perfectly on the shape.
 *  Kept comfortably under half of PuzzleScene's TRAY_PIECE_GAP so two adjacent tray
 *  pieces' padded hit areas never overlap each other. Scaled by UI_SCALE along with
 *  everything else (see uiScale.js) so this stays the same *visual* click forgiveness
 *  on screen regardless of how many real pixels back each piece. */
const HIT_AREA_PADDING = 10 * UI_SCALE;

export class PieceView
{
    /**
     * @param {import('phaser').Scene} scene - the Phaser scene to draw into.
     * @param {number} x - world-space x of this piece's bounding-box top-left corner.
     * @param {number} y - world-space y of this piece's bounding-box top-left corner.
     * @param {string} shapeId - a shape id from src/core/Shape.js (e.g. 'l4').
     * @param {number} cellSize - pixel size (width and height) of one shape cell.
     * @param {string | number} placementId - the id this piece will be placed under in
     *   src/core/Grid (see Grid.place), e.g. its tray slot index. Stored here so
     *   PuzzleScene's shared drag handlers can read it straight off the dragged
     *   Container (via getData) rather than having to look the PieceView up by searching.
     */
    constructor (scene, x, y, shapeId, cellSize, placementId)
    {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.shapeId = shapeId;
        this.cellSize = cellSize;
        this.placementId = placementId;
        this.baseColor = SHAPE_COLORS[shapeId] ?? DEFAULT_COLOR;

        /** True once this piece has been successfully placed on the board (Milestone 5). Locked pieces no longer respond to drag input. */
        this.isPlaced = false;

        /** How much smaller than true size this piece is drawn while resting in the
         *  tray (see PuzzleScene.layoutTray, which shrinks the whole tray uniformly
         *  when a level has enough pieces that it would otherwise run off the bottom
         *  of the screen) - 1 means full/true size. Restored to full size whenever the
         *  piece is picked up (see PuzzleScene's dragstart handler) so it's dragged
         *  and placed at the same size as the board's own cells, and reapplied if a
         *  drop turns out to be invalid and the piece returns to the tray. */
        this.trayScale = 1;

        /** @type {Phaser.GameObjects.Rectangle[]} the per-cell rectangles drawn in draw(), kept around in case a future milestone needs to re-skin a piece in place. */
        this.rects = [];

        this.container = scene.add.container(x, y);

        this.draw();
        this.makeDraggable();
    }

    /**
     * Draws one rectangle per cell of the shape, at the cell's relative offset scaled
     * by cellSize. Called once from the constructor; exposed as its own method in case
     * a future milestone needs to re-skin a piece in place.
     */
    draw ()
    {
        this.container.removeAll(true);
        this.rects = [];

        const size = this.cellSize - CELL_PADDING;

        for (const cell of getShapeCells(this.shapeId))
        {
            const localX = cell.col * this.cellSize + this.cellSize / 2;
            const localY = cell.row * this.cellSize + this.cellSize / 2;

            const rect = this.scene.add.rectangle(localX, localY, size, size, this.baseColor);
            rect.setStrokeStyle(UI_SCALE, 0x3a362f, 0.35);

            this.container.add(rect);
            this.rects.push(rect);
        }
    }

    /**
     * Makes this piece's container hit-testable (a Container has no intrinsic texture
     * to infer a hit area from, so one is built explicitly matching the piece's own
     * bounding box, padded outward by HIT_AREA_PADDING so a slightly-off click still
     * grabs it) and tells Phaser's input plugin it may be dragged. PuzzleScene attaches
     * the actual 'dragstart'/'drag'/'dragend' listeners at the scene level (one set of
     * listeners for every piece, rather than one per piece) and identifies which
     * PieceView a given drag event belongs to via `getData('pieceView')`, set here.
     *
     * The hitArea rectangle below is shifted by half the container's width/height, and
     * that offset is NOT optional cosmetic padding — it compensates for a real Phaser
     * behavior that's easy to miss: Container.setSize() gives the container an origin
     * that is fixed at (0.5, 0.5) (center) — `originX`/`originY` are read-only on
     * Container in this Phaser build, there is no setOrigin() to opt out — and Phaser's
     * actual input hit-testing adds that origin's pixel offset (displayOriginX/Y,
     * i.e. half the container's width/height) to the pointer's local coordinates
     * before testing them against hitArea. Meanwhile the piece's own cells (drawn in
     * draw(), above) are positioned assuming local (0, 0) is the top-left corner, with
     * no such shift — rendering and hit-testing disagree about where local (0, 0) is.
     * Left uncompensated, only cells in roughly a piece's top-left/center region were
     * ever pickable, and anything past the halfway point (e.g. the bottom row of a
     * tall piece, or the right half of a wide one) silently never registered a click —
     * this was diagnosed by sweeping click positions down a multi-row piece and
     * finding hits cut off at exactly half its pixel height. Pre-adding displayOrigin
     * to the rectangle's own coordinates cancels that shift back out, so the EFFECTIVE
     * hit zone (after Phaser's internal adjustment) ends up matching the same
     * top-left-based rectangle used everywhere else in this codebase.
     */
    makeDraggable ()
    {
        this.container.setSize(this.pixelWidth, this.pixelHeight);

        const displayOriginX = this.pixelWidth / 2;
        const displayOriginY = this.pixelHeight / 2;

        this.container.setInteractive(
            new Geom.Rectangle(
                displayOriginX - HIT_AREA_PADDING,
                displayOriginY - HIT_AREA_PADDING,
                this.pixelWidth + HIT_AREA_PADDING * 2,
                this.pixelHeight + HIT_AREA_PADDING * 2
            ),
            Geom.Rectangle.Contains
        );
        this.container.setData('pieceView', this);
        this.scene.input.setDraggable(this.container);
    }

    /**
     * Marks this piece as permanently placed: disables further pointer interaction.
     * "Permanently" lasted until Milestone 7 added unlock() below — a placed piece can
     * now be freed again via undo/reset. Always locks in at true size (scale 1) — a
     * placed piece's cells must line up exactly with the board's own cells, so any
     * tray-only shrinking (see trayScale above) is undone here regardless of what size
     * it was resting at in the tray.
     */
    lockInPlace ()
    {
        this.isPlaced = true;
        this.container.setScale(1);
        this.container.disableInteractive();
    }

    /**
     * Reverses lockInPlace(): marks this piece as unplaced again and re-enables
     * dragging. Used by PuzzleScene's undo/reset (Milestone 7) after it has already
     * freed this piece's cells back on src/core/Grid — this method only concerns
     * itself with this piece's own visual/interactive state, not the Grid. Restores
     * its tray size (rather than leaving it at the true/full size it was placed at),
     * since unlock() always puts a piece back into the tray.
     */
    unlock ()
    {
        this.isPlaced = false;
        this.container.setScale(this.trayScale);
        this.makeDraggable();
    }

    /**
     * Shrinks (or restores) how this piece is drawn while resting in the tray,
     * without changing its true pixel dimensions (pixelWidth/pixelHeight, used for hit
     * testing and drag/placement math, stay based on cellSize regardless) — only the
     * visual Container transform scales. See the trayScale field comment above for why.
     *
     * @param {number} scale - 1 for true size, less than 1 to shrink.
     */
    setTrayScale (scale)
    {
        this.trayScale = scale;
        this.container.setScale(scale);
    }

    /** Total rendered pixel width of this piece's bounding box, e.g. for tray layout. */
    get pixelWidth ()
    {
        return getShapeBounds(this.shapeId).cols * this.cellSize;
    }

    /** Total rendered pixel height of this piece's bounding box, e.g. for tray layout. */
    get pixelHeight ()
    {
        return getShapeBounds(this.shapeId).rows * this.cellSize;
    }

    /** Removes this piece's visuals from the scene. Used when a level resets/changes. */
    destroy ()
    {
        this.container.destroy();
    }
}
