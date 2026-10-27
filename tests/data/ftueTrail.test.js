/**
 * ftueTrail.test.js (data)
 *
 * The first-day trail makes the player buy the clock and hang it on the wall. These tests check that
 * the shipped data actually supports that: the clock is on sale from day 1, has art and a wall spot,
 * and the first day's earnings pay for it (otherwise the shop would hold a new player hostage).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import economyRaw from '../../src/data/economy.json' with { type: 'json' };
import itemsRaw from '../../src/data/items.json' with { type: 'json' };
import { loadEconomy } from '../../src/data/loadEconomy.js';
import { loadItems } from '../../src/data/loadItems.js';
import { dayPay, bonusForDay, createEconomyState, shopStatus, addMoney } from '../../src/core/economy.js';
import { FTUE_ITEM_ID } from '../../src/core/ftueTrail.js';
import { RoomLayout } from '../../src/core/RoomLayout.js';
import { WALL_ROWS, ROOM_W } from '../../src/core/roomConfig.js';

const config = loadEconomy(structuredClone(economyRaw));
const items = loadItems(structuredClone(itemsRaw));

describe('the first-day trail item', () => {
    const entry = config.shop.find((shopEntry) => shopEntry.id === FTUE_ITEM_ID);
    const def = items.find((item) => item.id === FTUE_ITEM_ID);

    test('is an enabled shop item unlocked on day 1, with a catalogue entry', () => {
        assert.ok(entry, 'in the shop list');
        assert.equal(entry.enabled, true);
        assert.equal(entry.unlockDay, 1);
        assert.ok(def, 'in items.json');
    });

    test('is affordable from the first day\'s pay and bonuses (so the shop can never trap a new player)', () => {
        const paycheckBonuses = bonusForDay(1, [], config).reduce((sum, bonus) => sum + bonus.amount, 0);
        const startBonuses = bonusForDay(1, [], config, 'start').reduce((sum, bonus) => sum + bonus.amount, 0);
        const wallet = addMoney(createEconomyState(), dayPay(1, config) + paycheckBonuses + startBonuses);
        assert.equal(shopStatus(FTUE_ITEM_ID, 1, wallet, config), 'buyable', `wallet $${wallet.money}, price $${entry.price}`);
    });

    test('can be hung on the wall of an empty room (the apartment hand-cursor needs a spot)', () => {
        const room = new RoomLayout();
        let found = false;
        for (let x = 0; x < ROOM_W && !found; x++)
        {
            for (let y = 0; y < WALL_ROWS && !found; y++)
            {
                found = room.canPlace(def, x, y);
            }
        }
        assert.ok(found, 'a legal wall spot exists');
    });
});
