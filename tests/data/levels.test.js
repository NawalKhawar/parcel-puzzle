/**
 * levels.test.js
 *
 * Two groups of tests:
 *   1. loadLevel.js validation rules, using small hand-built levels/trucks.
 *   2. The shipped src/data/levels.json against the game design spec: 30 levels (days);
 *      level 1 has 3 easy trucks; levels 2-7 have 4 (2 easy, 2 medium); levels 8-12 have
 *      5 (2 easy, 2 medium, 1 hard); levels 13-30 have 6 (2 easy, 2 medium, 2 hard); difficulty never drops within a
 *      level. If someone regenerates or hand-edits the data and breaks that shape, these
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

    test('rejects a bad difficulty, difficultyScore or reward', () => {
        assert.throws(() => loadTruck(validTruck({ difficulty: 'brutal' })), /difficulty/);
        assert.throws(() => loadTruck(validTruck({ difficultyScore: 1.5 })), /difficultyScore/);
        assert.throws(() => loadTruck(validTruck({ reward: 0 })), /reward/);
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

    test('there are exactly 30 levels', () => {
        assert.equal(levels.length, 30);
    });

    // Expected difficulty labels per level, in play order.
    const expectedLabels = (levelNumber) => {
        if (levelNumber === 1) return ['easy', 'easy', 'easy'];
        if (levelNumber <= 7) return ['easy', 'easy', 'medium', 'medium'];
        if (levelNumber <= 12) return ['easy', 'easy', 'medium', 'medium', 'hard'];
        return ['easy', 'easy', 'medium', 'medium', 'hard', 'hard'];
    };

    test('level 1 has 3 easy trucks', () => {
        assert.deepEqual(levels[0].trucks.map((t) => t.difficulty), expectedLabels(1));
    });

    test('levels 2-7 have 4 trucks: 2 easy then 2 medium', () => {
        for (let n = 2; n <= 7; n++) {
            assert.deepEqual(levels[n - 1].trucks.map((t) => t.difficulty), expectedLabels(n), `level ${n}`);
        }
    });

    test('levels 8-12 have 5 trucks: 2 easy, 2 medium, 1 hard', () => {
        for (let n = 8; n <= 12; n++) {
            assert.deepEqual(levels[n - 1].trucks.map((t) => t.difficulty), expectedLabels(n), `level ${n}`);
        }
    });

    test('levels 13-30 have 6 trucks: 2 easy, 2 medium, 2 hard', () => {
        for (let n = 13; n <= 30; n++) {
            assert.deepEqual(levels[n - 1].trucks.map((t) => t.difficulty), expectedLabels(n), `level ${n}`);
        }
    });

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
        assert.ok(avg(levels[29]) > avg(levels[7]), 'level 30 should average harder than level 8');
        assert.ok(avg(levels[7]) > avg(levels[1]), 'level 8 should average harder than level 2');
        assert.ok(avg(levels[1]) > avg(levels[0]), 'level 2 should average harder than level 1');
    });

    test('every truck has a positive integer reward', () => {
        for (const level of levels) {
            for (const truck of level.trucks) {
                assert.ok(Number.isInteger(truck.reward) && truck.reward > 0, `${truck.id} needs a reward`);
            }
        }
    });
});
