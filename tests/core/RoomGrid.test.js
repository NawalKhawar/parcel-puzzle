/**
 * RoomGrid.test.js
 *
 * Tests for src/core/RoomGrid.js: the apartment's placement rules (inside the room, no
 * overlaps, rugs are the one exception) and the back-to-front draw order that makes
 * nearer furniture cover farther furniture.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { RoomGrid } from '../../src/core/RoomGrid.js';

const plant = { id: 'plant', cols: 1, rows: 1 };
const table = { id: 'table', cols: 2, rows: 2 };
const shelf = { id: 'shelf', cols: 2, rows: 1 };
const rug = { id: 'rug', cols: 3, rows: 2, flat: true };
const rug2 = { id: 'rug2', cols: 2, rows: 2, flat: true };

describe('RoomGrid - bounds', () => {
    test('accepts placements fully inside the room, including flush against every wall', () => {
        const room = new RoomGrid(4, 3);
        assert.equal(room.canPlace(table, 0, 0), true);
        assert.equal(room.canPlace(table, 2, 1), true, 'bottom-right corner exactly fits');
        assert.equal(room.canPlace(plant, 3, 2), true);
    });

    test('rejects placements that stick out of any side', () => {
        const room = new RoomGrid(4, 3);
        assert.equal(room.canPlace(table, -1, 0), false);
        assert.equal(room.canPlace(table, 0, -1), false);
        assert.equal(room.canPlace(table, 3, 0), false, 'sticks out the right');
        assert.equal(room.canPlace(table, 0, 2), false, 'sticks out the front');
    });
});

describe('RoomGrid - overlap', () => {
    test('two normal items cannot overlap, but can touch', () => {
        const room = new RoomGrid(6, 4);
        room.place(table, 1, 1);
        assert.equal(room.canPlace(plant, 1, 1), false, 'directly on the table');
        assert.equal(room.canPlace(plant, 2, 2), false, 'on the table\'s far corner cell');
        assert.equal(room.canPlace(plant, 3, 1), true, 'right next to it');
        assert.equal(room.canPlace(plant, 1, 3), true, 'right in front of it');
    });

    test('a normal item may sit on a rug, but two rugs may not overlap', () => {
        const room = new RoomGrid(6, 4);
        room.place(rug, 0, 0);
        assert.equal(room.canPlace(table, 0, 0), true, 'table on the rug');
        assert.equal(room.canPlace(rug2, 1, 1), false, 'rug on rug');
        assert.equal(room.canPlace(rug2, 3, 0), true, 'rug beside rug');
    });

    test('a rug can be put down underneath an existing item', () => {
        const room = new RoomGrid(6, 4);
        room.place(table, 1, 1);
        assert.equal(room.canPlace(rug, 0, 0), true);
    });

    test('ignoreId lets an item be tested against its own old spot', () => {
        const room = new RoomGrid(6, 4);
        room.place(table, 1, 1);
        assert.equal(room.canPlace(table, 2, 1), false, 'overlaps its own old position');
        assert.equal(room.canPlace(table, 2, 1, 'table'), true, 'fine when ignoring itself');
    });
});

describe('RoomGrid - place / remove', () => {
    test('place records the item; remove returns where it was and frees the cells', () => {
        const room = new RoomGrid(4, 4);
        room.place(table, 1, 2);
        assert.equal(room.has('table'), true);
        assert.deepEqual(room.get('table'), { id: 'table', col: 1, row: 2, cols: 2, rows: 2, flat: false });

        const removed = room.remove('table');
        assert.equal(removed.col, 1);
        assert.equal(room.has('table'), false);
        assert.equal(room.canPlace(plant, 1, 2), true, 'cells are free again');
        assert.equal(room.remove('table'), undefined, 'removing twice is harmless');
    });

    test('placing an illegal position or an already-placed item throws', () => {
        const room = new RoomGrid(4, 4);
        room.place(plant, 0, 0);
        assert.throws(() => room.place(plant, 1, 1), /already placed/);
        assert.throws(() => room.place(table, 3, 3), /cannot be placed/);
    });
});

describe('RoomGrid - draw order (what is behind what)', () => {
    test('farther items are drawn before nearer items', () => {
        const room = new RoomGrid(8, 6);
        room.place({ id: 'front', cols: 1, rows: 1 }, 3, 5);
        room.place({ id: 'back', cols: 1, rows: 1 }, 3, 0);
        room.place({ id: 'middle', cols: 1, rows: 1 }, 3, 2);
        assert.deepEqual(room.getDrawOrder().map((p) => p.id), ['back', 'middle', 'front']);
    });

    test('rugs are always drawn first, even when they extend nearer than other items', () => {
        const room = new RoomGrid(8, 6);
        room.place(plant, 0, 0);
        room.place(rug, 4, 3);
        assert.deepEqual(room.getDrawOrder().map((p) => p.id), ['rug', 'plant']);
    });

    test('a deep item is ordered by its FRONT edge, so something in front of it is drawn after it', () => {
        const room = new RoomGrid(8, 6);
        room.place({ id: 'bed', cols: 2, rows: 3 }, 0, 0); // rows 0-2, front edge at 3
        room.place({ id: 'stool', cols: 1, rows: 1 }, 0, 3); // directly in front of the bed
        room.place({ id: 'lamp', cols: 1, rows: 1 }, 5, 1); // beside it, front edge at 2
        assert.deepEqual(room.getDrawOrder().map((p) => p.id), ['lamp', 'bed', 'stool']);
    });

    test('does not modify the grid and returns a fresh array each call', () => {
        const room = new RoomGrid(4, 4);
        room.place(shelf, 0, 0);
        const first = room.getDrawOrder();
        first.pop();
        assert.equal(room.getDrawOrder().length, 1);
    });
});
