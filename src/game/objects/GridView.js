import { getShapeCells } from '../../core/Shape.js';
import { UI_SCALE } from '../uiScale.js';

/**
 * GridView.js
 *
 * A Phaser Container that renders a src/core/Grid as on-screen cells: open cells drawn
 * as a light square with a grid-line stroke, blocked cells drawn in a distinct dark
 * fill so the player can immediately see which cells they can never fill. This is
 * purely a rendering layer — it holds no puzzle-rule logic itself (see "Architectural
 * boundary" in PROJECT_STRUCTURE.md); it only reads the already-validated Grid/level
 * data it's given.
 *
 * As of Milestone 5 this also owns drag-preview "ghost" feedback (showGhost/clearGhost)
 * and the magnetic snap search (findNearestValidOrigin): PuzzleScene drives both of
 * these from its drag handlers, but the geometry/rendering for them lives here
 * alongside cellToWorld/originToWorld, since it's all the same "translate between
 * pixels and grid cells" responsibility this class already owns. A dragged piece's own
 * color never changes (see PieceView) — valid/invalid feedback is shown as a tinted
 * highlight of the cells on the BOARD itself instead, via showGhost().
 */

/** Colors are placeholder-only; Milestone 10 replaces these with real art. */
const OPEN_CELL_FILL_COLOR = 0xfbf3e4;
const OPEN_CELL_STROKE_COLOR = 0xcfc3a8;
const BLOCKED_CELL_FILL_COLOR = 0x3a362f;
const CELL_PADDING = 2 * UI_SCALE; // px gap between adjacent cell squares, purely cosmetic.

/** Ghost highlight colors shown on the board cells a dragged piece would occupy. */
const GHOST_VALID_COLOR = 0x8fd19e;
const GHOST_INVALID_COLOR = 0xe08283;
const GHOST_ALPHA = 0.6;

/** How many extra rows/cols out from the nearest cell findNearestValidOrigin() also
 *  considers when looking for a legal placement — this is what makes snapping feel
 *  forgiving rather than requiring a pixel-perfect hover. */
const SNAP_SEARCH_RADIUS = 1;

export class GridView
{
    /**
     * @param {import('phaser').Scene} scene - the Phaser scene to draw into.
     * @param {number} x - world-space x of the grid's top-left corner (board origin).
     * @param {number} y - world-space y of the grid's top-left corner (board origin).
     * @param {import('../../core/Grid.js').Grid} grid - the board model to render.
     * @param {number} cellSize - pixel size (width and height) of one grid cell.
     */
    constructor (scene, x, y, grid, cellSize)
    {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.grid = grid;
        this.cellSize = cellSize;

        /** Root container all cell rectangles are parented to, positioned at the board origin. */
        this.container = scene.add.container(x, y);

        /** @type {Phaser.GameObjects.Rectangle[]} currently-shown ghost highlight rectangles, if any — see showGhost/clearGhost. */
        this.ghostRects = [];

        this.draw();
    }

    /**
     * (Re)draws every cell of the grid. Called once from the constructor; exposed as
     * its own method so a future milestone (e.g. switching levels) can clear and
     * rebuild the view without constructing a brand-new GridView.
     */
    draw ()
    {
        this.container.removeAll(true);

        for (let row = 0; row < this.grid.rows; row++)
        {
            for (let col = 0; col < this.grid.cols; col++)
            {
                const isBlocked = this.grid.blockedCellKeys.has(`${row},${col}`);

                // Rectangles are positioned by their center in Phaser by default, so we
                // offset to the middle of each cell slot within the container's local space.
                const localX = col * this.cellSize + this.cellSize / 2;
                const localY = row * this.cellSize + this.cellSize / 2;
                const size = this.cellSize - CELL_PADDING;

                const rect = this.scene.add.rectangle(
                    localX,
                    localY,
                    size,
                    size,
                    isBlocked ? BLOCKED_CELL_FILL_COLOR : OPEN_CELL_FILL_COLOR
                );

                if (!isBlocked)
                {
                    rect.setStrokeStyle(UI_SCALE, OPEN_CELL_STROKE_COLOR);
                }

                this.container.add(rect);
            }
        }
    }

    /**
     * Converts a grid cell to the world-space pixel position of that cell's center.
     * Will be used by Milestone 5's snap logic to position a piece once it locks into
     * a cell, and by PuzzleScene for layout math (e.g. placing the piece tray below
     * the board using the grid's total pixel height).
     *
     * @param {number} row
     * @param {number} col
     * @returns {{x: number, y: number}}
     */
    cellToWorld (row, col)
    {
        return {
            x: this.x + col * this.cellSize + this.cellSize / 2,
            y: this.y + row * this.cellSize + this.cellSize / 2,
        };
    }

    /**
     * Converts a grid origin (the bounding-box top-left cell a shape would be anchored
     * at — see src/core/Placement.js) to the matching world-space pixel position. This
     * is distinct from cellToWorld(), which returns a cell's *center*: a placed piece's
     * container is positioned by its own top-left corner (the same "origin" convention
     * used throughout src/core), so snapping a dragged piece into place uses this
     * method, not cellToWorld(). Added for Milestone 5 (drag/snap).
     *
     * @param {number} row
     * @param {number} col
     * @returns {{x: number, y: number}}
     */
    originToWorld (row, col)
    {
        return {
            x: this.x + col * this.cellSize,
            y: this.y + row * this.cellSize,
        };
    }

    /**
     * Highlights the board cells a shape would occupy if dropped at (originRow,
     * originCol), tinted green if that placement is legal or red if not — this is the
     * "ghost" the player sees on the board while dragging, in place of recoloring the
     * piece itself. Replaces any previously-shown ghost. Cells that would fall outside
     * the board entirely are skipped (there's nothing on the board to highlight there);
     * a piece dragged mostly off-board will simply show a partial or empty ghost.
     *
     * @param {string} shapeId
     * @param {number} originRow
     * @param {number} originCol
     * @param {boolean} isValid
     */
    showGhost (shapeId, originRow, originCol, isValid)
    {
        this.clearGhost();

        const color = isValid ? GHOST_VALID_COLOR : GHOST_INVALID_COLOR;
        const size = this.cellSize - CELL_PADDING;

        for (const cell of getShapeCells(shapeId))
        {
            const row = originRow + cell.row;
            const col = originCol + cell.col;

            if (row < 0 || row >= this.grid.rows || col < 0 || col >= this.grid.cols)
            {
                continue;
            }

            const localX = col * this.cellSize + this.cellSize / 2;
            const localY = row * this.cellSize + this.cellSize / 2;

            const rect = this.scene.add.rectangle(localX, localY, size, size, color, GHOST_ALPHA);
            this.container.add(rect);
            this.ghostRects.push(rect);
        }
    }

    /** Removes any ghost highlight currently shown (see showGhost). Safe to call even when no ghost is showing. */
    clearGhost ()
    {
        for (const rect of this.ghostRects)
        {
            rect.destroy();
        }
        this.ghostRects = [];
    }

    /**
     * Finds the best placement origin for a shape given a raw, unsnapped world
     * position: starts from the nearest grid cell to that position, then also checks a
     * small neighborhood around it (SNAP_SEARCH_RADIUS cells out in every direction)
     * for a legal placement, preferring whichever legal candidate is closest to the raw
     * position. This is what gives dragging its "magnetic" feel — the player doesn't
     * need to hit one exact pixel-perfect spot, just land reasonably close to a valid
     * one. If nothing in range is legal, returns the raw nearest cell anyway (with
     * isValid: false) so callers still have something sensible to show as an invalid
     * ghost/preview.
     *
     * @param {string} shapeId
     * @param {number} worldX
     * @param {number} worldY
     * @returns {{row: number, col: number, isValid: boolean}}
     */
    findNearestValidOrigin (shapeId, worldX, worldY)
    {
        const rawRow = (worldY - this.y) / this.cellSize;
        const rawCol = (worldX - this.x) / this.cellSize;
        const nearestRow = Math.round(rawRow);
        const nearestCol = Math.round(rawCol);

        let best = null;
        let bestDistance = Infinity;

        for (let dRow = -SNAP_SEARCH_RADIUS; dRow <= SNAP_SEARCH_RADIUS; dRow++)
        {
            for (let dCol = -SNAP_SEARCH_RADIUS; dCol <= SNAP_SEARCH_RADIUS; dCol++)
            {
                const row = nearestRow + dRow;
                const col = nearestCol + dCol;

                if (!this.grid.canPlace(shapeId, row, col))
                {
                    continue;
                }

                const distance = Math.hypot(row - rawRow, col - rawCol);
                if (distance < bestDistance)
                {
                    bestDistance = distance;
                    best = { row, col };
                }
            }
        }

        if (best)
        {
            return { row: best.row, col: best.col, isValid: true };
        }
        return { row: nearestRow, col: nearestCol, isValid: false };
    }

    /** Total rendered pixel width of the board, e.g. for centering/layout math. */
    get pixelWidth ()
    {
        return this.grid.cols * this.cellSize;
    }

    /** Total rendered pixel height of the board, e.g. for centering/layout math. */
    get pixelHeight ()
    {
        return this.grid.rows * this.cellSize;
    }
}
