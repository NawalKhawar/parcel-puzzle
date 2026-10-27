/**
 * shapeLevels.test.js
 *
 * Tests for the shape-gated puzzle pool (src/data/levels.shapes.json), a second data set with
 * the same level structure as levels.json but where piece shapes are introduced gradually:
 *   - level 1 starts with just the dot and the square;
 *   - then one new shape at a time: every 3 levels (domino_h 3, domino_v 6, tri_i 9, bar4 12), every 4
 *     (tri_l 16, l4 20, t4 24, s4 28), then every 5 (p5 33, plus 38) - so all 12 are in play from level 38;
 *   - the number of trucks per day and the easy/medium/hard mix match levels.json;
 *   - each truck slot holds a pool of 5 puzzles, and every one is solvable.
 * Also covers the loadShapeLevels validator with small hand-built data.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { loadShapeLevels, loadLevels, createGridForTruck } from '../../src/data/loadLevel.js';
import { solve } from '../../src/core/Solver.js';
import shapesRaw from '../../src/data/levels.shapes.json' with { type: 'json' };
import levelsRaw from '../../src/data/levels.json' with { type: 'json' };

/** The shapes available from level 1. */
const START = ['dot', 'square'];
/** [level, shape] for every unlock, in order. */
const UNLOCKS = [
    [3, 'domino_h'], [6, 'domino_v'], [9, 'tri_i'], [12, 'bar4'], [16, 'tri_l'],
    [20, 'l4'], [24, 't4'], [28, 's4'], [33, 'p5'], [38, 'plus'],
];
const POOL_SIZE = 5;

/** A tiny valid shape level to mutate in the validator tests: a 1x2 board and a domino. */
const validLevel = () => ({
    id: 'L1',
    newShapes: [],
    allowedShapes: ['dot', 'domino_h'],
    trucks: [
        {
            id: 'L1-T1',
            difficulty: 'easy',
            puzzles: [{ id: 'L1-T1-p1', rows: 1, cols: 2, blocked: [], pieces: ['domino_h'], difficulty: 'easy' }],
        },
    ],
});

describe('loadShapeLevels - validation', () => {
    test('accepts a minimal valid shape level', () => {
        assert.doesNotThrow(() => loadShapeLevels([validLevel()]));
    });

    test('rejects a puzzle that uses a shape its level does not allow', () => {
        const level = validLevel();
        level.allowedShapes = ['dot']; // domino_h no longer allowed
        assert.throws(() => loadShapeLevels([level]), /does not allow/);
    });

    test('rejects a puzzle whose difficulty differs from its slot', () => {
        const level = validLevel();
        level.trucks[0].puzzles[0].difficulty = 'hard';
        assert.throws(() => loadShapeLevels([level]), /does not match/);
    });

    test('rejects duplicate ids, unknown shapes, a new shape that is not allowed, and empty pools', () => {
        const dup = validLevel();
        dup.trucks[0].puzzles.push({ ...dup.trucks[0].puzzles[0] });
        assert.throws(() => loadShapeLevels([dup]), /Duplicate id/);

        const unknown = validLevel();
        unknown.allowedShapes = ['blob'];
        assert.throws(() => loadShapeLevels([unknown]), /unknown shape id/);

        const notAllowed = validLevel();
        notAllowed.newShapes = ['square'];
        assert.throws(() => loadShapeLevels([notAllowed]), /must also be in/);

        const empty = validLevel();
        empty.trucks[0].puzzles = [];
        assert.throws(() => loadShapeLevels([empty]), /non-empty/);
    });

    test('still enforces the normal puzzle rules (cell count must match the board)', () => {
        const level = validLevel();
        level.trucks[0].puzzles[0].pieces = ['dot'];
        assert.throws(() => loadShapeLevels([level]), /must match exactly/);
    });
});

describe('shipped levels.shapes.json - shape progression', () => {
    const levels = loadShapeLevels(shapesRaw);

    // Which shapes each level is expected to allow, following the unlock plan.
    const expectedAllowed = (levelNumber) => [...START, ...UNLOCKS.filter(([from]) => from <= levelNumber).map(([, shape]) => shape)];

    test('there are 50 levels', () => {
        assert.equal(levels.length, 50);
    });

    test('levels 1 and 2 only allow (and only use) the dot and the square', () => {
        for (const level of levels.slice(0, 2)) {
            assert.deepEqual(level.allowedShapes, START, `${level.id} allowed shapes`);
            assert.deepEqual(level.newShapes, [], `${level.id} introduces nothing`);
            for (const puzzle of level.trucks.flatMap((slot) => slot.puzzles)) {
                assert.ok(puzzle.pieces.every((id) => START.includes(id)), `${puzzle.id} must only use the dot and square`);
            }
        }
    });

    test('exactly one shape is introduced at a time: every 3 levels, then every 4, then every 5, in the planned order', () => {
        const introductions = levels.map((level, index) => [index + 1, level.newShapes]).filter(([, shapes]) => shapes.length > 0);
        assert.deepEqual(introductions, UNLOCKS.map(([level, shape]) => [level, [shape]]));
    });

    test('all 12 shapes are in play from level 38', () => {
        assert.equal(levels[37].allowedShapes.length, 12);
        assert.equal(levels[49].allowedShapes.length, 12);
    });

    test('every level allows exactly the shapes unlocked so far', () => {
        levels.forEach((level, index) => {
            assert.deepEqual([...level.allowedShapes].sort(), [...expectedAllowed(index + 1)].sort(), `${level.id}`);
        });
    });

    test('no puzzle uses a shape before the level that introduces it', () => {
        const introducedAt = Object.fromEntries(UNLOCKS.map(([level, shape]) => [shape, level]));
        levels.forEach((level, index) => {
            for (const puzzle of level.trucks.flatMap((slot) => slot.puzzles)) {
                for (const id of puzzle.pieces) {
                    assert.ok((introducedAt[id] ?? 1) <= index + 1, `${puzzle.id} uses ${id} before level ${introducedAt[id]}`);
                }
            }
        });
    });

    test('at a level that introduces a shape, every puzzle contains it', () => {
        for (const level of levels.filter((entry) => entry.newShapes.length > 0)) {
            const puzzles = level.trucks.flatMap((slot) => slot.puzzles);
            for (const puzzle of puzzles) {
                assert.ok(puzzle.pieces.some((id) => level.newShapes.includes(id)), `${puzzle.id} has no new shape`);
            }
            for (const shape of level.newShapes) {
                assert.ok(puzzles.some((puzzle) => puzzle.pieces.includes(shape)), `${level.id} never shows ${shape}`);
            }
        }
    });
});

describe('shipped levels.shapes.json - structure matches the normal levels', () => {
    const levels = loadShapeLevels(shapesRaw);
    const normal = loadLevels(levelsRaw);

    test('same trucks per day and same easy/medium/hard order as levels.json', () => {
        levels.forEach((level, index) => {
            assert.deepEqual(
                level.trucks.map((slot) => slot.difficulty),
                normal[index].trucks.map((truck) => truck.difficulty),
                `${level.id}`
            );
        });
    });

    test(`every truck slot holds a pool of ${POOL_SIZE} puzzles, all of the slot's difficulty`, () => {
        for (const level of levels) {
            for (const slot of level.trucks) {
                assert.equal(slot.puzzles.length, POOL_SIZE, `${slot.id} pool size`);
                for (const puzzle of slot.puzzles) {
                    assert.equal(puzzle.difficulty, slot.difficulty, `${puzzle.id}`);
                }
            }
        }
    });

    test('every board is square or portrait, and no puzzle or level carries money data', () => {
        for (const puzzle of levels.flatMap((level) => level.trucks.flatMap((slot) => slot.puzzles))) {
            assert.ok(puzzle.rows >= puzzle.cols, `${puzzle.id} is landscape`);
            assert.equal(puzzle.reward, undefined, `${puzzle.id} should not have a reward`);
        }
    });

    test('no two puzzles in the whole file are identical', () => {
        const seen = new Set();
        for (const puzzle of levels.flatMap((level) => level.trucks.flatMap((slot) => slot.puzzles))) {
            const blocked = [...puzzle.blocked].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            const key = `${puzzle.rows}x${puzzle.cols}|${JSON.stringify(blocked)}|${[...puzzle.pieces].sort().join(',')}`;
            assert.ok(!seen.has(key), `${puzzle.id} duplicates an earlier puzzle`);
            seen.add(key);
        }
    });

    test('every one of the puzzles is solvable', () => {
        for (const puzzle of levels.flatMap((level) => level.trucks.flatMap((slot) => slot.puzzles))) {
            const result = solve(createGridForTruck(puzzle), puzzle.pieces, { maxSolutions: 1 });
            assert.ok(result.solutionCount >= 1, `${puzzle.id} must have at least one solution`);
        }
    });
});
