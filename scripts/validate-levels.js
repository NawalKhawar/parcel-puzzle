#!/usr/bin/env node
/**
 * validate-levels.js
 *
 * CLI entry point: loads every level (day) in src/data/levels.json, validates it
 * against the schema (src/data/loadLevel.js), then runs the backtracking solver
 * (src/core/Solver.js) against every truck (puzzle) in it to confirm each is actually
 * solvable - not just internally consistent. Prints a per-truck report and exits
 * non-zero if anything is wrong, naming the offending truck, so a broken or unsolvable
 * puzzle can never silently reach the game.
 *
 * Usage: node scripts/validate-levels.js
 *
 * Must never import 'phaser' - this runs in plain Node, no browser/game instance
 * required. See "Architectural boundary" in PROJECT_STRUCTURE.md.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { loadLevels, createGridForTruck } from '../src/data/loadLevel.js';
import { solve } from '../src/core/Solver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEVELS_PATH = path.resolve(__dirname, '../src/data/levels.json');

/**
 * Classifies a solve() result into "unique / 2 or more / unsolvable" buckets.
 *
 * @param {import('../src/core/Solver.js').SolveResult} result
 * @returns {string}
 */
function classifySolutions(result) {
    if (result.solutionCount === 0) {
        return result.nodeBudgetExceeded ? 'unknown (node budget exceeded, 0 found)' : 'UNSOLVABLE';
    }
    if (result.solutionCount === 1 && result.solutionCountIsExact) {
        return 'exactly 1 solution (unique)';
    }
    return '2 or more solutions';
}

async function main() {
    let rawLevels;
    try {
        const text = await readFile(LEVELS_PATH, 'utf8');
        rawLevels = JSON.parse(text);
    } catch (err) {
        console.error(`Failed to read/parse ${LEVELS_PATH}: ${err.message}`);
        process.exitCode = 1;
        return;
    }

    /** @type {string[]} */
    const failures = [];

    let levels;
    try {
        // loadLevels validates schema (rows/cols, blocked bounds, known shape ids,
        // exact-cover cell count, unique ids) and throws on the first problem found.
        levels = loadLevels(rawLevels);
    } catch (err) {
        console.error(`Level set failed schema validation: ${err.message}`);
        process.exitCode = 1;
        return;
    }

    const truckTotal = levels.reduce((sum, level) => sum + level.trucks.length, 0);
    console.log(`Validating ${levels.length} level(s) / ${truckTotal} truck(s) from ${path.relative(process.cwd(), LEVELS_PATH)}\n`);

    const rows = [];
    for (const level of levels) {
        for (const truck of level.trucks) {
            const grid = createGridForTruck(truck);
            const result = solve(grid, truck.pieces, { maxSolutions: 2, maxNodes: 500000 });
            const classification = classifySolutions(result);
            const ok = result.solutionCount > 0;

            if (!ok) {
                failures.push(`${truck.id}: ${classification}`);
            }

            rows.push({
                id: truck.id,
                size: `${truck.rows}x${truck.cols}`,
                blocked: truck.blocked.length,
                pieces: truck.pieces.length,
                difficulty: truck.difficulty ?? '-',
                nodesExplored: result.nodesExplored,
                classification,
                status: ok ? 'PASS' : 'FAIL',
            });
        }
    }

    const idWidth = Math.max(2, ...rows.map((r) => r.id.length));
    const header = `${'id'.padEnd(idWidth)}  size   blocked  pieces  diff    nodes    status  solutions`;
    console.log(header);
    console.log('-'.repeat(header.length));
    for (const r of rows) {
        console.log(
            `${r.id.padEnd(idWidth)}  ${r.size.padEnd(5)}  ${String(r.blocked).padEnd(7)}  ${String(r.pieces).padEnd(6)}  ${r.difficulty.padEnd(6)}  ${String(
                r.nodesExplored
            ).padEnd(7)}  ${r.status.padEnd(6)}  ${r.classification}`
        );
    }

    console.log();
    if (failures.length > 0) {
        console.error(`${failures.length} truck(s) failed validation:`);
        for (const f of failures) {
            console.error(`  - ${f}`);
        }
        process.exitCode = 1;
    } else {
        console.log(`All ${truckTotal} truck(s) across ${levels.length} level(s) solvable.`);
        process.exitCode = 0;
    }
}

main();
