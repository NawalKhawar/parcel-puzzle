/**
 * save.js
 *
 * The ONLY file in the project that touches localStorage. It is deliberately tiny and knows nothing
 * about what is inside a save: it just stores and fetches one JSON object under one key. Everything
 * about the save's contents (fields, validation, defaults) lives elsewhere (src/core/saveState.js and
 * src/game/progress.js), so a different backend - a platform SDK, a server - can replace this file
 * later without any game code changing, as long as these three exports keep their names and shapes.
 *
 * Every function is wrapped in try/catch because localStorage can throw at ANY access: private
 * windows, blocked site data, a full disk quota, or no localStorage at all (the Node test runner).
 * A save must never be able to crash the game, so every failure is swallowed.
 */

/** The localStorage key the save lives under. The "_v1" is the storage format, not the game version. */
const SAVE_KEY = 'parcel_save_v1';

/**
 * Reads the saved game, if there is a usable one.
 *
 * @returns {object | null} the parsed save object, or null when there is none, it is not valid JSON,
 *   it is not a plain object, or storage cannot be read. (Whether its CONTENTS make sense is decided
 *   later, field by field, by core/saveState.mergeSave.)
 */
export function loadSave()
{
    try
    {
        const text = window.localStorage.getItem(SAVE_KEY);
        if (text === null)
        {
            return null;
        }
        const data = JSON.parse(text);
        // JSON.parse also accepts numbers, strings, arrays and null; only an object can be a save.
        return data !== null && typeof data === 'object' && !Array.isArray(data) ? data : null;
    }
    catch
    {
        return null; // corrupt JSON, blocked storage... treated exactly like "no save".
    }
}

/**
 * Stores the game state, replacing any earlier save. Fails silently (the game just carries on
 * unsaved) if storage is unavailable, full, or the state cannot be turned into JSON.
 *
 * @param {object} state - plain data (numbers, text, booleans, arrays, plain objects).
 */
export function writeSave(state)
{
    try
    {
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    }
    catch
    {
        // Not saved. Nothing useful can be done about it from here.
    }
}

/**
 * Deletes the saved game. Used by New Game and by the ?resetsave=1 debug switch.
 */
export function clearSave()
{
    try
    {
        window.localStorage.removeItem(SAVE_KEY);
    }
    catch
    {
        // Storage unavailable: there is nothing stored that we could remove anyway.
    }
}
