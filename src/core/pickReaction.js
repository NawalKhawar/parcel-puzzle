/**
 * pickReaction.js
 *
 * Chooses which pose the worker strikes when a truck is solved: random, but never the same pose
 * twice in a row, so the reactions keep feeling fresh. Plain logic with no Phaser dependency (see
 * "Architectural boundary" in PROJECT_STRUCTURE.md), so it is unit-testable.
 */

/**
 * @param {string[]} poses - the poses to choose from (at least one).
 * @param {string | null | undefined} last - the pose used last time, if any; it is excluded unless it is the only one.
 * @param {() => number} [rng] - returns a float in [0, 1); Math.random by default, injectable for tests.
 * @returns {string} one of `poses`.
 */
export function pickReaction(poses, last, rng = Math.random) {
    // Everything except the previous pose; if that leaves nothing (a single pose), allow it.
    const options = poses.filter((pose) => pose !== last);
    const pool = options.length > 0 ? options : poses;
    return pool[Math.floor(rng() * pool.length)];
}
