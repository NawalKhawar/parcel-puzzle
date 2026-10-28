/**
 * badges.test.js
 *
 * Tests for src/core/badges.js: when the red dots show on the Shop / Decorate buttons and the shop tabs.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import economyRaw from '../../src/data/economy.json' with { type: 'json' };
import { loadEconomy } from '../../src/data/loadEconomy.js';
import { createEconomyState } from '../../src/core/economy.js';
import { shopHasBuyable, unseenItems, apartmentHasNew } from '../../src/core/badges.js';

const config = loadEconomy(structuredClone(economyRaw));
const wallet = (money, ownedItems = []) => ({ ...createEconomyState(), money, ownedItems });

describe('shop dot', () => {
    test('no dot with an empty wallet, a dot as soon as the cheapest unlocked item is affordable', () => {
        assert.equal(shopHasBuyable(1, wallet(0), config), false);
        assert.equal(shopHasBuyable(1, wallet(14), config), false);
        assert.equal(shopHasBuyable(1, wallet(15), config), true, 'a $15 wallpaper is unlocked on day 1');
    });

    test('items that are locked, owned or disabled never count, however rich the player is', () => {
        // Day 1 with a fortune: only the day-1 items (and not the disabled luxury ones) can be bought.
        assert.equal(shopHasBuyable(1, wallet(100000), config), true);
        const ownsAllDay1 = config.shop.filter((item) => item.enabled && item.unlockDay <= 1).map((item) => item.id);
        assert.equal(shopHasBuyable(1, wallet(100000, ownsAllDay1), config), false, 'nothing left that is unlocked');
        const ownsEverything = config.shop.filter((item) => item.enabled).map((item) => item.id);
        assert.equal(shopHasBuyable(50, wallet(100000, ownsEverything), config), false, 'luxury items are disabled');
    });

    test('a tab only lights up for its own category', () => {
        // $20 on day 1: wallpapers ($15) and the clock (decor, $20) are affordable; furniture is not unlocked.
        const state = wallet(20);
        assert.equal(shopHasBuyable(1, state, config, ['wallpaper']), true);
        assert.equal(shopHasBuyable(1, state, config, ['decor', 'furniture', 'luxury']), true, 'the clock');
        // Own the clock and every wallpaper: no decor left on day 1, so only the wallpaper tab is dark too.
        const owned = config.shop.filter((item) => item.unlockDay <= 1 && item.enabled).map((item) => item.id);
        assert.equal(shopHasBuyable(1, wallet(20, owned), config, ['wallpaper']), false);
        // Furniture is locked on day 1 (the mattress unlocks on day 3).
        assert.equal(shopHasBuyable(1, wallet(1000), config, ['furniture']), false);
        assert.equal(shopHasBuyable(3, wallet(1000), config, ['furniture']), true);
    });
});

describe('apartment dot', () => {
    test('something owned and not yet seen lights the dot; once seen it goes out', () => {
        assert.equal(apartmentHasNew([], []), false);
        assert.equal(apartmentHasNew(['clock'], []), true);
        assert.equal(apartmentHasNew(['clock'], ['clock']), false);
        assert.equal(apartmentHasNew(['clock', 'rug'], ['clock']), true, 'a later purchase is new again');
    });

    test('unseenItems keeps purchase order and ignores seen ids that are no longer owned', () => {
        assert.deepEqual(unseenItems(['a', 'b', 'c'], ['b', 'zzz']), ['a', 'c']);
    });
});
