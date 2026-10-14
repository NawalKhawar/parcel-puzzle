/**
 * solver.test.js
 *
 * Regression tests for scripts/solver.js: asserts that every currently-shipped level
 * in src/data/levels.json still solves with the expected solvability/uniqueness
 * outcome. These numbers were captured by running `node scripts/validate-levels.js`
 * against the current level set (see TRACKER.md's Milestone 8 decision log entry) —
 * if a future change to Shape.js, Placement.js, Grid.js, or levels.json alters how
 * many ways a level can be solved, this is the test that should catch it.
 *
 * Also includes a couple of hand-built micro-levels with known, easy-to-reason-about
 * solution counts, so a regression in the solver itself (not just a levels.json change)
 * has a minimal, deterministic test to fail against.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { Grid } from '../../src/core/Grid.js';
import { solve } from '../../scripts/solver.js';
import { loadLevels, createGridForLevel } from '../../src/data/loadLevel.js';
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

    // Expected outcomes captured from `node scripts/validate-levels.js` against the
    // current level set. A level moving from 'unique' to 'multiple' (or vice versa),
    // or from solvable to unsolvable, means something in the engine or the level data
    // itself changed — update this table deliberately if that change was intentional.
    const expected = {
        'level-001': 'unique',
        'level-002': 'unique',
        'level-003': 'unique',
        'level-004': 'unique',
        'level-005': 'unique',
        'level-006': 'multiple',
        'level-007': 'multiple',
    };

    for (const level of levels) {
        test(`${level.id} is solvable and matches its expected uniqueness`, () => {
            const grid = createGridForLevel(level);
            const result = solve(grid, level.pieces);

            assert.ok(result.solutionCount >= 1, `${level.id} must have at least one solution`);

            const actual = result.solutionCount === 1 && result.solutionCountIsExact ? 'unique' : 'multiple';
            assert.equal(actual, expected[level.id], `${level.id}'s solvability profile changed unexpectedly`);
        });
    }

    test('every shipped level is accounted for in the expected-outcomes table above', () => {
        const levelIds = levels.map((level) => level.id);
        assert.deepEqual(Object.keys(expected).sort(), [...levelIds].sort());
    });
});
