/**
 * loadEconomy.js
 *
 * Validates the economy config (src/data/economy.json) - the ONE place every money number in the
 * game lives: what each truck tier pays, the pay ranks, the workload per day, one-off bonuses,
 * hint and overtime rules, and the shop's price list. Bad data fails loudly at load time, naming
 * the offending entry and the rule it broke, instead of producing odd payouts mid-game.
 *
 * Must never import 'phaser' - see "Architectural boundary" in PROJECT_STRUCTURE.md.
 */

/** The three truck tiers, in the order a day plays them (easiest first). */
export const TIER_IDS = ['easy', 'medium', 'hard'];

/** The categories a shop item can be in. */
export const SHOP_CATEGORIES = ['wallpaper', 'decor', 'furniture', 'luxury'];

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

/**
 * @typedef {Object} EconomyConfig
 * @property {Object<string, {name: string, units: number}>} tiers - pay units per tier.
 * @property {Array<{rank: number, name: string, startDay: number, unitValue: number}>} ranks -
 *   pay ranks; a rank applies from its startDay until the next rank's startDay.
 * @property {Array<{fromDay: number, toDay: number | null, trucks: Array<{tier: string, count: number}>}>} workload -
 *   the trucks played per day, in play order; toDay null = "and every day after".
 * @property {Array<{id: string, label: string, day: number, amount: number, enabled: boolean, screen?: boolean}>} bonuses -
 *   one-off bonuses, each paid once: on the paycheck of its day, or - with `screen: true` - on its
 *   own Bonus screen shown before that day's gameplay.
 * @property {{costUnits: number}} hints - a paid hint costs this many units of the current rank.
 * @property {{enabled: boolean, days: number[], multiplier: number}} overtime
 * @property {Array<{id: string, name: string, category: string, unlockDay: number, price: number, enabled: boolean}>} shop
 */

/**
 * Validates the contents of economy.json.
 *
 * @param {EconomyConfig} raw
 * @returns {EconomyConfig} the same object, every entry proven valid.
 * @throws {Error} naming the offending entry and the rule it broke.
 */
export function loadEconomy(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new Error('economy.json must be an object');
    }

    // ---- tiers
    for (const id of TIER_IDS) {
        const tier = raw.tiers?.[id];
        if (!tier || typeof tier.name !== 'string' || tier.name.length === 0) {
            throw new Error(`tier "${id}": needs a non-empty "name"`);
        }
        if (!isPositiveInt(tier.units)) {
            throw new Error(`tier "${id}": "units" must be a positive whole number`);
        }
    }

    // ---- ranks: numbered 1, 2, 3... with startDays that start at day 1 and strictly increase
    if (!Array.isArray(raw.ranks) || raw.ranks.length === 0) {
        throw new Error('"ranks" must be a non-empty array');
    }
    raw.ranks.forEach((rank, index) => {
        const label = `rank ${index + 1}`;
        if (rank.rank !== index + 1) {
            throw new Error(`${label}: "rank" must be ${index + 1} (ranks are numbered in order)`);
        }
        if (typeof rank.name !== 'string' || rank.name.length === 0) {
            throw new Error(`${label}: needs a non-empty "name"`);
        }
        if (!isPositiveInt(rank.unitValue)) {
            throw new Error(`${label}: "unitValue" must be a positive whole number of dollars`);
        }
        if (!isPositiveInt(rank.startDay)) {
            throw new Error(`${label}: "startDay" must be a positive whole number`);
        }
        if (index === 0 && rank.startDay !== 1) {
            throw new Error(`${label}: the first rank must start on day 1`);
        }
        if (index > 0 && rank.startDay <= raw.ranks[index - 1].startDay) {
            throw new Error(`${label}: "startDay" must be later than the previous rank's`);
        }
    });

    // ---- workload: ranges that follow on from each other with no gaps or overlaps, the last open-ended
    if (!Array.isArray(raw.workload) || raw.workload.length === 0) {
        throw new Error('"workload" must be a non-empty array');
    }
    let expectedFrom = 1;
    raw.workload.forEach((range, index) => {
        const label = `workload range ${index + 1}`;
        if (range.fromDay !== expectedFrom) {
            throw new Error(`${label}: "fromDay" must be ${expectedFrom} (ranges must follow on with no gap or overlap)`);
        }
        const isLast = index === raw.workload.length - 1;
        if (isLast) {
            if (range.toDay !== null) {
                throw new Error(`${label}: the last range must have "toDay": null so it covers every later day`);
            }
        } else {
            if (!isPositiveInt(range.toDay) || range.toDay < range.fromDay) {
                throw new Error(`${label}: "toDay" must be a whole number of at least ${range.fromDay}`);
            }
            expectedFrom = range.toDay + 1;
        }
        if (!Array.isArray(range.trucks) || range.trucks.length === 0) {
            throw new Error(`${label}: "trucks" must be a non-empty array`);
        }
        for (const entry of range.trucks) {
            if (!TIER_IDS.includes(entry.tier)) {
                throw new Error(`${label}: unknown tier "${entry.tier}"`);
            }
            if (!isPositiveInt(entry.count)) {
                throw new Error(`${label}: "count" for ${entry.tier} must be a positive whole number`);
            }
        }
    });

    // ---- bonuses
    if (!Array.isArray(raw.bonuses)) {
        throw new Error('"bonuses" must be an array');
    }
    const bonusIds = new Set();
    for (const bonus of raw.bonuses) {
        const label = `bonus "${bonus?.id}"`;
        if (typeof bonus?.id !== 'string' || bonus.id.length === 0) {
            throw new Error(`every bonus needs a non-empty string "id" (got ${JSON.stringify(bonus)})`);
        }
        if (bonusIds.has(bonus.id)) {
            throw new Error(`${label}: duplicate id`);
        }
        bonusIds.add(bonus.id);
        if (typeof bonus.label !== 'string' || bonus.label.length === 0) {
            throw new Error(`${label}: needs a non-empty "label"`);
        }
        if (!isPositiveInt(bonus.day)) {
            throw new Error(`${label}: "day" must be a positive whole number`);
        }
        if (!isPositiveInt(bonus.amount)) {
            throw new Error(`${label}: "amount" must be a positive whole number of dollars`);
        }
        if (typeof bonus.enabled !== 'boolean') {
            throw new Error(`${label}: "enabled" must be true or false`);
        }
        if (bonus.screen !== undefined && typeof bonus.screen !== 'boolean') {
            throw new Error(`${label}: "screen", if present, must be true or false`);
        }
    }

    // ---- hints
    if (!isPositiveInt(raw.hints?.costUnits)) {
        throw new Error('"hints.costUnits" must be a positive whole number');
    }

    // ---- overtime
    const overtime = raw.overtime;
    if (!overtime || typeof overtime.enabled !== 'boolean') {
        throw new Error('"overtime.enabled" must be true or false');
    }
    if (!Array.isArray(overtime.days) || !overtime.days.every(isPositiveInt) || new Set(overtime.days).size !== overtime.days.length) {
        throw new Error('"overtime.days" must be a list of distinct positive whole numbers');
    }
    if (typeof overtime.multiplier !== 'number' || !(overtime.multiplier >= 1)) {
        throw new Error('"overtime.multiplier" must be a number of at least 1');
    }

    // ---- shop
    if (!Array.isArray(raw.shop) || raw.shop.length === 0) {
        throw new Error('"shop" must be a non-empty array');
    }
    const shopIds = new Set();
    for (const item of raw.shop) {
        const label = `shop item "${item?.id}"`;
        if (typeof item?.id !== 'string' || item.id.length === 0) {
            throw new Error(`every shop item needs a non-empty string "id" (got ${JSON.stringify(item)})`);
        }
        if (shopIds.has(item.id)) {
            throw new Error(`${label}: duplicate id`);
        }
        shopIds.add(item.id);
        if (typeof item.name !== 'string' || item.name.length === 0) {
            throw new Error(`${label}: needs a non-empty "name"`);
        }
        if (!SHOP_CATEGORIES.includes(item.category)) {
            throw new Error(`${label}: "category" must be one of ${SHOP_CATEGORIES.join(', ')}`);
        }
        if (!isPositiveInt(item.unlockDay)) {
            throw new Error(`${label}: "unlockDay" must be a positive whole number`);
        }
        if (!isPositiveInt(item.price)) {
            throw new Error(`${label}: "price" must be a positive whole number of dollars`);
        }
        if (typeof item.enabled !== 'boolean') {
            throw new Error(`${label}: "enabled" must be true or false`);
        }
    }

    return raw;
}
