/**
 * loadLevel.js
 *
 * Validates and normalizes raw level data (as it would come from levels.json) against
 * the schema documented in levels.schema.md, and provides a convenience constructor
 * for turning a validated level into a ready-to-play src/core/Grid instance.
 *
 * This is the single gate raw level data must pass through before anything else in the
 * game (the Phaser scene, the solver, tests) touches it — see levels.schema.md for why
 * that matters and what's checked. Must never import 'phaser' — see "Architectural
 * boundary" in PROJECT_STRUCTURE.md.
 */

import { Grid } from '../core/Grid.js';
import { isKnownShape, getShapeCellCount } from '../core/Shape.js';

/**
 * @typedef {Object} RawLevel
 * @property {string} id
 * @property {number} rows
 * @property {number} cols
 * @property {Array<[number, number]>} blocked
 * @property {string[]} pieces
 * @property {'easy' | 'medium' | 'hard'} [difficulty]
 * @property {number} [reward]
 */

/**
 * Validates a single raw level object and returns it unchanged (levels.json is already
 * in the shape the game consumes directly — "normalizing" here is really just
 * validating and defaulting optional fields, not reshaping data).
 *
 * @param {RawLevel} raw
 * @returns {RawLevel} the same level object, proven valid.
 * @throws {Error} with a message naming the offending level id (or its index/object
 *   shape, if even `id` itself is missing/invalid) and exactly which rule failed.
 */
export function loadLevel(raw) {
    const label = raw && typeof raw.id === 'string' && raw.id.length > 0 ? `level "${raw.id}"` : 'a level with no valid id';

    if (!raw || typeof raw !== 'object') {
        throw new Error(`Invalid level data: expected an object, got ${JSON.stringify(raw)}`);
    }
    if (typeof raw.id !== 'string' || raw.id.length === 0) {
        throw new Error(`Invalid level data: "id" must be a non-empty string (got ${JSON.stringify(raw.id)})`);
    }
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

    const totalPieceCells = raw.pieces.reduce((sum, shapeId) => sum + getShapeCellCount(shapeId), 0);
    const totalBoardCells = raw.rows * raw.cols;
    const openCells = totalBoardCells - raw.blocked.length;
    if (totalPieceCells !== openCells) {
        throw new Error(
            `${label}: pieces cover ${totalPieceCells} cells but the board has ${openCells} open cells ` +
                `(${raw.rows}x${raw.cols} grid minus ${raw.blocked.length} blocked) — these must match exactly ` +
                `for the level to be fillable at all.`
        );
    }

    if (raw.difficulty !== undefined && !['easy', 'medium', 'hard'].includes(raw.difficulty)) {
        throw new Error(`${label}: "difficulty" must be one of 'easy' | 'medium' | 'hard' (got ${JSON.stringify(raw.difficulty)})`);
    }

    if (raw.reward !== undefined && (!Number.isInteger(raw.reward) || raw.reward <= 0)) {
        throw new Error(`${label}: "reward", if present, must be a positive integer (got ${JSON.stringify(raw.reward)})`);
    }

    return raw;
}

/**
 * Validates an entire array of raw levels (e.g. the full contents of levels.json),
 * additionally checking that every level's "id" is unique across the set — a
 * duplicate id would silently break level-select/save-data lookups, so it's treated
 * as a hard validation failure here rather than left for someone to discover later.
 *
 * @param {RawLevel[]} rawLevels
 * @returns {RawLevel[]} the same array, with every entry proven valid.
 * @throws {Error} on the first invalid level, or on a duplicate id.
 */
export function loadLevels(rawLevels) {
    if (!Array.isArray(rawLevels)) {
        throw new Error(`Invalid level set: expected an array, got ${JSON.stringify(rawLevels)}`);
    }

    const seenIds = new Set();
    for (const raw of rawLevels) {
        loadLevel(raw);
        if (seenIds.has(raw.id)) {
            throw new Error(`Duplicate level id "${raw.id}" — level ids must be unique across the level set`);
        }
        seenIds.add(raw.id);
    }
    return rawLevels;
}

/**
 * Convenience constructor: builds a fresh, empty-of-placements src/core/Grid for a
 * validated level, ready for the solver or the Phaser scene to start placing pieces
 * into. Does not itself re-validate the level — call loadLevel/loadLevels first.
 *
 * @param {RawLevel} level - a level object already validated by loadLevel/loadLevels.
 * @returns {Grid}
 */
export function createGridForLevel(level) {
    return new Grid(level.rows, level.cols, level.blocked);
}
