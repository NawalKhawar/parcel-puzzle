/**
 * items.test.js
 *
 * Checks the real furniture catalogue (src/data/items.json) loads, holds the agreed items with the
 * agreed rules, and that the loader rejects bad data.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadItems } from '../../src/data/loadItems.js';
import { MAX_HEIGHT_ROWS, ROOM_W, WALL_HANG_ROWS, WALL_ROWS, WALL_RESERVED_ROWS } from '../../src/core/roomConfig.js';

const raw = JSON.parse(readFileSync(fileURLToPath(new URL('../../src/data/items.json', import.meta.url)), 'utf8'));
const items = loadItems(structuredClone(raw));
const byId = new Map(items.map((item) => [item.id, item]));

describe('items.json', () => {
    test('holds exactly the agreed items', () => {
        assert.deepEqual([...byId.keys()].sort(), [
            'bed', 'bookshelf', 'clock', 'coffee-table', 'couch', 'fridge', 'large-rug', 'mattress', 'mini-fridge',
            'photo-frame', 'poster-space', 'poster-sports', 'rug', 'tall-lamp', 'tall-plant',
        ]);
    });

    test('only the two rugs are flat (so only rugs can have things on them)', () => {
        assert.deepEqual(items.filter((item) => item.flat).map((item) => item.id), ['rug', 'large-rug']);
    });

    test('the large rug is twice the rug in width and depth', () => {
        assert.deepEqual(byId.get('large-rug').footprint, { w: 2 * byId.get('rug').footprint.w, h: 2 * byId.get('rug').footprint.h });
    });

    test('the clock, both posters and the photo frame hang on the wall; everything else stands on the floor', () => {
        const hung = items.filter((item) => item.wallMounted).map((item) => item.id).sort();
        assert.deepEqual(hung, ['clock', 'photo-frame', 'poster-space', 'poster-sports']);
    });

    test('the two posters are the same size', () => {
        assert.deepEqual(byId.get('poster-sports').footprint, byId.get('poster-space').footprint);
    });

    test("the mattress is the bed's cousin: same floor space, solid", () => {
        const { mattress, bed } = { mattress: byId.get('mattress'), bed: byId.get('bed') };
        assert.deepEqual(mattress.footprint, bed.footprint);
        assert.ok(!mattress.flat);
    });

    test('the potted plant is still filed under its old id and art name', () => {
        assert.equal(byId.get('tall-plant').name, 'Potted Plant');
        assert.equal(byId.get('tall-plant').sprite, 'item-tall-plant');
    });

    test('the fridge is the largest standing item - no picture is bigger, and only the bed and mattress take more floor', () => {
        const area = (item) => item.footprint.w * (item.footprint.h + item.heightRows);
        const floorSpace = (item) => item.footprint.w * item.footprint.h;
        const standing = items.filter((item) => !item.wallMounted && !item.flat && item.id !== 'fridge');
        for (const other of standing) {
            // Backing into the wall caps its picture at 4 tiles tall, which the bed's equals.
            assert.ok(area(byId.get('fridge')) >= area(other), `picture not smaller than ${other.id}`);
        }
        // More floor space than anything but the (low) bed and mattress.
        for (const other of standing.filter((item) => !['bed', 'mattress'].includes(item.id))) {
            assert.ok(floorSpace(byId.get('fridge')) > floorSpace(other), `floor space bigger than ${other.id}`);
        }
    });

    test('the couch and potted plant are at least as big as the bookshelf and lamp they sit beside', () => {
        const width = (id) => byId.get(id).footprint.w;
        assert.ok(width('couch') >= 2 && width('tall-plant') >= 2);
    });

    test('the potted plant is drawn at three quarters size', () => {
        assert.equal(byId.get('tall-plant').artScale, 0.75);
    });

    test('the fridge and mini fridge are not extreme: fridge shrunk, mini fridge enlarged, couch and bookshelf enlarged', () => {
        assert.ok(byId.get('fridge').artScale < 1);
        assert.ok(byId.get('mini-fridge').artScale > 1);
        assert.ok(byId.get('couch').artScale > 1);
        assert.ok(byId.get('bookshelf').artScale > 1);
        // Still clearly a smaller appliance than the fridge once drawn.
        assert.ok(byId.get('fridge').artScale * byId.get('fridge').footprint.w > byId.get('mini-fridge').artScale * byId.get('mini-fridge').footprint.w);
    });

    test('only the fridge may back into the wall', () => {
        assert.deepEqual(items.filter((item) => item.intoWall).map((item) => item.id), ['fridge']);
    });

    test("the fridge's picture still fits inside the room when it is backed up one row", () => {
        const fridge = byId.get('fridge');
        // Its picture rises heightRows above the footprint's top row; backed up, that row is the wall's lowest.
        assert.ok(WALL_ROWS - fridge.intoWall - fridge.heightRows >= 0);
    });

    test('prices are not item data: they live in economy.json', () => {
        for (const item of items) {
            assert.equal(item.price, undefined, `${item.id} should not have a price`);
        }
    });

    test('every wall item fits in the top two wall rows and has no height above it', () => {
        for (const item of items.filter((entry) => entry.wallMounted)) {
            assert.ok(item.footprint.h <= WALL_HANG_ROWS, item.id);
            assert.equal(item.heightRows, 0, item.id);
        }
    });

    test('every floor item except the rugs is solid, so only rugs can be overlapped', () => {
        for (const item of items.filter((entry) => !entry.wallMounted && !entry.id.endsWith('rug'))) {
            assert.ok(!item.flat, item.id);
        }
    });
});

describe('loadItems rejects bad data', () => {
    const withChange = (change) => {
        const data = structuredClone(raw);
        change(data.items.find((item) => item.id === 'bed'));
        return data;
    };

    test('a missing or bad footprint', () => {
        assert.throws(() => loadItems(withChange((bed) => delete bed.footprint)), /"footprint"/);
        assert.throws(() => loadItems(withChange((bed) => { bed.footprint.w = 0; })), /"footprint"/);
    });

    test('heightRows above the cap', () => {
        assert.throws(() => loadItems(withChange((bed) => { bed.heightRows = MAX_HEIGHT_ROWS + 1; })), /"heightRows"/);
    });

    test('a footprint bigger than its area', () => {
        assert.throws(() => loadItems(withChange((bed) => { bed.footprint.w = ROOM_W + 1; })), new RegExp(`does not fit on the ${ROOM_W}x8 floor`));
        assert.throws(() => loadItems(withChange((bed) => { bed.wallMounted = true; bed.heightRows = 0; })), new RegExp(`does not fit on the ${ROOM_W}x${WALL_HANG_ROWS} wall area`));
    });

    test('a wall item with height above it', () => {
        assert.throws(() => loadItems(withChange((bed) => { bed.wallMounted = true; bed.footprint = { w: 1, h: 1 }; })), /"heightRows": 0/);
    });

    test('intoWall out of range, or on a wall item', () => {
        assert.throws(() => loadItems(withChange((bed) => { bed.intoWall = WALL_RESERVED_ROWS + 1; })), /"intoWall"/);
        assert.throws(() => loadItems(withChange((bed) => { bed.intoWall = -1; })), /"intoWall"/);
        assert.throws(() => loadItems(withChange((bed) => { bed.intoWall = 0.5; })), /"intoWall"/);
        assert.throws(() => loadItems(withChange((bed) => { bed.wallMounted = true; bed.heightRows = 0; bed.footprint = { w: 1, h: 1 }; bed.intoWall = 1; })), /already hangs on the wall/);
        assert.doesNotThrow(() => loadItems(withChange((bed) => { bed.intoWall = WALL_RESERVED_ROWS; })));
    });

    test('artScale must be above 0 and at most 2', () => {
        assert.throws(() => loadItems(withChange((bed) => { bed.artScale = 0; })), /"artScale"/);
        assert.throws(() => loadItems(withChange((bed) => { bed.artScale = 2.5; })), /"artScale"/);
        assert.throws(() => loadItems(withChange((bed) => { bed.artScale = 'big'; })), /"artScale"/);
        assert.doesNotThrow(() => loadItems(withChange((bed) => { bed.artScale = 0.75; })));
        assert.doesNotThrow(() => loadItems(withChange((bed) => { bed.artScale = 1.25; })));
    });

    test('duplicate ids or missing sprite', () => {
        assert.throws(() => loadItems(withChange((bed) => { bed.id = 'rug'; })), /duplicate/);
        assert.throws(() => loadItems(withChange((bed) => delete bed.sprite)), /"sprite"/);
    });
});
