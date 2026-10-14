# Level Data Schema

This describes the shape of objects in `src/data/levels.json`, the **new, runtime**
level format. It is unrelated to the legacy picture/legend format in
`docs/level_data.md` — that file is reference-only and is never read at runtime
(see `loadLevel.js`, which is the only code allowed to turn raw level data into
something the game uses).

## Level object

```ts
{
  /** Unique, stable identifier for this level. Used for save data / level selection, so
   *  it should not be reassigned once a level has shipped. */
  id: string;

  /** Board height (number of grid rows). Must be a positive integer. */
  rows: number;

  /** Board width (number of grid columns). Must be a positive integer. */
  cols: number;

  /** Cells that are permanently unusable — no piece may ever cover them, and they are
   *  excluded from the "is this level complete?" check. Each entry is a [row, col]
   *  tuple, 0-indexed, within [0, rows) x [0, cols). May be an empty array. */
  blocked: Array<[number, number]>;

  /** The set of pieces the player is given for this level, in no particular required
   *  order (the tray/UI decides display order). Each entry is a shape id from the
   *  canonical vocabulary in src/core/Shape.js (e.g. 'l4', 'p5', 'dot'). Repeats are
   *  allowed and expected (e.g. multiple 'dot' pieces). There is NO stored (row, col)
   *  position for any piece — pieces start unplaced, and the player decides where
   *  each one goes (per docs/game_concept.pdf: no rotation, drag-to-place). */
  pieces: string[];

  /** Optional, purely descriptive — not used by any engine logic. A free-form
   *  difficulty bucket for level-select UI / progression ordering. */
  difficulty?: 'easy' | 'medium' | 'hard';

  /** Optional. Coins earned for completing this level ("truck"), shown on WinScene and
   *  folded into the running shift total (see PuzzleScene.handleWin / ShiftCompleteScene,
   *  Milestone 9). Must be a positive integer if present. Defaults to DEFAULT_REWARD
   *  (see PuzzleScene.js) if omitted, so existing level data never needs to be touched
   *  just to keep working — but every level actually shipped in levels.json sets this
   *  explicitly, scaled loosely with grid size/difficulty, per docs/game_concept.pdf's
   *  "Shift Complete!" screen reference (trucks completed + total earned). */
  reward?: number;
}
```

## Invariants enforced by `loadLevel.js`

A level is rejected (loudly, with a descriptive error naming the offending level id)
if any of the following don't hold:

1. `id` is a non-empty string.
2. `rows` and `cols` are positive integers.
3. Every `blocked` cell is within bounds and no cell appears twice.
4. `pieces` is a non-empty array, and every entry is a shape id recognized by
   `src/core/Shape.js` (`isKnownShape`).
5. **Exact-cover cell count**: the total cell count of all pieces, plus the number of
   blocked cells, equals `rows * cols`. This doesn't prove a level is *solvable*
   (pieces could still be impossible to arrange even if the counts match — that's what
   the solver in Milestone 3 is for), but it catches the much more common authoring
   mistake of simply picking the wrong pieces/grid size for a level, immediately at
   load time rather than as a confusing runtime dead-end.
6. `reward`, if present, is a positive integer.

## Where the shape vocabulary lives

Shape ids referenced in `pieces` are defined once, canonically, in
`src/core/Shape.js` (`SHAPES`) — there is no separate copy of shape geometry under
`src/data/`. Keeping one canonical source avoids the new engine and the level data
silently drifting out of sync on what e.g. `'l4'` actually looks like.
