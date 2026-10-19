/**
 * ShapeNames.test.js
 *
 * Tests for the player-facing shape names in src/core/Shape.js, used by the "new piece" popup.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { listShapeIds, getShapeName, SHAPE_NAMES } from '../../src/core/Shape.js';

describe('shape names', () => {
    test('every shape has a non-empty name, and there are no names for unknown shapes', () => {
        for (const id of listShapeIds()) {
            assert.ok(typeof SHAPE_NAMES[id] === 'string' && SHAPE_NAMES[id].length > 0, `${id} needs a name`);
        }
        assert.deepEqual(Object.keys(SHAPE_NAMES).sort(), [...listShapeIds()].sort());
    });

    test('the irregular shapes introduced by the levels have distinct, readable names', () => {
        const introduced = ['tri_l', 'l4', 't4', 's4', 'p5', 'plus'];
        const names = introduced.map(getShapeName);
        assert.equal(new Set(names).size, introduced.length, `names must differ: ${names.join(', ')}`);
    });

    test('an unknown shape id throws', () => {
        assert.throws(() => getShapeName('blob'), /Unknown shape id/);
    });
});
