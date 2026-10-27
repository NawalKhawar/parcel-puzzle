# Level Data Schema

This describes the shape of `src/data/levels.json`, the **runtime** level data. It is
unrelated to the legacy picture/legend format in `docs/level_data.md` — that file is
reference-only and is never read at runtime (see `loadLevel.js`, which is the only code
allowed to turn raw level data into something the game uses).

## Vocabulary

- A **level** is one in-game day. The game has a list of levels, played in order.
- A **truck** is one packing puzzle (a board plus the pieces that must exactly fill it).
  Each level contains several trucks, played in order.

`levels.json` is an array of level objects. The current set (produced by
`node scripts/generate-levels.js`) has 50 levels (E/M/H = easy/medium/hard trucks): level 1 has
3E; levels 2–5 have 4E; 6–14 have 3E+1M; 15–19 have 2E+2M; 20–25 have 3E+2M; 26–30 have 2E+3M;
31–39 have 2E+2M+1H; 40–50 have 2E+2M+2H.

## Level object

```ts
{
  /** Unique, stable identifier, e.g. "level-07". */
  id: string;

  /** The day's puzzles, in play order. Must be non-empty. The "Truck k/total" counter
   *  shown in-game is simply the index into / length of this array. */
  trucks: Truck[];
}
```

## Truck object

```ts
{
  /** Unique identifier across the WHOLE game (not just this level), e.g.
   *  "level-07-truck-3". */
  id: string;

  /** Board height (number of grid rows). Must be a positive integer. By design every
   *  shipped board is square or portrait (rows >= cols), because the board represents the
   *  open back of a mail truck; tests/data/levels.test.js enforces this. */
  rows: number;

  /** Board width (number of grid columns). Must be a positive integer. */
  cols: number;

  /** Cells that are permanently unusable — no piece may ever cover them, and they are
   *  excluded from the "is this truck complete?" check. Each entry is a [row, col]
   *  tuple, 0-indexed, within [0, rows) x [0, cols). May be an empty array. */
  blocked: Array<[number, number]>;

  /** The pieces the player is given, in no particular required order (the tray/UI
   *  decides display order). Each entry is a shape id from the canonical vocabulary in
   *  src/core/Shape.js (e.g. 'l4', 'p5', 'dot'). Repeats are allowed and expected.
   *  There is NO stored (row, col) position for any piece — pieces start unplaced, and
   *  the player decides where each one goes (per docs/game_concept.pdf: no rotation,
   *  drag-to-place). */
  pieces: string[];

  /** Optional, descriptive: 'easy' | 'medium' | 'hard'. Shown in the in-game header and
   *  used by the tests to check each level's difficulty ramp. */
  difficulty?: 'easy' | 'medium' | 'hard';

  /** Optional, descriptive: a 0..1 difficulty score computed by the generator (see
   *  scripts/generate-levels.js for the formula). easy < 0.34 <= medium < 0.67 <= hard.
   *  Not used by game logic; tests use it to check difficulty never drops within a day. */
  difficultyScore?: number;

  // There is deliberately NO reward field: what a truck pays is worked out from its
  // `difficulty` and the day by src/core/economy.js, using the numbers in src/data/economy.json.
}
```

## Invariants enforced by `loadLevel.js`

Data is rejected (loudly, with a descriptive error naming the offending level/truck id)
if any of the following don't hold:

1. The level list is a non-empty array; level ids are non-empty strings and unique.
2. Each level has a non-empty `trucks` array; truck ids are non-empty strings and unique
   across the entire game.
3. `rows` and `cols` are positive integers.
4. Every `blocked` cell is within bounds and no cell appears twice.
5. `pieces` is a non-empty array, and every entry is a shape id recognized by
   `src/core/Shape.js` (`isKnownShape`).
6. **Exact-cover cell count**: the total cell count of all pieces, plus the number of
   blocked cells, equals `rows * cols`. This doesn't prove a truck is *solvable* (pieces
   could still be impossible to arrange even if the counts match — that's what the solver
   in `scripts/` is for, run by `node scripts/validate-levels.js` and `npm test`), but it
   catches the much more common authoring mistake of simply picking the wrong pieces/grid
   size, immediately at load time rather than as a confusing runtime dead-end.
7. `difficulty`, if present, is one of the three labels; `difficultyScore`, if present,
   is a number between 0 and 1.

## Regenerating the data

`node scripts/generate-levels.js` rebuilds the whole file deterministically (it is seeded,
so re-running without code changes reproduces the same file). To change the number of
trucks per day or the difficulty curve, edit `labelsForLevel()` / `targetDifficulty()` at
the top of that script and re-run it, then run `node scripts/validate-levels.js` and
`npm test` (the tests in `tests/data/levels.test.js` encode the intended level structure
and will need updating if the plan itself changes).

## The shape-gated pool (`levels.shapes.json`)

A second data file with the same levels, but where shapes are introduced gradually and each
truck slot holds a POOL of alternative puzzles. It is generated by
`node scripts/generate-levels.js --shape-gated` and validated by `loadShapeLevels`
(`node scripts/validate-levels.js --shapes` also solves every puzzle).

```ts
{
  id: string;                  // "level-08"
  newShapes: string[];         // shapes introduced at this level (usually empty)
  allowedShapes: string[];     // every shape any puzzle in this level may use
  trucks: Array<{
    id: string;                // "level-08-truck-3" - one SLOT in the day
    difficulty: 'easy' | 'medium' | 'hard';   // same easy/medium/hard order as levels.json
    puzzles: Truck[];          // the pool (5 by default); each is a normal Truck object as
                               // above, with id "level-08-truck-3-p2" and the slot's difficulty
  }>;
}
```

Extra rules enforced by `loadShapeLevels`: every puzzle only uses its level's
`allowedShapes`, has its slot's difficulty, `newShapes` is a subset of `allowedShapes`, and
ids are unique across the whole file. The unlock plan itself (level 1 has only the dot and the
square; then ONE new shape at a time: every 3 levels (domino_h 3, domino_v 6, tri_i 9, bar4 12), every 4
(tri_l 16, l4 20, t4 24, s4 28), then every 5 (p5 33, plus 38)) lives in the generator's
`SHAPE_UNLOCKS` and is checked by `tests/data/shapeLevels.test.js`. The game reads
this file at runtime through `pickDayPuzzles` (src/data/pickDayPuzzles.js): when a day starts,
one puzzle is taken from each slot's pool and the day is ordered easiest to hardest. The pick
rotates: the first time a level is played it uses each pool's first puzzle, the next time the
second, and so on, wrapping after the last.
This is the file the game plays; `levels.json` above is the original reference set.

## Where the shape vocabulary lives

Shape ids referenced in `pieces` are defined once, canonically, in
`src/core/Shape.js` (`SHAPES`) — there is no separate copy of shape geometry under
`src/data/`. Keeping one canonical source avoids the new engine and the level data
silently drifting out of sync on what e.g. `'l4'` actually looks like.
