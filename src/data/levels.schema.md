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
`node scripts/generate-levels.js`) has 30 levels: level 1 has 3 easy trucks; levels 2–7
have 4 (2 easy, 2 medium); levels 8–12 have 5 (2 easy, 2 medium, 1 hard); levels 13–30
have 6 (2 easy, 2 medium, 2 hard).

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

  /** Optional. Coins earned for completing this truck, shown on WinScene and added to
   *  the day's running total (see PuzzleScene.handleWin / DayCompleteScene). Must be a
   *  positive integer if present. Defaults to DEFAULT_REWARD (see PuzzleScene.js) if
   *  omitted. The generator sets it to (open cells) + 0 / 4 / 8 for easy / medium / hard. */
  reward?: number;
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
   is a number between 0 and 1; `reward`, if present, is a positive integer.

## Regenerating the data

`node scripts/generate-levels.js` rebuilds the whole file deterministically (it is seeded,
so re-running without code changes reproduces the same file). To change the number of
trucks per day or the difficulty curve, edit `labelsForLevel()` / `targetDifficulty()` at
the top of that script and re-run it, then run `node scripts/validate-levels.js` and
`npm test` (the tests in `tests/data/levels.test.js` encode the intended level structure
and will need updating if the plan itself changes).

## Where the shape vocabulary lives

Shape ids referenced in `pieces` are defined once, canonically, in
`src/core/Shape.js` (`SHAPES`) — there is no separate copy of shape geometry under
`src/data/`. Keeping one canonical source avoids the new engine and the level data
silently drifting out of sync on what e.g. `'l4'` actually looks like.
