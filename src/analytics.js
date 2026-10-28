/**
 * analytics.js
 *
 * The ONLY file that talks to GameAnalytics (the official JavaScript SDK, npm package "gameanalytics").
 * Everything else in the game calls the small track* functions below at the right moments.
 *
 * SAFETY. Analytics must never be able to hurt the game:
 *   - every exported function is wrapped in try/catch and does nothing on any failure;
 *   - if the keys in analyticsConfig.js are still placeholders, the page has ?noanalytics=1, or the SDK could not
 *     be loaded / initialised (an ad blocker, offline...), every function silently does nothing;
 *   - the SDK is loaded with a dynamic import(), so it arrives as a separate file AFTER the first screen is up
 *     and can never delay it. Events asked for while it is still loading wait in a short queue.
 *
 * WHAT IS SENT. Only the events named below. No names, e-mail or other personal data are added: the SDK's own
 * defaults (a random anonymous user id kept in the browser's storage, device / OS / browser type) are all that
 * identifies a player. Nothing is sent from update loops or on every drag / placement.
 *
 * EVENT SHAPES (see the SDK docs, "Event Tracking"):
 *   progression:  Start / Complete of  "Day03"                      - one per workday
 *                 Start / Complete of  "Day03" > "Truck2" > "easy"  - one per truck (day, truck number, tier)
 *   design:       "Tutorial:Step1"  "Hint:Paid:Day03"  "Reset:Day03"  "Shop:Purchase:<itemId>"
 *                 "Shop:Opened"  "Apartment:Opened"  "Menu:NewGame"  "Menu:Continue"
 *                 (a design event id is 1-5 ':'-separated segments of at most 32 characters.)
 *
 * DAY / TRUCK BOOKKEEPING. A Start is only sent when nothing of that kind is already open, and a Complete only
 * when its Start is open. So scenes may call these freely (a scene is rebuilt after a shop visit or a rotated
 * phone) without duplicating events. A day or truck that is started but never completed is exactly what shows
 * up as drop-off in the dashboard; a reloaded page starts with nothing open, so it sends a fresh Start. Choosing
 * New Game / Continue from the menu also closes anything open (the player left that attempt).
 */

import { GA_GAME_KEY, GA_SECRET_KEY, GA_BUILD_VERSION } from './analyticsConfig.js';

/** The values of the placeholders analyticsConfig.js ships with: analytics stays off while a key still has one. */
const PLACEHOLDERS = ['YOUR_GAME_KEY', 'YOUR_SECRET_KEY'];

/** Events asked for before the SDK finished loading wait here (capped, so an SDK that never loads cannot grow it). */
const MAX_QUEUED = 60;

/** The loaded SDK ({ GameAnalytics, EGAProgressionStatus }) once ready, else null. */
let sdk = null;
/** 'idle' (not started) | 'loading' | 'ready' | 'off' (disabled or failed for good). */
let state = 'idle';
/** Calls waiting for the SDK. */
let queue = [];
/** The day (number) whose Start is open (sent, no Complete yet), or null. */
let openDay = null;
/** The truck whose Start is open, as "day:truckIndex", or null. */
let openTruck = null;

/** @returns {URLSearchParams} the page address's query (empty if it cannot be read). */
function pageQuery()
{
    try
    {
        return new URLSearchParams(window.location.search);
    }
    catch
    {
        return new URLSearchParams();
    }
}

/**
 * Runs something against the SDK: now if it is ready, after loading if it is loading, never if analytics is off.
 * Any error is swallowed.
 *
 * @param {(sdk: {GameAnalytics: any, EGAProgressionStatus: any}) => void} job
 */
function run(job)
{
    try
    {
        if (state === 'ready' && sdk)
        {
            job(sdk);
        }
        else if (state === 'loading' && queue.length < MAX_QUEUED)
        {
            queue.push(job);
        }
    }
    catch
    {
        // Analytics must never break the game.
    }
}

/** @param {number} day @returns {string} "Day03": zero-padded so the dashboard sorts the days correctly. */
function dayName(day)
{
    return `Day${String(day).padStart(2, '0')}`;
}

/** @param {number} truckIndex - 0-based. @returns {string} "Truck2" (1-based, as a player counts them). */
function truckName(truckIndex)
{
    return `Truck${truckIndex + 1}`;
}

/**
 * Starts analytics, once. Call it after the save is loaded; it returns at once and never throws. Does nothing if
 * the keys are placeholders or the page has ?noanalytics=1.
 */
export function initAnalytics()
{
    try
    {
        if (state !== 'idle')
        {
            return;
        }
        const query = pageQuery();
        const keysAreReal = ![GA_GAME_KEY, GA_SECRET_KEY].some((key) => typeof key !== 'string' || key.length === 0 || PLACEHOLDERS.includes(key));
        if (query.get('noanalytics') === '1' || !keysAreReal)
        {
            state = 'off';
            return;
        }
        state = 'loading';

        // Which build the events are labelled with: the release string, or marked as a test session so it can be
        // told apart from real players in the dashboard (the Build filter).
        const dev = Boolean(import.meta.env && import.meta.env.DEV);
        const testing = query.get('gatest') === '1';
        const build = testing ? `${GA_BUILD_VERSION}-test` : dev ? `${GA_BUILD_VERSION}-dev` : GA_BUILD_VERSION;

        // A separate file, fetched after the first screen is up. Blocked / offline: the promise fails and analytics is off.
        import('gameanalytics')
            .then((module) => {
                try
                {
                    const { GameAnalytics, EGAProgressionStatus } = module.gameanalytics;
                    // Order from the SDK docs: configuration first, then initialize (some settings cannot change after it).
                    GameAnalytics.setEnabledInfoLog(testing || dev); // console messages while testing only
                    GameAnalytics.configureBuild(build);
                    GameAnalytics.initialize(GA_GAME_KEY, GA_SECRET_KEY);
                    sdk = { GameAnalytics, EGAProgressionStatus };
                    state = 'ready';
                    const waiting = queue;
                    queue = [];
                    waiting.forEach(run);
                }
                catch
                {
                    state = 'off';
                    queue = [];
                }
            })
            .catch(() => {
                state = 'off';
                queue = [];
            });
    }
    catch
    {
        state = 'off';
    }
}

// ------------------------------------------------------------------ progression events (days and trucks)

/**
 * A workday begins (its first truck is starting - or, after a reload / Continue, the truck the player resumes at).
 * Sends Start for "DayNN" unless that day's Start is already open.
 *
 * @param {number} day - 1-based day number.
 */
export function trackDayStart(day)
{
    try
    {
        if (openDay === day)
        {
            return;
        }
        openDay = day;
        run(({ GameAnalytics, EGAProgressionStatus }) => GameAnalytics.addProgressionEvent(EGAProgressionStatus.Start, dayName(day)));
    }
    catch
    {
        // never break the game
    }
}

/**
 * The workday is finished (the end-of-day results screen appeared). Sends Complete for "DayNN", but only if that
 * day's Start is open - so rebuilding the results screen (after a shop visit, a rotated phone) sends nothing more.
 *
 * @param {number} day - 1-based day number.
 */
export function trackDayComplete(day)
{
    try
    {
        if (openDay !== day)
        {
            return;
        }
        openDay = null;
        run(({ GameAnalytics, EGAProgressionStatus }) => GameAnalytics.addProgressionEvent(EGAProgressionStatus.Complete, dayName(day)));
    }
    catch
    {
        // never break the game
    }
}

/**
 * A truck's puzzle appears. Sends Start for "DayNN" > "TruckN" > tier (the second and third progression levels),
 * unless that truck's Start is already open (a truck picked up again after a shop visit is the same attempt).
 *
 * @param {number} day - 1-based day number.
 * @param {number} truckIndex - 0-based index of the truck within the day (an overtime truck comes after the regular ones).
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'.
 */
export function trackTruckStart(day, truckIndex, difficulty)
{
    try
    {
        const key = `${day}:${truckIndex}`;
        if (openTruck === key)
        {
            return;
        }
        openTruck = key;
        run(({ GameAnalytics, EGAProgressionStatus }) =>
            GameAnalytics.addProgressionEvent(EGAProgressionStatus.Start, dayName(day), truckName(truckIndex), String(difficulty)));
    }
    catch
    {
        // never break the game
    }
}

/**
 * The truck's grid is full. Sends Complete for the same "DayNN" > "TruckN" > tier, if its Start is open.
 *
 * @param {number} day
 * @param {number} truckIndex
 * @param {string} difficulty
 */
export function trackTruckComplete(day, truckIndex, difficulty)
{
    try
    {
        if (openTruck !== `${day}:${truckIndex}`)
        {
            return;
        }
        openTruck = null;
        run(({ GameAnalytics, EGAProgressionStatus }) =>
            GameAnalytics.addProgressionEvent(EGAProgressionStatus.Complete, dayName(day), truckName(truckIndex), String(difficulty)));
    }
    catch
    {
        // never break the game
    }
}

// ------------------------------------------------------------------ design events

/**
 * Sends one design event (an id of 1-5 ':'-separated segments, each at most 32 characters; the optional value
 * becomes a sum / mean in the dashboard).
 *
 * @param {string} eventId
 * @param {number} [value]
 */
function design(eventId, value)
{
    run(({ GameAnalytics }) => (value === undefined ? GameAnalytics.addDesignEvent(eventId) : GameAnalytics.addDesignEvent(eventId, value)));
}

/**
 * The first-time tutorial reached a step: "Tutorial:Step1", "Tutorial:Step2"...
 *
 * @param {number} step - 1-based step number.
 */
export function trackTutorialStep(step)
{
    try
    {
        design(`Tutorial:Step${step}`);
    }
    catch
    {
        // never break the game
    }
}

/**
 * A PAID hint was used: "Hint:Paid:DayNN", with the truck number as the event's value.
 *
 * @param {number} day
 * @param {number} truckIndex - 0-based; sent as the 1-based truck number.
 */
export function trackHintUsed(day, truckIndex)
{
    try
    {
        design(`Hint:Paid:${dayName(day)}`, truckIndex + 1);
    }
    catch
    {
        // never break the game
    }
}

/**
 * The player reset a truck: "Reset:DayNN", with the truck number as the value.
 *
 * @param {number} day
 * @param {number} truckIndex - 0-based; sent as the 1-based truck number.
 */
export function trackReset(day, truckIndex)
{
    try
    {
        design(`Reset:${dayName(day)}`, truckIndex + 1);
    }
    catch
    {
        // never break the game
    }
}

/**
 * A shop item was bought: "Shop:Purchase:<itemId>".
 *
 * @param {string} itemId - e.g. 'clock' (ids in economy.json are at most 32 characters).
 */
export function trackPurchase(itemId)
{
    try
    {
        design(`Shop:Purchase:${String(itemId).slice(0, 32)}`);
    }
    catch
    {
        // never break the game
    }
}

/** The player opened the apartment: "Apartment:Opened". */
export function trackApartmentOpened()
{
    try
    {
        design('Apartment:Opened');
    }
    catch
    {
        // never break the game
    }
}

/** The player opened the shop: "Shop:Opened" (the same idea as Apartment:Opened). */
export function trackShopOpened()
{
    try
    {
        design('Shop:Opened');
    }
    catch
    {
        // never break the game
    }
}

/**
 * The player chose New Game or Continue (a brand-new game also counts when it starts from the single Start
 * Packing button): "Menu:NewGame" / "Menu:Continue". Whatever day / truck was open is closed, because the
 * player has left that attempt - the next day / truck that appears sends a fresh Start.
 *
 * @param {'new' | 'continue'} choice
 */
export function trackMenuChoice(choice)
{
    try
    {
        openDay = null;
        openTruck = null;
        design(choice === 'new' ? 'Menu:NewGame' : 'Menu:Continue');
    }
    catch
    {
        // never break the game
    }
}
