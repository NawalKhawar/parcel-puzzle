/**
 * economy.test.js
 *
 * Tests for the game's money: what each truck pays by difficulty (easy $10, medium $15,
 * hard $35), the one-off first-day bonus ($10, so $40 after day 1), the validation of level
 * bonuses, and the employer details shown on the end-of-day popup.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { loadShapeLevels, loadLevels } from '../../src/data/loadLevel.js';
import shapesRaw from '../../src/data/levels.shapes.json' with { type: 'json' };
import levelsRaw from '../../src/data/levels.json' with { type: 'json' };
import companyData from '../../src/data/company.json' with { type: 'json' };

const PAY = { easy: 10, medium: 15, hard: 35 };

describe('truck pay by difficulty', () => {
    test('every puzzle in the shape-gated levels pays $10 / $15 / $35 for easy / medium / hard', () => {
        for (const level of loadShapeLevels(shapesRaw)) {
            for (const slot of level.trucks) {
                for (const puzzle of slot.puzzles) {
                    assert.equal(puzzle.reward, PAY[puzzle.difficulty], `${puzzle.id} (${puzzle.difficulty})`);
                }
            }
        }
    });

    test('the original levels.json uses the same pay, so the two data sets agree', () => {
        for (const level of loadLevels(levelsRaw)) {
            for (const truck of level.trucks) {
                assert.equal(truck.reward, PAY[truck.difficulty], `${truck.id} (${truck.difficulty})`);
            }
        }
    });
});

describe('end-of-level bonuses', () => {
    const levels = loadShapeLevels(shapesRaw);

    test('level 1 pays a $10 first-day bonus, and no other level has a bonus', () => {
        assert.deepEqual(
            levels[0].bonuses.map(({ label, amount }) => ({ label, amount })),
            [{ label: 'First day bonus', amount: 10 }]
        );
        for (const level of levels.slice(1)) {
            assert.deepEqual(level.bonuses ?? [], [], `${level.id} should have no bonus`);
        }
    });

    test('whichever puzzles level 1 deals, the player has exactly $40 after the first day', () => {
        const level = levels[0];
        const poolSize = level.trucks[0].puzzles.length;
        for (let play = 0; play < poolSize; play++) {
            const truckPay = level.trucks.reduce((sum, slot) => sum + slot.puzzles[play].reward, 0);
            const bonus = level.bonuses.reduce((sum, b) => sum + b.amount, 0);
            assert.equal(truckPay, 30, 'three easy trucks at $10');
            assert.equal(truckPay + bonus, 40);
        }
    });

    test('loadShapeLevels rejects a malformed bonus', () => {
        const base = () => ({
            id: 'L1',
            newShapes: [],
            allowedShapes: ['domino_h'],
            trucks: [{ id: 'T', difficulty: 'easy', puzzles: [{ id: 'P', rows: 1, cols: 2, blocked: [], pieces: ['domino_h'], difficulty: 'easy', reward: 10 }] }],
        });

        const ok = base();
        ok.bonuses = [{ id: 'b', label: 'Bonus', amount: 5 }];
        assert.doesNotThrow(() => loadShapeLevels([ok]));

        const noLabel = base();
        noLabel.bonuses = [{ id: 'b', label: '', amount: 5 }];
        assert.throws(() => loadShapeLevels([noLabel]), /label/);

        const badAmount = base();
        badAmount.bonuses = [{ id: 'b', label: 'Bonus', amount: 0 }];
        assert.throws(() => loadShapeLevels([badAmount]), /amount/);

        const notArray = base();
        notArray.bonuses = 'lots';
        assert.throws(() => loadShapeLevels([notArray]), /must be an array/);
    });
});

describe('employer details on the end-of-day popup', () => {
    test('the company name, tagline and department are set', () => {
        assert.equal(companyData.name, 'Adequate Parcel Service');
        assert.equal(companyData.tagline, 'Arrives Intact, Mostly');
        assert.ok(typeof companyData.department === 'string' && companyData.department.length > 0, 'a department name is needed');
    });
});
