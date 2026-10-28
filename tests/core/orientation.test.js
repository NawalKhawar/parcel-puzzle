/**
 * orientation.test.js
 *
 * The rules that choose between the landscape and the portrait layout, and the canvas size each gets.
 * Landscape must stay EXACTLY the original 1280 x 720 (the desktop game must not change), and portrait
 * must follow the window's shape within its limits.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { windowIsPortrait, gameSizeForWindow, LANDSCAPE_SIZE, PORTRAIT_WIDTH, PORTRAIT_MIN_HEIGHT, PORTRAIT_MAX_HEIGHT } from '../../src/core/orientation.js';

describe('windowIsPortrait', () => {
    test('a tall window is portrait, a wide one is landscape', () => {
        assert.equal(windowIsPortrait(390, 844), true);
        assert.equal(windowIsPortrait(1920, 1080), false);
    });

    test('a square window counts as landscape (the original layout is the default)', () => {
        assert.equal(windowIsPortrait(800, 800), false);
    });
});

describe('gameSizeForWindow - landscape', () => {
    test('is always exactly the original 1280 x 720 times the UI scale, whatever the window shape', () => {
        for (const [w, h] of [[1920, 1080], [1280, 720], [2560, 1080], [1000, 1000], [844, 390]])
        {
            for (const scale of [1, 1.5, 2])
            {
                const size = gameSizeForWindow(w, h, scale);
                assert.deepEqual(size, { width: LANDSCAPE_SIZE.width * scale, height: LANDSCAPE_SIZE.height * scale, portrait: false }, `${w}x${h} @${scale}`);
            }
        }
    });
});

describe('gameSizeForWindow - portrait', () => {
    test('is 720 design px wide and takes its height from the window shape', () => {
        const phone = gameSizeForWindow(390, 844, 1);
        assert.equal(phone.portrait, true);
        assert.equal(phone.width, PORTRAIT_WIDTH);
        // 720 * 844 / 390 = 1558, which is inside the allowed range
        assert.equal(phone.height, 1558);
        // the canvas shape matches the window's, so Scale.FIT fills it
        assert.ok(Math.abs(phone.width / phone.height - 390 / 844) < 0.001);
    });

    test('a very tall phone is clamped to the maximum height, a squat tablet to the minimum', () => {
        assert.equal(gameSizeForWindow(360, 1000, 1).height, PORTRAIT_MAX_HEIGHT);
        assert.equal(gameSizeForWindow(800, 1000, 1).height, PORTRAIT_MIN_HEIGHT);
    });

    test('the UI scale multiplies both dimensions', () => {
        const one = gameSizeForWindow(390, 844, 1);
        const two = gameSizeForWindow(390, 844, 2);
        assert.equal(two.width, one.width * 2);
        assert.equal(two.height, one.height * 2);
    });

    test('the height is always a whole number of design pixels inside the allowed range', () => {
        for (let h = 500; h <= 2400; h += 37)
        {
            const size = gameSizeForWindow(400, h, 1);
            if (size.portrait)
            {
                assert.equal(size.height, Math.round(size.height));
                assert.ok(size.height >= PORTRAIT_MIN_HEIGHT && size.height <= PORTRAIT_MAX_HEIGHT);
            }
        }
    });
});
