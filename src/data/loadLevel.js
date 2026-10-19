/**
 * loadLevel.js
 *
 * Validates raw level data (as it comes from levels.json) against the schema documented
 * in levels.schema.md, and provides a convenience constructor for turning a validated
 * truck (one packing puzzle) into a ready-to-play src/core/Grid instance.
 *
 * Vocabulary: a LEVEL is one in-game day; it contains several TRUCKS, and each truck is
 * one packing puzzle (a board plus the pieces that must exactly fill it).
 *
 * This is the single gate raw data must pass through before anything else in the game
 * (the Phaser scenes, the solver, tests) touches it. Must never import 'phaser' - see
 * "Architectural boundary" in PROJECT_STRUCTURE.md.
 */

import { Grid } from '../core/Grid.js';
import { isKnownShape, getShapeCellCount } from '../core/Shape.js';

/**
 * @typedef {Object} RawTruck
 * @property {string} id
 * @property {number} rows
 * @property {number} cols
 * @property {Array<[number, number]>} blocked
 * @property {string[]} pieces
 * @property {'easy' | 'medium' | 'hard'} [difficulty]
 * @property {number} [difficultyScore]
 * @property {number} [reward]
 */

/**
 * @typedef {Object} RawLevel
 * @property {string} id
 * @property {RawTruck[]} trucks
 */

/**
 * Validates a single truck (puzzle) object and returns it unchanged - "normalizing"
 * here is really just validating, since levels.json is already in the shape the game
 * consumes directly.
 *
 * @param {RawTruck} raw
 * @returns {RawTruck} the same object, proven valid.
 * @throws {Error} naming the offending truck id and exactly which rule failed.
 */
export function loadTruck(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new Error(`Invalid truck data: expected an object, got ${JSON.stringify(raw)}`);
    }
    if (typeof raw.id !== 'string' || raw.id.length === 0) {
        throw new Error(`Invalid truck data: "id" must be a non-empty string (got ${JSON.stringify(raw.id)})`);
    }
    const label = `truck "${raw.id}"`;

    if (!Number.isInteger(raw.rows) || raw.rows <= 0) {
        throw new Error(`${label}: "rows" must be a positive integer (got ${JSON.stringify(raw.rows)})`);
    }
    if (!Number.isInteger(raw.cols) || raw.cols <= 0) {
        throw new Error(`${label}: "cols" must be a positive integer (got ${JSON.stringify(raw.cols)})`);
    }
    if (!Array.isArray(raw.blocked)) {
        throw new Error(`${label}: "blocked" must be an array (got ${JSON.stringify(raw.blocked)})`);
    }

    const seenBlockedKeys = new Set();
    for (const entry of raw.blocked) {
        if (!Array.isArray(entry) || entry.length !== 2 || !Number.isInteger(entry[0]) || !Number.isInteger(entry[1])) {
            throw new Error(`${label}: each "blocked" entry must be a [row, col] integer tuple (got ${JSON.stringify(entry)})`);
        }
        const [row, col] = entry;
        if (row < 0 || row >= raw.rows || col < 0 || col >= raw.cols) {
            throw new Error(`${label}: blocked cell [${row}, ${col}] is out of bounds for a ${raw.rows}x${raw.cols} grid`);
        }
        const key = `${row},${col}`;
        if (seenBlockedKeys.has(key)) {
            throw new Error(`${label}: blocked cell [${row}, ${col}] is listed more than once`);
        }
        seenBlockedKeys.add(key);
    }

    if (!Array.isArray(raw.pieces) || raw.pieces.length === 0) {
        throw new Error(`${label}: "pieces" must be a non-empty array (got ${JSON.stringify(raw.pieces)})`);
    }
    for (const shapeId of raw.pieces) {
        if (!isKnownShape(shapeId)) {
            throw new Error(`${label}: unknown shape id "${shapeId}" in "pieces"`);
        }
    }

    // Exact-cover cell count: pieces must have exactly as many cells as the board has
    // open cells. Catches the commonest authoring mistake (wrong pieces for the grid)
    // at load time instead of as a confusing dead-end in play.
    const totalPieceCells = raw.pieces.reduce((sum, shapeId) => sum + getShapeCellCount(shapeId), 0);
    const openCells = raw.rows * raw.cols - raw.blocked.length;
    if (totalPieceCells !== openCells) {
        throw new Error(
            `${label}: pieces cover ${totalPieceCells} cells but the board has ${openCells} open cells ` +
                `(${raw.rows}x${raw.cols} grid minus ${raw.blocked.length} blocked) - these must match exactly ` +
                `for the truck to be fillable at all.`
        );
    }

    if (raw.difficulty !== undefined && !['easy', 'medium', 'hard'].includes(raw.difficulty)) {
        throw new Error(`${label}: "difficulty" must be one of 'easy' | 'medium' | 'hard' (got ${JSON.stringify(raw.difficulty)})`);
    }
    if (raw.difficultyScore !== undefined && !(typeof raw.difficultyScore === 'number' && raw.difficultyScore >= 0 && raw.difficultyScore <= 1)) {
        throw new Error(`${label}: "difficultyScore", if present, must be a number between 0 and 1 (got ${JSON.stringify(raw.difficultyScore)})`);
    }
    if (raw.reward !== undefined && (!Number.isInteger(raw.reward) || raw.reward <= 0)) {
        throw new Error(`${label}: "reward", if present, must be a positive integer (got ${JSON.stringify(raw.reward)})`);
    }

    return raw;
}

/**
 * Validates one level (day): a non-empty id plus a non-empty list of valid trucks whose
 * ids are unique within the level.
 *
 * @param {RawLevel} raw
 * @returns {RawLevel} the same object, proven valid.
 * @throws {Error} naming the offending level/truck and the rule that failed.
 */
export function loadLevel(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new Error(`Invalid level data: expected an object, got ${JSON.stringify(raw)}`);
    }
    if (typeof raw.id !== 'string' || raw.id.length === 0) {
        throw new Error(`Invalid level data: "id" must be a non-empty string (got ${JSON.stringify(raw.id)})`);
    }
    if (!Array.isArray(raw.trucks) || raw.trucks.length === 0) {
        throw new Error(`level "${raw.id}": "trucks" must be a non-empty array (got ${JSON.stringify(raw.trucks)})`);
    }

    const seenTruckIds = new Set();
    for (const truck of raw.trucks) {
        loadTruck(truck);
        if (seenTruckIds.has(truck.id)) {
            throw new Error(`level "${raw.id}": duplicate truck id "${truck.id}"`);
        }
        seenTruckIds.add(truck.id);
    }
    return raw;
}

/**
 * Validates the whole level list (e.g. all of levels.json), additionally checking that
 * level ids are unique and that truck ids are unique across the entire game - a
 * duplicate id would silently break save-data/lookup code later, so it's a hard failure.
 *
 * @param {RawLevel[]} rawLevels
 * @returns {RawLevel[]} the same array, every entry proven valid.
 * @throws {Error} on the first invalid level/truck, or on a duplicate id.
 */
export function loadLevels(rawLevels) {
    if (!Array.isArray(rawLevels) || rawLevels.length === 0) {
        throw new Error(`Invalid level set: expected a non-empty array, got ${JSON.stringify(rawLevels)}`);
    }

    const seenLevelIds = new Set();
    const seenTruckIds = new Set();
    for (const raw of rawLevels) {
        loadLevel(raw);
        if (seenLevelIds.has(raw.id)) {
            throw new Error(`Duplicate level id "${raw.id}" - level ids must be unique across the level set`);
        }
        seenLevelIds.add(raw.id);

        for (const truck of raw.trucks) {
            if (seenTruckIds.has(truck.id)) {
                throw new Error(`Duplicate truck id "${truck.id}" - truck ids must be unique across the whole game`);
            }
            seenTruckIds.add(truck.id);
        }
    }
    return rawLevels;
}

/**
 * @typedef {Object} RawShapeLevel
 * @property {string} id
 * @property {string[]} newShapes - shapes introduced at this level (usually empty).
 * @property {string[]} allowedShapes - every shape any puzzle in this level may use.
 * @property {Array<{id: string, label: string, amount: number}>} [bonuses] - one-off bonuses paid
 *   at the end of the level (e.g. a first-day bonus), shown on the end-of-day popup.
 * @property {Array<{id: string, difficulty: 'easy' | 'medium' | 'hard', puzzles: RawTruck[]}>} trucks -
 *   each truck is a SLOT holding a pool of alternative puzzles of that difficulty.
 */

/**
 * Validates the shape-gated data set (levels.shapes.json): the same levels/trucks layout as
 * levels.json, except each truck is a slot holding a POOL of alternative puzzles, and each
 * level lists which shapes it allows. Checks the structure, runs every puzzle through
 * loadTruck (grid size, blocked cells, known shapes, exact cell count...), and checks that
 *   - every puzzle only uses its level's allowed shapes,
 *   - every puzzle has the difficulty label of its slot,
 *   - ids are unique across the whole file (levels, trucks and puzzles).
 * Whether the shape-progression plan itself is right (what unlocks when) is checked by the
 * tests, not here.
 *
 * @param {RawShapeLevel[]} rawLevels
 * @returns {RawShapeLevel[]} the same array, every entry proven valid.
 * @throws {Error} naming the offending level/truck/puzzle and the rule it broke.
 */
export function loadShapeLevels(rawLevels) {
    if (!Array.isArray(rawLevels) || rawLevels.length === 0) {
        throw new Error(`Invalid shape level set: expected a non-empty array, got ${JSON.stringify(rawLevels)}`);
    }

    const seenIds = new Set();
    const claim = (id, what) => {
        if (typeof id !== 'string' || id.length === 0) {
            throw new Error(`${what} needs a non-empty string "id" (got ${JSON.stringify(id)})`);
        }
        if (seenIds.has(id)) {
            throw new Error(`Duplicate id "${id}" - ids must be unique across the whole shape level set`);
        }
        seenIds.add(id);
    };

    for (const level of rawLevels) {
        claim(level && level.id, 'Level');
        const levelLabel = `level "${level.id}"`;

        for (const key of ['allowedShapes', 'newShapes']) {
            if (!Array.isArray(level[key])) {
                throw new Error(`${levelLabel}: "${key}" must be an array`);
            }
            for (const shapeId of level[key]) {
                if (!isKnownShape(shapeId)) {
                    throw new Error(`${levelLabel}: unknown shape id "${shapeId}" in "${key}"`);
                }
            }
        }
        for (const shapeId of level.newShapes) {
            if (!level.allowedShapes.includes(shapeId)) {
                throw new Error(`${levelLabel}: new shape "${shapeId}" must also be in "allowedShapes"`);
            }
        }
        if (level.bonuses !== undefined) {
            if (!Array.isArray(level.bonuses)) {
                throw new Error(`${levelLabel}: "bonuses", if present, must be an array`);
            }
            for (const bonus of level.bonuses) {
                if (!bonus || typeof bonus.label !== 'string' || bonus.label.length === 0) {
                    throw new Error(`${levelLabel}: every bonus needs a non-empty "label" (got ${JSON.stringify(bonus)})`);
                }
                if (!Number.isInteger(bonus.amount) || bonus.amount <= 0) {
                    throw new Error(`${levelLabel}: bonus "${bonus.label}" needs a positive integer "amount" (got ${JSON.stringify(bonus.amount)})`);
                }
            }
        }
        if (!Array.isArray(level.trucks) || level.trucks.length === 0) {
            throw new Error(`${levelLabel}: "trucks" must be a non-empty array`);
        }

        for (const truck of level.trucks) {
            claim(truck && truck.id, `Truck in ${levelLabel}`);
            const truckLabel = `truck "${truck.id}"`;
            if (!['easy', 'medium', 'hard'].includes(truck.difficulty)) {
                throw new Error(`${truckLabel}: "difficulty" must be one of 'easy' | 'medium' | 'hard' (got ${JSON.stringify(truck.difficulty)})`);
            }
            if (!Array.isArray(truck.puzzles) || truck.puzzles.length === 0) {
                throw new Error(`${truckLabel}: "puzzles" must be a non-empty array`);
            }

            for (const puzzle of truck.puzzles) {
                loadTruck(puzzle); // grid size, blocked cells, known shapes, exact cell count, reward...
                claim(puzzle.id, `Puzzle in ${truckLabel}`);
                if (puzzle.difficulty !== truck.difficulty) {
                    throw new Error(`puzzle "${puzzle.id}": difficulty "${puzzle.difficulty}" does not match its truck slot's "${truck.difficulty}"`);
                }
                for (const shapeId of puzzle.pieces) {
                    if (!level.allowedShapes.includes(shapeId)) {
                        throw new Error(`puzzle "${puzzle.id}": uses shape "${shapeId}", which ${levelLabel} does not allow`);
                    }
                }
            }
        }
    }
    return rawLevels;
}

/**
 * Convenience constructor: builds a fresh Grid (blocked cells set, nothing placed) for a
 * validated truck, ready for the solver or the Phaser scene to place pieces into. Does
 * not re-validate - call loadTruck/loadLevels first.
 *
 * @param {RawTruck} truck - a truck already validated by loadTruck/loadLevels.
 * @returns {Grid}
 */
export function createGridForTruck(truck) {
    return new Grid(truck.rows, truck.cols, truck.blocked);
}
