/**
 * Shape.js
 *
 * Pure data + accessors for the polyomino shape vocabulary. This module must NEVER
 * import 'phaser' — see "Architectural boundary" in PROJECT_STRUCTURE.md. It is used
 * by the Phaser rendering layer (src/game/), the solver (src/core/Solver.js), and the
 * test suite, all of which need the exact same shape definitions.
 *
 * A shape is stored as a list of relative {row, col} cell offsets, normalized so the
 * smallest row and smallest col in the list are both 0 (i.e. the shape's bounding box
 * starts at its own origin). Placing a shape on the board is then just adding a board
 * origin (row, col) to every one of these relative offsets — see Placement.js.
 *
 * Per docs/game_concept.pdf, pieces have a FIXED orientation: there is no in-game
 * rotation or mirroring. That means each shape id below represents exactly one
 * orientation, not a family of rotations. If the design ever changes to allow
 * rotation, that should be handled by generating additional shape ids (e.g.
 * 'l4_r90') from these base definitions rather than rewriting this module's contract.
 *
 * The exact cell layouts below were reverse-engineered from the worked examples in
 * docs/level_data.md (legacy reference data) by cross-referencing each shape id
 * against multiple solved grids, to make sure the vocabulary this game ships with
 * matches what the legacy solver/generator understood by the same names. The actual
 * level data used at runtime lives in src/data/, not docs/level_data.md.
 */

/**
 * @typedef {Object} Cell
 * @property {number} row
 * @property {number} col
 */

/**
 * Canonical shape vocabulary: shape id -> normalized relative cell list.
 * Every shape's bounding box top-left corner is {row: 0, col: 0}.
 *
 * @type {Readonly<Record<string, ReadonlyArray<Cell>>>}
 */
export const SHAPES = Object.freeze({
    // Single cell.
    dot: [{ row: 0, col: 0 }],

    // Two cells side by side (1 row x 2 cols).
    domino_h: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
    ],

    // Two cells stacked (2 rows x 1 col).
    domino_v: [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
    ],

    // Straight 3-cell tromino (the "I" tromino), laid out horizontally.
    tri_i: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
    ],

    // Corner 3-cell tromino (the "L" tromino): two cells down, one cell right at the bottom.
    tri_l: [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
    ],

    // 2x2 block (the "O" tetromino).
    square: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
    ],

    // Straight 4-cell tetromino (the "I" tetromino), laid out horizontally.
    bar4: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
    ],

    // "L" tetromino: three cells down, one extra cell right at the bottom.
    l4: [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
        { row: 2, col: 1 },
    ],

    // "T" tetromino: three cells across the top, one cell hanging below the middle.
    t4: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 1, col: 1 },
    ],

    // "S" tetromino (zig-zag): top-right pair offset one column from the bottom-left pair.
    s4: [
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
    ],

    // "P" pentomino: a 2x2 block with one extra cell hanging below the left column.
    p5: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 2, col: 0 },
    ],

    // "Plus"/"X" pentomino: a center cell with one cell extending in each of the four directions.
    plus: [
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 1, col: 2 },
        { row: 2, col: 1 },
    ],
});

/**
 * Returns a fresh copy of a shape's relative cell list, keyed by shape id.
 * A copy is returned (rather than the frozen SHAPES entry itself) so callers are
 * always free to treat the result as a plain, mutable array of {row, col} objects.
 *
 * @param {string} shapeId - one of the keys in SHAPES (e.g. 'l4', 'p5').
 * @returns {Cell[]} relative cell offsets, normalized to a {row: 0, col: 0} bounding box origin.
 * @throws {Error} if shapeId is not a recognized shape.
 */
export function getShapeCells(shapeId) {
    const cells = SHAPES[shapeId];
    if (!cells) {
        throw new Error(`Unknown shape id: "${shapeId}". Known shapes: ${listShapeIds().join(', ')}`);
    }
    // Shallow-copy each cell object too, so a caller mutating the result can't corrupt
    // the shared SHAPES definitions (which are also frozen, as a second line of defense).
    return cells.map((cell) => ({ row: cell.row, col: cell.col }));
}

/**
 * Returns the bounding box size of a shape, i.e. how many rows/cols of the grid it
 * would span if placed with its origin at {0, 0}. Useful for layout code (e.g. sizing
 * a piece's tray slot) without needing to re-derive it from the raw cell list.
 *
 * @param {string} shapeId
 * @returns {{rows: number, cols: number}}
 * @throws {Error} if shapeId is not a recognized shape.
 */
export function getShapeBounds(shapeId) {
    const cells = getShapeCells(shapeId);
    const maxRow = Math.max(...cells.map((cell) => cell.row));
    const maxCol = Math.max(...cells.map((cell) => cell.col));
    return { rows: maxRow + 1, cols: maxCol + 1 };
}

/**
 * How many cells a shape occupies (its "size", e.g. a tetromino is always 4).
 * Used by the solver to sanity-check that a level's total piece cell count equals
 * its grid's open (non-blocked) cell count before attempting to solve it.
 *
 * @param {string} shapeId
 * @returns {number}
 * @throws {Error} if shapeId is not a recognized shape.
 */
export function getShapeCellCount(shapeId) {
    return getShapeCells(shapeId).length;
}

/**
 * Lists every known shape id, in the stable order they're declared in SHAPES above.
 * Used for validation error messages and for iterating "every shape" in tooling/tests.
 *
 * @returns {string[]}
 */
export function listShapeIds() {
    return Object.keys(SHAPES);
}

/**
 * Type guard: is this a shape id this module knows how to render/place?
 * Level loading (src/data/loadLevel.js) uses this to fail loudly on a typo'd shape id
 * instead of silently producing an empty/broken piece at runtime.
 *
 * @param {string} shapeId
 * @returns {boolean}
 */
export function isKnownShape(shapeId) {
    return Object.prototype.hasOwnProperty.call(SHAPES, shapeId);
}
