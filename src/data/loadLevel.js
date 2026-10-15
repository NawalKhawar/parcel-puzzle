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
