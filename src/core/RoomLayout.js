/**
 * RoomLayout.js
 *
 * The apartment's placement rules and draw order, as plain logic with no Phaser dependency (see
 * "Architectural boundary" in PROJECT_STRUCTURE.md), so all of it is unit-testable.
 *
 * COORDINATES. The room is one grid of tiles, ROOM_W wide:
 *
 *     y = 0 .. WALL_ROWS-1                     the back wall strip   (wall items live in its top
 *                                              WALL_HANG_ROWS rows; the lowest row stays clear)
 *     y = WALL_ROWS .. WALL_ROWS+ROOM_H-1      the floor             (floor items live here)
 *
 * Using one grid for both means a single formula positions every sprite (see spriteRect), and
 * "y" grows towards the viewer: a bigger y is nearer the front of the room.
 *
 * An item's position (x, y) is the top-left tile of its FOOTPRINT. Placement only ever looks at
 * the footprint; the extra rows a tall sprite sticks up (heightRows) are drawing only, so a
 * bookshelf against the back wall may overdraw the wall strip without "using" those wall tiles.
 *
 * RULES. A placement is valid when:
 *   1. x and y are whole tiles,
 *   2. the footprint lies inside the item's area (wall items: the top WALL_HANG_ROWS rows of the wall
 *      strip; floor items: the floor, plus the wall's cleared bottom row(s) for an item whose data
 *      says "intoWall" - the fridge - so a deep item can back right up against the wall),
 *   3. it doesn't overlap another item of the same LAYER. There are three layers - wall items,
 *      flat floor items (rugs), and solid floor items - and items only clash within a layer. So
 *      anything may stand on a rug, but two rugs can't overlap, and nothing can go on a bed.
 */

import { TILE, ROOM_W, ROOM_H, WALL_ROWS, WALL_HANG_ROWS } from './roomConfig.js';

/**
 * @typedef {import('../data/loadItems.js').ItemDef} ItemDef
 */

/**
 * @typedef {Object} Placement
 * @property {string} id
 * @property {number} x - footprint's left tile.
 * @property {number} y - footprint's top tile (room grid, wall rows included).
 * @property {number} w - footprint width in tiles.
 * @property {number} h - footprint depth in tiles.
 * @property {'wall' | 'flat' | 'solid'} layer - which items it can clash with (see the rules above).
 */

/**
 * Which layer an item belongs to. Items only block items on the same layer.
 *
 * @param {ItemDef} item
 * @returns {'wall' | 'flat' | 'solid'}
 */
export function layerOf(item) {
    if (item.wallMounted) {
        return 'wall';
    }
    return item.flat ? 'flat' : 'solid';
}

/**
 * The rectangle an item's sprite covers, in room pixels, when its footprint's top-left tile is
 * at (x, y). The sprite is footprint.w tiles wide and (footprint.h + heightRows) tiles tall, and
 * its BOTTOM-LEFT corner sits on the bottom-left corner of the footprint - so the extra height
 * grows upwards, overdrawing the tiles behind the item (and the wall, against the back wall).
 *
 * anchorX/anchorY is that bottom-left corner: draw the sprite there with origin (0, 1).
 *
 * @param {ItemDef} item
 * @param {number} x - footprint's left tile.
 * @param {number} y - footprint's top tile.
 * @param {number} [tile] - pixels per tile (TILE by default).
 * @returns {{anchorX: number, anchorY: number, left: number, top: number, width: number, height: number}}
 */
export function spriteRect(item, x, y, tile = TILE) {
    const width = item.footprint.w * tile;
    const height = (item.footprint.h + item.heightRows) * tile;
    const anchorX = x * tile;
    // Bottom edge of the footprint: its top row plus its depth.
    const anchorY = (y + item.footprint.h) * tile;
    return { anchorX, anchorY, left: anchorX, top: anchorY - height, width, height };
}

/**
 * The box of an item's VISIBLE picture, as offsets from its footprint's bottom-left corner (the
 * sprite's anchor), in room pixels at the base tile size TILE; y grows downwards, so a picture
 * standing above its footprint has negative top/bottom. The scene measures it from the art (the
 * artwork sits on a bigger transparent canvas), so this file stays free of any image handling.
 *
 * @typedef {Object} ArtHit
 * @property {number} left
 * @property {number} right
 * @property {number} top
 * @property {number} bottom
 */

/**
 * The rectangle that counts as an item's body for clicking: its visible picture if known (hit),
 * otherwise the whole nominal sprite box (spriteRect).
 *
 * @param {ItemDef} item
 * @param {number} x - footprint's left tile.
 * @param {number} y - footprint's top tile.
 * @param {number} [tile] - pixels per tile.
 * @param {ArtHit} [hit] - offsets at TILE size; scaled here if tile differs.
 * @returns {{left: number, top: number, width: number, height: number}}
 */
export function artRect(item, x, y, tile = TILE, hit) {
    const sprite = spriteRect(item, x, y, tile);
    if (!hit) {
        return sprite;
    }
    const k = tile / TILE;
    return {
        left: sprite.anchorX + hit.left * k,
        top: sprite.anchorY + hit.top * k,
        width: (hit.right - hit.left) * k,
        height: (hit.bottom - hit.top) * k,
    };
}

/**
 * The tile an item snaps to when its footprint's top-left corner is at room pixel (px, py):
 * the nearest whole tile, so the footprint jumps to whichever grid position it is closest to.
 *
 * @param {number} px
 * @param {number} py
 * @param {number} [tile]
 * @returns {{x: number, y: number}}
 */
export function snapToTile(px, py, tile = TILE) {
    return { x: Math.round(px / tile), y: Math.round(py / tile) };
}

/**
 * Two footprints overlap unless one is wholly to one side of the other.
 *
 * @param {{x: number, y: number, w: number, h: number}} a
 * @param {{x: number, y: number, w: number, h: number}} b
 * @returns {boolean}
 */
function overlaps(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Sort key for draw order, back to front. Smaller draws first (further back).
 *   - rank: wall items first (the wall is behind the whole room), then rugs (everything stands on
 *     them), then solid furniture.
 *   - bottom: the footprint's bottom edge (y + h). Sprites only ever cover their own columns, so
 *     two items can only overlap on screen if they share columns - and then the one whose
 *     footprint ends nearer the front is in front.
 *   - x, then id: tie-breakers that never change between frames, so equal items can't flicker.
 */
const RANK = { wall: 0, flat: 1, solid: 2 };

export class RoomLayout {
    /**
     * @param {Object} [size] - overridable for tests; defaults to roomConfig.
     * @param {number} [size.width] - tiles across.
     * @param {number} [size.floorRows] - floor rows.
     * @param {number} [size.wallRows] - wall strip rows.
     * @param {number} [size.hangRows] - how many of the wall's top rows wall items may use.
     */
    constructor({ width = ROOM_W, floorRows = ROOM_H, wallRows = WALL_ROWS, hangRows = WALL_HANG_ROWS } = {}) {
        this.width = width;
        this.floorRows = floorRows;
        this.wallRows = wallRows;
        this.hangRows = hangRows;
        /** @type {Map<string, Placement>} */
        this.placed = new Map();
    }

    /**
     * The rows an item may occupy: the top hangRows rows of the wall strip for wall items (the lowest
     * wall row stays clear), the floor for everything else. A floor item with "intoWall" may also
     * use that many rows of the wall's cleared bottom (never the rows wall items hang in).
     *
     * @param {ItemDef} item
     * @returns {{top: number, bottom: number}} first row, and one past the last row.
     */
    areaRows(item) {
        if (item.wallMounted) {
            return { top: 0, bottom: this.hangRows };
        }
        const intoWall = Math.min(item.intoWall ?? 0, this.wallRows - this.hangRows);
        return { top: this.wallRows - intoWall, bottom: this.wallRows + this.floorRows };
    }

    /**
     * The legal spot nearest to where an item was dropped - used when the exact spot isn't legal, so
     * the item lands as close as it can instead of being refused. Every legal top-left tile is
     * tried and the one whose distance to (x, y) is smallest wins; on a tie the topmost, then
     * leftmost, so the answer never changes between calls. If (x, y) is itself legal it is returned.
     *
     * @param {ItemDef} item
     * @param {number} x - where the item's top-left tile is wanted; may be fractional (the exact mouse position).
     * @param {number} y
     * @returns {{x: number, y: number} | null} the spot, or null if the item fits nowhere at all.
     */
    findNearestValid(item, x, y) {
        const { w, h } = item.footprint;
        const area = this.areaRows(item);
        let best = null;
        let bestDistance = Infinity;
        for (let row = area.top; row + h <= area.bottom; row++) {
            for (let col = 0; col + w <= this.width; col++) {
                if (!this.canPlace(item, col, row)) {
                    continue;
                }
                // Squared distance is enough to compare; strictly smaller keeps the first (topmost, leftmost) on a tie.
                const distance = (col - x) ** 2 + (row - y) ** 2;
                if (distance < bestDistance) {
                    best = { x: col, y: row };
                    bestDistance = distance;
                }
            }
        }
        return best;
    }

    /**
     * Whether an item could go with its footprint's top-left tile at (x, y).
     *
     * @param {ItemDef} item
     * @param {number} x
     * @param {number} y
     * @param {Object} [options]
     * @param {string | null} [options.ignoreId] - an item to pretend isn't there (the one being moved).
     * @returns {boolean}
     */
    canPlace(item, x, y, { ignoreId = null } = {}) {
        // Rule 1: whole tiles only.
        if (!Number.isInteger(x) || !Number.isInteger(y)) {
            return false;
        }
        // Rule 2: the footprint must lie wholly inside the item's own area.
        const { w, h } = item.footprint;
        const area = this.areaRows(item);
        if (x < 0 || x + w > this.width || y < area.top || y + h > area.bottom) {
            return false;
        }
        // Rule 3: no overlap with another item on the same layer.
        const layer = layerOf(item);
        const footprint = { x, y, w, h };
        for (const other of this.placed.values()) {
            if (other.id === item.id || other.id === ignoreId || other.layer !== layer) {
                continue;
            }
            if (overlaps(footprint, other)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Puts an item down.
     *
     * @param {ItemDef} item
     * @param {number} x
     * @param {number} y
     * @throws {Error} if it is already placed or the spot isn't valid.
     */
    place(item, x, y) {
        if (this.placed.has(item.id)) {
            throw new Error(`Item "${item.id}" is already placed`);
        }
        if (!this.canPlace(item, x, y)) {
            throw new Error(`Item "${item.id}" cannot go at (${x}, ${y})`);
        }
        this.placed.set(item.id, { id: item.id, x, y, w: item.footprint.w, h: item.footprint.h, layer: layerOf(item) });
    }

    /**
     * Picks an item up.
     *
     * @param {string} id
     * @returns {Placement | undefined} where it was, or undefined if it wasn't in the room.
     */
    remove(id) {
        const placement = this.placed.get(id);
        this.placed.delete(id);
        return placement;
    }

    /** @param {string} id @returns {boolean} whether the item is in the room. */
    has(id) {
        return this.placed.has(id);
    }

    /** @param {string} id @returns {Placement | undefined} */
    get(id) {
        return this.placed.get(id);
    }

    /**
     * Every placed item in the order to DRAW them, back to front (see RANK above for why).
     *
     * @returns {Placement[]} a new array.
     */
    drawOrder() {
        return [...this.placed.values()].sort(
            (a, b) =>
                RANK[a.layer] - RANK[b.layer] ||
                a.y + a.h - (b.y + b.h) ||
                a.x - b.x ||
                (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
        );
    }

    /**
     * The front-most placed item whose SPRITE covers room pixel (px, py) - the whole visible
     * picture, not just its footprint, so a tall bookshelf can be grabbed by its top.
     *
     * @param {number} px
     * @param {number} py
     * @param {Map<string, ItemDef>} defs - item definitions by id (for each sprite's size).
     * @param {number} [tile]
     * @param {Map<string, ArtHit>} [hits] - the VISIBLE picture's box per item id (see ArtHit). An
     *   item with an entry is picked by that box, so clicking the transparent padding round a
     *   picture (or the empty part of a shrunk sprite) misses it; an item without one falls back
     *   to its nominal sprite box (spriteRect).
     * @returns {string | null} the item's id, or null if nothing is there.
     */
    pickAt(px, py, defs, tile = TILE, hits = new Map()) {
        const frontToBack = this.drawOrder().reverse();
        for (const placement of frontToBack) {
            const rect = artRect(defs.get(placement.id), placement.x, placement.y, tile, hits.get(placement.id));
            if (px >= rect.left && px < rect.left + rect.width && py >= rect.top && py < rect.top + rect.height) {
                return placement.id;
            }
        }
        return null;
    }

    /**
     * The layout as plain data for saving: { [id]: { x, y } }.
     *
     * @returns {Object<string, {x: number, y: number}>}
     */
    serialize() {
        const data = {};
        for (const { id, x, y } of this.placed.values()) {
            data[id] = { x, y };
        }
        return data;
    }

    /**
     * Replaces the room's contents with a saved layout. Entries that no longer make sense - an
     * unknown item, a spot that's now invalid, a layout saved in an older format - are skipped
     * rather than failing, so an old save can never break the room.
     *
     * @param {Object} data - from serialize().
     * @param {Map<string, ItemDef>} defs - item definitions by id.
     * @returns {string[]} the ids that were skipped.
     */
    load(data, defs) {
        this.placed.clear();
        const skipped = [];
        for (const [id, spot] of Object.entries(data ?? {})) {
            const item = defs.get(id);
            if (item && spot && this.canPlace(item, spot.x, spot.y)) {
                this.place(item, spot.x, spot.y);
            } else {
                skipped.push(id);
            }
        }
        return skipped;
    }
}
