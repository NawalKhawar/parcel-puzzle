/**
 * pickDayPuzzles.js
 *
 * Chooses which puzzles a player actually plays on one day (level). In levels.shapes.json each
 * truck slot holds a POOL of alternative puzzles that all follow the same rules (same
 * difficulty, only shapes unlocked by that level), so a day is made by picking one puzzle from
 * each slot's pool.
 *
 * The pick ROTATES: the first time a level is played it uses the first puzzle of every pool,
 * the second time the second puzzle, and so on, wrapping around after the last. Replaying a level
 * therefore always gives fresh puzzles until all of them have been seen, with no repeats in
 * between. (Pools are stored easiest to hardest, so successive plays get very slightly harder.)
 *
 * Plain logic with no Phaser dependency (see "Architectural boundary" in PROJECT_STRUCTURE.md),
 * so it can be unit-tested. It is deterministic: the caller supplies how many times the level has
 * been played, and PuzzleScene keeps that count.
 */

/**
 * @typedef {import('./loadLevel.js').RawTruck} Puzzle
 * @typedef {import('./loadLevel.js').RawShapeLevel} ShapeLevel
 */

/**
 * Picks one puzzle from each truck slot of a level for this play-through, then orders the day
 * easiest to hardest by difficulty score.
 *
 * Ordering matters because two slots with the same label (e.g. the two easy trucks) overlap in
 * difficulty: their picks could otherwise come out harder first, easier second. Sorting by score
 * keeps difficulty from ever dropping during a day, and since the easy/medium/hard labels sit in
 * separate score bands, the slot order (easy, then medium, then hard) is kept too.
 *
 * @param {ShapeLevel} level - one level of the shape-gated data.
 * @param {number} [playNumber] - how many times this level has been started before: 0 the first
 *   time, 1 the second, and so on. It wraps around each slot's pool, so any whole number works.
 * @returns {Puzzle[]} one puzzle per truck slot, in play order.
 */
export function pickDayPuzzles(level, playNumber = 0) {
    const picks = level.trucks.map((slot) => {
        const size = slot.puzzles.length;
        // Double modulo so a (never expected) negative count still lands inside the pool.
        return slot.puzzles[((playNumber % size) + size) % size];
    });

    // Stable sort (guaranteed in modern JS), so equal scores keep their slot order.
    return picks.sort((a, b) => a.difficultyScore - b.difficultyScore);
}
