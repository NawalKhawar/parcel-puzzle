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
 * Usage:
 *   node scripts/validate-levels.js            checks src/data/levels.json
 *   node scripts/validate-levels.js --shapes   checks src/data/levels.shapes.json instead
 *                                              (the shape-gated pool: every puzzle of every slot)
 *
 * Must never import 'phaser' - this runs in plain Node, no browser/game instance
 * required. See "Architectural boundary" in PROJECT_STRUCTURE.md.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { loadLevels, loadShapeLevels, createGridForTruck } from '../src/data/loadLevel.js';
import { solve } from '../src/core/Solver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEVELS_PATH = path.resolve(__dirname, '../src/data/levels.json');
const SHAPES_PATH = path.resolve(__dirname, '../src/data/levels.shapes.json');

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
    const useShapes = process.argv.includes('--shapes');
    const dataPath = useShapes ? SHAPES_PATH : LEVELS_PATH;

    let rawLevels;
    try {
        const text = await readFile(dataPath, 'utf8');
        rawLevels = JSON.parse(text);
    } catch (err) {
        console.error(`Failed to read/parse ${dataPath}: ${err.message}`);
        process.exitCode = 1;
        return;
    }

    /** @type {string[]} */
    const failures = [];

    let levels;
    try {
        // loadLevels validates schema (rows/cols, blocked bounds, known shape ids,
        // exact-cover cell count, unique ids) and throws on the first problem found.
        levels = useShapes ? loadShapeLevels(rawLevels) : loadLevels(rawLevels);
    } catch (err) {
        console.error(`Level set failed schema validation: ${err.message}`);
        process.exitCode = 1;
        return;
    }

    // Flatten to the list of actual puzzles to solve: the trucks of levels.json, or every
    // puzzle in every slot's pool for levels.shapes.json.
    const truckTotal = useShapes
        ? levels.reduce((sum, level) => sum + level.trucks.reduce((n, truck) => n + truck.puzzles.length, 0), 0)
        : levels.reduce((sum, level) => sum + level.trucks.length, 0);
    const noun = useShapes ? 'puzzle' : 'truck';
    console.log(`Validating ${levels.length} level(s) / ${truckTotal} ${noun}(s) from ${path.relative(process.cwd(), dataPath)}\n`);

    const rows = [];
    for (const level of levels) {
        const toSolve = useShapes ? level.trucks.flatMap((slot) => slot.puzzles) : level.trucks;
        for (const truck of toSolve) {
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
        console.error(`${failures.length} ${noun}(s) failed validation:`);
        for (const f of failures) {
            console.error(`  - ${f}`);
        }
        process.exitCode = 1;
    } else {
        console.log(`All ${truckTotal} ${noun}(s) across ${levels.length} level(s) solvable.`);
        process.exitCode = 0;
    }
}

main();
