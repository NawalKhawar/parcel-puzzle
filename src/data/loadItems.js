/**
 * loadItems.js
 *
 * Validates the furniture catalogue in items.json - the items the apartment can hold and the shop
 * sells. Bad data fails loudly at load time, naming the offending item and the rule it broke,
 * instead of producing a half-broken room. Must never import 'phaser' - see "Architectural
 * boundary" in PROJECT_STRUCTURE.md.
 */

import { ROOM_W, ROOM_H, WALL_HANG_ROWS, WALL_RESERVED_ROWS, MAX_HEIGHT_ROWS } from '../core/roomConfig.js';

/** Largest allowed artScale. */
const MAX_ART_SCALE = 2;

/**
 * @typedef {Object} ItemDef
 * @property {string} id - unique id; also the key the room layout is saved under.
 * @property {string} name - label shown in the inventory and the shop. (What the item costs, and when
 *   it unlocks, is in economy.json - this file is only the item's look and floor space.)
 * @property {{w: number, h: number}} footprint - tiles the item occupies: w across, h front-to-back
 *   (for a wall item: w across the wall, h up the wall). Placement only ever looks at this.
 * @property {number} heightRows - extra tile rows the sprite sticks up ABOVE its footprint (a tall
 *   bookshelf on a 1-row footprint might have 2). Drawing only; never blocks placement.
 * @property {boolean} wallMounted - true: hangs on the back wall (top rows only); false: stands on the floor.
 * @property {number} [intoWall] - floor items only: how many of the wall's cleared bottom rows the
 *   footprint may overlap, letting a deep item (the fridge) back right up against the wall. 0 if absent.
 * @property {number} [artScale] - how big the picture is drawn compared with the size its footprint
 *   implies (1 if absent): 0.75 draws it at three quarters, 1.25 a quarter bigger (the picture then
 *   spills a little past its footprint, centred on it). Drawing only; placement ignores it.
 * @property {boolean} [flat] - true for rugs: lies under the furniture, so other floor items may
 *   overlap it (but two flat items may not overlap each other).
 * @property {string} sprite - texture key of the item's art (assets/apartment/<sprite>.png). A plain
 *   placeholder block is drawn while that art doesn't exist yet.
 * @property {string} color - "#rrggbb", the placeholder block's colour.
 */

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

/**
 * Validates the contents of items.json.
 *
 * @param {{items: ItemDef[]}} raw
 * @returns {ItemDef[]} the item list, every entry proven valid.
 * @throws {Error} naming the offending item and the rule it broke.
 */
export function loadItems(raw) {
    if (!raw || !Array.isArray(raw.items) || raw.items.length === 0) {
        throw new Error('items.json must contain a non-empty "items" array');
    }

    const seenIds = new Set();
    for (const item of raw.items) {
        if (!item || typeof item.id !== 'string' || item.id.length === 0) {
            throw new Error(`Item needs a non-empty string "id" (got ${JSON.stringify(item)})`);
        }
        const label = `item "${item.id}"`;
        if (seenIds.has(item.id)) {
            throw new Error(`${label}: duplicate id`);
        }
        seenIds.add(item.id);

        if (typeof item.name !== 'string' || item.name.length === 0) {
            throw new Error(`${label}: "name" must be a non-empty string`);
        }
        if (!item.footprint || !isPositiveInt(item.footprint.w) || !isPositiveInt(item.footprint.h)) {
            throw new Error(`${label}: "footprint" must be { "w": positive integer, "h": positive integer }`);
        }
        if (typeof item.wallMounted !== 'boolean') {
            throw new Error(`${label}: "wallMounted" must be true or false`);
        }
        if (!Number.isInteger(item.heightRows) || item.heightRows < 0 || item.heightRows > MAX_HEIGHT_ROWS) {
            // Capped so the sprite of an item on the back floor row can't stick out above the screen.
            throw new Error(`${label}: "heightRows" must be a whole number from 0 to ${MAX_HEIGHT_ROWS}`);
        }
        if (item.intoWall !== undefined) {
            if (!Number.isInteger(item.intoWall) || item.intoWall < 0 || item.intoWall > WALL_RESERVED_ROWS) {
                throw new Error(`${label}: "intoWall", if present, must be a whole number from 0 to ${WALL_RESERVED_ROWS}`);
            }
            if (item.wallMounted) {
                throw new Error(`${label}: "intoWall" is for floor items; a wall item already hangs on the wall`);
            }
        }
        if (item.artScale !== undefined && !(typeof item.artScale === 'number' && item.artScale > 0 && item.artScale <= MAX_ART_SCALE)) {
            // Far above 1 the picture would swamp its neighbours.
            throw new Error(`${label}: "artScale", if present, must be a number above 0 and at most ${MAX_ART_SCALE}`);
        }
        if (item.flat !== undefined && typeof item.flat !== 'boolean') {
            throw new Error(`${label}: "flat", if present, must be true or false`);
        }
        if (typeof item.sprite !== 'string' || item.sprite.length === 0) {
            throw new Error(`${label}: "sprite" must be a non-empty texture key`);
        }
        if (typeof item.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(item.color)) {
            throw new Error(`${label}: "color" must be a "#rrggbb" string`);
        }

        // The item has to fit the area it lives in, or it could never be placed anywhere.
        const areaRows = item.wallMounted ? WALL_HANG_ROWS : ROOM_H;
        if (item.footprint.w > ROOM_W || item.footprint.h > areaRows) {
            const area = item.wallMounted ? `the ${ROOM_W}x${WALL_HANG_ROWS} wall area` : `the ${ROOM_W}x${ROOM_H} floor`;
            throw new Error(`${label}: ${item.footprint.w}x${item.footprint.h} footprint does not fit on ${area}`);
        }
        if (item.wallMounted && (item.flat || item.heightRows !== 0)) {
            // A wall item's footprint IS its whole picture on the wall, so it has nothing above it,
            // and it can't be a rug.
            throw new Error(`${label}: a wall item can't be flat and must have "heightRows": 0`);
        }
    }
    return raw.items;
}
