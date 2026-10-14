/**
 * Grid.test.js
 *
 * Unit tests for src/core/Grid.js — the stateful board model wrapping Placement.js's
 * pure math with blocked/filled-cell bookkeeping, placement add/remove, and the
 * isComplete() win check.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { Grid } from '../../src/core/Grid.js';

describe('Grid.js', () => {
    test('constructor rejects non-positive or non-integer dimensions', () => {
        assert.throws(() => new Grid(0, 4), /positive integer/);
        assert.throws(() => new Grid(4, 0), /positive integer/);
        assert.throws(() => new Grid(4.5, 4), /positive integer/);
        assert.throws(() => new Grid(-1, 4), /positive integer/);
    });

    test('constructor accepts blocked cells as either [row, col] tuples or {row, col} objects', () => {
        const fromTuples = new Grid(3, 3, [[1, 1]]);
        const fromObjects = new Grid(3, 3, [{ row: 1, col: 1 }]);
        assert.equal(fromTuples.blockedCellKeys.has('1,1'), true);
        assert.equal(fromObjects.blockedCellKeys.has('1,1'), true);
    });

    test('canPlace is true for a legal placement and does not mutate the grid', () => {
        const grid = new Grid(4, 4);
        assert.equal(grid.canPlace('square', 0, 0), true);
        assert.equal(grid.filledCellKeys.size, 0, 'canPlace must not place anything');
    });

    test('canPlace is false for an out-of-bounds, blocked, or overlapping placement', () => {
        const grid = new Grid(4, 4, [[0, 0]]);
        assert.equal(grid.canPlace('bar4', 0, 1), false); // runs off the right edge.
        assert.equal(grid.canPlace('square', 0, 0), false); // square at (0,0) covers the blocked cell.

        grid.place('a', 'dot', 1, 1);
        assert.equal(grid.canPlace('dot', 1, 1), false); // already filled by placement 'a'.
    });

    test('place succeeds for a legal placement and fills its cells', () => {
        const grid = new Grid(4, 4);
        const result = grid.place('piece-1', 'domino_h', 0, 0);
        assert.equal(result, true);
        assert.equal(grid.filledCellKeys.has('0,0'), true);
        assert.equal(grid.filledCellKeys.has('0,1'), true);
        assert.deepEqual(grid.getPlacement('piece-1'), {
            shapeId: 'domino_h',
            originRow: 0,
            originCol: 0,
            cells: [
                { row: 0, col: 0 },
                { row: 0, col: 1 },
            ],
        });
    });

    test('place fails and leaves the grid unchanged for an illegal placement', () => {
        const grid = new Grid(2, 2);
        const result = grid.place('piece-1', 'bar4', 0, 0); // bar4 is 4 wide, board is 2 wide.
        assert.equal(result, false);
        assert.equal(grid.filledCellKeys.size, 0);
        assert.equal(grid.placements.size, 0);
    });

    test('place fails if the placementId is already in use, even if the new placement would itself be legal', () => {
        const grid = new Grid(4, 4);
        assert.equal(grid.place('piece-1', 'dot', 0, 0), true);
        assert.equal(grid.place('piece-1', 'dot', 2, 2), false, 'reusing an id must fail even for a different, legal spot');
        // The original placement must be untouched.
        assert.deepEqual(grid.getPlacement('piece-1').cells, [{ row: 0, col: 0 }]);
    });

    test('remove frees a placement\'s cells and makes them available again', () => {
        const grid = new Grid(4, 4);
        grid.place('piece-1', 'square', 0, 0);
        assert.equal(grid.canPlace('square', 0, 0), false);

        const removed = grid.remove('piece-1');
        assert.equal(removed, true);
        assert.equal(grid.filledCellKeys.size, 0);
        assert.equal(grid.canPlace('square', 0, 0), true);
    });

    test('remove returns false for a placementId that was never placed', () => {
        const grid = new Grid(4, 4);
        assert.equal(grid.remove('nonexistent'), false);
    });

    test('isComplete is false until every open cell is filled, then true, excluding blocked cells', () => {
        const grid = new Grid(2, 2, [[0, 0]]); // 3 open cells: (0,1), (1,0), (1,1).
        assert.equal(grid.isComplete(), false);

        grid.place('a', 'dot', 0, 1);
        assert.equal(grid.isComplete(), false);

        grid.place('b', 'domino_h', 1, 0); // fills (1,0) and (1,1).
        assert.equal(grid.isComplete(), true);
    });

    test('getRemainingOpenCellCount decreases as pieces are placed and increases again after remove', () => {
        const grid = new Grid(3, 3, [[0, 0]]); // 8 open cells.
        assert.equal(grid.getRemainingOpenCellCount(), 8);

        grid.place('a', 'domino_h', 0, 1);
        assert.equal(grid.getRemainingOpenCellCount(), 6);

        grid.remove('a');
        assert.equal(grid.getRemainingOpenCellCount(), 8);
    });

    test('toDebugString renders blocked, filled, and open cells distinctly', () => {
        const grid = new Grid(2, 2, [[0, 0]]);
        grid.place('x', 'dot', 1, 1);
        const rendered = grid.toDebugString();
        const lines = rendered.split('\n');
        assert.equal(lines.length, 2);
        assert.equal(lines[0], '# .'); // blocked, then open.
        assert.equal(lines[1], '. x'); // open, then the 'x' placement's first character.
    });
});
