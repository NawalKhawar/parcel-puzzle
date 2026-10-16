#!/usr/bin/env node
/**
 * generate-levels.js
 *
 * Authoring tool that (re)builds src/data/levels.json: the game's 30 levels ("days"),
 * each holding several trucks (individual packing puzzles). Hand-writing 142 puzzles
 * that ramp smoothly in difficulty isn't practical, so this script invents them:
 *
 *   1. The LEVEL PLAN (below) says how many trucks each level has and what difficulty
 *      each truck should be aimed at, as a number `t` between 0 (trivial) and 1 (hardest).
 *   2. For each truck it builds many random candidate puzzles aimed at that `t`:
 *      pick a board size + blocked cells, then randomly tile the open cells with
 *      polyominoes. The pieces used in the tiling become the truck's piece list - so a
 *      solution is guaranteed to exist by construction.
 *   3. Every candidate is still run through the real solver (src/core/Solver.js) to count
 *      solutions and measure search effort, and is given a difficulty SCORE (0..1) from
 *      its measurable features (board size, odd-shaped pieces, blocked cells, piece
 *      count, search effort). The candidate whose score lands closest to the target `t`
 *      wins.
 *   4. Within a level the trucks are sorted by score, so difficulty only ever goes up
 *      during a day. Output is deterministic (seeded PRNG): re-running gives the same file.
 *
 * Usage: node scripts/generate-levels.js
 * Afterwards run `node scripts/validate-levels.js` (and `npm test`) to double-check.
 *
 * Plain Node script - must never import 'phaser' (see "Architectural boundary" in
 * PROJECT_STRUCTURE.md).
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { Grid } from '../src/core/Grid.js';
import { getShapeCells } from '../src/core/Shape.js';
import { loadLevels } from '../src/data/loadLevel.js';
import { solve } from '../src/core/Solver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(__dirname, '../src/data/levels.json');

// ---------------------------------------------------------------------------
// Level plan: how many trucks per level, and how hard each one should be.
// ---------------------------------------------------------------------------

/** Total number of levels (days) in the game. */
const LEVEL_COUNT = 30;

/** Score thresholds that turn a 0..1 difficulty score into an easy/medium/hard label. */
const EASY_MAX = 0.34;
const MEDIUM_MAX = 0.67;

/**
 * The difficulty label each truck of a level must have, in play order. This is THE
 * level plan - edit it to change how many trucks a day has and how they ramp:
 *
 *   Level 1       : 3 trucks - easy, easy, easy
 *   Levels 2-7    : 4 trucks - 2 easy, 2 medium
 *   Levels 8-12   : 5 trucks - 2 easy, 2 medium, 1 hard
 *   Levels 13-30  : 6 trucks - 2 easy, 2 medium, 2 hard
 *
 * @param {number} levelNumber - 1-based level number.
 * @returns {Array<'easy' | 'medium' | 'hard'>}
 */
function labelsForLevel(levelNumber) {
    if (levelNumber === 1) return ['easy', 'easy', 'easy'];
    if (levelNumber <= 7) return ['easy', 'easy', 'medium', 'medium'];
    if (levelNumber <= 12) return ['easy', 'easy', 'medium', 'medium', 'hard'];
    return ['easy', 'easy', 'medium', 'medium', 'hard', 'hard'];
}

/**
 * How many trucks (puzzles) a level contains.
 *
 * @param {number} levelNumber - 1-based level number.
 * @returns {number}
 */
function trucksInLevel(levelNumber) {
    return labelsForLevel(levelNumber).length;
}

/**
 * Linear interpolation: a at p=0, b at p=1.
 *
 * @param {number} a
 * @param {number} b
 * @param {number} p
 * @returns {number}
 */
function lerp(a, b, p) {
    return a + (b - a) * p;
}

/**
 * The target difficulty `t` (0..1) for one truck, from its planned label (see
 * labelsForLevel). Each label has a band of difficulty (easy < 0.34 <= medium < 0.67 <=
 * hard); trucks sharing a label in the same level are spread across the band (so the
 * second easy truck is a bit harder than the first), and the band itself creeps upward as
 * the levels progress - so the game gets harder both within a day and over the weeks.
 *
 * @param {number} levelNumber - 1-based level number.
 * @param {number} truckIndex - 0-based truck index within the level.
 * @returns {number} target difficulty between 0 and 1.
 */
function targetDifficulty(levelNumber, truckIndex) {
    const labels = labelsForLevel(levelNumber);
    const label = labels[truckIndex];

    // Position of this truck among the trucks sharing its label: 0 = first, 1 = last
    // (0.5 if it is the only one, e.g. the single hard truck on levels 8-12).
    const group = labels.map((l, i) => (l === label ? i : -1)).filter((i) => i >= 0);
    const within = group.length === 1 ? 0.5 : group.indexOf(truckIndex) / (group.length - 1);

    if (levelNumber === 1) {
        return lerp(0.0, 0.12, truckIndex / (labels.length - 1));
    }

    const progress = (levelNumber - 2) / 28; // 0 at level 2, 1 at level 30.
    // [low end, high end] of each band at the first level and at the last level.
    const bands = {
        easy: [[0.04, 0.14], [0.14, 0.3]],
        medium: [[0.36, 0.42], [0.5, 0.64]],
        hard: [[0.7, 0.72], [0.8, 1.0]],
    };
    const [early, late] = bands[label];
    return lerp(lerp(early[0], late[0], progress), lerp(early[1], late[1], progress), within);
}

/**
 * Converts a difficulty score into the label stored in the data.
 *
 * @param {number} score - 0..1
 * @returns {'easy' | 'medium' | 'hard'}
 */
function labelOf(score) {
    if (score < EASY_MAX) return 'easy';
    if (score < MEDIUM_MAX) return 'medium';
    return 'hard';
}

// ---------------------------------------------------------------------------
// Seeded randomness (so the generated file is reproducible).
// ---------------------------------------------------------------------------

/**
 * mulberry32: a tiny, good-enough seeded PRNG. Returns a function giving floats in [0, 1).
 *
 * @param {number} seed
 * @returns {() => number}
 */
function makeRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let x = state;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Fisher-Yates shuffle (returns a new array).
 *
 * @template T
 * @param {T[]} items
 * @param {() => number} rng
 * @returns {T[]}
 */
function shuffle(items, rng) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * Random ordering where heavier-weighted items tend to come first (Efraimidis-Spirakis:
 * give each item the key rand^(1/weight) and sort descending). Items with weight <= 0
 * are left out entirely.
 *
 * @param {string[]} ids
 * @param {Record<string, number>} weights
 * @param {() => number} rng
 * @returns {string[]}
 */
function weightedOrder(ids, weights, rng) {
    return ids
        .filter((id) => weights[id] > 0)
        .map((id) => ({ id, key: Math.pow(rng(), 1 / weights[id]) }))
        .sort((a, b) => b.key - a.key)
        .map((entry) => entry.id);
}

// ---------------------------------------------------------------------------
// Shape preferences: easy boards favour big, tidy pieces; hard boards favour
// awkward, irregular ones and (almost) no single-cell fillers.
// ---------------------------------------------------------------------------

/** Relative likelihood of each shape when generating an EASY (t=0) board. */
const EASY_WEIGHTS = {
    dot: 1, domino_h: 2, domino_v: 2, tri_i: 3, tri_l: 2, square: 3,
    bar4: 3, l4: 1, t4: 1, s4: 0.5, p5: 1.5, plus: 0.5,
};

/** Relative likelihood of each shape when generating a HARD (t=1) board. */
const HARD_WEIGHTS = {
    dot: 0.1, domino_h: 0.5, domino_v: 0.5, tri_i: 0.5, tri_l: 1, square: 0.5,
    bar4: 0.3, l4: 2, t4: 2, s4: 2, p5: 2, plus: 2,
};

/** Shapes a player instantly recognises as "just fits in a rectangle" - they don't count as "irregular". */
const REGULAR_SHAPES = new Set(['dot', 'domino_h', 'domino_v', 'tri_i', 'square', 'bar4']);

/** The most pieces a truck may have (more than this can't be laid out comfortably in the tray). */
const MAX_PIECES = 9;

/**
 * Interpolates the easy/hard shape weights for a target difficulty.
 *
 * @param {number} t
 * @returns {Record<string, number>}
 */
function weightsFor(t) {
    const weights = {};
    for (const id of Object.keys(EASY_WEIGHTS)) {
        weights[id] = lerp(EASY_WEIGHTS[id], HARD_WEIGHTS[id], t);
    }
    return weights;
}

// ---------------------------------------------------------------------------
// Board sizes.
// ---------------------------------------------------------------------------

/**
 * Every board size the generator may use, as [rows, cols]. Boards are always square or
 * portrait (rows >= cols), never landscape, because the board will eventually represent
 * the open back of a mail truck. At most 7 rows x 5 cols; PuzzleScene shrinks the cell
 * size on tall boards so board + piece tray still fit on the 1024x768 screen.
 */
const BOARD_SIZES = [
    [4, 2], [5, 2], [6, 2], [7, 2],
    [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
    [4, 4], [5, 4], [6, 4], [7, 4],
    [5, 5], [6, 5], [7, 5],
];

/**
 * Picks a board size and blocked-cell count for a target difficulty. Harder = more open
 * cells (8 at t=0 up to 30 at t=1), more blocked cells (0 up to 4), and wider boards
 * (2-column boards are close to a 1-D puzzle, so they're only used while the game is easy).
 *
 * @param {number} t
 * @param {() => number} rng
 * @returns {{rows: number, cols: number, blockedCount: number}}
 */
function pickBoard(t, rng) {
    const targetOpen = Math.round(8 + 22 * t);
    const blockedCount = t < 0.12 ? 0 : Math.round(t * 4);
    const minCols = t < 0.15 ? 2 : t < 0.45 ? 3 : 4;

    // Score every allowed size by how close its open-cell count is to the target.
    const options = BOARD_SIZES.filter(([, cols]) => cols >= minCols).map(([rows, cols]) => ({
        rows,
        cols,
        distance: Math.abs(rows * cols - blockedCount - targetOpen),
    }));
    const best = Math.min(...options.map((o) => o.distance));
    // Anything within 2 cells of the best fit is fair game; choosing randomly among them
    // gives variety (e.g. a 5x4 vs a 7x3) instead of always the same board for a given t.
    const close = options.filter((o) => o.distance <= best + 2);
    const pick = close[Math.floor(rng() * close.length)];
    return { rows: pick.rows, cols: pick.cols, blockedCount };
}

// ---------------------------------------------------------------------------
// Random tiling (this is what guarantees every candidate is solvable).
// ---------------------------------------------------------------------------

/**
 * Finds the first open cell in row-major order (same scan order the solver uses).
 *
 * @param {Grid} grid
 * @returns {{row: number, col: number} | null}
 */
function firstOpenCell(grid) {
    for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.cols; col++) {
            const key = `${row},${col}`;
            if (!grid.blockedCellKeys.has(key) && !grid.filledCellKeys.has(key)) {
                return { row, col };
            }
        }
    }
    return null;
}

/**
 * Randomly tiles every open cell of a board with polyominoes using randomized
 * backtracking. At each step it targets the first uncovered cell and tries shapes (in a
 * weighted-random order) until one fits; if the rest of the board then can't be tiled
 * it backs out and tries the next. Gives up (returns null) if it burns through its step
 * budget, which can happen for awkward blocked-cell layouts - the caller just tries a
 * fresh random board instead.
 *
 * @param {number} rows
 * @param {number} cols
 * @param {Array<[number, number]>} blocked
 * @param {Record<string, number>} weights - likelihood of each shape id.
 * @param {number} maxDots - cap on single-cell pieces (they make a puzzle trivial).
 * @param {() => number} rng
 * @returns {string[] | null} the shape ids used, in board order (callers shuffle them).
 */
function randomTiling(rows, cols, blocked, weights, maxDots, rng) {
    const grid = new Grid(rows, cols, blocked);
    const shapeIds = Object.keys(weights);
    const used = [];
    let budget = 4000; // total placement attempts allowed before giving up.
    let counter = 0;

    function recurse() {
        const target = firstOpenCell(grid);
        if (!target) {
            return true; // every open cell is covered.
        }

        const dotsUsed = used.filter((id) => id === 'dot').length;
        for (const shapeId of weightedOrder(shapeIds, weights, rng)) {
            if (shapeId === 'dot' && dotsUsed >= maxDots) {
                continue;
            }
            for (const anchor of getShapeCells(shapeId)) {
                // Line the shape up so that its `anchor` cell lands on the target cell.
                const originRow = target.row - anchor.row;
                const originCol = target.col - anchor.col;
                if (!grid.canPlace(shapeId, originRow, originCol)) {
                    continue;
                }
                if (--budget < 0) {
                    return false;
                }
                const placementId = `gen-${counter++}`;
                grid.place(placementId, shapeId, originRow, originCol);
                used.push(shapeId);
                if (recurse()) {
                    return true;
                }
                used.pop();
                grid.remove(placementId);
                if (budget < 0) {
                    return false;
                }
            }
        }
        return false; // nothing fits here: backtrack.
    }

    return recurse() ? used : null;
}

// ---------------------------------------------------------------------------
// Scoring + candidate evaluation.
// ---------------------------------------------------------------------------

/**
 * @param {number} value
 * @returns {number} value clamped into [0, 1].
 */
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

/**
 * Difficulty score (0 = trivial, 1 = brutal) from a puzzle's measurable features. The
 * weights below are the "recipe" for what we consider hard; tweak them and re-run the
 * generator to reshape the whole difficulty curve.
 *
 *   40%  board size        (8 open cells -> 0, 30 open cells -> 1)
 *   20%  irregular pieces  (share of pieces that aren't plain bars/blocks/dots)
 *   15%  blocked cells     (0 -> 0, 4 -> 1)
 *   15%  piece count       (2 pieces -> 0, 9 pieces -> 1)
 *   10%  search effort     (how many placements the solver tried; log scale)
 *
 * @param {number} openCells
 * @param {number} blockedCount
 * @param {string[]} pieces
 * @param {number} nodesExplored
 * @returns {number}
 */
function scorePuzzle(openCells, blockedCount, pieces, nodesExplored) {
    const size = clamp01((openCells - 8) / 22);
    const irregular = pieces.filter((id) => !REGULAR_SHAPES.has(id)).length / pieces.length;
    const blockedShare = clamp01(blockedCount / 4);
    const pieceShare = clamp01((pieces.length - 2) / 7);
    const effort = clamp01(Math.log10(Math.max(1, nodesExplored)) / 4.5);
    return 0.4 * size + 0.2 * irregular + 0.15 * blockedShare + 0.15 * pieceShare + 0.1 * effort;
}

/**
 * A stable text fingerprint of a puzzle, used to avoid shipping the same puzzle twice.
 *
 * @param {{rows: number, cols: number, blocked: Array<[number, number]>, pieces: string[]}} puzzle
 * @returns {string}
 */
function signature(puzzle) {
    const blocked = [...puzzle.blocked].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return `${puzzle.rows}x${puzzle.cols}|${JSON.stringify(blocked)}|${[...puzzle.pieces].sort().join(',')}`;
}

/**
 * Builds and evaluates ONE random candidate aimed at difficulty `t`.
 *
 * @param {number} t - target difficulty.
 * @param {() => number} rng
 * @returns {null | {rows: number, cols: number, blocked: Array<[number, number]>, pieces: string[], score: number, solutionCount: number}}
 *   null if the attempt was unusable (couldn't be tiled, too many pieces, or too slow to solve).
 */
function makeCandidate(t, rng) {
    const { rows, cols, blockedCount } = pickBoard(t, rng);

    // Choose which cells are blocked: random distinct cells.
    const allCells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            allCells.push([r, c]);
        }
    }
    const blocked = shuffle(allCells, rng).slice(0, blockedCount);

    const maxDots = t < 0.67 ? 2 : 1;
    const tiled = randomTiling(rows, cols, blocked, weightsFor(t), maxDots, rng);
    if (!tiled || tiled.length < 2 || tiled.length > MAX_PIECES) {
        return null;
    }
    // Shuffle so the tray order doesn't mirror the order pieces were laid down.
    const pieces = shuffle(tiled, rng);

    // Ask the real solver how many solutions exist (capped at 7, meaning "7 or more")
    // and how hard it had to work. A search that blows the budget is rejected: the
    // validator/tests need every shipped puzzle to solve quickly.
    const open = rows * cols - blocked.length;
    const result = solve(new Grid(rows, cols, blocked), pieces, { maxSolutions: 7, maxNodes: 100000 });
    if (result.solutionCount === 0 || result.nodeBudgetExceeded) {
        return null;
    }

    const score = scorePuzzle(open, blocked.length, pieces, result.nodesExplored);
    return { rows, cols, blocked, pieces, score, solutionCount: result.solutionCount };
}

/**
 * Searches for the best puzzle for one truck slot: generates candidates until it has
 * enough acceptable ones, then returns the one whose score is closest to `t`.
 *
 * "Acceptable" means: its easy/medium/hard label matches the label `t` calls for (so a
 * truck meant to be medium can't accidentally come out hard), it isn't a duplicate, and
 * harder puzzles must not have lots of different solutions (many solutions = easy to
 * stumble onto one). If the solution-count rule can't be met after many tries it is
 * relaxed rather than looping forever (a warning is printed).
 *
 * @param {number} t - target difficulty.
 * @param {() => number} rng
 * @param {Set<string>} seen - signatures of puzzles already used (mutated: the winner is added).
 * @returns {{rows: number, cols: number, blocked: Array<[number, number]>, pieces: string[], score: number, solutionCount: number, relaxed: boolean}}
 */
function findBestPuzzle(t, rng, seen) {
    const wantedLabel = labelOf(t);
    // Max distinct solutions allowed per label; 7 means "no limit" (the solver cap).
    const maxSolutions = { easy: 7, medium: 5, hard: 3 }[wantedLabel];

    const ENOUGH = 40; // acceptable candidates to compare before picking a winner.
    const GIVE_UP_STRICT = 600; // attempts before relaxing the solution-count rule.
    const HARD_STOP = 3000; // attempts before failing outright.

    let best = null;
    let acceptable = 0;
    let relaxed = false;

    for (let attempt = 1; attempt <= HARD_STOP; attempt++) {
        const strict = attempt <= GIVE_UP_STRICT;
        if (!strict) {
            relaxed = true;
        }

        const candidate = makeCandidate(t, rng);
        if (!candidate) continue;
        if (labelOf(candidate.score) !== wantedLabel) continue;
        if (strict && candidate.solutionCount > maxSolutions) continue;
        if (seen.has(signature(candidate))) continue;

        acceptable++;
        if (!best || Math.abs(candidate.score - t) < Math.abs(best.score - t)) {
            best = candidate;
        }
        if (acceptable >= ENOUGH) break;
    }

    if (!best) {
        throw new Error(`Could not generate a "${wantedLabel}" puzzle for target difficulty ${t.toFixed(2)}`);
    }
    seen.add(signature(best));
    return { ...best, relaxed };
}

// ---------------------------------------------------------------------------
// Assembly + output.
// ---------------------------------------------------------------------------

/** Coins bonus added on top of a truck's open-cell count, by difficulty label. */
const REWARD_BONUS = { easy: 0, medium: 4, hard: 8 };

/**
 * Builds the whole level list.
 *
 * @returns {{levels: Array<Object>, warnings: string[]}}
 */
function generateAll() {
    const seen = new Set();
    const warnings = [];
    const levels = [];

    for (let levelNumber = 1; levelNumber <= LEVEL_COUNT; levelNumber++) {
        const count = trucksInLevel(levelNumber);
        const puzzles = [];

        for (let truckIndex = 0; truckIndex < count; truckIndex++) {
            const t = targetDifficulty(levelNumber, truckIndex);
            // One PRNG per truck slot, seeded from its position, so editing one slot's
            // rules doesn't reshuffle the randomness used by every other slot.
            const rng = makeRng(levelNumber * 1000 + truckIndex + 1);
            const puzzle = findBestPuzzle(t, rng, seen);
            if (puzzle.relaxed) {
                warnings.push(`level ${levelNumber} truck ${truckIndex + 1}: solution-count rule relaxed`);
            }
            puzzles.push(puzzle);
        }

        // Keep difficulty non-decreasing through the day.
        puzzles.sort((a, b) => a.score - b.score);

        const levelId = `level-${String(levelNumber).padStart(2, '0')}`;
        levels.push({
            id: levelId,
            trucks: puzzles.map((puzzle, index) => {
                const difficulty = labelOf(puzzle.score);
                const open = puzzle.rows * puzzle.cols - puzzle.blocked.length;
                return {
                    id: `${levelId}-truck-${index + 1}`,
                    rows: puzzle.rows,
                    cols: puzzle.cols,
                    blocked: puzzle.blocked.sort((a, b) => a[0] - b[0] || a[1] - b[1]),
                    pieces: puzzle.pieces,
                    difficulty,
                    difficultyScore: Math.round(puzzle.score * 100) / 100,
                    reward: open + REWARD_BONUS[difficulty],
                };
            }),
        });
    }
    return { levels, warnings };
}

/**
 * Serializes levels as JSON with one truck per few lines and short arrays kept inline,
 * so the file stays readable (and diff-able) instead of 5,000 lines of one-number rows.
 *
 * @param {Array<Object>} levels
 * @returns {string}
 */
function formatLevels(levels) {
    const inline = (value) => JSON.stringify(value).replace(/,/g, ', ');
    const lines = ['['];
    levels.forEach((level, li) => {
        lines.push('  {');
        lines.push(`    "id": ${JSON.stringify(level.id)},`);
        lines.push('    "trucks": [');
        level.trucks.forEach((truck, ti) => {
            lines.push('      {');
            lines.push(`        "id": ${JSON.stringify(truck.id)},`);
            lines.push(`        "rows": ${truck.rows},`);
            lines.push(`        "cols": ${truck.cols},`);
            lines.push(`        "blocked": ${inline(truck.blocked)},`);
            lines.push(`        "pieces": ${inline(truck.pieces)},`);
            lines.push(`        "difficulty": ${JSON.stringify(truck.difficulty)},`);
            lines.push(`        "difficultyScore": ${truck.difficultyScore},`);
            lines.push(`        "reward": ${truck.reward}`);
            lines.push(ti < level.trucks.length - 1 ? '      },' : '      }');
        });
        lines.push('    ]');
        lines.push(li < levels.length - 1 ? '  },' : '  }');
    });
    lines.push(']');
    return lines.join('\n') + '\n';
}

async function main() {
    const started = Date.now();
    const { levels, warnings } = generateAll();

    // Run the output through the same validator the game uses before writing anything.
    loadLevels(levels);

    await writeFile(OUTPUT_PATH, formatLevels(levels), 'utf8');

    const truckTotal = levels.reduce((sum, level) => sum + level.trucks.length, 0);
    console.log(`Wrote ${levels.length} levels / ${truckTotal} trucks to ${path.relative(process.cwd(), OUTPUT_PATH)} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    for (const level of levels) {
        const summary = level.trucks.map((t) => `${t.difficulty[0]}${t.difficultyScore.toFixed(2)}`).join('  ');
        console.log(`  ${level.id}: ${summary}`);
    }
    if (warnings.length > 0) {
        console.warn('\nWarnings:');
        for (const w of warnings) console.warn(`  - ${w}`);
    }
}

main();
