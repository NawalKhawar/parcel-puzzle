/**
 * pickDayPuzzles.test.js
 *
 * Tests for src/data/pickDayPuzzles.js: how a day's puzzles are chosen from the shape-gated
 * pools - one per truck slot, rotating through each pool on replays, never getting easier
 * during the day - plus a check over every shipped level.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { pickDayPuzzles } from '../../src/data/pickDayPuzzles.js';
import { loadShapeLevels } from '../../src/data/loadLevel.js';
import shapesRaw from '../../src/data/levels.shapes.json' with { type: 'json' };

/** Builds a minimal slot whose pool has the given difficulty scores. */
const slot = (id, difficulty, scores) => ({
    id,
    difficulty,
    puzzles: scores.map((score, index) => ({ id: `${id}-p${index + 1}`, difficulty, difficultyScore: score })),
});

describe('pickDayPuzzles - rotation', () => {
    const level = {
        id: 'L',
        trucks: [slot('t1', 'easy', [0.05, 0.08, 0.1]), slot('t2', 'easy', [0.12, 0.2]), slot('t3', 'medium', [0.4, 0.5, 0.55])],
    };
    const ids = (playNumber) => pickDayPuzzles(level, playNumber).map((p) => p.id);

    test('the first play (0, or no argument) uses the first puzzle of every pool', () => {
        assert.deepEqual(ids(0), ['t1-p1', 't2-p1', 't3-p1']);
        assert.deepEqual(pickDayPuzzles(level).map((p) => p.id), ['t1-p1', 't2-p1', 't3-p1']);
    });

    test('each replay moves on to the next puzzle in every pool', () => {
        assert.deepEqual(ids(1), ['t1-p2', 't2-p2', 't3-p2']);
        // Third play: t1 -> p3, t2 (only 2 puzzles) wraps back to p1, t3 -> p3.
        assert.deepEqual(ids(2), ['t1-p3', 't2-p1', 't3-p3']);
    });

    test('each pool wraps around on its own once it runs out (pools may differ in size)', () => {
        // After 3 plays: t1 (3 puzzles) is back at p1, t2 (2 puzzles) is at p2 (3 % 2 = 1), t3 (3) at p1.
        assert.deepEqual(ids(3), ['t1-p1', 't2-p2', 't3-p1']);
    });

    test('every puzzle in a pool is used exactly once before any repeats', () => {
        const seen = [0, 1, 2].map((n) => ids(n)[0]);
        assert.deepEqual(new Set(seen).size, 3, 'three plays of a three-puzzle pool give three different puzzles');
    });

    test('returns exactly one puzzle per slot, each from its own slot pool', () => {
        for (let play = 0; play < 6; play++) {
            const picked = pickDayPuzzles(level, play);
            assert.equal(picked.length, level.trucks.length);
            for (const puzzle of picked) {
                const owner = level.trucks.find((truck) => puzzle.id.startsWith(`${truck.id}-`));
                assert.ok(owner && owner.puzzles.includes(puzzle), `${puzzle.id} comes from its slot's pool`);
            }
        }
    });

    test('a negative or oversized count still lands inside the pool', () => {
        assert.equal(pickDayPuzzles(level, -1).length, 3);
        assert.equal(pickDayPuzzles(level, 1000).length, 3);
    });

    test('puzzles are ordered easiest to hardest, even when a later slot picks an easier one', () => {
        const overlapping = {
            id: 'L',
            trucks: [slot('a', 'easy', [0.1]), slot('b', 'easy', [0.06])],
        };
        assert.deepEqual(pickDayPuzzles(overlapping, 0).map((p) => p.difficultyScore), [0.06, 0.1]);
    });

    test('does not modify the level data', () => {
        const before = JSON.stringify(level);
        pickDayPuzzles(level, 2);
        assert.equal(JSON.stringify(level), before);
    });
});

describe('pickDayPuzzles over the shipped shape-gated levels', () => {
    const levels = loadShapeLevels(shapesRaw);

    test('any play number keeps the day easy -> medium -> hard, never dropping in difficulty', () => {
        const rank = { easy: 0, medium: 1, hard: 2 };
        for (const level of levels) {
            for (let play = 0; play < 12; play++) {
                const picked = pickDayPuzzles(level, play);
                assert.equal(picked.length, level.trucks.length, `${level.id} truck count`);
                for (let i = 1; i < picked.length; i++) {
                    assert.ok(rank[picked[i].difficulty] >= rank[picked[i - 1].difficulty], `${level.id} play ${play}: label dropped at truck ${i + 1}`);
                    assert.ok(picked[i].difficultyScore >= picked[i - 1].difficultyScore, `${level.id} play ${play}: score dropped at truck ${i + 1}`);
                }
                assert.deepEqual(
                    picked.map((p) => p.difficulty),
                    level.trucks.map((slotEntry) => slotEntry.difficulty),
                    `${level.id} play ${play}: label order`
                );
            }
        }
    });

    test('replaying a level five times shows five different puzzles in every slot, then repeats', () => {
        for (const level of levels) {
            level.trucks.forEach((slotEntry) => {
                const seen = new Set();
                for (let play = 0; play < slotEntry.puzzles.length; play++) {
                    // Find this slot's pick for this play (day order is sorted, so look it up by id prefix).
                    const pick = pickDayPuzzles(level, play).find((p) => p.id.startsWith(`${slotEntry.id}-`));
                    seen.add(pick.id);
                }
                assert.equal(seen.size, slotEntry.puzzles.length, `${slotEntry.id} should show every pool puzzle once`);
            });
        }
    });

    test('every picked puzzle only uses shapes its level allows', () => {
        for (const level of levels) {
            for (let play = 0; play < 5; play++) {
                for (const puzzle of pickDayPuzzles(level, play)) {
                    assert.ok(puzzle.pieces.every((id) => level.allowedShapes.includes(id)), `${puzzle.id}`);
                }
            }
        }
    });
});
