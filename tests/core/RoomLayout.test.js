/**
 * RoomLayout.test.js
 *
 * The apartment's placement rules, pick-up/put-down, save/load, draw order and sprite maths.
 * Uses its own small item set (including wall items, which the real catalogue doesn't have yet)
 * on the default 10-wide room: rows 0-1 are the wall strip, rows 2-9 the floor.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { RoomLayout, spriteRect, snapToTile, layerOf } from '../../src/core/RoomLayout.js';
import { TILE, ROOM_W, WALL_ROWS, WALL_HANG_ROWS, ROOM_H, HEADROOM_ROWS, MAX_HEIGHT_ROWS } from '../../src/core/roomConfig.js';

const item = (id, w, h, extra = {}) => ({ id, footprint: { w, h }, heightRows: 0, wallMounted: false, ...extra });
const ITEMS = [
    item('rug', 3, 2, { flat: true }),
    item('rug2', 2, 2, { flat: true }),
    item('bed', 2, 3, { heightRows: 1 }),
    item('bookshelf', 2, 1, { heightRows: 2 }),
    item('wardrobe', 2, 1, { heightRows: 3 }),
    item('stool', 1, 1),
    item('clock', 1, 1, { wallMounted: true }),
    item('poster', 1, 2, { wallMounted: true }),
];
const defs = new Map(ITEMS.map((entry) => [entry.id, entry]));
const def = (id) => defs.get(id);
const FLOOR_TOP = WALL_ROWS; // first floor row
const FLOOR_END = WALL_ROWS + ROOM_H; // one past the last floor row

describe('config', () => {
    test('defaults are the agreed room size', () => {
        assert.equal(TILE, 32);
        assert.equal(ROOM_W, 14);
        assert.equal(ROOM_H, 8);
        assert.equal(WALL_ROWS, 3);
        assert.equal(WALL_HANG_ROWS, 2, 'wall items use the top two wall rows');
        assert.equal(MAX_HEIGHT_ROWS, WALL_ROWS);
        assert.equal(HEADROOM_ROWS, 0);
    });
});

describe('placement validity - bounds', () => {
    const room = new RoomLayout();

    test('a floor item fits anywhere on the floor, corners included', () => {
        assert.ok(room.canPlace(def('bed'), 0, FLOOR_TOP));
        assert.ok(room.canPlace(def('bed'), ROOM_W - 2, FLOOR_END - 3));
    });

    test('a floor item may not poke off any edge of the floor', () => {
        assert.ok(!room.canPlace(def('bed'), -1, FLOOR_TOP), 'left');
        assert.ok(!room.canPlace(def('bed'), ROOM_W - 1, FLOOR_TOP), 'right');
        assert.ok(!room.canPlace(def('bed'), 0, FLOOR_END - 2), 'front');
        assert.ok(!room.canPlace(def('bed'), 0, FLOOR_TOP - 1), 'into the wall strip');
    });

    test('positions must be whole tiles', () => {
        assert.ok(!room.canPlace(def('stool'), 1.5, FLOOR_TOP));
        assert.ok(!room.canPlace(def('stool'), 1, FLOOR_TOP + 0.5));
    });
});

describe('placement validity - wall-mounted rules', () => {
    const room = new RoomLayout();

    test('wall items go only on the top two wall rows', () => {
        assert.ok(room.canPlace(def('clock'), 0, 0));
        assert.ok(room.canPlace(def('clock'), ROOM_W - 1, WALL_HANG_ROWS - 1), 'the second row down is the last allowed');
        assert.ok(room.canPlace(def('poster'), 3, 0), 'a 2-tall poster fills both rows');
        assert.ok(!room.canPlace(def('clock'), 0, WALL_ROWS - 1), 'not on the lowest wall row, just above the floor');
        assert.ok(!room.canPlace(def('poster'), 3, 1), 'may not hang down into the lowest wall row');
        assert.ok(!room.canPlace(def('clock'), 0, FLOOR_TOP), 'not on the floor');
        assert.ok(!room.canPlace(def('clock'), ROOM_W, 0), 'not off the end of the wall');
    });

    test('floor items never go on the wall strip', () => {
        assert.ok(!room.canPlace(def('stool'), 0, 0));
        assert.ok(!room.canPlace(def('stool'), 0, WALL_ROWS - 1));
    });

    test('wall items have their own slots: they block each other but not the floor', () => {
        const wall = new RoomLayout();
        wall.place(def('clock'), 4, 0);
        assert.ok(!wall.canPlace(def('poster'), 4, 0), 'overlaps the clock');
        assert.ok(wall.canPlace(def('poster'), 5, 0), 'next to it is fine');
        // A tall wardrobe against the back wall overdraws the clock but doesn't "use" wall tiles.
        assert.ok(wall.canPlace(def('wardrobe'), 4, FLOOR_TOP));
    });
});

describe('placement validity - overlap', () => {
    test('solid items cannot overlap: nothing can go on a bed or bookshelf', () => {
        const room = new RoomLayout();
        room.place(def('bed'), 2, FLOOR_TOP);
        room.place(def('bookshelf'), 6, FLOOR_TOP);
        assert.ok(!room.canPlace(def('stool'), 3, FLOOR_TOP + 2), 'on the bed');
        assert.ok(!room.canPlace(def('stool'), 7, FLOOR_TOP), 'on the bookshelf');
        assert.ok(!room.canPlace(def('bookshelf'), 1, FLOOR_TOP), 'partly over the bed');
        assert.ok(room.canPlace(def('stool'), 4, FLOOR_TOP), 'beside the bed');
    });

    test('anything can stand on a rug, and a rug can go under furniture', () => {
        const room = new RoomLayout();
        room.place(def('rug'), 2, FLOOR_TOP + 3);
        assert.ok(room.canPlace(def('bed'), 2, FLOOR_TOP + 2));
        assert.ok(room.canPlace(def('stool'), 3, FLOOR_TOP + 3));

        const other = new RoomLayout();
        other.place(def('bed'), 2, FLOOR_TOP + 2);
        assert.ok(other.canPlace(def('rug'), 2, FLOOR_TOP + 3));
    });

    test('two rugs cannot overlap each other', () => {
        const room = new RoomLayout();
        room.place(def('rug'), 2, FLOOR_TOP);
        assert.ok(!room.canPlace(def('rug2'), 4, FLOOR_TOP + 1));
        assert.ok(room.canPlace(def('rug2'), 5, FLOOR_TOP));
    });

    test('an item never blocks itself, and ignoreId skips one item', () => {
        const room = new RoomLayout();
        room.place(def('bed'), 2, FLOOR_TOP);
        assert.ok(room.canPlace(def('bed'), 3, FLOOR_TOP), 'moving the bed by one');
        assert.ok(room.canPlace(def('stool'), 2, FLOOR_TOP, { ignoreId: 'bed' }));
    });

    test('layers', () => {
        assert.equal(layerOf(def('rug')), 'flat');
        assert.equal(layerOf(def('bed')), 'solid');
        assert.equal(layerOf(def('clock')), 'wall');
    });
});

describe('nearest valid spot', () => {
    test('a spot that is already legal is returned unchanged', () => {
        const room = new RoomLayout();
        assert.deepEqual(room.findNearestValid(def('stool'), 4, FLOOR_TOP + 2), { x: 4, y: FLOOR_TOP + 2 });
    });

    test('an overlapped spot slides to the closest free one, on the side the position leans towards', () => {
        const room = new RoomLayout();
        room.place(def('bed'), 4, FLOOR_TOP); // covers columns 4-5, rows FLOOR_TOP..FLOOR_TOP+2
        // Aimed at the bed's left half (4.2): the nearest free stool spot is the column to its left.
        assert.deepEqual(room.findNearestValid(def('stool'), 4.2, FLOOR_TOP + 1), { x: 3, y: FLOOR_TOP + 1 });
        // Aimed at its right half (5.4): the column to its right.
        assert.deepEqual(room.findNearestValid(def('stool'), 5.4, FLOOR_TOP + 1), { x: 6, y: FLOOR_TOP + 1 });
        // Aimed at the bed's last row: just below it is closer than going sideways.
        assert.deepEqual(room.findNearestValid(def('stool'), 4.5, FLOOR_TOP + 2.4), { x: 4, y: FLOOR_TOP + 3 });
    });

    test('a spot off the edge of the floor is pulled back inside', () => {
        const room = new RoomLayout();
        assert.deepEqual(room.findNearestValid(def('bed'), ROOM_W + 3, FLOOR_END + 2), { x: ROOM_W - 2, y: FLOOR_END - 3 });
        assert.deepEqual(room.findNearestValid(def('stool'), -4, FLOOR_TOP + 1), { x: 0, y: FLOOR_TOP + 1 });
    });

    test('a wall item aimed at the floor lands on the wall; a floor item aimed at the wall lands on the floor', () => {
        const room = new RoomLayout();
        assert.deepEqual(room.findNearestValid(def('clock'), 5, FLOOR_TOP + 4), { x: 5, y: WALL_HANG_ROWS - 1 });
        assert.deepEqual(room.findNearestValid(def('stool'), 5, 0), { x: 5, y: FLOOR_TOP });
    });

    test('ties go to the topmost then leftmost spot, the same every time', () => {
        const room = new RoomLayout();
        room.place(item('crate', 1, 1), 5, FLOOR_TOP + 2); // a different 1x1 item blocks the exact spot
        // Free spots at equal distance on all four sides: the topmost wins.
        const spot = room.findNearestValid(def('stool'), 5, FLOOR_TOP + 2);
        assert.deepEqual(spot, { x: 5, y: FLOOR_TOP + 1 });
        assert.deepEqual(room.findNearestValid(def('stool'), 5, FLOOR_TOP + 2), spot);
    });

    test('an item that fits nowhere gets null', () => {
        const room = new RoomLayout({ width: 2, floorRows: 3 });
        room.place(def('stool'), 1, WALL_ROWS + 1); // the floor starts at row WALL_ROWS
        // The bed (2 wide, 3 deep) needs the whole 2x3 floor, and the stool is in the way.
        assert.equal(room.findNearestValid(def('bed'), 0, WALL_ROWS), null);
    });

    test('items never land on top of each other: every nearest spot passes canPlace', () => {
        const room = new RoomLayout();
        room.place(def('bed'), 2, FLOOR_TOP);
        room.place(def('bookshelf'), 6, FLOOR_TOP);
        for (let y = -2; y < FLOOR_END + 2; y += 0.7) {
            for (let x = -2; x < ROOM_W + 2; x += 0.7) {
                const spot = room.findNearestValid(def('stool'), x, y);
                assert.ok(spot && room.canPlace(def('stool'), spot.x, spot.y), `from ${x}, ${y}`);
            }
        }
    });
});

describe('items that may back into the wall (intoWall)', () => {
    const fridge = item('fridge', 2, 2, { heightRows: 2, intoWall: 1 });

    test("such an item may start one row up, in the wall's cleared bottom row - and no further", () => {
        const room = new RoomLayout();
        assert.ok(room.canPlace(fridge, 3, WALL_ROWS - 1), 'one row into the wall');
        assert.ok(!room.canPlace(fridge, 3, WALL_ROWS - 2), 'two rows is into the rows wall items use');
        assert.ok(room.canPlace(fridge, 3, FLOOR_TOP), 'the floor is still fine');
    });

    test('an ordinary item still may not enter the wall', () => {
        const room = new RoomLayout();
        assert.ok(!room.canPlace(def('bookshelf'), 3, WALL_ROWS - 1));
    });

    test("it still clashes with solid items it overlaps, and not with wall items above it", () => {
        const room = new RoomLayout();
        room.place(def('poster'), 3, 0); // a 2-tall poster, in the wall rows the fridge can't reach
        assert.ok(room.canPlace(fridge, 3, WALL_ROWS - 1));
        room.place(def('stool'), 3, FLOOR_TOP);
        assert.ok(!room.canPlace(fridge, 3, WALL_ROWS - 1), "the stool is under the fridge's second row");
        assert.ok(room.canPlace(fridge, 4, WALL_ROWS - 1));
    });

    test('its picture never rises above the top of the room when backed up', () => {
        const rect = spriteRect(fridge, 3, WALL_ROWS - 1);
        assert.ok(rect.top >= 0);
    });

    test('the nearest-valid search may use that extra row too', () => {
        const room = new RoomLayout();
        assert.deepEqual(room.findNearestValid(fridge, 5, 0), { x: 5, y: WALL_ROWS - 1 });
    });
});

describe('pick-up / put-down', () => {
    test('place, remove, and put back where it was', () => {
        const room = new RoomLayout();
        room.place(def('bed'), 2, FLOOR_TOP);
        assert.ok(room.has('bed'));
        assert.deepEqual(room.get('bed'), { id: 'bed', x: 2, y: FLOOR_TOP, w: 2, h: 3, layer: 'solid' });

        const was = room.remove('bed');
        assert.ok(!room.has('bed'));
        assert.equal(room.remove('bed'), undefined, 'removing twice is harmless');
        assert.ok(room.canPlace(def('stool'), 2, FLOOR_TOP), 'its tiles are free again');

        room.place(def('bed'), was.x, was.y);
        assert.deepEqual(room.get('bed'), was);
    });

    test('placing twice or on an invalid spot throws', () => {
        const room = new RoomLayout();
        room.place(def('stool'), 0, FLOOR_TOP);
        assert.throws(() => room.place(def('stool'), 1, FLOOR_TOP), /already placed/);
        assert.throws(() => room.place(def('bed'), 0, FLOOR_TOP), /cannot go/);
    });
});

describe('save / load', () => {
    test('round trip restores exactly the same layout', () => {
        const room = new RoomLayout();
        room.place(def('rug'), 3, FLOOR_TOP + 4);
        room.place(def('bed'), 3, FLOOR_TOP + 3);
        room.place(def('clock'), 7, 0);
        const saved = JSON.parse(JSON.stringify(room.serialize()));
        assert.deepEqual(saved, { rug: { x: 3, y: FLOOR_TOP + 4 }, bed: { x: 3, y: FLOOR_TOP + 3 }, clock: { x: 7, y: 0 } });

        const loaded = new RoomLayout();
        assert.deepEqual(loaded.load(saved, defs), []);
        assert.deepEqual([...loaded.placed.values()], [...room.placed.values()]);
    });

    test('loading replaces whatever was there and skips bad entries', () => {
        const room = new RoomLayout();
        room.place(def('stool'), 0, FLOOR_TOP);
        const skipped = room.load({
            bed: { x: 0, y: FLOOR_TOP },
            bookshelf: { x: 1, y: FLOOR_TOP }, // overlaps the bed
            sofa: { x: 5, y: FLOOR_TOP }, // not a known item
            clock: { col: 1, row: 0 }, // old save format
        }, defs);
        assert.deepEqual(skipped.sort(), ['bookshelf', 'clock', 'sofa']);
        assert.deepEqual([...room.placed.keys()], ['bed']);
        assert.deepEqual(room.load(undefined, defs), []);
        assert.equal(room.placed.size, 0);
    });
});

describe('depth sorting', () => {
    const ids = (room) => room.drawOrder().map((placement) => placement.id);

    test('wall items, then rugs, then furniture - whatever the placement order', () => {
        const room = new RoomLayout();
        room.place(def('stool'), 0, FLOOR_TOP);
        room.place(def('rug'), 4, FLOOR_END - 2);
        room.place(def('clock'), 0, 0);
        assert.deepEqual(ids(room), ['clock', 'rug', 'stool']);
    });

    test('a tall item against the back wall draws over the wall item it overlaps', () => {
        const room = new RoomLayout();
        room.place(def('wardrobe'), 4, FLOOR_TOP);
        room.place(def('poster'), 4, 0);
        assert.deepEqual(ids(room), ['poster', 'wardrobe']);
        // And its sprite really does reach up to the very top of the wall (the tallest allowed).
        const rect = spriteRect(def('wardrobe'), 4, FLOOR_TOP);
        assert.equal(rect.top, 0);
        assert.equal(HEADROOM_ROWS, 0, 'so nothing ever pokes above the top of the screen');
    });

    test('floor items sort by the bottom row of their footprint', () => {
        const room = new RoomLayout();
        // The bed covers rows 2-4 (bottom edge 5); the bookshelf sits on row 5 (bottom edge 6),
        // so the bookshelf is nearer the viewer and is drawn later, over the bed's front.
        room.place(def('bookshelf'), 2, FLOOR_TOP + 3);
        room.place(def('bed'), 2, FLOOR_TOP);
        assert.deepEqual(ids(room), ['bed', 'bookshelf']);
    });

    test('ties on the bottom row break by x, then by id, the same every time', () => {
        const room = new RoomLayout();
        room.place(def('bed'), 6, FLOOR_TOP); // bottom = FLOOR_TOP + 3
        room.place(def('stool'), 0, FLOOR_TOP + 2); // same bottom, smaller x
        assert.deepEqual(ids(room), ['stool', 'bed']);
        assert.deepEqual(ids(room), ids(room), 'stable between calls');

        // Valid placements on one layer can't share bottom row AND x, so the final id tie-break is
        // checked by planting two identical placements directly.
        const sameKey = new RoomLayout();
        sameKey.placed.set('b', { id: 'b', x: 0, y: 2, w: 1, h: 1, layer: 'solid' });
        sameKey.placed.set('a', { id: 'a', x: 0, y: 2, w: 1, h: 1, layer: 'solid' });
        assert.deepEqual(ids(sameKey), ['a', 'b']);
    });

    test('a rug in front of a bed still draws under it', () => {
        const room = new RoomLayout();
        room.place(def('bed'), 2, FLOOR_TOP);
        room.place(def('rug'), 2, FLOOR_END - 2);
        assert.deepEqual(ids(room), ['rug', 'bed']);
    });
});

describe('footprint-to-pixel maths', () => {
    test('the sprite is w x (h + heightRows) tiles, anchored at the footprint bottom-left', () => {
        assert.deepEqual(spriteRect(def('bed'), 3, 4), {
            anchorX: 3 * TILE,
            anchorY: (4 + 3) * TILE,
            left: 3 * TILE,
            top: (4 + 3 - 4) * TILE,
            width: 2 * TILE,
            height: 4 * TILE,
        });
    });

    test('a flat item\'s sprite is exactly its footprint', () => {
        const rect = spriteRect(def('rug'), 1, 5);
        assert.deepEqual([rect.left, rect.top, rect.width, rect.height], [TILE, 5 * TILE, 3 * TILE, 2 * TILE]);
    });

    test('a custom tile size scales everything', () => {
        const rect = spriteRect(def('bookshelf'), 2, 2, 16);
        assert.deepEqual([rect.anchorX, rect.anchorY, rect.top, rect.height], [32, 48, 0, 48]);
    });

    test('snapping rounds to the nearest tile', () => {
        assert.deepEqual(snapToTile(47, 80), { x: 1, y: 3 });
        assert.deepEqual(snapToTile(49, 79), { x: 2, y: 2 });
        assert.deepEqual(snapToTile(-20, 0), { x: -1, y: 0 });
    });
});

describe('picking uses the whole sprite', () => {
    test('a tall item can be grabbed by its top, above its footprint', () => {
        const room = new RoomLayout();
        room.place(def('bookshelf'), 4, FLOOR_TOP);
        // The footprint is one row; the sprite reaches up two more rows over the wall.
        assert.equal(room.pickAt(4 * TILE + 5, (FLOOR_TOP - 2) * TILE + 5, defs), 'bookshelf');
        assert.equal(room.pickAt(4 * TILE + 5, (FLOOR_TOP - 3) * TILE + 5, defs), null, 'above its top');
        assert.equal(room.pickAt(4 * TILE + 5, FLOOR_TOP * TILE + 5, defs), 'bookshelf');
        assert.equal(room.pickAt(4 * TILE + 5, (FLOOR_TOP + 1) * TILE + 5, defs), null, 'below it');
        assert.equal(room.pickAt(6 * TILE + 1, TILE, defs), null, 'beside it');
    });

    test('the front-most item wins where sprites overlap', () => {
        const room = new RoomLayout();
        room.place(def('rug'), 2, FLOOR_TOP + 2);
        room.place(def('bed'), 2, FLOOR_TOP + 1);
        // Inside both the rug and the bed: the bed is drawn on top, so it is picked.
        assert.equal(room.pickAt(2 * TILE + 5, (FLOOR_TOP + 2) * TILE + 5, defs), 'bed');
        // The rug's right-hand column sticks out past the bed.
        assert.equal(room.pickAt(4 * TILE + 5, (FLOOR_TOP + 2) * TILE + 5, defs), 'rug');
    });
});

describe('picking by the visible picture (art hit boxes)', () => {
    const poster = { id: 'poster', footprint: { w: 1, h: 2 }, heightRows: 0, wallMounted: true };
    const defs = new Map([[poster.id, poster]]);
    // The picture fills the middle 16px of the 32px-wide, 64px-tall footprint, leaving a margin all round.
    const hits = new Map([[poster.id, { left: 8, right: 24, top: -56, bottom: -8 }]]);

    test('a click in the transparent margin misses; a click on the picture hits', () => {
        const room = new RoomLayout();
        room.place(poster, 3, 0);
        // The footprint spans x 96..128, y 0..64 in room pixels.
        assert.equal(room.pickAt(100, 4, defs, TILE, hits), null, 'margin');
        assert.equal(room.pickAt(112, 32, defs, TILE, hits), poster.id, 'picture');
        // Without a hit box the whole nominal sprite counts, as before.
        assert.equal(room.pickAt(100, 4, defs), poster.id);
    });
});
