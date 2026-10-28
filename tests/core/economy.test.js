/**
 * economy.test.js (core)
 *
 * Tests for src/core/economy.js, the game's pure money rules, run against the real
 * src/data/economy.json: pay per rank and tier, daily pay, the 50-day totals, promotions,
 * one-off bonuses (paid once, across save/load), hints, overtime, shop purchases, and a
 * simulation of a model player buying out the shop. Also checks that no amount is ever a decimal.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import economyRaw from '../../src/data/economy.json' with { type: 'json' };
import { loadEconomy } from '../../src/data/loadEconomy.js';
import {
    roundUp,
    rankForDay,
    promotionRank,
    payForTruck,
    workloadForDay,
    highestTierForDay,
    dayPay,
    bonusForDay,
    claimBonuses,
    dayStartScreens,
    promotionRaisePercent,
    promotionBreakdown,
    hintCost,
    overtimePay,
    overtimeOffer,
    createEconomyState,
    serializeEconomyState,
    restoreEconomyState,
    addMoney,
    purchaseHint,
    shopStatus,
    purchaseItem,
    simulateShopper,
} from '../../src/core/economy.js';

const config = loadEconomy(structuredClone(economyRaw));

/** Adds up a function over days 1..last. */
const sumDays = (last, fn) => Array.from({ length: last }, (_, i) => fn(i + 1)).reduce((a, b) => a + b, 0);

describe('rounding', () => {
    test('roundUp always goes up to the next whole dollar', () => {
        assert.equal(roundUp(22.5), 23);
        assert.equal(roundUp(73.5), 74);
        assert.equal(roundUp(23), 23);
        assert.equal(roundUp(0.01), 1);
    });

    test('floating-point noise does not push an exact whole number up a dollar', () => {
        assert.equal(roundUp(2.0000000000000004), 2);
        assert.equal(roundUp(15 * 1.2), 18);
        assert.equal(roundUp(0.1 * 3 * 10), 3);
    });
});

describe('pay per rank and tier', () => {
    const table = [
        // day (in the rank), rank, easy, medium, hard
        [1, 1, 10, 15, 35],
        [19, 1, 10, 15, 35],
        [20, 2, 12, 18, 42],
        [39, 2, 12, 18, 42],
        [40, 3, 14, 21, 49],
        [50, 3, 14, 21, 49],
        [200, 3, 14, 21, 49], // pay does not rise after rank 3
    ];
    for (const [day, rank, easy, medium, hard] of table) {
        test(`day ${day} is rank ${rank}: easy $${easy}, medium $${medium}, hard $${hard}`, () => {
            assert.equal(rankForDay(day, config).rank, rank);
            assert.equal(payForTruck('easy', day, config), easy);
            assert.equal(payForTruck('medium', day, config), medium);
            assert.equal(payForTruck('hard', day, config), hard);
        });
    }

    test('rank unit values are $5, $6 and $7 and tiers are worth 2 / 3 / 7 units', () => {
        assert.deepEqual(config.ranks.map((rank) => rank.unitValue), [5, 6, 7]);
        assert.deepEqual([config.tiers.easy.units, config.tiers.medium.units, config.tiers.hard.units], [2, 3, 7]);
    });

    test('an unknown tier is an error', () => {
        assert.throws(() => payForTruck('brutal', 1, config), /unknown truck tier/);
    });
});

describe('promotions', () => {
    test('the player is promoted on starting day 20 (to rank 2) and day 40 (to rank 3), never otherwise', () => {
        const promotedDays = [];
        for (let day = 1; day <= 120; day++) {
            const promotion = promotionRank(day, config);
            if (promotion) {
                promotedDays.push([day, promotion.rank]);
            }
        }
        assert.deepEqual(promotedDays, [[20, 2], [40, 3]]);
    });
});

describe('workload by day', () => {
    const expect = (day, easy, medium, hard) => {
        const tiers = workloadForDay(day, config);
        const count = (tier) => tiers.filter((entry) => entry === tier).length;
        assert.deepEqual([count('easy'), count('medium'), count('hard')], [easy, medium, hard], `day ${day}`);
    };

    test('every band of days has the configured trucks', () => {
        expect(1, 3, 0, 0);
        expect(2, 4, 0, 0);
        for (let day = 3; day <= 5; day++) expect(day, 3, 1, 0);
        for (let day = 6; day <= 10; day++) expect(day, 2, 2, 0);
        for (let day = 11; day <= 15; day++) expect(day, 1, 3, 0);
        for (let day = 16; day <= 19; day++) expect(day, 2, 3, 0);
        for (let day = 20; day <= 24; day++) expect(day, 1, 4, 0);
        for (let day = 25; day <= 29; day++) expect(day, 2, 2, 1);
        for (let day = 30; day <= 39; day++) expect(day, 1, 3, 1);
        for (let day = 40; day <= 50; day++) expect(day, 1, 3, 2);
    });

    test('days past 50 keep the day-40+ pattern', () => {
        for (const day of [51, 75, 120]) expect(day, 1, 3, 2);
    });

    test('a day plays its trucks easiest first', () => {
        assert.deepEqual(workloadForDay(40, config), ['easy', 'medium', 'medium', 'medium', 'hard', 'hard']);
    });

    test('the highest tier of a day', () => {
        assert.equal(highestTierForDay(1, config), 'easy');
        assert.equal(highestTierForDay(10, config), 'medium');
        assert.equal(highestTierForDay(35, config), 'hard');
    });
});

describe('daily pay', () => {
    const expected = { 1: 30, 2: 40, 3: 45, 5: 45, 6: 50, 7: 50, 11: 55, 16: 65, 20: 84, 25: 102, 30: 108, 40: 175 };
    for (const [day, pay] of Object.entries(expected)) {
        test(`day ${day} pays $${pay}`, () => {
            assert.equal(dayPay(Number(day), config), pay);
        });
    }

    test('base pay for days 1-50 totals $4,925', () => {
        assert.equal(sumDays(50, (day) => dayPay(day, config)), 4925);
    });
});

describe('one-off bonuses', () => {
    const required = ['first-day', 'first-week', 'first-month'];

    test('the three required bonuses are $10 on day 1, $50 on day 7 and $100 on day 30', () => {
        const byId = Object.fromEntries(config.bonuses.map((bonus) => [bonus.id, bonus]));
        assert.deepEqual([byId['first-day'].day, byId['first-day'].amount, byId['first-day'].enabled], [1, 10, true]);
        assert.deepEqual([byId['first-week'].day, byId['first-week'].amount, byId['first-week'].enabled], [7, 50, true]);
        assert.deepEqual([byId['first-month'].day, byId['first-month'].amount, byId['first-month'].enabled], [30, 100, true]);
    });

    test('the optional promotion and finale bonuses exist but are switched off', () => {
        const optional = config.bonuses.filter((bonus) => !required.includes(bonus.id));
        assert.deepEqual(optional.map((bonus) => [bonus.day, bonus.amount, bonus.enabled]), [[20, 50, false], [40, 50, false], [50, 250, false]]);
        for (const day of [20, 40, 50]) {
            assert.deepEqual(bonusForDay(day, [], config), [], `day ${day} pays nothing extra while disabled`);
        }
    });

    test('with the three required bonuses ($10 + $50 + $100) the 50 days total $5,085', () => {
        let state = createEconomyState();
        let granted = 0;
        for (let day = 1; day <= 50; day++) {
            state = addMoney(state, dayPay(day, config));
            // Start-of-day bonuses (their own screen) and paycheck bonuses both count.
            for (const when of ['start', 'paycheck']) {
                const claim = claimBonuses(state, day, config, when);
                state = claim.state;
                granted += claim.granted.length;
            }
        }
        assert.equal(granted, 3);
        assert.equal(state.money, 5085);
    });

    test('a bonus is paid only once, even when its day is claimed again', () => {
        let state = createEconomyState();
        const first = claimBonuses(state, 1, config);
        assert.deepEqual(first.granted.map((bonus) => bonus.amount), [10]);
        state = first.state;
        const again = claimBonuses(state, 1, config);
        assert.deepEqual(again.granted, []);
        assert.equal(again.state.money, 10);
    });

    test('a bonus is paid only once across save/load cycles', () => {
        let state = claimBonuses(createEconomyState(), 1, config).state;
        // Save, "close the game", load - several times over, through a real JSON round trip.
        for (let cycle = 0; cycle < 3; cycle++) {
            state = restoreEconomyState(JSON.parse(JSON.stringify(serializeEconomyState(state))));
            const claim = claimBonuses(state, 1, config);
            assert.deepEqual(claim.granted, [], `cycle ${cycle}`);
            state = claim.state;
        }
        assert.equal(state.money, 10);
        assert.deepEqual(state.claimedBonuses, ['first-day']);
        // ...and a later bonus is still paid after a reload (day 7's comes on its own start-of-day screen).
        assert.deepEqual(claimBonuses(state, 7, config, 'start').granted.map((bonus) => bonus.amount), [50]);
    });
});

describe('start-of-day screens: promotion and bonus', () => {
    test('the promotion raise is 20% of starting pay at rank 2 and 40% at rank 3', () => {
        assert.equal(promotionRaisePercent(1, config), 0);
        assert.equal(promotionRaisePercent(19, config), 0);
        assert.equal(promotionRaisePercent(20, config), 20);
        assert.equal(promotionRaisePercent(39, config), 20);
        assert.equal(promotionRaisePercent(40, config), 40);
        assert.equal(promotionRaisePercent(90, config), 40);
    });

    test('the promotion screen text is worked out from the rank pay: $5 -> $6 is 20%, $5 -> $7 is 40%, of the STARTING wage', () => {
        const first = promotionBreakdown(20, config);
        assert.deepEqual([first.oldUnitValue, first.newUnitValue, first.startUnitValue, first.percent], [5, 6, 5, 20]);
        assert.equal(first.headline, 'Your pay is now 20% above your starting wage');
        assert.equal(first.breakdown, '$5 → $6 per unit');
        const second = promotionBreakdown(40, config);
        assert.deepEqual([second.oldUnitValue, second.newUnitValue, second.startUnitValue, second.percent], [6, 7, 5, 40]);
        assert.equal(second.headline, 'Your pay is now 40% above your starting wage');
        assert.equal(second.breakdown, '$6 → $7 per unit');
        // Change the config's pay and the text follows (nothing is typed in).
        const richer = structuredClone(config);
        richer.ranks[1].unitValue = 10;
        assert.equal(promotionBreakdown(20, richer).percent, 100);
    });

    test('days 7 and 30 pay their bonus on a start-of-day screen, day 1 on the paycheck', () => {
        assert.deepEqual(bonusForDay(7, [], config, 'start').map((bonus) => bonus.amount), [50]);
        assert.deepEqual(bonusForDay(7, [], config, 'paycheck'), []);
        assert.deepEqual(bonusForDay(30, [], config, 'start').map((bonus) => bonus.amount), [100]);
        assert.deepEqual(bonusForDay(1, [], config, 'paycheck').map((bonus) => bonus.amount), [10]);
        assert.deepEqual(bonusForDay(1, [], config, 'start'), []);
    });

    test('the screens before a day: promotion on 20 and 40, bonus on 7 and 30, nothing otherwise', () => {
        const screens = {};
        for (let day = 1; day <= 60; day++) {
            const list = dayStartScreens(day, [], config);
            if (list.length > 0) {
                screens[day] = list;
            }
        }
        assert.deepEqual(screens, { 7: ['bonus'], 20: ['promotion'], 30: ['bonus'], 40: ['promotion'] });
    });

    test('a bonus whose screen has been seen is not offered again, and a start bonus with the flag off never shows', () => {
        assert.deepEqual(dayStartScreens(7, ['first-week'], config), []);
        const off = structuredClone(config);
        off.bonuses.find((bonus) => bonus.id === 'first-week').enabled = false;
        assert.deepEqual(dayStartScreens(7, [], off), []);
    });

    test('with the optional promotion bonuses switched on, days 20 and 40 still get just the promotion screen (that bonus is on the paycheck)', () => {
        const on = structuredClone(config);
        for (const bonus of on.bonuses.filter((entry) => entry.id.startsWith('promotion'))) {
            bonus.enabled = true;
        }
        assert.deepEqual(dayStartScreens(20, [], on), ['promotion']);
        assert.deepEqual(bonusForDay(20, [], on, 'paycheck').map((bonus) => bonus.amount), [50]);
    });
});

describe('save data', () => {
    test('a state survives a JSON round trip unchanged', () => {
        const state = { money: 123, claimedBonuses: ['first-day'], ownedItems: ['clock', 'rug'] };
        assert.deepEqual(restoreEconomyState(JSON.parse(JSON.stringify(serializeEconomyState(state)))), state);
    });

    test('malformed saves are rejected', () => {
        assert.throws(() => restoreEconomyState(null), /object/);
        assert.throws(() => restoreEconomyState({ money: 12.5, claimedBonuses: [], ownedItems: [] }), /whole number/);
        assert.throws(() => restoreEconomyState({ money: -1, claimedBonuses: [], ownedItems: [] }), /negative/);
        assert.throws(() => restoreEconomyState({ money: 1, claimedBonuses: 'x', ownedItems: [] }), /claimedBonuses/);
        assert.throws(() => restoreEconomyState({ money: 1, claimedBonuses: [], ownedItems: [3] }), /ownedItems/);
    });

    test('duplicates in a saved list are dropped', () => {
        assert.deepEqual(restoreEconomyState({ money: 0, claimedBonuses: ['a', 'a'], ownedItems: ['b', 'b'] }).claimedBonuses, ['a']);
    });
});

describe('hints', () => {
    test('a paid hint costs 4 units of the rank: $20, $24, $28', () => {
        assert.equal(config.hints.costUnits, 4);
        assert.equal(hintCost(1, config), 20);
        assert.equal(hintCost(19, config), 20);
        assert.equal(hintCost(20, config), 24);
        assert.equal(hintCost(39, config), 24);
        assert.equal(hintCost(40, config), 28);
        assert.equal(hintCost(80, config), 28);
    });

    test('buying a hint takes its price; with too little money it fails and changes nothing', () => {
        const rich = { ...createEconomyState(), money: 40 };
        const bought = purchaseHint(rich, 1, config);
        assert.equal(bought.ok, true);
        assert.equal(bought.state.money, 20);
        assert.equal(rich.money, 40, 'the old state is untouched');

        const poor = { ...createEconomyState(), money: 19 };
        const refused = purchaseHint(poor, 1, config);
        assert.equal(refused.ok, false);
        assert.equal(refused.reason, 'too-expensive');
        assert.equal(refused.state, poor);
        assert.equal(purchaseHint({ ...poor, money: 20 }, 1, config).ok, true, 'exactly enough is enough');
    });
});

describe('overtime', () => {
    const days = [10, 15, 20, 25, 30, 35, 40, 45, 50];

    test('the offer days are a config list', () => {
        assert.deepEqual(config.overtime.days, days);
    });

    test('the extra truck is of the highest tier and pays 1.5x, rounded up', () => {
        const pays = days.map((day) => overtimeOffer(day, config).pay);
        assert.deepEqual(pays, [23, 23, 27, 63, 63, 63, 74, 74, 74]);
        assert.equal(pays.reduce((a, b) => a + b, 0), 484);
        assert.equal(overtimeOffer(10, config).tier, 'medium');
        assert.equal(overtimeOffer(35, config).tier, 'hard');
    });

    test('there is no offer on other days', () => {
        for (let day = 1; day <= 60; day++) {
            if (!days.includes(day)) {
                assert.equal(overtimeOffer(day, config), null, `day ${day}`);
            }
        }
    });

    test('the overtime flag turns the whole thing off', () => {
        const off = structuredClone(config);
        off.overtime.enabled = false;
        for (const day of days) {
            assert.equal(overtimeOffer(day, off), null);
        }
    });

    test('changing the day list changes the offers', () => {
        const custom = structuredClone(config);
        custom.overtime.days = [2];
        assert.equal(overtimeOffer(2, custom).pay, 15, 'easy $10 x 1.5');
        assert.equal(overtimeOffer(10, custom), null);
    });

    test('rounding goes up, never down', () => {
        assert.equal(overtimePay('easy', 1, config), 15);
        assert.equal(overtimePay('medium', 1, config), 23, '22.5 rounds up');
        assert.equal(overtimePay('hard', 40, config), 74, '73.5 rounds up');
    });
});

describe('the shop', () => {
    const enabled = config.shop.filter((item) => item.enabled);

    test('the 24 real items still sum to $2,165, the six luxury items to $3,300, and all 30 to $5,465', () => {
        assert.equal(enabled.length, 24);
        assert.equal(enabled.reduce((sum, item) => sum + item.price, 0), 2165);
        assert.equal(config.shop.length, 30);
        assert.equal(config.shop.filter((item) => item.category === 'luxury').reduce((sum, item) => sum + item.price, 0), 3300);
        assert.equal(config.shop.reduce((sum, item) => sum + item.price, 0), 5465);
    });

    test('the placeholders are the six disabled luxury items', () => {
        const placeholders = config.shop.filter((item) => !item.enabled);
        assert.deepEqual(placeholders.map((item) => [item.id, item.unlockDay, item.price]), [
            ['lux-1', 24, 350], ['lux-2', 28, 400], ['lux-3', 34, 550], ['lux-4', 38, 600], ['lux-5', 42, 650], ['lux-6', 46, 750],
        ]);
    });

    test('unlock days and prices match the design', () => {
        const spec = {
            cream: [1, 15], 'soft-blue': [1, 15], 'soft-green': [1, 15], 'pale-pink': [1, 20],
            'soft-yellow': [3, 25], lavender: [3, 25], sage: [3, 25], 'dusty-rose': [8, 35], 'warm-tan': [8, 35],
            clock: [1, 20], 'poster-sports': [2, 30], 'poster-space': [2, 30], 'photo-frame': [4, 40], rug: [4, 40],
            'tall-plant': [6, 45], 'tall-lamp': [8, 50],
            mattress: [3, 60], 'coffee-table': [10, 90], couch: [12, 150], bookshelf: [14, 150],
            'large-rug': [16, 120], 'mini-fridge': [18, 180], bed: [22, 350], fridge: [32, 600],
        };
        for (const [id, [unlockDay, price]] of Object.entries(spec)) {
            const item = config.shop.find((entry) => entry.id === id);
            assert.deepEqual([item.unlockDay, item.price], [unlockDay, price], id);
        }
        assert.equal(Object.keys(spec).length, 24);
    });

    test('an item cannot be bought before its unlock day', () => {
        const rich = { ...createEconomyState(), money: 10000 };
        const early = purchaseItem(rich, 'bed', 21, config);
        assert.equal(early.ok, false);
        assert.equal(early.reason, 'locked');
        assert.equal(early.state, rich);
        assert.equal(purchaseItem(rich, 'bed', 22, config).ok, true);
    });

    test('an item cannot be bought without enough money, but exactly enough works', () => {
        const state = { ...createEconomyState(), money: 14 };
        const refused = purchaseItem(state, 'cream', 1, config);
        assert.equal(refused.ok, false);
        assert.equal(refused.reason, 'too-expensive');
        const bought = purchaseItem({ ...state, money: 15 }, 'cream', 1, config);
        assert.equal(bought.ok, true);
        assert.equal(bought.state.money, 0);
        assert.deepEqual(bought.state.ownedItems, ['cream']);
    });

    test('purchases are one-time', () => {
        const once = purchaseItem({ ...createEconomyState(), money: 100 }, 'clock', 1, config);
        assert.equal(once.ok, true);
        const twice = purchaseItem(once.state, 'clock', 1, config);
        assert.equal(twice.ok, false);
        assert.equal(twice.reason, 'owned');
        assert.equal(twice.state.money, 80);
    });

    test('disabled placeholder items can never be bought normally', () => {
        const rich = { ...createEconomyState(), money: 10000 };
        assert.equal(shopStatus('lux-1', 50, rich, config), 'disabled');
        assert.equal(purchaseItem(rich, 'lux-1', 50, config).ok, false);
    });

    test('shopStatus reports where each item stands', () => {
        const state = { ...createEconomyState(), money: 20, ownedItems: ['clock'] };
        assert.equal(shopStatus('clock', 1, state, config), 'owned');
        assert.equal(shopStatus('bed', 1, state, config), 'locked');
        assert.equal(shopStatus('rug', 4, state, config), 'too-expensive');
        assert.equal(shopStatus('cream', 1, state, config), 'buyable');
        assert.throws(() => shopStatus('nope', 1, state, config), /unknown shop item/);
    });
});

describe('simulation: a model player buys the cheapest affordable item as soon as possible', () => {
    test('the full 30-item catalogue gets bought out (the day is printed, not asserted - see scripts/simulate-economy.js)', () => {
        const { purchases, finishDay, state } = simulateShopper(config, { includeDisabled: true });
        console.log('\nDay each item is bought (all 30 items, no overtime):');
        for (const purchase of purchases) {
            console.log(`  day ${String(purchase.day).padStart(2)}  ${purchase.id.padEnd(14)} $${purchase.price}`);
        }
        console.log(`  -> catalogue complete on day ${finishDay}, $${state.money} left over`);

        assert.equal(purchases.length, 30);
        assert.ok(finishDay !== null, 'the catalogue is completed at some point');
        assert.equal(new Set(purchases.map((purchase) => purchase.id)).size, 30, 'nothing bought twice');
    });

    test('every purchase respects its unlock day', () => {
        const { purchases } = simulateShopper(config, { includeDisabled: true });
        for (const purchase of purchases) {
            const item = config.shop.find((entry) => entry.id === purchase.id);
            assert.ok(purchase.day >= item.unlockDay, `${purchase.id} bought on day ${purchase.day}, unlocks ${item.unlockDay}`);
        }
    });

    test('the 24 real items alone are bought out no later than the whole catalogue', () => {
        const { finishDay } = simulateShopper(config, { includeDisabled: false });
        console.log(`  (the 24 real items alone are complete on day ${finishDay})`);
        assert.ok(finishDay <= simulateShopper(config, { includeDisabled: true }).finishDay);
    });

    test('taking every overtime offer gets there sooner', () => {
        const withOvertime = simulateShopper(config, { includeDisabled: true, takeOvertime: true });
        const without = simulateShopper(config, { includeDisabled: true });
        assert.ok(withOvertime.finishDay <= without.finishDay);
        console.log(`  catalogue complete on day ${without.finishDay} without overtime, day ${withOvertime.finishDay} taking every overtime`);
    });
});

describe('every amount is a whole number', () => {
    test('pay, bonuses, hints and overtime are integers on every day from 1 to 200', () => {
        for (let day = 1; day <= 200; day++) {
            for (const tier of ['easy', 'medium', 'hard']) {
                assert.ok(Number.isInteger(payForTruck(tier, day, config)), `pay ${tier} day ${day}`);
                assert.ok(Number.isInteger(overtimePay(tier, day, config)), `overtime ${tier} day ${day}`);
            }
            assert.ok(Number.isInteger(dayPay(day, config)), `day pay ${day}`);
            assert.ok(Number.isInteger(hintCost(day, config)), `hint ${day}`);
            const offer = overtimeOffer(day, config);
            if (offer) {
                assert.ok(Number.isInteger(offer.pay), `offer ${day}`);
            }
        }
        for (const item of config.shop) {
            assert.ok(Number.isInteger(item.price), item.id);
        }
        for (const bonus of config.bonuses) {
            assert.ok(Number.isInteger(bonus.amount), bonus.id);
        }
    });

    test('a decimal multiplier still gives whole dollars, rounded up', () => {
        const odd = structuredClone(config);
        odd.overtime.multiplier = 1.1;
        for (let day = 1; day <= 60; day++) {
            for (const tier of ['easy', 'medium', 'hard']) {
                const pay = overtimePay(tier, day, odd);
                assert.ok(Number.isInteger(pay));
                assert.ok(pay >= payForTruck(tier, day, odd) * 1.1 - 1e-9, 'never rounds down');
            }
        }
    });

    test('the wallet refuses decimals and negative additions', () => {
        assert.throws(() => addMoney(createEconomyState(), 2.5), /whole number/);
        assert.throws(() => addMoney(createEconomyState(), -5), /negative/);
        const simState = simulateShopper(config).state;
        assert.ok(Number.isInteger(simState.money));
    });
});
