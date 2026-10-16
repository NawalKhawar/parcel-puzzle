/**
 * Grid.js
 *
 * The stateful board model for a single puzzle level: its dimensions, which cells are
 * permanently blocked (unusable), and which cells are currently covered by placed
 * pieces. This is the main object the Phaser scene (src/game/), the solver
 * (src/core/Solver.js), and tests (tests/core/) all interact with to ask "can this piece
 * go here?", to actually place/remove pieces, and to check for a win.
 *
 * Must never import 'phaser' — see "Architectural boundary" in PROJECT_STRUCTURE.md.
 * All the actual geometry/legality math lives in Placement.js; this class is
 * intentionally just bookkeeping (which cells are blocked/filled, which placement
 * owns which cells) on top of that pure math.
 */

import { translateShape, isLegalPlacement, cellKey } from './Placement.js';

/**
 * @typedef {import('./Shape.js').Cell} Cell
 */

/**
 * @typedef {Object} Placement
 * @property {string} shapeId
 * @property {number} originRow
 * @property {number} originCol
 * @property {Cell[]} cells - absolute board cells this placement occupies.
 */

export class Grid {
    /**
     * @param {number} rows - board height (number of grid rows).
     * @param {number} cols - board width (number of grid columns).
     * @param {Array<[number, number] | Cell>} [blockedCells] - cells that can never be
     *   filled by any piece (e.g. the single blocked cell per level in the legacy
     *   reference data). Accepts either [row, col] tuples or {row, col} objects so
     *   callers can use whichever is more convenient (level JSON tends to use tuples).
     */
    constructor(rows, cols, blockedCells = []) {
        if (!Number.isInteger(rows) || rows <= 0 || !Number.isInteger(cols) || cols <= 0) {
            throw new Error(`Grid requires positive integer rows/cols, got rows=${rows}, cols=${cols}`);
        }

        this.rows = rows;
        this.cols = cols;

        /** @type {Set<string>} */
        this.blockedCellKeys = new Set(
            blockedCells.map((cell) => {
                const [row, col] = Array.isArray(cell) ? cell : [cell.row, cell.col];
                return cellKey(row, col);
            })
        );

        /** @type {Set<string>} cells currently covered by a placed piece. */
        this.filledCellKeys = new Set();

        /**
         * Active placements, keyed by a caller-supplied placement id (e.g. a piece's
         * tray instance id). A Map (rather than an array) is used so remove() can find
         * and free a specific placement's cells in O(1) without scanning every
         * placement on the board.
         * @type {Map<string | number, Placement>}
         */
        this.placements = new Map();
    }

    /**
     * Checks whether a shape could legally be placed with its bounding-box origin at
     * (originRow, originCol): fully on the board, not overlapping a blocked cell, and
     * not overlapping an already-filled cell. Does not mutate the grid — safe to call
     * speculatively (the solver calls this many times per level while backtracking).
     *
     * @param {string} shapeId
     * @param {number} originRow
     * @param {number} originCol
     * @returns {boolean}
     */
    canPlace(shapeId, originRow, originCol) {
        const cells = translateShape(shapeId, originRow, originCol);
        return isLegalPlacement(cells, this.rows, this.cols, this.blockedCellKeys, this.filledCellKeys);
    }

    /**
     * Places a shape on the board under the given placement id, if and only if the
     * placement is legal (re-checked internally via canPlace, so callers never need to
     * call canPlace first — though UI code typically will anyway, to drive snap-preview
     * feedback before the player commits to a drop).
     *
     * @param {string | number} placementId - a caller-chosen unique id for this placed
     *   piece (e.g. the piece's tray instance id), used later to remove() it again.
     * @param {string} shapeId
     * @param {number} originRow
     * @param {number} originCol
     * @returns {boolean} true if the piece was placed; false if the placement was
     *   illegal (grid is left unchanged) or if placementId is already in use.
     */
    place(placementId, shapeId, originRow, originCol) {
        if (this.placements.has(placementId)) {
            return false;
        }
        if (!this.canPlace(shapeId, originRow, originCol)) {
            return false;
        }

        const cells = translateShape(shapeId, originRow, originCol);
        for (const cell of cells) {
            this.filledCellKeys.add(cellKey(cell.row, cell.col));
        }
        this.placements.set(placementId, { shapeId, originRow, originCol, cells });
        return true;
    }

    /**
     * Removes a previously placed piece, freeing its cells so other pieces can be
     * placed there again. Used by undo (Milestone 7) and by the solver when
     * backtracking out of a dead-end branch.
     *
     * @param {string | number} placementId
     * @returns {boolean} true if a placement with that id existed and was removed.
     */
    remove(placementId) {
        const placement = this.placements.get(placementId);
        if (!placement) {
            return false;
        }
        for (const cell of placement.cells) {
            this.filledCellKeys.delete(cellKey(cell.row, cell.col));
        }
        this.placements.delete(placementId);
        return true;
    }

    /**
     * Looks up the details of a currently active placement by id, e.g. so the scene
     * can animate a specific piece back out when undoing.
     *
     * @param {string | number} placementId
     * @returns {Placement | undefined}
     */
    getPlacement(placementId) {
        return this.placements.get(placementId);
    }

    /**
     * The puzzle is solved once every non-blocked cell on the board is covered by a
     * placed piece. Blocked cells are intentionally never fillable, so they're
     * excluded from this check (see docs/level_data.md's '#' notation for the same
     * concept in the legacy reference format).
     *
     * @returns {boolean}
     */
    isComplete() {
        const totalCells = this.rows * this.cols;
        const openCells = totalCells - this.blockedCellKeys.size;
        return this.filledCellKeys.size === openCells;
    }

    /**
     * How many non-blocked cells remain unfilled. Useful for the solver's pruning
     * (e.g. bailing out early once remaining open cells can't possibly be tiled by the
     * remaining pieces' total cell count) and for a progress indicator in the UI.
     *
     * @returns {number}
     */
    getRemainingOpenCellCount() {
        const totalCells = this.rows * this.cols;
        const openCells = totalCells - this.blockedCellKeys.size;
        return openCells - this.filledCellKeys.size;
    }

    /**
     * Renders the board as a plain-text grid for debugging/manual verification:
     * '#' for a blocked cell, '.' for an empty open cell, or the placement id's first
     * character for a filled cell. This mirrors the legend-diagram style used in
     * docs/level_data.md, which makes it easy to eyeball whether a Grid matches the
     * level it was meant to represent (used for the Milestone 1 manual verification
     * step, and handy while debugging the solver).
     *
     * @returns {string}
     */
    toDebugString() {
        // Build a reverse lookup from a filled cell's key to the placement id that
        // owns it, so we can label each filled cell in the rendered grid below.
        /** @type {Map<string, string | number>} */
        const cellOwner = new Map();
        for (const [placementId, placement] of this.placements) {
            for (const cell of placement.cells) {
                cellOwner.set(cellKey(cell.row, cell.col), placementId);
            }
        }

        const lines = [];
        for (let row = 0; row < this.rows; row++) {
            const rowChars = [];
            for (let col = 0; col < this.cols; col++) {
                const key = cellKey(row, col);
                if (this.blockedCellKeys.has(key)) {
                    rowChars.push('#');
                } else if (cellOwner.has(key)) {
                    rowChars.push(String(cellOwner.get(key)).charAt(0));
                } else {
                    rowChars.push('.');
                }
            }
            lines.push(rowChars.join(' '));
        }
        return lines.join('\n');
    }
}
