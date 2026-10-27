/**
 * wallpapers.test.js
 *
 * Validates the wallpapers catalogue (src/data/wallpapers.json) loads correctly
 * and that the loader rejects malformed data.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadWallpapers } from '../../src/data/loadWallpapers.js';

const raw = JSON.parse(readFileSync(fileURLToPath(new URL('../../src/data/wallpapers.json', import.meta.url)), 'utf8'));
const wallpapers = loadWallpapers(structuredClone(raw));
const byId = new Map(wallpapers.map((w) => [w.id, w]));

describe('wallpapers.json', () => {
    test('holds a non-empty list of wallpapers', () => {
        assert.ok(wallpapers.length > 0);
    });

    test('every wallpaper has a unique id, name and valid hex color (and no price - that is in economy.json)', () => {
        const ids = new Set();
        for (const w of wallpapers) {
            assert.ok(w.id && typeof w.id === 'string');
            assert.ok(w.name && typeof w.name === 'string');
            assert.equal(w.price, undefined);
            assert.ok(w.color.match(/^#[0-9a-fA-F]{6}$/), `invalid color "${w.color}"`);
            assert.ok(!ids.has(w.id), `duplicate id "${w.id}"`);
            ids.add(w.id);
        }
    });

    test('wallpapers keep the order of the file', () => {
        assert.deepEqual(wallpapers.map((w) => w.id), raw.wallpapers.map((w) => w.id));
    });
});

describe('loadWallpapers rejects malformed data', () => {
    const withChange = (change) => {
        const data = structuredClone(raw);
        change(data);
        return data;
    };

    test('missing or non-array wallpapers list', () => {
        assert.throws(() => loadWallpapers({}), /wallpapers/);
        assert.throws(() => loadWallpapers({ wallpapers: null }), /wallpapers/);
    });

    test('duplicate ids', () => {
        assert.throws(() => loadWallpapers(withChange((data) => {
            const first = data.wallpapers[0];
            data.wallpapers.push({ ...first, id: first.id });
        })), /duplicate/);
    });

    test('missing or invalid color', () => {
        assert.throws(() => loadWallpapers(withChange((data) => {
            delete data.wallpapers[0].color;
        })), /"color"/);
        assert.throws(() => loadWallpapers(withChange((data) => {
            data.wallpapers[0].color = 'red';
        })), /"color"/);
        assert.throws(() => loadWallpapers(withChange((data) => {
            data.wallpapers[0].color = '#gggggg';
        })), /"color"/);
    });
});
