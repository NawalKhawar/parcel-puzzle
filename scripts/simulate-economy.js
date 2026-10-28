#!/usr/bin/env node
/**
 * simulate-economy.js
 *
 * Authoring/QA tool for the economy: plays src/data/economy.json forward for a model player and
 * prints the pacing, with no browser and no Phaser (it only uses src/core/economy.js).
 *
 * The model player completes every truck of every day, collects the day's one-off bonuses, and then
 * buys the cheapest item they can afford, again and again, as soon as it is unlocked. It prints
 *
 *   - the pay per truck by rank, and each day's pay at the key days,
 *   - the 50-day totals (base pay, bonuses, overtime),
 *   - the day each shop item is bought, and the day the whole catalogue is owned.
 *
 * Usage:
 *   node scripts/simulate-economy.js              no overtime taken
 *   node scripts/simulate-economy.js --overtime   take every overtime offer
 *   node scripts/simulate-economy.js --real-items only the 24 items that have art (not the placeholders)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { loadEconomy } from '../src/data/loadEconomy.js';
import {
    payForTruck,
    dayPay,
    bonusForDay,
    overtimeOffer,
    simulateShopper,
    hintCost,
} from '../src/core/economy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = loadEconomy(JSON.parse(readFileSync(path.resolve(__dirname, '../src/data/economy.json'), 'utf8')));

const takeOvertime = process.argv.includes('--overtime');
const includeDisabled = !process.argv.includes('--real-items');

// ---- Pay per truck by rank.
console.log('Pay per truck (easy / medium / hard):');
for (const rank of config.ranks) {
    const pays = ['easy', 'medium', 'hard'].map((tier) => `$${payForTruck(tier, rank.startDay, config)}`);
    console.log(`  rank ${rank.rank} ${rank.name.padEnd(14)} from day ${String(rank.startDay).padStart(2)}: ${pays.join(' / ')}`);
}

// ---- Day pay at the key days.
console.log('\nDay pay (trucks only):');
for (const day of [1, 2, 6, 7, 11, 16, 20, 25, 30, 40]) {
    console.log(`  day ${String(day).padStart(2)}: $${dayPay(day, config)}`);
}

// ---- What a paid hint costs by rank.
console.log(`
Paid hint (${config.hints.costUnits} units): ${config.ranks.map((rank) => `rank ${rank.rank} $${hintCost(rank.startDay, config)}`).join(', ')}`);

// ---- The 50-day totals.
let base = 0;
let bonuses = 0;
let overtime = 0;
for (let day = 1; day <= 50; day++) {
    base += dayPay(day, config);
    bonuses += [...bonusForDay(day, [], config, "start"), ...bonusForDay(day, [], config)].reduce((sum, bonus) => sum + bonus.amount, 0);
    overtime += overtimeOffer(day, config)?.pay ?? 0;
}
console.log(`\nDays 1-50: base pay $${base}, enabled bonuses $${bonuses} (total $${base + bonuses}), overtime offers worth $${overtime} if all taken`);

// ---- The model player's shopping.
const { purchases, finishDay, state } = simulateShopper(config, { includeDisabled, takeOvertime });
console.log(`\nShopping (cheapest affordable first${takeOvertime ? ', taking every overtime offer' : ''}${includeDisabled ? ', placeholders included' : ''}):`);
for (const purchase of purchases) {
    console.log(`  day ${String(purchase.day).padStart(2)}  ${purchase.id.padEnd(14)} $${purchase.price}`);
}
console.log(finishDay === null
    ? '  -> the catalogue is never completed'
    : `  -> the whole catalogue (${purchases.length} items) is owned on day ${finishDay}, with $${state.money} left over`);

// ---- Both model players side by side (the pacing check: about day 53 without overtime, about day 50 with).
const finish = (overtime) => simulateShopper(config, { includeDisabled, takeOvertime: overtime }).finishDay;
console.log(`
Full shop completed: day ${finish(false)} without overtime, day ${finish(true)} taking every overtime offer`);
