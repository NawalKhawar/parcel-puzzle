/**
 * apartment.test.js
 *
 * Tests for src/data/loadApartment.js: the validation rules, plus checks that the shipped
 * apartment.json (furniture catalog) and shop.json (tabs) match what the design asks for -
 * placeholder furniture of several different sizes, and three shop tabs in the right order.
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
    test('rejects missing tabs, duplicate ids, and unlabelled tabs/items', () => {
        assert.throws(() => loadShop({ tabs: [] }), /tabs/);
        assert.throws(() => loadShop({ tabs: [{ id: 't', label: '', items: [] }] }), /label/);
        assert.throws(() => loadShop({ tabs: [{ id: 't', label: 'T', items: [{ id: 'x', name: '' }] }] }), /name/);
        assert.throws(
            () => loadShop({ tabs: [{ id: 't', label: 'T', items: [{ id: 'x', name: 'X' }, { id: 'x', name: 'Y' }] }] }),
            /Duplicate/
        );
    });

    test('has exactly three tabs - Clothes, Accessories, Decor - in that order, each with labelled items', () => {
        const shop = loadShop(shopRaw);
        assert.deepEqual(shop.tabs.map((tab) => tab.label), ['Clothes', 'Accessories', 'Decor']);
        for (const tab of shop.tabs) {
            assert.ok(tab.items.length > 0, `${tab.label} needs placeholder items`);
        }
    });
});
