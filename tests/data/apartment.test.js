/**
 * apartment.test.js
 *
 * Tests for src/data/loadApartment.js: the validation rules, plus checks that the shipped
 * apartment.json (furniture catalog) and shop.json (items) match what the design asks for -
 * placeholder furniture of several different sizes, and a shop that is a single list of items.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { loadApartment, loadShop } from '../../src/data/loadApartment.js';
import apartmentRaw from '../../src/data/apartment.json' with { type: 'json' };
import shopRaw from '../../src/data/shop.json' with { type: 'json' };

const validItem = (overrides = {}) => ({ id: 'a', name: 'A', cols: 1, rows: 1, height: 10, color: '#aabbcc', ...overrides });
const apartmentWith = (...items) => ({ room: { cols: 4, rows: 4 }, items });

describe('loadApartment - validation', () => {
    test('accepts a minimal valid apartment', () => {
        assert.doesNotThrow(() => loadApartment(apartmentWith(validItem())));
    });

    test('rejects a bad room, empty catalog, duplicate ids and missing names', () => {
        assert.throws(() => loadApartment({ room: { cols: 0, rows: 4 }, items: [validItem()] }), /room/);
        assert.throws(() => loadApartment({ room: { cols: 4, rows: 4 }, items: [] }), /non-empty/);
        assert.throws(() => loadApartment(apartmentWith(validItem(), validItem())), /duplicate id/);
        assert.throws(() => loadApartment(apartmentWith(validItem({ name: '' }))), /name/);
    });

    test('rejects footprints that are invalid or larger than the room', () => {
        assert.throws(() => loadApartment(apartmentWith(validItem({ cols: 0 }))), /positive integers/);
        assert.throws(() => loadApartment(apartmentWith(validItem({ cols: 5 }))), /does not fit/);
        assert.throws(() => loadApartment(apartmentWith(validItem({ rows: 5 }))), /does not fit/);
    });

    test('rejects a bad height, colour or flat flag', () => {
        assert.throws(() => loadApartment(apartmentWith(validItem({ height: 0 }))), /height/);
        assert.throws(() => loadApartment(apartmentWith(validItem({ color: 'red' }))), /color/);
        assert.throws(() => loadApartment(apartmentWith(validItem({ flat: 'yes' }))), /flat/);
    });
});

describe('shipped apartment.json', () => {
    const apartment = loadApartment(apartmentRaw);

    test('has several placeholder items with at least four different footprint sizes', () => {
        assert.ok(apartment.items.length >= 6);
        const footprints = new Set(apartment.items.map((item) => `${item.cols}x${item.rows}`));
        assert.ok(footprints.size >= 4, `only ${footprints.size} distinct footprints: ${[...footprints].join(', ')}`);
    });

    test('includes a flat item (rug) and a tall item, so depth and layering can be exercised', () => {
        assert.ok(apartment.items.some((item) => item.flat));
        assert.ok(apartment.items.some((item) => item.height >= 100));
    });

    test('every normal item can be in the room at the same time (total footprint fits)', () => {
        const room = apartment.room.cols * apartment.room.rows;
        const used = apartment.items.filter((item) => !item.flat).reduce((sum, item) => sum + item.cols * item.rows, 0);
        assert.ok(used <= room, `normal items need ${used} cells but the room has ${room}`);
    });
});

describe('loadShop and the shipped shop.json', () => {
    test('rejects missing items, duplicate ids, and unnamed items', () => {
        assert.throws(() => loadShop({ items: [] }), /items/);
        assert.throws(() => loadShop({}), /items/);
        assert.throws(() => loadShop({ items: [{ id: 'x', name: '' }] }), /name/);
        assert.throws(() => loadShop({ items: [{ id: 'x', name: 'X' }, { id: 'x', name: 'Y' }] }), /Duplicate/);
    });

    test('the shop is one flat list of labelled items: no clothes, and no category tabs', () => {
        const shop = loadShop(shopRaw);
        assert.ok(shop.items.length > 0, 'needs placeholder items');
        assert.equal(shop.tabs, undefined, 'the shop has no category tabs');
        assert.ok(!JSON.stringify(shop).toLowerCase().includes('cloth'), 'the shop does not sell clothes');
    });
});
