import { loadSave, writeSave, clearSave } from '../save.js';
import { mergeSave, defaultSaveState, SAVE_VERSION, TIP_FLAGS } from '../core/saveState.js';
import { rankForDay } from '../core/economy.js';
import { loadShapeLevels } from '../data/loadLevel.js';
import shapeLevelsRaw from '../data/levels.shapes.json';
import { economy, getEconomyState, setEconomyState, resetEconomy } from './economy.js';
import { isMusicMuted, isSfxMuted, restoreMute, resumeBgm } from './audio.js';
import { startDay } from './dayFlow.js';

/**
 * progress.js (game layer)
 *
 * Saving and loading the player's progress. It is the bridge between three things:
 *
 *   - the running game, whose state lives in the Phaser registry (money, apartment, tutorial flags...)
 *     and in the audio module (mute toggles);
 *   - the save FORMAT and its validation (core/saveState.js); and
 *   - the storage itself (src/save.js, the only code that touches localStorage).
 *
 * WHEN THE GAME IS SAVED - only at these moments, never per frame:
 *
 *   1. Every truck packed (commitTruck): the truck's pay and the number of trucks done are saved.
 *   2. End of a workday, as the results screen appears (commitDay): the save says "start the NEXT day",
 *      with the day's pay and bonuses in the wallet.
 *   3. Every purchase in the shop.            (saveProgress)
 *   4. Every apartment change (item placed, moved, removed; Undo / Redo / Clear; a wallpaper pick).
 *   5. A mute toggle                          (saveMute).
 *
 * A save therefore always describes the START of a truck. If the player quits or reloads, Continue
 * restarts the truck they were on (the trucks already packed stay packed). A truck that has been won but
 * not yet committed - only possible for the day's last truck and an overtime truck, which end in the
 * overtime offer / the report instead of a commit - never leaks into a save: captureState holds its pay back.
 *
 * The flow is: Boot calls initSave() ONCE to read and validate the stored save. The title screen asks
 * hasSave() whether to offer Continue. Continue calls continueGame(); New Game calls startNewGame().
 */

/** Registry key: the 0-based level (day - 1) the next save should name as the day to play. */
const NEXT_LEVEL_KEY = 'saveNextLevel';

/** Registry key: how many of that day's trucks are packed and committed (0 = the day starts afresh). */
const TRUCK_KEY = 'saveTruck';

/**
 * The save as last read or written this session (a full, validated state), or null if there is none.
 * Keeping it in memory means the title screen can answer "is there a save?" without touching storage
 * again, Continue works for the rest of the session even if storage is blocked and writes failed, and a
 * mute toggle in the middle of a day can rewrite the last committed state instead of the live one.
 */
let currentSave = null;

/** The validated level list, loaded lazily (it throws on bad level data, so only when first needed). */
let levels = null;

/** @returns {Array<{trucks: Array}>} every day's level data. */
function getLevels()
{
    if (levels === null)
    {
        levels = loadShapeLevels(shapeLevelsRaw);
    }
    return levels;
}

/** @returns {number} the number of days in the game. */
function getLevelCount()
{
    return getLevels().length;
}

/**
 * Reads the stored save, once, at start-up (called by the Boot scene before the title screen).
 *
 * The ?resetsave=1 URL switch is handled here: it deletes the stored save BEFORE it is read, so the
 * game starts completely fresh. The switch is then removed from the address bar, so reloading the
 * page afterwards does not wipe the new progress too.
 *
 * Also puts the saved mute choices back into the audio module, so a muted game stays muted.
 */
export function initSave()
{
    try
    {
        const params = new URLSearchParams(window.location.search);
        if (params.get('resetsave') === '1')
        {
            clearSave();
            params.delete('resetsave');
            const query = params.toString();
            window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
        }
    }
    catch
    {
        // No window.location / history (not in a browser): there is nothing to reset or tidy.
    }

    // mergeSave validates every field and returns null for anything unusable (see core/saveState.js).
    currentSave = mergeSave(loadSave(), { maxDay: getLevelCount() });
    if (currentSave)
    {
        restoreMute(currentSave.muted.music, currentSave.muted.sfx);
    }
}

/** @returns {boolean} whether there is a saved game to continue (the title screen offers Continue). */
export function hasSave()
{
    return currentSave !== null;
}

/**
 * Builds the save object from the live game state (see saveProgress).
 *
 * The save names the last COMMITTED truck boundary: `truck` trucks of the day are packed. The paycheck
 * log can be ahead of that - a truck that was won but not committed (the day's last truck while the
 * overtime offer is up, or an overtime truck) - and its pay is already in the live wallet, so it is
 * taken back out. Otherwise reloading would replay that truck and pay for it a second time. Purchases
 * made since the boundary stay, because they are subtracted from the same wallet.
 *
 * @param {import('phaser').Data.DataManager} registry
 * @returns {object} a state in the shape core/saveState.js describes.
 */
function captureState(registry)
{
    const day = (registry.get(NEXT_LEVEL_KEY) ?? 0) + 1;
    const truck = registry.get(TRUCK_KEY) ?? 0;
    const wallet = getEconomyState(registry);

    // Lines for the committed trucks stay in the save; later ones (uncommitted) are held back from the money.
    const fullLog = registry.get('dayTruckLog') ?? [];
    const truckLog = fullLog.slice(0, truck).map(({ tier, amount }) => ({ tier, amount }));
    const heldBack = fullLog.slice(truck).reduce((sum, line) => sum + line.amount, 0);
    const money = Math.max(0, wallet.money - heldBack);

    // The apartment's layout is kept as { [id]: { x, y } } (RoomLayout.serialize); the save stores a list.
    const layout = registry.get('apartmentLayout') ?? {};
    const placedItems = Object.entries(layout).map(([id, spot]) => ({ id, x: spot.x, y: spot.y }));
    // The phone (portrait) room has its own arrangement (a different tile grid).
    const portraitLayout = registry.get('apartmentLayoutPortrait') ?? {};
    const placedItemsPortrait = Object.entries(portraitLayout).map(([id, spot]) => ({ id, x: spot.x, y: spot.y }));

    return {
        v: SAVE_VERSION,
        day,
        truck,
        truckLog,
        money,
        ownedItems: [...wallet.ownedItems],
        claimedBonuses: [...wallet.claimedBonuses],
        // Written for information only; on load the rank is always worked out from the day.
        rank: rankForDay(day, economy).rank,
        placedItems,
        placedItemsPortrait,
        seenItems: [...(registry.get('seenItems') ?? [])],
        wallpaper: registry.get('apartmentWallpaper') ?? null,
        muted: { music: isMusicMuted(), sfx: isSfxMuted() },
        seenIntro: Boolean(registry.get('ftueDone')),
        tips: Object.fromEntries(TIP_FLAGS.map((name) => [name, Boolean(registry.get(name))])),
    };
}

/**
 * Saves the game as it stands at the last truck boundary: a shop purchase, an apartment change, a
 * skipped tutorial, a packed truck, the results screen. See captureState for what is (not) included.
 *
 * @param {import('phaser').Data.DataManager} registry - scene.registry.
 */
export function saveProgress(registry)
{
    currentSave = captureState(registry);
    writeSave(currentSave);
}

/**
 * A truck has just been packed (and paid): saves, so quitting from now on only loses the truck after it.
 * Not used for the day's last truck, which leads into the overtime offer / the report (commitDay).
 *
 * @param {import('phaser').Data.DataManager} registry
 * @param {number} trucksDone - how many of the day's trucks are packed now (the finished truck's 0-based index + 1).
 */
export function commitTruck(registry, trucksDone)
{
    registry.set(TRUCK_KEY, trucksDone);
    saveProgress(registry);
}

/**
 * The end of a workday, as the results screen appears: the day is over, so its pay and bonuses are in
 * the wallet and the save is written naming the NEXT day, from its first truck. (After the very last
 * day the save names that last day again, so Continue replays it.) The paycheck log is cleared here,
 * once the report has its own copy of it, so the next day starts with an empty one.
 *
 * @param {import('phaser').Data.DataManager} registry
 * @param {number} nextLevelIndex - 0-based index of the day that follows the one just finished.
 */
export function commitDay(registry, nextLevelIndex)
{
    registry.set(NEXT_LEVEL_KEY, Math.min(nextLevelIndex, getLevelCount() - 1));
    registry.set(TRUCK_KEY, 0);
    registry.set('dayTruckLog', []);
    saveProgress(registry);
}

/**
 * A mute toggle: rewrites the LAST SAVED state with the new mute choices, so it never changes anything
 * else. (With no save yet it writes a new-game state carrying just the mute choices.)
 */
export function saveMute()
{
    currentSave = { ...(currentSave ?? defaultSaveState()), muted: { music: isMusicMuted(), sfx: isSfxMuted() } };
    writeSave(currentSave);
}

/**
 * Starts a brand-new game: forgets the stored save and resets every piece of progress - empty wallet,
 * nothing claimed or owned, an empty apartment with the original wall, all the tutorials to show
 * again. The mute choices are kept (they are the player's settings, not progress).
 *
 * @param {import('phaser').Data.DataManager} registry - scene.registry.
 * @param {Object} [options]
 * @param {boolean} [options.returning] - the player already had a game (they chose New Game over a
 *   save), so they are offered a Skip button for the tutorial. A first-time player is not.
 */
export function startNewGame(registry, { returning = false } = {})
{
    clearSave();
    currentSave = null;

    resetEconomy(registry);
    registry.set('apartmentLayout', {});
    registry.set('apartmentLayoutPortrait', {});
    registry.set('seenItems', []);
    registry.set('apartmentWallpaper', null);
    registry.set('ftueDone', false);
    for (const name of TIP_FLAGS)
    {
        registry.set(name, false);
    }
    registry.set('skipOffered', returning);
    registry.set(NEXT_LEVEL_KEY, 0);
    registry.set(TRUCK_KEY, 0);
    registry.set('dayTruckLog', []);
}

/**
 * @param {import('phaser').Data.DataManager} registry
 * @returns {boolean} whether the tutorial can still be skipped: the player was offered the Skip
 *   button (a returning player on a new game) and has not pressed it yet.
 */
export function isTutorialSkippable(registry)
{
    return Boolean(registry.get('skipOffered')) && !registry.get('tutorialSkipped');
}

/**
 * Switches the whole tutorial off for good: the first-day guide, the boss's tips, the hint tip, the
 * shop / apartment tips and the shop -> decorate trail (hand cursors, pulses and locks). The flags are
 * the same ones the tutorial sets as it goes, so each part simply believes it has already happened.
 * They are saved at once. The Hint button's nudge when
 * the player sits idle is NOT part of the tutorial and is untouched. The caller tidies its own screen.
 *
 * @param {import('phaser').Data.DataManager} registry
 */
export function skipTutorial(registry)
{
    registry.set('ftueDone', true);
    for (const name of TIP_FLAGS)
    {
        registry.set(name, true);
    }
    saveProgress(registry);
}

/**
 * Loads the saved game into the registry and resumes it: a day with no truck packed yet starts from its
 * first truck (through the promotion / bonus screens if it has them - see dayFlow.js); a day part-way
 * through goes straight to its next unpacked truck, with the packed trucks' pay lines restored for the
 * end-of-day report. Only the truck that was being played starts over.
 *
 * @param {import('phaser').Scene} scene - the scene to start the game from (the title screen).
 */
export function continueGame(scene)
{
    const state = currentSave ?? defaultSaveState();
    const registry = scene.registry;

    setEconomyState(registry, { money: state.money, claimedBonuses: [...state.claimedBonuses], ownedItems: [...state.ownedItems] });
    registry.set('apartmentLayout', Object.fromEntries(state.placedItems.map(({ id, x, y }) => [id, { x, y }])));
    registry.set('apartmentLayoutPortrait', Object.fromEntries(state.placedItemsPortrait.map(({ id, x, y }) => [id, { x, y }])));
    registry.set('seenItems', [...state.seenItems]);
    registry.set('apartmentWallpaper', state.wallpaper);
    registry.set('ftueDone', state.seenIntro);
    for (const name of TIP_FLAGS)
    {
        registry.set(name, state.tips[name]);
    }

    const levelIndex = Math.min(state.day, getLevelCount()) - 1;
    // A truck number beyond the day's trucks (a save from level data that has since changed) is nonsense:
    // fall back to the start of the day, whose pay lines would no longer match.
    const truck = state.truck < getLevels()[levelIndex].trucks.length ? state.truck : 0;
    registry.set(NEXT_LEVEL_KEY, levelIndex);
    registry.set(TRUCK_KEY, truck);
    registry.set('dayTruckLog', truck > 0 ? state.truckLog.map((line) => ({ ...line, overtime: false })) : []);

    if (truck === 0)
    {
        startDay(scene, levelIndex);
    }
    else
    {
        // The day's promotion / bonus screens already happened before the truck that was packed.
        resumeBgm('gameplay-bgm');
        scene.scene.start('PuzzleScene', { levelIndex, truckIndex: truck });
    }
}
