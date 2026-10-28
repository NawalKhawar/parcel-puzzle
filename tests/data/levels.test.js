/**
 * levels.test.js
 *
 * Two groups of tests:
 *   1. loadLevel.js validation rules, using small hand-built levels/trucks.
 *   2. The shipped src/data/levels.json against the game design spec: 50 levels (days) -
 *      1: 3E; 2: 4E; 3-5: 3E+1M; 6-10: 2E+2M; 11-15: 1E+3M; 16-19: 2E+3M; 20-24: 1E+4M; 25-29: 2E+2M+1H;
 *      30-39: 1E+3M+1H; 40-50: 1E+3M+2H (E/M/H = easy/medium/hard) - and difficulty never drops within a level. If someone regenerates or hand-edits the data and breaks that shape, these
 *      fail with a message naming the level.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { loadTruck, loadLevel, loadLevels } from '../../src/data/loadLevel.js';
import levelsRaw from '../../src/data/levels.json' with { type: 'json' };

/** A minimal valid truck: a 1x2 board filled by one horizontal domino. */
const validTruck = (overrides = {}) => ({ id: 't1', rows: 1, cols: 2, blocked: [], pieces: ['domino_h'], ...overrides });

describe('loadLevel.js - truck validation', () => {
    test('accepts a minimal valid truck', () => {
        assert.doesNotThrow(() => loadTruck(validTruck()));
    });

    test('rejects pieces whose cell count does not match the open cells', () => {
        assert.throws(() => loadTruck(validTruck({ pieces: ['dot'] })), /must match exactly/);
    });

    test('rejects unknown shape ids', () => {
        assert.throws(() => loadTruck(validTruck({ pieces: ['blob'] })), /unknown shape id "blob"/);
    });

    test('rejects out-of-bounds and duplicate blocked cells', () => {
        assert.throws(() => loadTruck(validTruck({ blocked: [[5, 5]], pieces: ['dot'] })), /out of bounds/);
        assert.throws(() => loadTruck(validTruck({ rows: 2, blocked: [[0, 0], [0, 0]], pieces: ['dot', 'dot'] })), /more than once/);
    });

    test('rejects a bad difficulty or difficultyScore', () => {
        assert.throws(() => loadTruck(validTruck({ difficulty: 'brutal' })), /difficulty/);
        assert.throws(() => loadTruck(validTruck({ difficultyScore: 1.5 })), /difficultyScore/);
    });
});

describe('loadLevel.js - level validation', () => {
    test('accepts a level with valid trucks', () => {
        assert.doesNotThrow(() => loadLevel({ id: 'l1', trucks: [validTruck()] }));
    });

    test('rejects a level with no trucks', () => {
        assert.throws(() => loadLevel({ id: 'l1', trucks: [] }), /non-empty array/);
    });

    test('rejects duplicate truck ids inside a level and across levels', () => {
        assert.throws(() => loadLevel({ id: 'l1', trucks: [validTruck(), validTruck()] }), /duplicate truck id/);
        assert.throws(
            () => loadLevels([{ id: 'a', trucks: [validTruck()] }, { id: 'b', trucks: [validTruck()] }]),
            /Duplicate truck id/
        );
    });

    test('rejects duplicate level ids', () => {
        assert.throws(
            () => loadLevels([{ id: 'a', trucks: [validTruck({ id: 'x' })] }, { id: 'a', trucks: [validTruck({ id: 'y' })] }]),
            /Duplicate level id/
        );
    });
});

describe('shipped levels.json matches the game design spec', () => {
    const levels = loadLevels(levelsRaw);
    const rank = { easy: 0, medium: 1, hard: 2 };

    test('there are exactly 50 levels', () => {
        assert.equal(levels.length, 50);
    });

    // The level plan: [first level, last level, labels in play order].
    const E = 'easy';
    const M = 'medium';
    const H = 'hard';
    const PLAN = [
        [1, 1, [E, E, E]],
        [2, 2, [E, E, E, E]],
        [3, 5, [E, E, E, M]],
        [6, 10, [E, E, M, M]],
        [11, 15, [E, M, M, M]],
        [16, 19, [E, E, M, M, M]],
        [20, 24, [E, M, M, M, M]],
        [25, 29, [E, E, M, M, H]],
        [30, 39, [E, M, M, M, H]],
        [40, 50, [E, M, M, M, H, H]],
    ];

    for (const [first, last, labels] of PLAN) {
        test(`levels ${first}-${last} have ${labels.length} trucks: ${labels.map((l) => l[0].toUpperCase()).join('')}`, () => {
            for (let n = first; n <= last; n++) {
                assert.deepEqual(levels[n - 1].trucks.map((t) => t.difficulty), labels, `level ${n}`);
            }
        });
    }

    test('difficulty never decreases within a level (labels and scores)', () => {
        for (const level of levels) {
            for (let i = 1; i < level.trucks.length; i++) {
                const prev = level.trucks[i - 1];
                const cur = level.trucks[i];
                assert.ok(rank[cur.difficulty] >= rank[prev.difficulty], `${cur.id} label is easier than the truck before it`);
                assert.ok(cur.difficultyScore >= prev.difficultyScore, `${cur.id} score is lower than the truck before it`);
            }
        }
    });

    test('later levels are harder overall than early ones (average score trends upward)', () => {
        const avg = (level) => level.trucks.reduce((sum, t) => sum + t.difficultyScore, 0) / level.trucks.length;
        assert.ok(avg(levels[49]) > avg(levels[29]), 'level 50 should average harder than level 30');
        assert.ok(avg(levels[29]) > avg(levels[14]), 'level 30 should average harder than level 15');
        assert.ok(avg(levels[14]) > avg(levels[7]), 'level 15 should average harder than level 8');
        assert.ok(avg(levels[7]) > avg(levels[1]), 'level 8 should average harder than level 2');
        assert.ok(avg(levels[1]) > avg(levels[0]), 'level 2 should average harder than level 1');
    });

    test('every board is square or portrait (never landscape)', () => {
        for (const level of levels) {
            for (const truck of level.trucks) {
                assert.ok(truck.rows >= truck.cols, `${truck.id} is ${truck.rows}x${truck.cols} (rows x cols), which is landscape`);
            }
        }
    });

    test('no truck carries a reward: pay comes from economy.json', () => {
        for (const level of levels) {
            for (const truck of level.trucks) {
                assert.equal(truck.reward, undefined, `${truck.id} should not have a reward`);
            }
        }
    });
});
