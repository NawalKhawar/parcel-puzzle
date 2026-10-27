/**
 * economy.test.js (data)
 *
 * Tests for the economy DATA: that economy.json passes its validator (and the validator rejects
 * bad config), that the shop price list lines up with the item and wallpaper art files, that the
 * shipped levels have exactly the trucks per day the economy's workload table promises, and that
 * no level data carries money. Also the employer details (Cozy Cargo) shown on the paycheck.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import economyRaw from '../../src/data/economy.json' with { type: 'json' };
import itemsRaw from '../../src/data/items.json' with { type: 'json' };
import wallpapersRaw from '../../src/data/wallpapers.json' with { type: 'json' };
import shapesRaw from '../../src/data/levels.shapes.json' with { type: 'json' };
import levelsRaw from '../../src/data/levels.json' with { type: 'json' };
import companyData from '../../src/data/company.json' with { type: 'json' };
import { loadEconomy, TIER_IDS } from '../../src/data/loadEconomy.js';
import { loadItems } from '../../src/data/loadItems.js';
import { loadWallpapers } from '../../src/data/loadWallpapers.js';
import { loadShapeLevels } from '../../src/data/loadLevel.js';
import { pickDayPuzzles, pickOvertimePuzzle } from '../../src/data/pickDayPuzzles.js';
import { workloadForDay, highestTierForDay } from '../../src/core/economy.js';

const config = loadEconomy(structuredClone(economyRaw));
const items = loadItems(structuredClone(itemsRaw));
const wallpapers = loadWallpapers(structuredClone(wallpapersRaw));
const levels = loadShapeLevels(structuredClone(shapesRaw));

describe('economy.json validation', () => {
    const withChange = (change) => {
        const data = structuredClone(economyRaw);
        change(data);
        return data;
    };

    test('the shipped config is valid', () => {
        assert.doesNotThrow(() => loadEconomy(structuredClone(economyRaw)));
    });

    test('tiers need whole, positive units', () => {
        assert.throws(() => loadEconomy(withChange((d) => { d.tiers.easy.units = 2.5; })), /tier "easy"/);
        assert.throws(() => loadEconomy(withChange((d) => { delete d.tiers.hard; })), /tier "hard"/);
    });

    test('ranks must be numbered in order, start on day 1 and keep rising', () => {
        assert.throws(() => loadEconomy(withChange((d) => { d.ranks[1].rank = 5; })), /rank 2/);
        assert.throws(() => loadEconomy(withChange((d) => { d.ranks[0].startDay = 2; })), /day 1/);
        assert.throws(() => loadEconomy(withChange((d) => { d.ranks[2].startDay = 10; })), /later than/);
        assert.throws(() => loadEconomy(withChange((d) => { d.ranks[0].unitValue = 4.5; })), /unitValue/);
    });

    test('workload ranges must follow on with no gap, and the last must be open-ended', () => {
        assert.throws(() => loadEconomy(withChange((d) => { d.workload[1].fromDay = 4; })), /fromDay/);
        assert.throws(() => loadEconomy(withChange((d) => { d.workload[7].toDay = 60; })), /toDay/);
        assert.throws(() => loadEconomy(withChange((d) => { d.workload[0].trucks[0].tier = 'epic'; })), /unknown tier/);
        assert.throws(() => loadEconomy(withChange((d) => { d.workload[0].trucks[0].count = 0; })), /count/);
    });

    test('bonuses need a unique id, a whole positive amount and an enabled flag', () => {
        assert.throws(() => loadEconomy(withChange((d) => { d.bonuses[1].id = d.bonuses[0].id; })), /duplicate/);
        assert.throws(() => loadEconomy(withChange((d) => { d.bonuses[0].amount = 10.5; })), /amount/);
        assert.throws(() => loadEconomy(withChange((d) => { d.bonuses[0].enabled = 'yes'; })), /enabled/);
    });

    test('hint cost, overtime settings and shop entries are checked', () => {
        assert.throws(() => loadEconomy(withChange((d) => { d.hints.costUnits = 0; })), /costUnits/);
        assert.throws(() => loadEconomy(withChange((d) => { d.overtime.multiplier = 0.5; })), /multiplier/);
        assert.throws(() => loadEconomy(withChange((d) => { d.overtime.enabled = 1; })), /enabled/);
        assert.throws(() => loadEconomy(withChange((d) => { d.overtime.days = [10, 10]; })), /days/);
        assert.throws(() => loadEconomy(withChange((d) => { d.shop[0].price = 12.5; })), /price/);
        assert.throws(() => loadEconomy(withChange((d) => { d.shop[0].unlockDay = 0; })), /unlockDay/);
        assert.throws(() => loadEconomy(withChange((d) => { d.shop[0].category = 'toys'; })), /category/);
        assert.throws(() => loadEconomy(withChange((d) => { d.shop[1].id = d.shop[0].id; })), /duplicate/);
    });

    test('every money amount in the config is a whole number', () => {
        const walk = (value, path) => {
            if (typeof value === 'number' && path.at(-1) !== 'multiplier') {
                assert.ok(Number.isInteger(value), `${path.join('.')} = ${value}`);
            } else if (value && typeof value === 'object') {
                Object.entries(value).forEach(([key, child]) => walk(child, [...path, key]));
            }
        };
        walk(economyRaw, []);
    });
});

describe('the shop lines up with the art files', () => {
    const shopById = new Map(config.shop.map((item) => [item.id, item]));
    const artById = new Map([...items, ...wallpapers].map((entry) => [entry.id, entry]));

    test('every item and wallpaper in the art files has a price in the shop (nothing is unsellable)', () => {
        for (const id of artById.keys()) {
            assert.ok(shopById.has(id), `${id} has art but no shop entry`);
        }
    });

    test('every enabled shop entry has art with the same name and the right kind', () => {
        const wallpaperIds = new Set(wallpapers.map((wallpaper) => wallpaper.id));
        for (const shopEntry of config.shop.filter((entry) => entry.enabled)) {
            const art = artById.get(shopEntry.id);
            assert.ok(art, `${shopEntry.id} is enabled but has no art entry`);
            assert.equal(art.name, shopEntry.name, `${shopEntry.id} name`);
            assert.equal(wallpaperIds.has(shopEntry.id), shopEntry.category === 'wallpaper', `${shopEntry.id} category`);
        }
    });

    test('the placeholder luxury items have no art yet and are all disabled', () => {
        const luxury = config.shop.filter((entry) => entry.category === 'luxury');
        assert.equal(luxury.length, 6);
        for (const entry of luxury) {
            assert.equal(entry.enabled, false, entry.id);
            assert.equal(artById.has(entry.id), false, `${entry.id} should not have art`);
        }
        assert.ok(config.shop.filter((entry) => !entry.enabled).every((entry) => entry.category === 'luxury'));
    });

    test('a bigger version always costs more (mini fridge < fridge, rug < large rug)', () => {
        assert.ok(shopById.get('mini-fridge').price < shopById.get('fridge').price);
        assert.ok(shopById.get('rug').price < shopById.get('large-rug').price);
        assert.ok(shopById.get('mattress').price < shopById.get('bed').price);
    });
});

describe('the shipped levels match the economy workload', () => {
    test('there are levels for days 1-50', () => {
        assert.equal(levels.length, 50);
    });

    test('every day has exactly the trucks per tier the workload promises', () => {
        const mismatches = [];
        levels.forEach((level, index) => {
            const day = index + 1;
            const expected = workloadForDay(day, config);
            const actual = level.trucks.map((slot) => slot.difficulty);
            // Compare per tier (the order of trucks is checked by the day-ordering test below).
            const counts = (list) => TIER_IDS.map((tier) => list.filter((entry) => entry === tier).length).join('/');
            if (counts(expected) !== counts(actual)) {
                mismatches.push(`day ${day}: workload ${counts(expected)} (easy/medium/hard) but level has ${counts(actual)}`);
            }
        });
        assert.deepEqual(mismatches, []);
    });

    test('the plain levels.json data set agrees too', () => {
        const plain = levelsRaw.map((level, index) => {
            const day = index + 1;
            const counts = (list) => TIER_IDS.map((tier) => list.filter((entry) => entry === tier).length).join('/');
            return counts(workloadForDay(day, config)) === counts(level.trucks.map((truck) => truck.difficulty)) ? null : `day ${day}`;
        });
        assert.deepEqual(plain.filter(Boolean), []);
    });

    test('a day, once its puzzles are picked, plays its tiers in the same order as the workload', () => {
        levels.forEach((level, index) => {
            const day = index + 1;
            const played = pickDayPuzzles(level, 0).map((puzzle) => puzzle.difficulty);
            assert.deepEqual(played, workloadForDay(day, config), `day ${day}`);
        });
    });

    test('no level data carries money: pay and bonuses come from economy.json', () => {
        for (const level of levels) {
            assert.equal(level.bonuses, undefined, `${level.id} bonuses`);
        }
        const json = JSON.stringify([shapesRaw, levelsRaw]);
        assert.ok(!json.includes('"reward"') && !json.includes('"bonuses"'));
    });
});

describe('overtime puzzles', () => {
    test('every overtime day has an unused puzzle of the highest tier', () => {
        for (const day of config.overtime.days.filter((entry) => entry <= levels.length)) {
            const level = levels[day - 1];
            const tier = highestTierForDay(day, config);
            for (let playNumber = 0; playNumber < 8; playNumber++) {
                const played = pickDayPuzzles(level, playNumber);
                const extra = pickOvertimePuzzle(level, tier, played, playNumber);
                assert.equal(extra.difficulty, tier, `day ${day}`);
                assert.ok(!played.some((puzzle) => puzzle.id === extra.id), `day ${day} repeats ${extra.id}`);
            }
        }
    });

    test('replaying a day rotates the overtime puzzle', () => {
        const level = levels[9];
        const tier = highestTierForDay(10, config);
        const ids = [0, 1, 2].map((n) => pickOvertimePuzzle(level, tier, pickDayPuzzles(level, n), n).id);
        assert.equal(new Set(ids).size, 3);
    });

    test('a level without an unused puzzle of the tier is an error', () => {
        const tiny = { id: 'tiny', trucks: [{ id: 't', difficulty: 'easy', puzzles: [{ id: 'p1' }] }] };
        assert.throws(() => pickOvertimePuzzle(tiny, 'easy', [{ id: 'p1' }], 0), /no unused/);
        assert.throws(() => pickOvertimePuzzle(tiny, 'hard', [], 0), /no unused/);
    });
});

describe('employer details on the paycheck', () => {
    test('the company is Cozy Cargo, with a department and no tagline', () => {
        assert.equal(companyData.name, 'Cozy Cargo');
        assert.equal(companyData.tagline, undefined, 'the tagline was dropped');
        assert.ok(typeof companyData.department === 'string' && companyData.department.length > 0, 'a department name is needed');
    });
});
