import { Geom } from 'phaser';

import { getShapeCells, getShapeBounds } from '../../core/Shape.js';
import { UI_SCALE } from '../uiScale.js';

/**
 * PieceView.js
 *
 * A Phaser Container that renders a single polyomino piece as its true fixed-orientation
 * shape, using the piece's art image (assets/pieces/<shape id>.png, loaded by the Preloader under the
 * shape id as its texture key). Each image is drawn at 144 px per cell - twice the 72 px
 * game cell, for sharpness - and is scaled to the piece's bounding box. Positioned so (x, y) is the world-space top-left corner of the piece's own
 * bounding box, matching the same "origin = bounding-box corner" convention Shape.js and
 * Placement.js use, so the pixel layout here stays consistent with the grid-coordinate
 * math everywhere else in the engine.
 *
 * As of Milestone 5, every PieceView is draggable from the moment it's created (see the
 * constructor): it makes itself hit-testable and tells Phaser's input plugin it can be
 * dragged, but it does NOT decide what a drag means — PuzzleScene owns that (listening
 * for the scene-wide 'drag'/'dragend' events, checking src/core/Grid.canPlace, and
 * calling back into this class via markPlaced()/unlock()). Keeping "can this be picked
 * up" here, and "what does a drop actually do to the puzzle" in the scene, mirrors the
 * engine/rendering split used everywhere else (see "Architectural boundary" in
 * PROJECT_STRUCTURE.md): this class still holds no puzzle-rule logic of its own.
 *
 * A piece's own art is always fixed — valid/invalid drop feedback while dragging is
 * shown as a ghost highlight on the board itself (see GridView.showGhost), not by
 * recoloring the piece, so the player always has a stable, unambiguous answer to
 * "what piece am I holding" while dragging.
 *
 * The hit area used for picking a piece up (see makeDraggable) is deliberately padded
 * a bit larger than the piece's visible bounds, so a slightly-off click still grabs it.
 */

/** How far beyond each of a piece's cells its clickable/draggable hit area extends while the
 *  piece is in the tray, so the player doesn't have to click pixel-perfectly on the shape. (On
 *  the board there is no padding: pieces sit edge to edge.) Scaled by UI_SCALE along with
 *  everything else (see uiScale.js) so this stays the same *visual* click forgiveness on
 *  screen regardless of how many real pixels back each piece. */
const HIT_AREA_PADDING = 6 * UI_SCALE;

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

        /** True while this piece sits on the board. A placed piece can still be picked up again (dragged to a new spot, or off the board back to the tray). */
        this.isPlaced = false;

        /** While placed: the board cell ({ row, col }) this piece's origin is on; null while it is in the tray or being carried. Lets PuzzleScene put it back if it is dropped somewhere illegal. */
        this.boardOrigin = null;

        /** How much smaller than true size this piece is drawn while resting in the
         *  tray (see PuzzleScene.layoutTray, which shrinks the whole tray uniformly
         *  when a level has enough pieces that it would otherwise run off the bottom
         *  of the screen) - 1 means full/true size. Restored to full size whenever the
         *  piece is picked up (see PuzzleScene's dragstart handler) so it's dragged
         *  and placed at the same size as the board's own cells, and reapplied if a
         *  drop turns out to be invalid and the piece returns to the tray. */
        this.trayScale = 1;

        this.container = scene.add.container(x, y);

        this.draw();
        this.makeDraggable();
    }

    /**
     * Draws the piece: its art image, stretched to the piece's bounding box (the image is
     * drawn at twice the on-screen size, so it is scaled down by the same factor in both
     * directions and keeps its proportions). Called once from the constructor.
     */
    draw ()
    {
        this.container.removeAll(true);

        const image = this.scene.add.image(0, 0, this.shapeId).setOrigin(0, 0);
        image.setDisplaySize(this.pixelWidth, this.pixelHeight);
        this.container.add(image);
    }

    /**
     * Makes this piece's container hit-testable (a Container has no intrinsic texture
     * to infer a hit area from, so one is built explicitly matching the piece's own
     * cells, padded outward by HIT_AREA_PADDING in the tray so a slightly-off click still
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
        const cells = getShapeCells(this.shapeId);
        const cellSize = this.cellSize;

        // The hit area is set up once (Phaser only keeps the first one it is given, and swapping
        // it in the middle of a drag would be fragile). Its test is the piece's own cells: an
        // L-shaped piece's empty corner does not respond, so a neighbour sitting there can be
        // grabbed instead. In the tray each cell is grown outward by HIT_AREA_PADDING so a
        // slightly-off click still grabs it; on the board there is no padding, because pieces
        // sit edge to edge. isPlaced is looked at EVERY time the test runs, so moving a piece
        // between the tray and the board needs no new hit area. Parcels on the belt may overlap
        // slightly; where they do, the one drawn in front gets the click.
        // The rectangle is only the shape Phaser insists on; the callback does the real test. x
        // and y arrive already shifted by the display origin (see the long note above), so the
        // test takes that shift off again before comparing against the cells.
        this.container.setInteractive(
            new Geom.Rectangle(0, 0, this.pixelWidth + displayOriginX * 2, this.pixelHeight + displayOriginY * 2),
            (area, x, y) => {
                const pad = this.isPlaced ? 0 : HIT_AREA_PADDING;
                const localX = x - displayOriginX;
                const localY = y - displayOriginY;
                return cells.some(
                    (cell) =>
                        localX >= cell.col * cellSize - pad &&
                        localX < (cell.col + 1) * cellSize + pad &&
                        localY >= cell.row * cellSize - pad &&
                        localY < (cell.row + 1) * cellSize + pad
                );
            }
        );
        this.container.setData('pieceView', this);
        this.scene.input.setDraggable(this.container);
    }

    /**
     * Marks this piece as sitting on the board at (row, col). It stays draggable, so the
     * player can pick it up again and move it or take it off the board. Always shown at true
     * size (scale 1) - a placed piece's cells must line up exactly with the board's own
     * cells, so any tray-only shrinking (see trayScale above) is undone here.
     *
     * @param {number} row - board row of this piece's origin.
     * @param {number} col - board column of this piece's origin.
     */
    markPlaced (row, col)
    {
        this.isPlaced = true;
        this.boardOrigin = { row, col };
        this.container.setScale(1);
    }

    /**
     * Puts this piece back to "in the tray": not placed, shown at its tray size, with the
     * forgiving tray hit area. PuzzleScene calls this after it has already freed the piece's
     * cells on src/core/Grid - this method only concerns this piece's own visual/interactive
     * state, not the Grid.
     */
    unlock ()
    {
        this.isPlaced = false;
        this.boardOrigin = null;
        this.container.setScale(this.trayScale);
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
