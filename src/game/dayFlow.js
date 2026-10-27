import { economy, getEconomyState } from './economy.js';
import { resumeBgm } from './audio.js';
import { dayStartScreens } from '../core/economy.js';

/**
 * dayFlow.js
 *
 * Starting a day: the screens that come between clicking "Next Day" and the day's gameplay. Which
 * ones apply is decided by the pure rule core/economy.dayStartScreens (a promotion screen on days 20
 * and 40, a bonus screen on days with a start-of-day bonus), in that order; this just walks through
 * them, one scene each (the gameplay music stays paused through them), and finally starts the day's first truck (whose own day-start popup then
 * appears).
 */

/** The order the screens appear in. */
const ORDER = ['promotion', 'bonus'];

/** Scene keys for each screen. */
const SCENE_FOR = { promotion: 'PromotionScene', bonus: 'BonusScene' };

/**
 * Moves on to the next step of starting a day: the next screen that applies, or - when none are
 * left - the first truck of the day.
 *
 * @param {import('phaser').Scene} scene - the scene that is finishing (it is replaced).
 * @param {number} levelIndex - 0-based index of the day being started.
 * @param {'promotion' | 'bonus' | null} [after] - the screen that has just been shown (null when
 *   coming from the end-of-day paycheck, i.e. before any of them).
 */
export function startDay(scene, levelIndex, after = null)
{
    const claimed = getEconomyState(scene.registry).claimedBonuses;
    const done = after ? ORDER.indexOf(after) : -1;
    const next = dayStartScreens(levelIndex + 1, claimed, economy).find((screen) => ORDER.indexOf(screen) > done);
    if (next)
    {
        scene.scene.start(SCENE_FOR[next], { levelIndex });
    }
    else
    {
        // The promotion and bonus screens keep the gameplay music paused; it comes back as gameplay begins.
        resumeBgm('gameplay-bgm');
        scene.scene.start('PuzzleScene', { levelIndex, truckIndex: 0 });
    }
}
