/**
 * solver.test.js
 *
 * Regression tests for src/core/Solver.js: asserts that every truck (puzzle) of every
 * level in src/data/levels.json is still solvable - if a future change to Shape.js,
 * Placement.js, Grid.js, or levels.json breaks a puzzle, this is the test that should
 * catch it.
 *
 * Also includes a couple of hand-built micro-levels with known, easy-to-reason-about
 * solution counts, so a regression in the solver itself (not just a levels.json change)
 * has a minimal, deterministic test to fail against.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { Grid } from '../../src/core/Grid.js';
import { solve, findHint } from '../../src/core/Solver.js';
import { loadLevels, createGridForTruck } from '../../src/data/loadLevel.js';
import levelsRaw from '../../src/data/levels.json' with { type: 'json' };

describe('solver.js — hand-built micro-levels', () => {
    test('a single cell with a single dot piece has exactly one solution', () => {
        const grid = new Grid(1, 1);
        const result = solve(grid, ['dot']);
        assert.equal(result.solutionCount, 1);
        assert.equal(result.solutionCountIsExact, true);
    });

    test('a 1x4 strip with two dominoes has exactly one solution (both placements forced)', () => {
        const grid = new Grid(1, 4);
        const result = solve(grid, ['domino_h', 'domino_h']);
        assert.equal(result.solutionCount, 1);
    });

    test('a 2x2 board with four dots has exactly one solution (dots are interchangeable, not counted as distinct arrangements)', () => {
        const grid = new Grid(2, 2);
        const result = solve(grid, ['dot', 'dot', 'dot', 'dot']);
        assert.equal(result.solutionCount, 1);
    });

    test('a board with no piece that can possibly fit has zero solutions', () => {
        const grid = new Grid(1, 1);
        const result = solve(grid, ['domino_h']); // too big for a 1x1 board.
        assert.equal(result.solutionCount, 0);
        assert.equal(result.solutionCountIsExact, true);
    });

    test('grid is restored to its original empty state after solving, regardless of outcome', () => {
        const grid = new Grid(2, 2);
        solve(grid, ['dot', 'dot', 'dot', 'dot']);
        assert.equal(grid.filledCellKeys.size, 0, 'solve() must undo every placement it tried');
        assert.equal(grid.placements.size, 0);
    });

    test('maxSolutions caps the search: a 2x4 board with eight dots has many solutions, but only maxSolutions are reported', () => {
        const grid = new Grid(2, 4); // 8 open cells, 8 interchangeable dots -> trivially many fill orders at the node level, but there's really only 1 *distinct* covering since all pieces are identical dots.
        const result = solve(grid, ['dot', 'dot', 'dot', 'dot', 'dot', 'dot', 'dot', 'dot'], { maxSolutions: 1 });
        assert.equal(result.solutionCount, 1);
        assert.equal(result.solutionCountIsExact, false, 'search should have stopped at the cap, not exhausted the space');
    });
});

describe('solver.js — shipped levels.json regression', () => {
    const levels = loadLevels(levelsRaw);

    // Every truck (puzzle) in every level must be solvable. The generator guarantees this
    // by construction, but this is the safety net if levels.json is ever hand-edited or
    // the engine's placement rules change. (Uniqueness is deliberately NOT pinned per
    // truck any more: with 142 generated puzzles, that table would be noise - the
    // difficulty ramp is covered in tests/data/levels.test.js instead.)
    for (const level of levels) {
        for (const truck of level.trucks) {
            test(`${truck.id} is solvable`, () => {
                const grid = createGridForTruck(truck);
                const result = solve(grid, truck.pieces, { maxSolutions: 1 });
                assert.ok(result.solutionCount >= 1, `${truck.id} must have at least one solution`);
            });
        }
    }
});

describe('findHint - Hint button support (highlight only, never changes the board)', () => {
    test('from an empty board, points at a legal spot for the largest piece', () => {
        const grid = new Grid(2, 3);
        const hint = findHint(grid, ['domino_h', 'tri_i', 'dot']); // 2+3+1 = the 6 open cells
        assert.ok(hint, 'a solvable board must yield a hint');
        assert.equal(hint.shapeId, 'tri_i', 'the largest piece is the one hinted');
        assert.ok(grid.canPlace(hint.shapeId, hint.row, hint.col), 'the hinted area is free on an empty board');
        assert.equal(grid.placements.size, 0, 'findHint must leave the grid untouched');
    });

    test('works from the current board: points only at pieces that are not placed yet, in free cells', () => {
        const grid = new Grid(2, 3);
        grid.place('player-1', 'tri_i', 0, 0); // top row filled and correct; only the bottom row is left.
        const hint = findHint(grid, ['tri_i', 'domino_h', 'dot']);
        assert.ok(hint);
        assert.equal(hint.shapeId, 'domino_h');
        assert.equal(hint.row, 1, 'must point into the still-empty bottom row');
        assert.ok(grid.canPlace(hint.shapeId, hint.row, hint.col), 'and those cells are free');
        assert.equal(grid.placements.size, 1, "the player's piece is still the only thing on the grid");
    });

    test("on a dead end it still gives a hint, pointing at cells the player's wrong piece occupies", () => {
        const grid = new Grid(1, 4);
        grid.place('player-1', 'domino_h', 0, 1); // covers cols 1-2, stranding cols 0 and 3: unsolvable.
        const hint = findHint(grid, ['domino_h', 'domino_h']);
        assert.ok(hint, 'a dead end must not leave the player without a hint');
        assert.equal(hint.shapeId, 'domino_h');
        assert.ok(hint.col === 0 || hint.col === 2, 'the true solution is dominoes at columns 0 and 2');
        assert.equal(grid.canPlace(hint.shapeId, hint.row, hint.col), false, "the hinted area overlaps the player's wrong piece");
        assert.equal(grid.placements.size, 1, "nothing of the player's was cleared");
    });

    test('on a dead end, skips a solution piece the player already has in exactly the right place', () => {
        const grid = new Grid(1, 5);
        grid.place('player-1', 'domino_h', 0, 0); // matches the true solution (a domino at column 0)...
        grid.place('player-2', 'dot', 0, 3); // ...but this dot strands cells 2 and 4: a dead end.
        const hint = findHint(grid, ['domino_h', 'domino_h', 'dot']);
        assert.ok(hint);
        assert.equal(hint.shapeId, 'domino_h');
        assert.notEqual(hint.col, 0, 'must not point at the domino that is already correct');
    });

    test('returns null when everything is already placed correctly, or there are no pieces', () => {
        const grid = new Grid(1, 2);
        grid.place('player-1', 'domino_h', 0, 0);
        assert.equal(findHint(grid, ['domino_h']), null);
        assert.equal(findHint(new Grid(1, 1), []), null);
    });
});
