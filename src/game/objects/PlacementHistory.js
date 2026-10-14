/**
 * PlacementHistory.js
 *
 * A minimal ordered stack of placement ids, recording the order pieces were placed on
 * the board in. This is session/UI bookkeeping ("what did the player do, in what
 * order") rather than puzzle-rule logic, so it lives alongside the other game objects
 * rather than in src/core — but like src/core, it holds no Phaser dependency of its
 * own; it's just an array with stack semantics, kept as its own small class so
 * PuzzleScene's undo/reset logic reads as "pop the history, undo that placement"
 * rather than juggling a raw array inline.
 */
export class PlacementHistory
{
    constructor ()
    {
        /** @type {Array<string | number>} */
        this.stack = [];
    }

    /**
     * Records a newly-committed placement as the most recent action.
     *
     * @param {string | number} placementId
     */
    push (placementId)
    {
        this.stack.push(placementId);
    }

    /**
     * Removes and returns the most recently recorded placement id, or undefined if
     * nothing has been placed (callers should check this before trying to undo).
     *
     * @returns {string | number | undefined}
     */
    pop ()
    {
        return this.stack.pop();
    }

    /** Discards the entire history, e.g. when resetting a level back to empty. */
    clear ()
    {
        this.stack = [];
    }

    /** True once every placement has been popped (or none were ever pushed). */
    get isEmpty ()
    {
        return this.stack.length === 0;
    }
}
