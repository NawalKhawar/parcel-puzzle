/**
 * saveState.js
 *
 * What a saved game looks like, and how to turn whatever was found in storage into a trustworthy
 * game state. Pure data and plain functions - no Phaser, no localStorage (that is src/save.js) - so
 * it can be tested in Node and the format can change in one place.
 *
 * The saved object is one flat JSON object:
 *
 *   v                 format version (1). Bump it, and teach mergeSave to upgrade, if the format changes.
 *   day               the day to play, 1-based (the game calls this levelIndex + 1): the day after the one
 *                     just finished, or the day still in progress.
 *   truck             how many of that day's trucks are already packed (0 = start the day from its first
 *                     truck). A save is written after every packed truck, so quitting loses only the truck
 *                     that was being played. Trucks packed are final: their pay is in `money`.
 *   truckLog          [{ tier, amount }] - one line per packed truck (exactly `truck` of them), so the
 *                     end-of-day report still lists the trucks packed before a quit.
 *   money, ownedItems, claimedBonuses
 *                     the economy state (core/economy.js EconomyState). `money` never includes pay for a
 *                     truck that is not in `truckLog`.
 *   rank              the pay rank in force on `day`. Informational: the game always works the rank
 *                     out from the day, so a hand-edited value can never change the pay.
 *   placedItems       [{ id, x, y }] - the furniture in the apartment, by the tile its corner is on.
 *   wallpaper         the chosen wallpaper's id, or null for the original wall.
 *   muted             { music, sfx } - the two pause-menu toggles.
 *   seenIntro         true once the first-day guide has been completed.
 *   tips              { [flag]: boolean } - which of the boss's later tips / first-day trail steps
 *                     have been shown (see TIP_FLAGS), so Continue does not repeat tutorials.
 */

/** The version this code writes, and the newest one it can read. */
export const SAVE_VERSION = 1;

/**
 * The yes/no flags for the boss's later tips, the first-day shop -> decorate trail and the tutorial
 * Skip button. (The first day's main guide is the separate top-level `seenIntro`.) Each one is a
 * registry key of the same name. A flag missing from an older save is simply false.
 */
export const TIP_FLAGS = [
    'workloadTipDone',
    'hintTipDone',
    'hintEverUsed',
    'shopTipShown',
    'shopVisited',
    'decorateVisited',
    'apartmentTipDone',
    // A returning player (New Game over an existing save) is offered a Skip button for the tutorial...
    'skipOffered',
    // ...and once they press it, every prompt, highlight and lock of the tutorial stays off for good.
    'tutorialSkipped',
];

/**
 * @returns {object} the state of a brand-new game: day 1, no trucks done, no money, nothing owned or
 *   placed, sound on, no tutorial seen. Every field mergeSave can fill in is present here.
 */
export function defaultSaveState()
{
    return {
        v: SAVE_VERSION,
        day: 1,
        truck: 0,
        truckLog: [],
        money: 0,
        ownedItems: [],
        claimedBonuses: [],
        rank: 1,
        placedItems: [],
        wallpaper: null,
        muted: { music: false, sfx: false },
        seenIntro: false,
        tips: Object.fromEntries(TIP_FLAGS.map((flag) => [flag, false])),
    };
}

// ------------------------------------------------------------------ small validators
// Each returns the value if it is valid and otherwise the fallback - never throws, so one bad field
// in a hand-edited or damaged save only resets that field, not the whole game.

/** @returns {boolean} whether `value` is a non-null, non-array object. */
function isPlainObject(value)
{
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A whole number (no fraction, not NaN/Infinity) that is at least `min`; else the fallback. */
function wholeNumber(value, min, fallback)
{
    return Number.isSafeInteger(value) && value >= min ? value : fallback;
}

/** Strictly `true` counts as true; anything else (including the string "true") is false. */
function flag(value)
{
    return value === true;
}

/**
 * A list of text ids. Not a list -> the fallback (empty). Entries that are not non-empty text are
 * dropped and repeats removed, so a mostly-good list keeps what is good.
 */
function idList(value)
{
    if (!Array.isArray(value))
    {
        return [];
    }
    return [...new Set(value.filter((entry) => typeof entry === 'string' && entry.length > 0))];
}

/**
 * The placed furniture: a list of { id, x, y } with a text id and whole-number tile coordinates.
 * Malformed entries are dropped, and an id that appears twice keeps only its first entry (an item
 * can only be in one place - the game's layout is keyed by id).
 */
function placedList(value)
{
    if (!Array.isArray(value))
    {
        return [];
    }
    const seen = new Set();
    const result = [];
    for (const entry of value)
    {
        if (
            isPlainObject(entry) &&
            typeof entry.id === 'string' && entry.id.length > 0 && !seen.has(entry.id) &&
            Number.isSafeInteger(entry.x) && Number.isSafeInteger(entry.y)
        )
        {
            seen.add(entry.id);
            result.push({ id: entry.id, x: entry.x, y: entry.y });
        }
    }
    return result;
}

/**
 * The packed-truck lines: a list of { tier, amount } with a text tier name and a whole-number pay.
 * Malformed entries are dropped. Saved trucks are never overtime (an overtime truck is not resumable),
 * so the game adds `overtime: false` when it loads them.
 */
function truckLogList(value)
{
    if (!Array.isArray(value))
    {
        return [];
    }
    return value
        .filter((entry) => isPlainObject(entry) && typeof entry.tier === 'string' && entry.tier.length > 0 && Number.isSafeInteger(entry.amount) && entry.amount >= 0)
        .map((entry) => ({ tier: entry.tier, amount: entry.amount }));
}

// ------------------------------------------------------------------ the merge

/**
 * Turns whatever was read from storage into a complete, valid game state - or null if it is not a
 * usable save at all.
 *
 * It is a MERGE over the new-game defaults: every field is checked on its own, and a field that is
 * missing (an older save from before the field existed) or the wrong type falls back to its default
 * rather than failing the whole save. So adding a field later never invalidates existing saves.
 *
 * Returns null (= "start fresh, there is nothing to continue") when `raw` is not an object, has no
 * sensible version number, or was written by a NEWER version of the game than this one (we cannot
 * know what its fields mean, and guessing could corrupt it).
 *
 * @param {unknown} raw - the parsed JSON from storage (src/save.js loadSave).
 * @param {Object} [options]
 * @param {number} [options.maxDay] - how many days the game has; a saved day beyond it is capped.
 * @returns {object | null} a full state shaped like defaultSaveState(), or null.
 */
export function mergeSave(raw, { maxDay = Infinity } = {})
{
    if (!isPlainObject(raw) || !Number.isSafeInteger(raw.v) || raw.v < 1 || raw.v > SAVE_VERSION)
    {
        return null;
    }

    const defaults = defaultSaveState();
    const muted = isPlainObject(raw.muted) ? raw.muted : {};
    const tips = isPlainObject(raw.tips) ? raw.tips : {};
    // A rank above the day's real one would be harmless (it is never used for pay) - but keep it
    // a sane whole number anyway.
    // `truck` and `truckLog` must agree (one log line per packed truck): the log decides how many trucks
    // there are evidence for, and extra lines are dropped. An older save without them starts the day afresh.
    const log = truckLogList(raw.truckLog);
    const truck = Math.min(wholeNumber(raw.truck, 0, defaults.truck), log.length);
    return {
        v: SAVE_VERSION,
        day: Math.min(wholeNumber(raw.day, 1, defaults.day), maxDay),
        truck,
        truckLog: log.slice(0, truck),
        money: wholeNumber(raw.money, 0, defaults.money),
        ownedItems: idList(raw.ownedItems),
        claimedBonuses: idList(raw.claimedBonuses),
        rank: wholeNumber(raw.rank, 1, defaults.rank),
        placedItems: placedList(raw.placedItems),
        wallpaper: typeof raw.wallpaper === 'string' && raw.wallpaper.length > 0 ? raw.wallpaper : null,
        muted: { music: flag(muted.music), sfx: flag(muted.sfx) },
        seenIntro: flag(raw.seenIntro),
        tips: Object.fromEntries(TIP_FLAGS.map((name) => [name, flag(tips[name])])),
    };
}
