/**
 * economy.js
 *
 * The game's money rules as plain functions - what a truck pays, what a day pays, when bonuses and
 * promotions happen, what a hint or an overtime truck costs/pays, and whether the player may buy a
 * shop item. NO Phaser (see "Architectural boundary" in PROJECT_STRUCTURE.md), so every rule is
 * unit-tested and the whole economy can be simulated from a plain Node script.
 *
 * Every number comes from the config passed in (src/data/economy.json, validated by
 * data/loadEconomy.js) - nothing is hard-coded here. Every function takes the config as its LAST
 * argument, and none of them change what they are given: the state functions return a new state.
 *
 * Money is whole dollars everywhere. Anything that could produce a fraction (the overtime
 * multiplier) is rounded UP, and addMoney/spend refuse non-integers so a stray decimal can never
 * reach the wallet.
 *
 * A "day" is 1-based and equals a level (day 1 = levels[0]).
 */

/** @typedef {import('../data/loadEconomy.js').EconomyConfig} EconomyConfig */

/**
 * @typedef {Object} EconomyState - everything about the player's money that must be saved.
 * @property {number} money - the wallet, in whole dollars.
 * @property {string[]} claimedBonuses - ids of one-off bonuses already paid (never paid twice).
 * @property {string[]} ownedItems - ids of shop items bought (each can be bought only once).
 */

// ------------------------------------------------------------------ rounding

/**
 * Rounds UP to a whole number, ignoring floating-point noise. The danger with plain Math.ceil is a
 * product that SHOULD be whole coming out as, say, 18.000000000000004 and being rounded up to 19
 * (e.g. 15 * 1.2). Rounding to 6 decimals first removes that noise.
 *
 * @param {number} value
 * @returns {number} the smallest whole number that is at least `value`.
 */
export function roundUp(value) {
    return Math.ceil(Math.round(value * 1e6) / 1e6);
}

/**
 * Throws unless the value is a whole number - the guard that keeps decimals out of the economy.
 *
 * @param {number} value
 * @param {string} what - names the value in the error message.
 */
function assertWhole(value, what) {
    if (!Number.isInteger(value)) {
        throw new Error(`${what} must be a whole number of dollars (got ${value})`);
    }
}

// ------------------------------------------------------------------ ranks and pay

/**
 * The pay rank in force on a day: the last rank whose startDay has been reached.
 *
 * @param {number} day - 1-based.
 * @param {EconomyConfig} config
 * @returns {{rank: number, name: string, startDay: number, unitValue: number}}
 */
export function rankForDay(day, config) {
    let current = config.ranks[0];
    for (const rank of config.ranks) {
        if (day >= rank.startDay) {
            current = rank;
        }
    }
    return current;
}

/**
 * The rank the player is promoted TO when they start this day, or null if no promotion happens
 * then. Promotions are the days a rank above the first begins (days 20 and 40 in the shipped
 * config); pay stops rising after the last rank, so later days never promote.
 *
 * @param {number} day
 * @param {EconomyConfig} config
 * @returns {{rank: number, name: string, startDay: number, unitValue: number} | null}
 */
export function promotionRank(day, config) {
    return config.ranks.find((rank) => rank.rank > 1 && rank.startDay === day) ?? null;
}

/**
 * How much more the day's rank pays than the STARTING rank, as a whole percent of the starting pay
 * (rounded up): the number the promotion screen shows - "wages increased by 20% of starting pay".
 * Rank unit values $5 / $6 / $7 give 0 / 20 / 40.
 *
 * @param {number} day
 * @param {EconomyConfig} config
 * @returns {number} whole percent.
 */
export function promotionRaisePercent(day, config) {
    const base = config.ranks[0].unitValue;
    return roundUp(((rankForDay(day, config).unitValue - base) * 100) / base);
}

/**
 * What one truck of a tier pays on a day: the tier's units times the day's rank unit value.
 *
 * @param {string} tier - 'easy' | 'medium' | 'hard'.
 * @param {number} day
 * @param {EconomyConfig} config
 * @returns {number} whole dollars.
 */
export function payForTruck(tier, day, config) {
    const units = config.tiers[tier]?.units;
    if (units === undefined) {
        throw new Error(`unknown truck tier "${tier}"`);
    }
    return units * rankForDay(day, config).unitValue;
}

// ------------------------------------------------------------------ workload and day pay

/**
 * The trucks a day plays, one tier per truck, in play order (easy first). The last workload range
 * is open-ended, so days beyond the last configured one repeat its pattern.
 *
 * @param {number} day
 * @param {EconomyConfig} config
 * @returns {string[]} e.g. ['easy', 'easy', 'medium'].
 */
export function workloadForDay(day, config) {
    const range = config.workload.find((entry) => day >= entry.fromDay && (entry.toDay === null || day <= entry.toDay));
    if (!range) {
        throw new Error(`no workload configured for day ${day}`);
    }
    return range.trucks.flatMap((entry) => Array(entry.count).fill(entry.tier));
}

/**
 * The hardest tier the day plays - the tier an overtime truck is drawn from.
 *
 * @param {number} day
 * @param {EconomyConfig} config
 * @returns {string}
 */
export function highestTierForDay(day, config) {
    const tiers = workloadForDay(day, config);
    return tiers.reduce((best, tier) => (config.tiers[tier].units > config.tiers[best].units ? tier : best));
}

/**
 * What a day's trucks pay in total (before bonuses and overtime).
 *
 * @param {number} day
 * @param {EconomyConfig} config
 * @returns {number} whole dollars.
 */
export function dayPay(day, config) {
    return workloadForDay(day, config).reduce((sum, tier) => sum + payForTruck(tier, day, config), 0);
}

// ------------------------------------------------------------------ bonuses

/**
 * The one-off bonuses due on a day that have not been claimed yet. Each bonus is paid at one of two
 * moments, set by its `screen` flag in the config:
 *   'paycheck' (default) - on the day's paycheck, as its own line;
 *   'start'              - on its own Bonus screen shown BEFORE the day's gameplay (e.g. employee of
 *                          the week / month).
 *
 * @param {number} day
 * @param {string[]} claimedBonuses - ids already paid.
 * @param {EconomyConfig} config
 * @param {'paycheck' | 'start'} [when] - which moment's bonuses to list (default 'paycheck').
 * @returns {Array<{id: string, label: string, amount: number}>}
 */
export function bonusForDay(day, claimedBonuses, config, when = 'paycheck') {
    return config.bonuses
        .filter((bonus) => bonus.enabled && bonus.day === day && !claimedBonuses.includes(bonus.id) && (bonus.screen === true) === (when === 'start'))
        .map(({ id, label, amount }) => ({ id, label, amount }));
}

/**
 * The screens shown between clicking Next Day and the day's gameplay, in order: the 'promotion'
 * screen when the day brings a raise, then the 'bonus' screen when a start-of-day bonus is due.
 *
 * @param {number} day
 * @param {string[]} claimedBonuses
 * @param {EconomyConfig} config
 * @returns {Array<'promotion' | 'bonus'>}
 */
export function dayStartScreens(day, claimedBonuses, config) {
    const screens = [];
    if (promotionRank(day, config)) {
        screens.push('promotion');
    }
    if (bonusForDay(day, claimedBonuses, config, 'start').length > 0) {
        screens.push('bonus');
    }
    return screens;
}

// ------------------------------------------------------------------ hints and overtime

/**
 * The price of a paid hint on a day: the configured number of units at the day's rank.
 *
 * @param {number} day
 * @param {EconomyConfig} config
 * @returns {number} whole dollars.
 */
export function hintCost(day, config) {
    return config.hints.costUnits * rankForDay(day, config).unitValue;
}

/**
 * What an overtime truck of a tier pays: the normal pay times the multiplier, rounded UP.
 *
 * @param {string} tier
 * @param {number} day
 * @param {EconomyConfig} config
 * @returns {number} whole dollars.
 */
export function overtimePay(tier, day, config) {
    return roundUp(payForTruck(tier, day, config) * config.overtime.multiplier);
}

/**
 * The overtime offer made after a day's last truck, or null if there is none (overtime switched
 * off, or not one of the configured days). The extra truck is of the day's highest tier.
 *
 * @param {number} day
 * @param {EconomyConfig} config
 * @returns {{tier: string, pay: number} | null}
 */
export function overtimeOffer(day, config) {
    if (!config.overtime.enabled || !config.overtime.days.includes(day)) {
        return null;
    }
    const tier = highestTierForDay(day, config);
    return { tier, pay: overtimePay(tier, day, config) };
}

// ------------------------------------------------------------------ the saved state

/** @returns {EconomyState} a brand-new game's state: an empty wallet, nothing claimed or owned. */
export function createEconomyState() {
    return { money: 0, claimedBonuses: [], ownedItems: [] };
}

/**
 * Turns the state into plain data for saving.
 *
 * @param {EconomyState} state
 * @returns {{version: number, money: number, claimedBonuses: string[], ownedItems: string[]}}
 */
export function serializeEconomyState(state) {
    return { version: 1, money: state.money, claimedBonuses: [...state.claimedBonuses], ownedItems: [...state.ownedItems] };
}

/**
 * Rebuilds a state from saved data, rejecting anything malformed (a non-whole or negative wallet,
 * lists that are not lists of text). Duplicates in the lists are dropped.
 *
 * @param {unknown} data - what serializeEconomyState produced (possibly after a JSON round trip).
 * @returns {EconomyState}
 * @throws {Error} if the data is not a valid saved state.
 */
export function restoreEconomyState(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('saved economy state must be an object');
    }
    assertWhole(data.money, 'saved money');
    if (data.money < 0) {
        throw new Error('saved money cannot be negative');
    }
    const textList = (list, what) => {
        if (!Array.isArray(list) || !list.every((entry) => typeof entry === 'string')) {
            throw new Error(`saved ${what} must be a list of ids`);
        }
        return [...new Set(list)];
    };
    return {
        money: data.money,
        claimedBonuses: textList(data.claimedBonuses, 'claimedBonuses'),
        ownedItems: textList(data.ownedItems, 'ownedItems'),
    };
}

/**
 * Adds money to the wallet.
 *
 * @param {EconomyState} state
 * @param {number} amount - whole dollars, not negative.
 * @returns {EconomyState} a new state.
 */
export function addMoney(state, amount) {
    assertWhole(amount, 'an amount to add');
    if (amount < 0) {
        throw new Error('cannot add a negative amount');
    }
    return { ...state, money: state.money + amount };
}

/**
 * Pays out a day's unclaimed bonuses (those due at the given moment - see bonusForDay): adds them to
 * the wallet and records them as claimed, so they are never paid again - not on a second call, and
 * not after the state is saved and reloaded.
 *
 * @param {EconomyState} state
 * @param {number} day
 * @param {EconomyConfig} config
 * @param {'paycheck' | 'start'} [when] - default 'paycheck'.
 * @returns {{state: EconomyState, granted: Array<{id: string, label: string, amount: number}>}}
 */
export function claimBonuses(state, day, config, when = 'paycheck') {
    const granted = bonusForDay(day, state.claimedBonuses, config, when);
    const total = granted.reduce((sum, bonus) => sum + bonus.amount, 0);
    return {
        state: { ...addMoney(state, total), claimedBonuses: [...state.claimedBonuses, ...granted.map((bonus) => bonus.id)] },
        granted,
    };
}

// ------------------------------------------------------------------ hints (paid)

/**
 * Buys a paid hint: takes its price from the wallet if there is enough.
 *
 * @param {EconomyState} state
 * @param {number} day
 * @param {EconomyConfig} config
 * @returns {{ok: boolean, reason?: 'too-expensive', cost: number, state: EconomyState}} the state is
 *   unchanged when the purchase fails.
 */
export function purchaseHint(state, day, config) {
    const cost = hintCost(day, config);
    if (state.money < cost) {
        return { ok: false, reason: 'too-expensive', cost, state };
    }
    return { ok: true, cost, state: { ...state, money: state.money - cost } };
}

// ------------------------------------------------------------------ the shop

/**
 * @param {string} itemId
 * @param {EconomyConfig} config
 * @returns {EconomyConfig['shop'][number] | undefined} the shop entry, if there is one.
 */
export function shopItem(itemId, config) {
    return config.shop.find((item) => item.id === itemId);
}

/**
 * Where an item stands for the player right now:
 *   'disabled'      - switched off in the config (no art yet): never offered.
 *   'owned'         - already bought.
 *   'locked'        - the day has not reached the item's unlockDay.
 *   'too-expensive' - unlocked but the wallet is short.
 *   'buyable'       - can be bought now.
 *
 * @param {string} itemId
 * @param {number} day - the current day.
 * @param {EconomyState} state
 * @param {EconomyConfig} config
 * @param {{allowDisabled?: boolean}} [options] - treat disabled items as normal (used by the simulation).
 * @returns {'disabled' | 'owned' | 'locked' | 'too-expensive' | 'buyable'}
 */
export function shopStatus(itemId, day, state, config, { allowDisabled = false } = {}) {
    const item = shopItem(itemId, config);
    if (!item) {
        throw new Error(`unknown shop item "${itemId}"`);
    }
    if (!item.enabled && !allowDisabled) {
        return 'disabled';
    }
    if (state.ownedItems.includes(itemId)) {
        return 'owned';
    }
    if (day < item.unlockDay) {
        return 'locked';
    }
    if (state.money < item.price) {
        return 'too-expensive';
    }
    return 'buyable';
}

/**
 * Buys a shop item: takes its price from the wallet and marks it owned (items are bought once).
 * Fails - leaving the state untouched - if the item is disabled, already owned, not unlocked yet
 * on this day, or too expensive.
 *
 * @param {EconomyState} state
 * @param {string} itemId
 * @param {number} day - the current day.
 * @param {EconomyConfig} config
 * @param {{allowDisabled?: boolean}} [options]
 * @returns {{ok: boolean, reason?: string, state: EconomyState}}
 */
export function purchaseItem(state, itemId, day, config, options) {
    const status = shopStatus(itemId, day, state, config, options);
    if (status !== 'buyable') {
        return { ok: false, reason: status, state };
    }
    const item = shopItem(itemId, config);
    return { ok: true, state: { ...state, money: state.money - item.price, ownedItems: [...state.ownedItems, itemId] } };
}

// ------------------------------------------------------------------ simulation

/**
 * Plays the economy forward for a model player, to check the pacing: every day they complete every
 * truck (and, if asked, take the overtime offer), collect the day's bonuses, then buy the cheapest
 * item they can afford, again and again, until nothing more is affordable.
 *
 * @param {EconomyConfig} config
 * @param {Object} [options]
 * @param {number} [options.lastDay] - stop after this day (default 120).
 * @param {boolean} [options.includeDisabled] - also buy the disabled placeholder items, i.e. the
 *   full catalogue (default true).
 * @param {boolean} [options.takeOvertime] - accept every overtime offer (default false).
 * @returns {{purchases: Array<{day: number, id: string, price: number}>, finishDay: number | null, state: EconomyState}}
 *   finishDay is the day the last catalogue item was bought, or null if never.
 */
export function simulateShopper(config, { lastDay = 120, includeDisabled = true, takeOvertime = false } = {}) {
    let state = createEconomyState();
    const purchases = [];
    const catalogue = config.shop.filter((item) => includeDisabled || item.enabled);
    let finishDay = null;

    for (let day = 1; day <= lastDay && finishDay === null; day++) {
        state = addMoney(state, dayPay(day, config));
        const offer = overtimeOffer(day, config);
        if (takeOvertime && offer) {
            state = addMoney(state, offer.pay);
        }
        // Start-of-day bonuses arrive before the day is played, paycheck ones after; either way they
        // are in the wallet before the shop.
        state = claimBonuses(claimBonuses(state, day, config, 'start').state, day, config).state;

        // Buy the cheapest affordable unlocked item until nothing more can be bought.
        for (;;) {
            const options = { allowDisabled: includeDisabled };
            const candidates = catalogue
                .filter((item) => shopStatus(item.id, day, state, config, options) === 'buyable')
                .sort((a, b) => a.price - b.price);
            if (candidates.length === 0) {
                break;
            }
            const choice = candidates[0];
            state = purchaseItem(state, choice.id, day, config, options).state;
            purchases.push({ day, id: choice.id, price: choice.price });
        }

        if (catalogue.every((item) => state.ownedItems.includes(item.id))) {
            finishDay = day;
        }
    }
    return { purchases, finishDay, state };
}
