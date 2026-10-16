/**
 * RoomGrid.js
 *
 * The apartment's placement rules: a floor grid that furniture is placed onto. This is the
 * apartment's equivalent of Grid.js for the puzzle - pure logic with no Phaser dependency
 * (see "Architectural boundary" in PROJECT_STRUCTURE.md), so the rules are unit-testable
 * and the scene only has to ask "can this go here?" and "what order do I draw things in?".
 *
 * An item occupies a rectangle of `cols` x `rows` floor cells. Two rules decide whether a
 * placement is legal:
 *   1. The whole footprint must be on the floor (inside the room).
 *   2. It must not overlap another item - with one exception: FLAT items (rugs) lie on the
 *      floor rather than standing on it, so a normal item may sit on top of a rug. Two flat
 *      items still can't overlap each other, and two normal items still can't either.
 */

/**
 * @typedef {Object} RoomItemDef
 * @property {string} id - unique item id.
 * @property {number} cols - footprint width in floor cells.
 * @property {number} rows - footprint depth in floor cells.
 * @property {boolean} [flat] - true for rugs and other floor coverings.
 */

/**
 * @typedef {Object} RoomPlacement
 * @property {string} id
 * @property {number} col - floor column of the footprint's back-left cell.
 * @property {number} row - floor row of the footprint's back-left cell (0 = against the back wall).
 * @property {number} cols
 * @property {number} rows
 * @property {boolean} flat
 */

export class RoomGrid {
    /**
     * @param {number} cols - floor width in cells (positive integer).
     * @param {number} rows - floor depth in cells (positive integer).
     */
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        /** @type {Map<string, RoomPlacement>} */
        this.placed = new Map();
    }

    /**
     * Whether an item could legally be placed with its back-left cell at (col, row).
     *
     * @param {RoomItemDef} item
     * @param {number} col
     * @param {number} row
     * @param {string} [ignoreId] - an item to pretend isn't there (e.g. the item being
     *   moved, so it doesn't block its own new position).
     * @returns {boolean}
     */
    canPlace(item, col, row, ignoreId) {
        // Rule 1: the footprint must lie entirely within the floor.
        if (col < 0 || row < 0 || col + item.cols > this.cols || row + item.rows > this.rows) {
            return false;
        }

        // Rule 2: no overlap with a same-kind item (flat vs flat, or normal vs normal).
        const isFlat = Boolean(item.flat);
        for (const other of this.placed.values()) {
            if (other.id === ignoreId || other.flat !== isFlat) {
                continue;
            }
            // Two rectangles overlap unless one is entirely to one side of the other.
            const separated =
                col + item.cols <= other.col ||
                other.col + other.cols <= col ||
                row + item.rows <= other.row ||
                other.row + other.rows <= row;
            if (!separated) {
                return false;
            }
        }
        return true;
    }

    /**
     * Places an item. The item must not already be placed and the position must be legal.
     *
     * @param {RoomItemDef} item
     * @param {number} col
     * @param {number} row
     * @throws {Error} if the item is already placed or the position is illegal.
     */
    place(item, col, row) {
        if (this.placed.has(item.id)) {
            throw new Error(`Item "${item.id}" is already placed`);
        }
        if (!this.canPlace(item, col, row)) {
            throw new Error(`Item "${item.id}" cannot be placed at column ${col}, row ${row}`);
        }
        this.placed.set(item.id, {
            id: item.id,
            col,
            row,
            cols: item.cols,
            rows: item.rows,
            flat: Boolean(item.flat),
        });
    }

    /**
     * Removes an item from the floor (picking it up).
     *
     * @param {string} id
     * @returns {RoomPlacement | undefined} where it was, or undefined if it wasn't placed.
     */
    remove(id) {
        const placement = this.placed.get(id);
        this.placed.delete(id);
        return placement;
    }

    /**
     * @param {string} id
     * @returns {boolean} whether the item is currently on the floor.
     */
    has(id) {
        return this.placed.has(id);
    }

    /**
     * @param {string} id
     * @returns {RoomPlacement | undefined}
     */
    get(id) {
        return this.placed.get(id);
    }

    /**
     * Every placed item, in the order they must be DRAWN so that nearer items cover
     * farther ones (painter's algorithm): back to front.
     *
     *   - Flat items (rugs) first, since everything else stands on or in front of them.
     *   - Then by each item's front edge (row + rows), smallest first: an item whose front
     *     edge is further back can't be in front of one whose front edge is nearer.
     *   - Ties (same front edge) fall back to column; such items sit side by side, so
     *     either order looks identical.
     *
     * Because normal items never overlap, ordering by front edge is enough to get
     * "behind" and "in front of" right, including tall items hiding things behind them.
     *
     * @returns {RoomPlacement[]} a new array, back to front.
     */
    getDrawOrder() {
        return [...this.placed.values()].sort((a, b) => {
            if (a.flat !== b.flat) {
                return a.flat ? -1 : 1;
            }
            const frontA = a.row + a.rows;
            const frontB = b.row + b.rows;
            if (frontA !== frontB) {
                return frontA - frontB;
            }
            return a.col - b.col;
        });
    }
}
