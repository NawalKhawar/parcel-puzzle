/**
 * loadApartment.js
 *
 * Validates the apartment data in apartment.json (room size + the furniture catalog) and
 * the shop data in shop.json (tabs and their placeholder items), the same way
 * loadLevel.js guards the puzzle data: bad data fails loudly at load time, naming the
 * offending entry, instead of producing a half-broken screen. Must never import
 * 'phaser' - see "Architectural boundary" in PROJECT_STRUCTURE.md.
 */

/**
 * @typedef {Object} FurnitureDef
 * @property {string} id - unique id.
 * @property {string} name - label shown in the inventory and on the item.
 * @property {number} cols - footprint width in floor cells.
 * @property {number} rows - footprint depth in floor cells.
 * @property {number} height - drawn height in pixels (at the room's near-edge scale).
 * @property {string} color - base colour as "#rrggbb".
 * @property {boolean} [flat] - true for rugs: lies on the floor, other items may sit on top.
 */

/**
 * @typedef {Object} ApartmentData
 * @property {{cols: number, rows: number}} room
 * @property {FurnitureDef[]} items
 */

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

/**
 * Validates apartment.json's contents.
 *
 * @param {ApartmentData} raw
 * @returns {ApartmentData} the same object, proven valid.
 * @throws {Error} naming the offending item and the rule it broke.
 */
export function loadApartment(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new Error(`Invalid apartment data: expected an object, got ${JSON.stringify(raw)}`);
    }
    if (!raw.room || !isPositiveInt(raw.room.cols) || !isPositiveInt(raw.room.rows)) {
        throw new Error(`Apartment "room" must have positive integer "cols" and "rows" (got ${JSON.stringify(raw.room)})`);
    }
    if (!Array.isArray(raw.items) || raw.items.length === 0) {
        throw new Error('Apartment "items" must be a non-empty array');
    }

    const seenIds = new Set();
    for (const item of raw.items) {
        if (!item || typeof item.id !== 'string' || item.id.length === 0) {
            throw new Error(`Furniture item needs a non-empty string "id" (got ${JSON.stringify(item)})`);
        }
        const label = `furniture "${item.id}"`;
        if (seenIds.has(item.id)) {
            throw new Error(`${label}: duplicate id`);
        }
        seenIds.add(item.id);

        if (typeof item.name !== 'string' || item.name.length === 0) {
            throw new Error(`${label}: "name" must be a non-empty string`);
        }
        if (!isPositiveInt(item.cols) || !isPositiveInt(item.rows)) {
            throw new Error(`${label}: "cols" and "rows" must be positive integers (got ${item.cols} x ${item.rows})`);
        }
        // An item bigger than the whole room could never be placed anywhere.
        if (item.cols > raw.room.cols || item.rows > raw.room.rows) {
            throw new Error(`${label}: ${item.cols}x${item.rows} footprint does not fit in the ${raw.room.cols}x${raw.room.rows} room`);
        }
        if (typeof item.height !== 'number' || !(item.height > 0)) {
            throw new Error(`${label}: "height" must be a positive number`);
        }
        if (typeof item.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(item.color)) {
            throw new Error(`${label}: "color" must be a "#rrggbb" string (got ${JSON.stringify(item.color)})`);
        }
        if (item.flat !== undefined && typeof item.flat !== 'boolean') {
            throw new Error(`${label}: "flat", if present, must be true or false`);
        }
    }
    return raw;
}

/**
 * @typedef {Object} ShopData
 * @property {Array<{id: string, label: string, items: Array<{id: string, name: string}>}>} tabs
 */

/**
 * Validates shop.json's contents: a non-empty list of tabs, each with a label and a list
 * of named placeholder items; ids unique across the whole shop.
 *
 * @param {ShopData} raw
 * @returns {ShopData} the same object, proven valid.
 * @throws {Error} naming the offending tab/item and the rule it broke.
 */
export function loadShop(raw) {
    if (!raw || !Array.isArray(raw.tabs) || raw.tabs.length === 0) {
        throw new Error('Shop data needs a non-empty "tabs" array');
    }

    const seenIds = new Set();
    const claim = (id, what) => {
        if (typeof id !== 'string' || id.length === 0) {
            throw new Error(`${what} needs a non-empty string "id"`);
        }
        if (seenIds.has(id)) {
            throw new Error(`Duplicate shop id "${id}"`);
        }
        seenIds.add(id);
    };

    for (const tab of raw.tabs) {
        claim(tab && tab.id, 'Shop tab');
        if (typeof tab.label !== 'string' || tab.label.length === 0) {
            throw new Error(`Shop tab "${tab.id}": "label" must be a non-empty string`);
        }
        if (!Array.isArray(tab.items)) {
            throw new Error(`Shop tab "${tab.id}": "items" must be an array`);
        }
        for (const item of tab.items) {
            claim(item && item.id, `Item in shop tab "${tab.id}"`);
            if (typeof item.name !== 'string' || item.name.length === 0) {
                throw new Error(`Shop item "${item.id}": "name" must be a non-empty string`);
            }
        }
    }
    return raw;
}
