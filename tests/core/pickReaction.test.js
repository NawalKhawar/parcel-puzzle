/**
 * pickReaction.test.js
 *
 * The worker's solved-truck reaction: random, never the same pose twice in a row.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { pickReaction } from '../../src/core/pickReaction.js';

const POSES = ['happy', 'happy2', 'celebrate'];

describe('pickReaction', () => {
    test('never repeats the previous pose, however the dice fall', () => {
        for (const last of POSES) {
            for (let i = 0; i < 100; i++) {
                assert.notEqual(pickReaction(POSES, last, () => i / 100), last);
            }
        }
    });

    test('can reach every other pose', () => {
        const seen = new Set();
        for (let i = 0; i < 100; i++) {
            seen.add(pickReaction(POSES, 'happy', () => i / 100));
        }
        assert.deepEqual([...seen].sort(), ['celebrate', 'happy2']);
    });

    test('with no previous pose, any of them may come up', () => {
        const seen = new Set();
        for (let i = 0; i < 100; i++) {
            seen.add(pickReaction(POSES, null, () => i / 100));
        }
        assert.equal(seen.size, 3);
    });

    test('a single pose is returned even if it was the last one', () => {
        assert.equal(pickReaction(['happy'], 'happy'), 'happy');
    });

    test('a long run with the real random generator never repeats back to back', () => {
        let last = null;
        for (let i = 0; i < 500; i++) {
            const pose = pickReaction(POSES, last);
            assert.notEqual(pose, last);
            last = pose;
        }
    });
});
