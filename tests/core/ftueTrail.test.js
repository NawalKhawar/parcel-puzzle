/**
 * ftueTrail.test.js
 *
 * The first-day trail (paycheck -> shop -> apartment) must lead the player on without ever locking
 * them in: each step is derived from what they own, and an unbuyable clock skips the trail.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ftueTrailStage, FTUE_ITEM_ID } from '../../src/core/ftueTrail.js';

const base = { day: 1, ownedItems: [], clockBuyable: true, decorateVisited: false };

describe('ftueTrailStage', () => {
    test('day 1, nothing bought yet: the shop step', () => {
        assert.equal(ftueTrailStage(base), 'shop');
    });

    test('the clock bought but the apartment not visited: the decorate step', () => {
        assert.equal(ftueTrailStage({ ...base, ownedItems: [FTUE_ITEM_ID], clockBuyable: false }), 'decorate');
    });

    test('the clock bought and the apartment visited: the trail is over', () => {
        assert.equal(ftueTrailStage({ ...base, ownedItems: [FTUE_ITEM_ID], clockBuyable: false, decorateVisited: true }), 'free');
    });

    test('buying other things does not count as buying the clock', () => {
        assert.equal(ftueTrailStage({ ...base, ownedItems: ['rug', 'poster-sports'] }), 'shop');
    });

    test('a clock that cannot be bought skips the trail, so nobody is locked in the shop', () => {
        assert.equal(ftueTrailStage({ ...base, clockBuyable: false }), 'free');
    });

    test('a skipped tutorial has no trail at any step', () => {
        assert.equal(ftueTrailStage({ ...base, skipped: true }), 'free');
        assert.equal(ftueTrailStage({ ...base, skipped: true, ownedItems: [FTUE_ITEM_ID], clockBuyable: false }), 'free');
    });

    test('only day 1 has a trail', () => {
        for (const day of [2, 3, 10, 50])
        {
            assert.equal(ftueTrailStage({ ...base, day }), 'free', `day ${day}`);
            assert.equal(ftueTrailStage({ ...base, day, ownedItems: [FTUE_ITEM_ID], clockBuyable: false }), 'free', `day ${day}`);
        }
    });
});
