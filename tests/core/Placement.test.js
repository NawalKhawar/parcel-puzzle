/**
 * Placement.test.js
 *
 * Unit tests for src/core/Placement.js's pure geometry/legality helpers — translating
 * a shape to absolute board coordinates, and checking bounds/blocked/overlap conflicts
 * in isolation from Grid's stateful bookkeeping.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    cellKey,
    translateShape,
    isWithinBounds,
    hasBlockedConflict,
    hasOverlap,
    isLegalPlacement,
} from '../../src/core/Placement.js';

describe('Placement.js', () => {
    test('cellKey produces a stable, distinct string per (row, col) pair', () => {
        assert.equal(cellKey(0, 0), '0,0');
        assert.equal(cellKey(3, 12), '3,12');
        assert.notEqual(cellKey(1, 2), cellKey(2, 1));
    });

    test('translateShape offsets every cell by the given origin', () => {
        // domino_h is [{0,0},{0,1}]; placed at origin (2, 3), it should land at (2,3) and (2,4).
        const cells = translateShape('domino_h', 2, 3);
        assert.deepEqual(cells, [
            { row: 2, col: 3 },
            { row: 2, col: 4 },
        ]);
    });

    test('translateShape supports a negative origin (useful for bounds-checking a shape hanging off an edge)', () => {
        const cells = translateShape('domino_v', -1, 0);
        assert.deepEqual(cells, [
            { row: -1, col: 0 },
            { row: 0, col: 0 },
        ]);
    });

    test('translateShape throws on an unknown shape id (delegates to getShapeCells)', () => {
        assert.throws(() => translateShape('not_a_shape', 0, 0), /Unknown shape id/);
    });

    test('isWithinBounds accepts cells fully inside the board', () => {
        const cells = translateShape('square', 0, 0);
        assert.equal(isWithinBounds(cells, 4, 4), true);
    });

    test('isWithinBounds rejects a cell past the right/bottom edge', () => {
        const cells = translateShape('bar4', 0, 1); // spans cols 1-4 on a 4-wide board -> col 4 is out of bounds.
        assert.equal(isWithinBounds(cells, 4, 4), false);
    });

    test('isWithinBounds rejects a cell with a negative row/col', () => {
        const cells = translateShape('domino_v', -1, 0);
        assert.equal(isWithinBounds(cells, 4, 4), false);
    });

    test('hasBlockedConflict detects a cell that overlaps a blocked cell', () => {
        const cells = translateShape('domino_h', 0, 0); // covers (0,0) and (0,1).
        const blocked = new Set([cellKey(0, 1)]);
        assert.equal(hasBlockedConflict(cells, blocked), true);
    });

    test('hasBlockedConflict returns false when no cell overlaps a blocked cell', () => {
        const cells = translateShape('domino_h', 0, 0);
        const blocked = new Set([cellKey(5, 5)]);
        assert.equal(hasBlockedConflict(cells, blocked), false);
    });

    test('hasOverlap detects a cell that is already filled', () => {
        const cells = translateShape('dot', 2, 2);
        const filled = new Set([cellKey(2, 2)]);
        assert.equal(hasOverlap(cells, filled), true);
    });

    test('hasOverlap returns false when no cell is already filled', () => {
        const cells = translateShape('dot', 2, 2);
        const filled = new Set([cellKey(9, 9)]);
        assert.equal(hasOverlap(cells, filled), false);
    });

    test('isLegalPlacement combines bounds + blocked + overlap into one pass/fail check', () => {
        const blocked = new Set([cellKey(0, 3)]);
        const filled = new Set([cellKey(1, 1)]);

        // Legal: fully in bounds, no blocked/filled conflict.
        assert.equal(isLegalPlacement(translateShape('dot', 2, 2), 4, 4, blocked, filled), true);

        // Illegal: out of bounds.
        assert.equal(isLegalPlacement(translateShape('bar4', 0, 1), 4, 4, blocked, filled), false);

        // Illegal: lands on the blocked cell.
        assert.equal(isLegalPlacement(translateShape('dot', 0, 3), 4, 4, blocked, filled), false);

        // Illegal: overlaps an already-filled cell.
        assert.equal(isLegalPlacement(translateShape('dot', 1, 1), 4, 4, blocked, filled), false);
    });
});
