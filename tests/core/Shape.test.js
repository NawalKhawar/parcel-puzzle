/**
 * Shape.test.js
 *
 * Unit tests for src/core/Shape.js's shape vocabulary and accessors. Uses Node's
 * built-in test runner (`node --test`) — see TRACKER.md's Milestone 8 decision log
 * entry for why that was chosen over an added dependency like vitest.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { getShapeCells, getShapeBounds, getShapeCellCount, listShapeIds, isKnownShape, SHAPES } from '../../src/core/Shape.js';

describe('Shape.js', () => {
    test('listShapeIds returns every key declared in SHAPES', () => {
        assert.deepEqual(listShapeIds(), Object.keys(SHAPES));
    });

    test('isKnownShape recognizes real shape ids and rejects unknown ones', () => {
        assert.equal(isKnownShape('dot'), true);
        assert.equal(isKnownShape('p5'), true);
        assert.equal(isKnownShape('nonexistent_shape'), false);
        assert.equal(isKnownShape(''), false);
    });

    test('getShapeCells throws a descriptive error for an unknown shape id', () => {
        assert.throws(() => getShapeCells('not_a_real_shape'), /Unknown shape id/);
    });

    test('getShapeCells returns a fresh copy each call, not a reference to SHAPES', () => {
        const first = getShapeCells('dot');
        first[0].row = 999;
        const second = getShapeCells('dot');
        // Mutating the first call's result must not have leaked into the shared
        // SHAPES data — this is the whole point of getShapeCells copying rather than
        // returning the frozen array directly (see its doc comment).
        assert.equal(second[0].row, 0);
    });

    test('every declared shape is normalized to a {row: 0, col: 0} bounding-box origin', () => {
        for (const shapeId of listShapeIds()) {
            const cells = getShapeCells(shapeId);
            const minRow = Math.min(...cells.map((c) => c.row));
            const minCol = Math.min(...cells.map((c) => c.col));
            assert.equal(minRow, 0, `${shapeId} should have a cell at row 0`);
            assert.equal(minCol, 0, `${shapeId} should have a cell at col 0`);
        }
    });

    test('every declared shape has no duplicate cells', () => {
        for (const shapeId of listShapeIds()) {
            const cells = getShapeCells(shapeId);
            const keys = cells.map((c) => `${c.row},${c.col}`);
            assert.equal(new Set(keys).size, keys.length, `${shapeId} has a duplicate cell`);
        }
    });

    test('getShapeBounds matches the actual max row/col of each shape', () => {
        assert.deepEqual(getShapeBounds('dot'), { rows: 1, cols: 1 });
        assert.deepEqual(getShapeBounds('domino_h'), { rows: 1, cols: 2 });
        assert.deepEqual(getShapeBounds('domino_v'), { rows: 2, cols: 1 });
        assert.deepEqual(getShapeBounds('bar4'), { rows: 1, cols: 4 });
        assert.deepEqual(getShapeBounds('square'), { rows: 2, cols: 2 });
        // p5: a 2x2 block plus one cell hanging below the left column -> 3 rows x 2 cols.
        assert.deepEqual(getShapeBounds('p5'), { rows: 3, cols: 2 });
        // plus: a 3x3 bounding box even though the corners are empty.
        assert.deepEqual(getShapeBounds('plus'), { rows: 3, cols: 3 });
    });

    test('getShapeCellCount matches the shape\'s actual cell list length', () => {
        assert.equal(getShapeCellCount('dot'), 1);
        assert.equal(getShapeCellCount('domino_h'), 2);
        assert.equal(getShapeCellCount('tri_l'), 3);
        assert.equal(getShapeCellCount('bar4'), 4);
        assert.equal(getShapeCellCount('p5'), 5);
        assert.equal(getShapeCellCount('plus'), 5);
    });
});
