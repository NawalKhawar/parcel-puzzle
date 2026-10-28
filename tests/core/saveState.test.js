/**
 * saveState.test.js
 *
 * The save format's safety net: whatever is in storage - missing fields, wrong types, a newer
 * version, garbage - mergeSave must hand back either a complete valid state or null, and never throw.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { defaultSaveState, mergeSave, SAVE_VERSION, TIP_FLAGS } from '../../src/core/saveState.js';

/** A realistic mid-game save. */
function sampleSave()
{
    return {
        v: 1,
        day: 12,
        money: 340,
        ownedItems: ['item-a', 'item-b'],
        claimedBonuses: ['first-day'],
        rank: 1,
        placedItems: [{ id: 'item-a', x: 3, y: 4 }],
        wallpaper: 'wall-blue',
        muted: { music: true, sfx: false },
        seenIntro: true,
        tips: { workloadTipDone: true, hintTipDone: true },
    };
}

describe('mergeSave - good saves', () => {
    test('a complete save comes back unchanged (plus every tip flag filled in)', () => {
        const merged = mergeSave(sampleSave());
        assert.equal(merged.day, 12);
        assert.equal(merged.money, 340);
        assert.deepEqual(merged.ownedItems, ['item-a', 'item-b']);
        assert.deepEqual(merged.placedItems, [{ id: 'item-a', x: 3, y: 4 }]);
        assert.deepEqual(merged.muted, { music: true, sfx: false });
        assert.equal(merged.tips.workloadTipDone, true);
        assert.equal(merged.tips.shopVisited, false, 'a tip flag the save does not mention defaults to false');
    });

    test('survives a JSON round trip', () => {
        const merged = mergeSave(JSON.parse(JSON.stringify(sampleSave())));
        assert.equal(merged.money, 340);
    });

    test('the red-dot "seen" list and the phone room arrangement are saved, and an older save counts what it owns as seen', () => {
        const merged = mergeSave({ ...sampleSave(), seenItems: ['item-a'], placedItemsPortrait: [{ id: 'item-b', x: 2, y: 6 }] });
        assert.deepEqual(merged.seenItems, ['item-a']);
        assert.deepEqual(merged.placedItemsPortrait, [{ id: 'item-b', x: 2, y: 6 }]);
        const older = mergeSave(sampleSave()); // no seenItems / placedItemsPortrait fields
        assert.deepEqual(older.seenItems, ['item-a', 'item-b'], 'nothing owned shows as new after an upgrade');
        assert.deepEqual(older.placedItemsPortrait, []);
        assert.deepEqual(mergeSave({ v: 1, ownedItems: ['x'], seenItems: 'oops' }).seenItems, [], 'a damaged list is reset');
    });

    test('the new-game defaults are themselves a valid save', () => {
        assert.deepEqual(mergeSave(defaultSaveState()), defaultSaveState());
    });
});

describe('progress inside a day (trucks packed)', () => {
    const lines = [{ tier: 'easy', amount: 30 }, { tier: 'medium', amount: 50 }];

    test('a new game and a save without the fields start the day from its first truck', () => {
        assert.equal(defaultSaveState().truck, 0);
        assert.deepEqual(defaultSaveState().truckLog, []);
        const merged = mergeSave(sampleSave());
        assert.equal(merged.truck, 0);
        assert.deepEqual(merged.truckLog, []);
    });

    test('packed trucks and their pay lines survive a round trip', () => {
        const merged = mergeSave(JSON.parse(JSON.stringify({ ...sampleSave(), truck: 2, truckLog: lines })));
        assert.equal(merged.truck, 2);
        assert.deepEqual(merged.truckLog, lines);
    });

    test('the truck count and the pay lines always agree', () => {
        // more trucks claimed than there are lines for: only the lines are evidence
        assert.equal(mergeSave({ ...sampleSave(), truck: 5, truckLog: lines }).truck, 2);
        // more lines than trucks: the extras are dropped
        const fewer = mergeSave({ ...sampleSave(), truck: 1, truckLog: lines });
        assert.equal(fewer.truck, 1);
        assert.deepEqual(fewer.truckLog, [lines[0]]);
    });

    test('bad values fall back, and overtime / unknown fields on a line are not kept', () => {
        assert.equal(mergeSave({ ...sampleSave(), truck: -1, truckLog: lines }).truck, 0);
        assert.equal(mergeSave({ ...sampleSave(), truck: 'two', truckLog: lines }).truck, 0);
        const messy = mergeSave({ ...sampleSave(), truck: 3, truckLog: [{ tier: 'easy', amount: 30, overtime: true }, { tier: '', amount: 5 }, { tier: 'hard', amount: -4 }, null, { tier: 'hard', amount: 80 }] });
        assert.deepEqual(messy.truckLog, [{ tier: 'easy', amount: 30 }, { tier: 'hard', amount: 80 }]);
        assert.equal(messy.truck, 2);
        assert.deepEqual(mergeSave({ ...sampleSave(), truck: 1, truckLog: 'nope' }).truckLog, []);
    });

    test('the old per-day fields are not part of the format', () => {
        const merged = mergeSave({ ...sampleSave(), trucksDoneToday: 2, hintUsedToday: true });
        assert.equal('trucksDoneToday' in merged, false);
        assert.equal('hintUsedToday' in merged, false);
    });
});

describe('the tutorial-skip flags', () => {
    test('are tip flags, saved and restored like the others', () => {
        assert.ok(TIP_FLAGS.includes('skipOffered') && TIP_FLAGS.includes('tutorialSkipped'));
        const merged = mergeSave({ v: 1, tips: { skipOffered: true, tutorialSkipped: true } });
        assert.equal(merged.tips.skipOffered, true);
        assert.equal(merged.tips.tutorialSkipped, true);
    });

    test('an older save without them gives a first-time-style player (no skip offered, nothing skipped)', () => {
        const merged = mergeSave({ v: 1, day: 4, tips: { workloadTipDone: true } });
        assert.equal(merged.tips.skipOffered, false);
        assert.equal(merged.tips.tutorialSkipped, false);
    });
});

describe('mergeSave - missing and new fields fall back to defaults', () => {
    test('a save with only a version gets the whole default state', () => {
        assert.deepEqual(mergeSave({ v: 1 }), defaultSaveState());
    });

    test('a save from before a field existed keeps its own data and defaults the rest', () => {
        const old = { v: 1, day: 5, money: 99 };
        const merged = mergeSave(old);
        assert.equal(merged.day, 5);
        assert.equal(merged.money, 99);
        assert.deepEqual(merged.ownedItems, []);
        assert.equal(merged.seenIntro, false);
        assert.deepEqual(merged.muted, { music: false, sfx: false });
    });

    test('unknown extra fields are ignored, not carried', () => {
        const merged = mergeSave({ v: 1, day: 2, futureThing: 'x' });
        assert.equal('futureThing' in merged, false);
    });
});

describe('mergeSave - rejects what it cannot trust', () => {
    test('anything that is not an object is no save', () => {
        for (const bad of [null, undefined, 42, 'text', true, [], [1, 2]])
        {
            assert.equal(mergeSave(bad), null, `input ${JSON.stringify(bad)}`);
        }
    });

    test('a missing or nonsense version is no save', () => {
        for (const v of [undefined, null, 0, -1, 1.5, '1', NaN, {}, []])
        {
            assert.equal(mergeSave({ v, day: 3 }), null, `v = ${JSON.stringify(v)}`);
        }
    });

    test('a save from a NEWER version is ignored', () => {
        assert.equal(mergeSave({ ...sampleSave(), v: SAVE_VERSION + 1 }), null);
    });
});

describe('mergeSave - bad fields are replaced individually', () => {
    test('wrong-typed numbers fall back to their defaults', () => {
        const merged = mergeSave({ v: 1, day: 'five', money: '300', rank: null });
        assert.equal(merged.day, 1);
        assert.equal(merged.money, 0);
        assert.equal(merged.rank, 1);
    });

    test('negative, fractional and non-finite numbers are rejected', () => {
        for (const bad of [-5, 2.5, NaN, Infinity, -Infinity])
        {
            assert.equal(mergeSave({ v: 1, money: bad }).money, 0, `money ${bad}`);
            assert.equal(mergeSave({ v: 1, day: bad }).day, 1, `day ${bad}`);
        }
        assert.equal(mergeSave({ v: 1, day: 0 }).day, 1, 'day 0 does not exist');
    });

    test('a day beyond the last level is capped to it', () => {
        assert.equal(mergeSave({ v: 1, day: 999 }, { maxDay: 50 }).day, 50);
        assert.equal(mergeSave({ v: 1, day: 49 }, { maxDay: 50 }).day, 49);
    });

    test('arrays that are not arrays become empty', () => {
        const merged = mergeSave({ v: 1, ownedItems: 'rug', claimedBonuses: { a: 1 }, placedItems: 7 });
        assert.deepEqual(merged.ownedItems, []);
        assert.deepEqual(merged.claimedBonuses, []);
        assert.deepEqual(merged.placedItems, []);
    });

    test('bad entries are dropped from a list but the good ones stay, without duplicates', () => {
        const merged = mergeSave({ v: 1, ownedItems: ['a', 5, '', null, 'a', 'b'] });
        assert.deepEqual(merged.ownedItems, ['a', 'b']);
    });

    test('placed items need a text id and whole-number x and y; repeats of an id keep the first', () => {
        const merged = mergeSave({
            v: 1,
            placedItems: [
                { id: 'ok', x: 1, y: 2 },
                { id: 'ok', x: 9, y: 9 },
                { id: 'frac', x: 1.5, y: 2 },
                { id: 'str', x: '1', y: 2 },
                { x: 1, y: 2 },
                'junk',
                null,
            ],
        });
        assert.deepEqual(merged.placedItems, [{ id: 'ok', x: 1, y: 2 }]);
    });

    test('flags must be exactly true: the text "true" or the number 1 do not count', () => {
        const merged = mergeSave({ v: 1, seenIntro: 'true', muted: { music: 'yes', sfx: true } });
        assert.equal(merged.seenIntro, false);
        assert.deepEqual(merged.muted, { music: false, sfx: true });
    });

    test('a non-object muted / tips is ignored', () => {
        const merged = mergeSave({ v: 1, muted: true, tips: 'all' });
        assert.deepEqual(merged.muted, { music: false, sfx: false });
        for (const name of TIP_FLAGS)
        {
            assert.equal(merged.tips[name], false);
        }
    });

    test('wallpaper must be non-empty text, else null', () => {
        assert.equal(mergeSave({ v: 1, wallpaper: 'wall-blue' }).wallpaper, 'wall-blue');
        for (const bad of [5, '', {}, false])
        {
            assert.equal(mergeSave({ v: 1, wallpaper: bad }).wallpaper, null);
        }
    });

    test('never throws, whatever it is given', () => {
        const nasty = [
            { v: 1, day: {}, money: [], ownedItems: [[]], placedItems: [[], {}, { id: {} }], muted: [], tips: [] },
            { v: 1, __proto__: { day: 3 } },
            { v: 1, toString: 5 },
        ];
        for (const input of nasty)
        {
            assert.doesNotThrow(() => mergeSave(input));
        }
    });
});
