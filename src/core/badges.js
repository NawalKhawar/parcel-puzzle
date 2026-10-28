/**
 * badges.js
 *
 * When the game shows a RED DOT on a button, as plain functions (no Phaser, so they are unit-tested):
 *
 *   - the SHOP button (and the shop's Furniture / Wallpapers tabs) gets a dot when the player can buy
 *     something right now: an item that is unlocked on this day, not owned yet, and not dearer than
 *     the wallet;
 *   - the DECORATE (apartment) button gets a dot when the player owns something they have not yet seen
 *     in the apartment's inventory - a new purchase waiting to be placed.
 *
 * "Seen" is a list of item ids kept in the save (`seenItems`): opening the apartment marks everything
 * the player owns as seen, so the dot goes away once they have looked.
 */

import { shopStatus } from './economy.js';

/** @typedef {import('./economy.js').EconomyState} EconomyState */
/** @typedef {import('../data/loadEconomy.js').EconomyConfig} EconomyConfig */

/**
 * Whether the shop has anything the player can buy right now.
 *
 * @param {number} day - the current day (1-based); decides which items are unlocked.
 * @param {EconomyState} state - the wallet and owned items.
 * @param {EconomyConfig} config
 * @param {string[] | null} [categories] - only look at items in these shop categories (a shop tab);
 *   null (the default) looks at every category.
 * @returns {boolean} true if at least one enabled item has the status 'buyable'.
 */
export function shopHasBuyable(day, state, config, categories = null) {
    return config.shop.some(
        (item) =>
            (categories === null || categories.includes(item.category)) &&
            shopStatus(item.id, day, state, config) === 'buyable'
    );
}

/**
 * The owned items the player has not seen in the apartment yet.
 *
 * @param {string[]} ownedItems - ids of everything the player owns.
 * @param {string[]} seenItems - ids already shown in the apartment's inventory.
 * @returns {string[]} the unseen ids, in the order they were bought.
 */
export function unseenItems(ownedItems, seenItems) {
    const seen = new Set(seenItems);
    return ownedItems.filter((id) => !seen.has(id));
}

/**
 * Whether the Decorate button should show its dot: something owned is new to the apartment.
 *
 * @param {string[]} ownedItems
 * @param {string[]} seenItems
 * @returns {boolean}
 */
export function apartmentHasNew(ownedItems, seenItems) {
    return unseenItems(ownedItems, seenItems).length > 0;
}
