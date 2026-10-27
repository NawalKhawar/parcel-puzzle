import economyRaw from '../data/economy.json';
import { loadEconomy } from '../data/loadEconomy.js';
import { createEconomyState } from '../core/economy.js';

/**
 * economy.js (game layer)
 *
 * The bridge between the pure economy rules (src/core/economy.js) and the running game: it holds
 * the validated config (the ONE copy every scene reads) and keeps the player's economy state -
 * wallet, claimed bonuses, owned items - in the Phaser registry, which is the game's save store.
 *
 * The state is plain data (see EconomyState), so saving it is just core/economy.serializeEconomyState
 * and restoring it restoreEconomyState; the scenes only ever go through the helpers here.
 */

/** The validated economy config (src/data/economy.json). Fails loudly at start-up if it is malformed. */
export const economy = loadEconomy(economyRaw);

/** Registry key holding the EconomyState. */
const STATE_KEY = 'economyState';

/**
 * @param {import('phaser').Data.DataManager} registry - scene.registry.
 * @returns {import('../core/economy.js').EconomyState} the current state (a fresh one if none is stored yet).
 */
export function getEconomyState(registry) {
    return registry.get(STATE_KEY) ?? createEconomyState();
}

/**
 * Stores a new state. The core functions never change a state in place - they return a new one -
 * so this is how every change reaches the game.
 *
 * @param {import('phaser').Data.DataManager} registry
 * @param {import('../core/economy.js').EconomyState} state
 */
export function setEconomyState(registry, state) {
    registry.set(STATE_KEY, state);
}

/**
 * Starts a brand-new game's economy: an empty wallet, no bonuses claimed, nothing owned.
 *
 * @param {import('phaser').Data.DataManager} registry
 */
export function resetEconomy(registry) {
    registry.set(STATE_KEY, createEconomyState());
}

/**
 * @param {import('phaser').Data.DataManager} registry
 * @returns {number} the wallet, in whole dollars.
 */
export function getMoney(registry) {
    return getEconomyState(registry).money;
}
