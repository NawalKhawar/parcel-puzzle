/**
 * Solver.js
 *
 * A backtracking exact-cover solver for a single truck (puzzle): given a src/core/Grid
 * (with its blocked cells set, and optionally some pieces already placed) and a multiset
 * of the piece shape ids still to place, finds how many distinct ways the pieces can
 * completely fill the grid's remaining open cells.
 *
 * Lives in src/core/ (no Phaser dependency — see "Architectural boundary" in
 * PROJECT_STRUCTURE.md) because it has two kinds of users: the Node scripts
 * (`node scripts/validate-levels.js`, scripts/generate-levels.js) and the game itself,
 * whose Hint button uses findHint() below. It can be unit/regression-tested directly
 * against known expected solution counts.
 *
 * Algorithm: classic backtracking exact-cover. At each step, find the first open
 * (unblocked, unfilled) cell in top-to-bottom, left-to-right scan order. If there is
 * none, the board is fully covered — record a solution. Otherwise, try every distinct
 * remaining shape, anchored at every one of its own cells against that scan cell (so
 * the candidate placement is guaranteed to cover the scan cell, which is what keeps
 * the search from wasting time on placements that leave the current gap unfilled).
 * For each legal placement, place it, recurse, then undo it and try the next option.
 *
 * Pieces of the same shape id are treated as interchangeable (a multiset, tracked by
 * remaining count per shape id) rather than as distinct individually-numbered pieces —
 * swapping two identical 'dot' pieces between two cells is not counted as a second
 * solution, since the player has no way to tell those pieces apart in the first place.
 */

import { getShapeCells, getShapeCellCount } from './Shape.js';

/**
 * @typedef {import('./Grid.js').Grid} Grid
 */

/**
 * @typedef {Object} SolveResult
 * @property {number} solutionCount - number of distinct solutions found (capped by
 *   options.maxSolutions; see `solutionCountIsExact`).
 * @property {Array<Object>} solutions - up to options.maxSolutions recorded solutions,
 *   each a map of placementId -> {shapeId, originRow, originCol}, useful for e.g.
 *   rendering a "here's one valid solution" hint.
 * @property {boolean} solutionCountIsExact - false if the search stopped early because
 *   it hit options.maxSolutions before exhausting the search space (so there may be
 *   more solutions than solutionCount reports).
 * @property {boolean} nodeBudgetExceeded - true if the search was aborted because it
 *   hit options.maxNodes before finishing — result is a lower bound, not reliable.
 * @property {number} nodesExplored - how many placement attempts the search made,
 *   purely informational (e.g. for the validator's difficulty-ish "score" column).
 */

/**
 * Finds the next open (not blocked, not yet filled) cell in row-major scan order, or
 * null if the grid is already fully covered.
 *
 * @param {Grid} grid
 * @returns {{row: number, col: number} | null}
 */
function findNextOpenCell(grid) {
    for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.cols; col++) {
            const key = `${row},${col}`;
            if (grid.blockedCellKeys.has(key) || grid.filledCellKeys.has(key)) {
                continue;
            }
            return { row, col };
        }
    }
    return null;
}

/**
 * Solves a level: how many distinct ways can `pieces` exactly cover `grid`'s open
 * cells? `grid` is mutated during the search (pieces are placed/removed as the
 * backtracking explores), but is restored to its original (empty) state before this
 * function returns, regardless of outcome.
 *
 * @param {Grid} grid - a fresh grid (blocked cells set, no placements yet).
 * @param {string[]} pieces - shape ids to place, e.g. ['p5', 'dot', 'dot'].
 * @param {Object} [options]
 * @param {number} [options.maxSolutions=2] - stop searching once this many solutions
 *   are found. Defaults to 2, which is enough to distinguish "exactly 1 solution"
 *   (unique — a satisfying property for a shipped puzzle) from "2 or more" without
 *   paying for an exhaustive count on levels that aren't unique.
 * @param {number} [options.maxNodes=500000] - abort the search after exploring this
 *   many placement attempts, to keep a single bad/huge level from hanging the CLI.
 * @returns {SolveResult}
 */
export function solve(grid, pieces, options = {}) {
    const maxSolutions = options.maxSolutions ?? 2;
    const maxNodes = options.maxNodes ?? 500000;

    /** @type {Map<string, number>} remaining count of each distinct shape id. */
    const remainingCounts = new Map();
    for (const shapeId of pieces) {
        remainingCounts.set(shapeId, (remainingCounts.get(shapeId) ?? 0) + 1);
    }

    const solutions = [];
    let nodesExplored = 0;
    let nodeBudgetExceeded = false;
    let placementCounter = 0;

    // If the grid already has pieces on it (e.g. the player's own placements, when
    // solving for a hint), those must stay put and must not be reported as part of the
    // solution - a solution only lists the pieces THIS search placed.
    const preExistingIds = new Set(grid.placements.keys());

    function recurse() {
        if (nodeBudgetExceeded || solutions.length >= maxSolutions) {
            return;
        }
        if (nodesExplored >= maxNodes) {
            nodeBudgetExceeded = true;
            return;
        }

        const target = findNextOpenCell(grid);
        if (!target) {
            // No open cells left: every placement so far forms a valid solution.
            const solution = {};
            for (const [placementId, placement] of grid.placements) {
                if (preExistingIds.has(placementId)) {
                    continue;
                }
                solution[placementId] = {
                    shapeId: placement.shapeId,
                    originRow: placement.originRow,
                    originCol: placement.originCol,
                };
            }
            solutions.push(solution);
            return;
        }

        for (const [shapeId, count] of remainingCounts) {
            if (count <= 0 || solutions.length >= maxSolutions || nodeBudgetExceeded) {
                continue;
            }

            for (const anchor of getShapeCells(shapeId)) {
                const originRow = target.row - anchor.row;
                const originCol = target.col - anchor.col;

                if (!grid.canPlace(shapeId, originRow, originCol)) {
                    continue;
                }

                nodesExplored++;
                if (nodesExplored >= maxNodes) {
                    nodeBudgetExceeded = true;
                    return;
                }

                const placementId = `solve-${placementCounter++}`;
                grid.place(placementId, shapeId, originRow, originCol);
                remainingCounts.set(shapeId, count - 1);

                recurse();

                grid.remove(placementId);
                remainingCounts.set(shapeId, count);

                if (solutions.length >= maxSolutions || nodeBudgetExceeded) {
                    return;
                }
            }
        }
    }

    recurse();

    return {
        solutionCount: solutions.length,
        solutions,
        solutionCountIsExact: !nodeBudgetExceeded && solutions.length < maxSolutions,
        nodeBudgetExceeded,
        nodesExplored,
    };
}

/**
 * Picks one piece to give away as a hint: solves the board from its CURRENT state (any
 * pieces already on the grid stay where they are) and returns where one of the
 * still-unplaced pieces belongs in a complete solution.
 *
 * The largest remaining piece is chosen, since placing a big piece gives the player the
 * most information (a lone 1-cell piece would barely help).
 *
 * @param {Grid} grid - the current board, with the player's placements on it.
 * @param {string[]} remainingPieces - shape ids of the pieces not yet placed.
 * @returns {{shapeId: string, row: number, col: number} | null} where to put one piece,
 *   or null if the board can't be completed from its current state (i.e. the player's
 *   existing placements are a dead end) - the caller decides how to recover, e.g. by
 *   clearing the board and asking again.
 */
export function findHint(grid, remainingPieces) {
    if (remainingPieces.length === 0) {
        return null;
    }

    const result = solve(grid, remainingPieces, { maxSolutions: 1, maxNodes: 200000 });
    if (result.solutionCount === 0) {
        return null;
    }

    // Order the solution's placements largest-first and take the first one.
    const placements = Object.values(result.solutions[0]).sort(
        (a, b) => getShapeCellCount(b.shapeId) - getShapeCellCount(a.shapeId)
    );
    const best = placements[0];
    return { shapeId: best.shapeId, row: best.originRow, col: best.originCol };
}
