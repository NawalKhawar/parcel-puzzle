/**
 * TrayLayout.test.js
 *
 * Tests for src/core/TrayLayout.js: how the parcels are sized and spaced along the belt - full
 * size with gaps when there is room, slight overlap when crowded, shrinking only as a last
 * resort - and that no layout ever hides a neighbour's shape.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { computeTrayLayout } from '../../src/core/TrayLayout.js';
import { getShapeBounds } from '../../src/core/Shape.js';
import data from '../../src/data/levels.shapes.json' with { type: 'json' };

const options = {
    usableWidth: 600,
    maxScale: 0.7,
    minScale: 0.45,
    maxHeight: 200,
    gap: 8,
    maxOverlapFraction: 0.2,
    maxOverlapPx: 14,
};
const box = (width, height = 50) => ({ width, height });

describe('computeTrayLayout - fitting the row', () => {
    test('with plenty of room: full allowed size, a plain gap between pieces, no overlap', () => {
        const layout = computeTrayLayout([box(100), box(100), box(100)], options);
        assert.equal(layout.scale, 0.7);
        assert.equal(layout.overlaps, false);
        assert.deepEqual(layout.lefts, [0, 78, 156]); // each piece is 70 wide + the 8 gap
        assert.equal(layout.rowWidth, 70 * 3 + 8 * 2);
    });

    test('a crowded row overlaps its neighbours slightly instead of shrinking, when that is enough', () => {
        // 10 pieces of 100 -> 70 each = 700 + 9 gaps of 8 = 772, far more than 600: the gaps close
        // up first and then the pieces start to overlap - at full size, no shrinking needed.
        const layout = computeTrayLayout(Array.from({ length: 10 }, () => box(100)), options);
        assert.equal(layout.scale, 0.7, 'still full size');
        assert.equal(layout.overlaps, true, 'the plain row is far too wide for 600, so pieces must overlap');
        assert.ok(layout.rowWidth <= 600 + 1e-9, 'the squeezed row fits');
    });

    test('a slightly-too-wide row just tightens the gaps; nothing overlaps yet', () => {
        // 8 pieces of 100 -> 560 + 7 gaps of 8 = 616 > 600, but closing the gaps a little is enough.
        const layout = computeTrayLayout(Array.from({ length: 8 }, () => box(100)), options);
        assert.equal(layout.scale, 0.7);
        assert.equal(layout.overlaps, false);
        assert.ok(layout.rowWidth <= 600 + 1e-9);
    });

    test('overlap is spread evenly and kept small: the same amount at every junction', () => {
        const layout = computeTrayLayout(Array.from({ length: 10 }, () => box(100)), options);
        const widths = 100 * layout.scale;
        const steps = layout.lefts.slice(1).map((left, i) => left - layout.lefts[i] - widths);
        for (const step of steps) {
            assert.ok(Math.abs(step - steps[0]) < 1e-9, 'every junction squeezed by the same amount');
        }
    });

    test('never overlaps a neighbour by more than the allowed fraction or pixels', () => {
        for (const count of [6, 8, 10, 14]) {
            const sizes = Array.from({ length: count }, (_, i) => box(60 + i * 10));
            const layout = computeTrayLayout(sizes, options);
            for (let i = 0; i < count - 1; i++) {
                const wA = sizes[i].width * layout.scale;
                const wB = sizes[i + 1].width * layout.scale;
                const overlap = layout.lefts[i] + wA - layout.lefts[i + 1];
                const allowed = Math.min(options.maxOverlapPx, options.maxOverlapFraction * Math.min(wA, wB));
                assert.ok(overlap <= allowed + 1e-9, `junction ${i} of ${count}: overlap ${overlap} > ${allowed}`);
            }
        }
    });

    test('when overlap is not enough it shrinks every piece, never below the minimum', () => {
        const sizes = Array.from({ length: 12 }, () => box(100));
        const layout = computeTrayLayout(sizes, options);
        assert.ok(layout.scale < 0.7, 'had to shrink');
        assert.ok(layout.scale >= options.minScale);
        assert.equal(layout.fits, true);
        assert.ok(layout.rowWidth <= options.usableWidth + 1e-9);
    });

    test('an impossible row is reported as not fitting, at the minimum size, rather than shrinking past it', () => {
        const layout = computeTrayLayout(Array.from({ length: 40 }, () => box(100)), options);
        assert.equal(layout.scale, options.minScale);
        assert.equal(layout.fits, false);
    });
});

describe('computeTrayLayout - size limits and order', () => {
    test('a very tall piece lowers the size so it stays under maxHeight', () => {
        const layout = computeTrayLayout([box(100, 400)], options); // 400 tall, limit 200 -> 0.5
        assert.equal(layout.scale, 0.5);
    });

    test('maxScale is respected even when everything would fit bigger', () => {
        assert.equal(computeTrayLayout([box(20, 20)], { ...options, maxScale: 0.6 }).scale, 0.6);
    });

    test('pieces stay in order, left to right, and the first starts at 0', () => {
        const layout = computeTrayLayout(Array.from({ length: 9 }, (_, i) => box(80 + i * 7)), options);
        assert.equal(layout.lefts[0], 0);
        for (let i = 1; i < layout.lefts.length; i++) {
            assert.ok(layout.lefts[i] > layout.lefts[i - 1], 'strictly increasing');
        }
    });

    test('no pieces, and a single piece, work', () => {
        assert.deepEqual(computeTrayLayout([], options).lefts, []);
        const one = computeTrayLayout([box(100)], options);
        assert.deepEqual(one.lefts, [0]);
        assert.equal(one.rowWidth, 70);
    });
});

describe('computeTrayLayout over every shipped puzzle', () => {
    // The real belt settings used by PuzzleScene, in design pixels.
    const real = { usableWidth: 1152, maxScale: 1, minScale: 0.45, maxHeight: 170, gap: 8, maxOverlapFraction: 0, maxOverlapPx: 0 };
    const puzzles = data.flatMap((level) => level.trucks.flatMap((slot) => slot.puzzles));

    test('every puzzle fits on the belt without going below the minimum size', () => {
        let smallest = 1;
        for (const puzzle of puzzles) {
            const cell = Math.min(72, 360 / puzzle.rows);
            const trayCell = Math.min(1, 52 / cell); // parcels are drawn at about 52px per cell on the belt
            const sizes = puzzle.pieces.map((id) => {
                const b = getShapeBounds(id);
                return { width: b.cols * cell, height: b.rows * cell };
            });
            const layout = computeTrayLayout(sizes, { ...real, maxScale: trayCell });
            assert.equal(layout.fits, true, `${puzzle.id} does not fit`);
            smallest = Math.min(smallest, layout.scale / trayCell);
        }
        assert.ok(smallest >= 0.6, `smallest relative scale ${smallest.toFixed(2)} is too small to grab comfortably`);
    });
});
