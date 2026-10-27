/**
 * ftueTrail.js
 *
 * The first-day "trail" that leads a new player from the paycheck to their first piece of furniture:
 *
 *   1. SHOP     - on the end-of-day screen only the Shop button works (it pulses, with the hand cursor
 *                 pressing it); in the shop only the clock can be bought, and the player cannot leave
 *                 until they have bought it.
 *   2. DECORATE - back on the end-of-day screen the Decorate button pulses (the hand presses it) and
 *                 Next Day stays locked until the apartment has been visited; in the apartment the hand
 *                 drags the clock from the inventory onto the wall.
 *   3. free     - the trail is over; everything works normally.
 *
 * Which step the player is on is worked out from the game state each time (not stored), so it can
 * never get out of step with what they actually own. Pure and Phaser-free so it can be tested.
 */

/** The item the first-day trail has the player buy and place (an id in economy.json's shop list). */
export const FTUE_ITEM_ID = 'clock';

/**
 * Which step of the first-day trail the player is on.
 *
 * @param {Object} state
 * @param {number} state.day - the day being finished / shopped on (1-based). Only day 1 has a trail.
 * @param {string[]} state.ownedItems - ids of everything the player owns.
 * @param {boolean} state.clockBuyable - whether the trail item can be bought right now (shopStatus is
 *   'buyable'). If it cannot - unaffordable, say, after a data change - the trail is skipped, so the
 *   player is never locked in the shop with something they cannot pay for.
 * @param {boolean} state.decorateVisited - whether the Decorate button has been pressed yet.
 * @param {boolean} [state.skipped] - the player pressed Skip: the whole trail is switched off.
 * @returns {'shop' | 'decorate' | 'free'}
 */
export function ftueTrailStage({ day, ownedItems, clockBuyable, decorateVisited, skipped = false })
{
    if (skipped || day !== 1)
    {
        return 'free';
    }
    if (!ownedItems.includes(FTUE_ITEM_ID))
    {
        return clockBuyable ? 'shop' : 'free';
    }
    return decorateVisited ? 'free' : 'decorate';
}
