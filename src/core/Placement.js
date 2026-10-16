/**
 * Placement.js
 *
 * Pure helper functions for turning a shape (relative cell offsets, see Shape.js)
 * into absolute board coordinates, and for checking whether that placement is legal
 * against a board's bounds/blocked cells/already-filled cells.
 *
 * This module has NO notion of "the board" as an object with state — it only works
 * with plain arrays/sets passed in by the caller. Grid.js is the stateful wrapper
 * that owns a board's blocked/filled cells and calls into these functions; keeping
 * the math here pure makes it trivial to unit test in isolation (Milestone 8) and to
 * reuse from the solver (src/core/Solver.js), which explores many hypothetical
 * placements per second and doesn't want the overhead of a full Grid mutation for
 * every "what if I placed this here?" check.
 *
 * Must never import 'phaser' — see "Architectural boundary" in PROJECT_STRUCTURE.md.
 */

import { getShapeCells } from './Shape.js';

/**
 * @typedef {import('./Shape.js').Cell} Cell
 */

/**
 * Builds the string key used to represent a single board cell inside Sets/Maps
 * (e.g. Grid's blocked-cell set and filled-cell map). Using one shared key format
 * (rather than nested objects or a 2D array) keeps cell lookups O(1) and keeps Grid.js
 * and Placement.js from silently drifting into two different coordinate conventions.
 *
 * @param {number} row
 * @param {number} col
 * @returns {string}
 */
export function cellKey(row, col) {
    return `${row},${col}`;
}

/**
 * Translates a shape's relative cell offsets into absolute board coordinates for a
 * given placement origin. The "origin" is the board position of the shape's own
 * {row: 0, col: 0} bounding-box corner (see Shape.js for why shapes are normalized
 * that way) — it is NOT necessarily a filled cell itself for every shape (e.g. 's4'
 * has no cell at its own {0, 0}), it's purely a bounding-box anchor.
 *
 * @param {string} shapeId
 * @param {number} originRow
 * @param {number} originCol
 * @returns {Cell[]} absolute {row, col} cells this placement would occupy on the board.
 * @throws {Error} if shapeId is not a recognized shape (via getShapeCells).
 */
export function translateShape(shapeId, originRow, originCol) {
    return getShapeCells(shapeId).map((cell) => ({
        row: cell.row + originRow,
        col: cell.col + originCol,
    }));
}

/**
 * Checks that every absolute cell in `cells` falls within a `rows` x `cols` board.
 * Negative origins (shape hanging off the top/left edge) are caught here too, since
 * row/col can go negative when translateShape is called with a negative origin.
 *
 * @param {Cell[]} cells - absolute board cells (e.g. from translateShape).
 * @param {number} rows - board height.
 * @param {number} cols - board width.
 * @returns {boolean} true if every cell is inside [0, rows) x [0, cols).
 */
export function isWithinBounds(cells, rows, cols) {
    return cells.every((cell) => cell.row >= 0 && cell.row < rows && cell.col >= 0 && cell.col < cols);
}

/**
 * Checks whether any absolute cell in `cells` lands on a blocked cell.
 *
 * @param {Cell[]} cells - absolute board cells (e.g. from translateShape).
 * @param {Set<string>} blockedCellKeys - set of cellKey(row, col) strings for blocked cells.
 * @returns {boolean} true if at least one cell is blocked.
 */
export function hasBlockedConflict(cells, blockedCellKeys) {
    return cells.some((cell) => blockedCellKeys.has(cellKey(cell.row, cell.col)));
}

/**
 * Checks whether any absolute cell in `cells` is already occupied by a previously
 * placed piece.
 *
 * @param {Cell[]} cells - absolute board cells (e.g. from translateShape).
 * @param {Set<string>} filledCellKeys - set of cellKey(row, col) strings for filled cells.
 * @returns {boolean} true if at least one cell is already filled.
 */
export function hasOverlap(cells, filledCellKeys) {
    return cells.some((cell) => filledCellKeys.has(cellKey(cell.row, cell.col)));
}

/**
 * One-shot legality check combining bounds + blocked + overlap checks, for callers
 * (like the solver) that just want a single yes/no answer for "can this shape go here?"
 * without needing the individual sub-checks.
 *
 * @param {Cell[]} cells - absolute board cells (e.g. from translateShape).
 * @param {number} rows - board height.
 * @param {number} cols - board width.
 * @param {Set<string>} blockedCellKeys - set of cellKey(row, col) strings for blocked cells.
 * @param {Set<string>} filledCellKeys - set of cellKey(row, col) strings for filled cells.
 * @returns {boolean} true if the placement is fully legal.
 */
export function isLegalPlacement(cells, rows, cols, blockedCellKeys, filledCellKeys) {
    return (
        isWithinBounds(cells, rows, cols) &&
        !hasBlockedConflict(cells, blockedCellKeys) &&
        !hasOverlap(cells, filledCellKeys)
    );
}
