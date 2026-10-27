import { UI_SCALE } from '../uiScale.js';

/**
 * GuideCursor.js
 *
 * The little pointing-hand cursor (assets/ui/hand-cursor.webp) that the first-day guide uses to SHOW
 * the player what to do. It is purely a picture drawn on top of the scene: it never touches the real
 * parcels, buttons or furniture it points at, it only moves over them. Two looping demonstrations:
 *
 *   - playDrag(from, to): the hand appears on `from`, presses down (shrinks a little, as if pushed
 *     into the screen), slides smoothly to `to` while held, lets go (springs back and fades), pauses
 *     and repeats. Used for "drag this parcel / this item over there".
 *   - playTap(at): the hand appears on `at`, presses down and bounces back as if it hit something,
 *     fades out, pauses and repeats. Used for "press this button".
 *
 * Both loop until stop() (or the scene shuts down). The positions are given as FUNCTIONS and read
 * again at the start of every loop, so a target that has moved (a re-laid-out tray, a scrolled
 * list) is still pointed at correctly. A function may return null for "not available right now"; the
 * loop then just waits a moment and tries again.
 *
 * The picture's pivot is its FINGERTIP, so pressing (scaling down) shrinks the hand towards the spot
 * it is pointing at instead of towards its middle, and the position you give is where the fingertip
 * lands. If the cursor picture is missing from assets/ui, every method quietly does nothing.
 */

/** The fingertip as a fraction of the picture (0-1 across, 0-1 down) - measured from the art. */
const FINGERTIP = { x: 0.36, y: 0.14 };

/** How wide the hand is drawn, in design pixels (the art is 256 px wide; UI_SCALE is applied here). */
const DEFAULT_WIDTH = 92;

/** How small the hand gets when "pressed" (1 = its normal size). */
const PRESSED_SCALE = 0.78;

/** How big the hand springs up to (past its normal size) in a tap's bounce. */
const BOUNCE_SCALE = 1.14;

/** How long to wait before looking again when a position function has nothing for us (ms). */
const RETRY_MS = 400;

export class GuideCursor
{
    /**
     * @param {import('phaser').Scene} scene - the scene to draw in. The cursor removes itself when the scene shuts down.
     * @param {Object} [options]
     * @param {number} [options.depth] - draw depth: above what it points at, below popups and pause menus.
     * @param {number} [options.width] - drawn width in design pixels.
     */
    constructor (scene, { depth = 900, width = DEFAULT_WIDTH } = {})
    {
        this.scene = scene;
        /** Bumped whenever the running animation is replaced or stopped, so a late callback can tell it is stale. */
        this.runId = 0;
        /** Undoes the step currently in progress (stops its tween or timer). */
        this.cancelStep = null;
        /** What is being demonstrated: { kind: 'drag' | 'tap', ... }, or null. */
        this.mode = null;
        this.suspended = false;
        this.destroyed = false;

        this.image = null;
        if (scene.textures.exists('hand-cursor'))
        {
            this.image = scene.add.image(0, 0, 'hand-cursor').setOrigin(FINGERTIP.x, FINGERTIP.y).setDepth(depth).setAlpha(0);
            /** The normal (un-pressed) scale. */
            this.baseScale = (width * UI_SCALE) / this.image.width;
            this.image.setScale(this.baseScale);
        }
        scene.events.once('shutdown', this.stop, this);
    }

    /**
     * Loops the "press, drag, release" demonstration.
     *
     * @param {() => ({x: number, y: number} | null)} getFrom - where the fingertip starts (screen pixels).
     * @param {() => ({x: number, y: number} | null)} getTo - where it is dragged to.
     * @param {Object} [options]
     * @param {number} [options.delay] - ms to wait before the first loop (lets the screen settle).
     */
    playDrag (getFrom, getTo, { delay = 0 } = {})
    {
        this.mode = { kind: 'drag', getFrom, getTo, delay };
        this.begin();
    }

    /**
     * Loops the "press and bounce" demonstration.
     *
     * @param {() => ({x: number, y: number} | null)} getAt - where the fingertip lands (screen pixels).
     * @param {Object} [options]
     * @param {number} [options.delay] - ms to wait before the first loop.
     */
    playTap (getAt, { delay = 0 } = {})
    {
        this.mode = { kind: 'tap', getAt, delay };
        this.begin();
    }

    /**
     * Hides the cursor and pauses the demonstration (e.g. while the player is dragging something
     * themselves). resume() starts it again from the beginning of a loop.
     */
    suspend ()
    {
        if (this.destroyed || this.suspended)
        {
            return;
        }
        this.suspended = true;
        this.interrupt();
        this.image?.setAlpha(0);
    }

    /** Carries on after suspend(). Does nothing if it was not suspended. */
    resume ()
    {
        if (this.destroyed || !this.suspended)
        {
            return;
        }
        this.suspended = false;
        if (this.mode)
        {
            this.mode.delay = 0;
            this.begin();
        }
    }

    /** Ends the demonstration for good and removes the cursor. Safe to call more than once. */
    stop ()
    {
        if (this.destroyed)
        {
            return;
        }
        this.destroyed = true;
        this.interrupt();
        this.mode = null;
        this.scene.events.off('shutdown', this.stop, this);
        this.image?.destroy();
        this.image = null;
    }

    // ------------------------------------------------------------------ the loops

    /** Starts (or restarts) the current mode's loop from the top, after its initial delay. */
    begin ()
    {
        if (this.destroyed || !this.image || !this.mode)
        {
            return;
        }
        this.interrupt();
        const id = this.runId;
        this.after(this.mode.delay, () => this.cycle(id));
    }

    /**
     * One loop of the demonstration, then another (until stopped). `id` is the run this loop belongs
     * to; if the run was replaced or stopped meanwhile, the loop ends quietly.
     *
     * @param {number} id
     */
    cycle (id)
    {
        if (id !== this.runId || this.destroyed || this.suspended || !this.mode)
        {
            return;
        }
        const { image, baseScale } = this;
        const mode = this.mode;
        const start = mode.kind === 'drag' ? mode.getFrom() : mode.getAt();
        const end = mode.kind === 'drag' ? mode.getTo() : null;
        if (!start || (mode.kind === 'drag' && !end))
        {
            // The thing to point at isn't there right now; look again shortly.
            this.after(RETRY_MS, () => this.cycle(id));
            return;
        }

        // Start invisible at the starting spot, at normal size.
        image.setPosition(start.x, start.y).setScale(baseScale).setAlpha(0);
        const pressed = baseScale * PRESSED_SCALE;

        const steps = [
            this.tween({ alpha: 1, duration: 250 }),
            this.wait(200),
            // Press: shrink about the fingertip, as if pushed into the screen.
            this.tween({ scaleX: pressed, scaleY: pressed, duration: 140, ease: 'Sine.easeOut' }),
        ];
        if (mode.kind === 'drag')
        {
            steps.push(
                this.wait(90),
                // Drag: slide smoothly to the target while still pressed.
                this.tween({ x: end.x, y: end.y, duration: 1100, ease: 'Sine.easeInOut' }),
                this.wait(180),
                // Release: spring back up to normal size...
                this.tween({ scaleX: baseScale, scaleY: baseScale, duration: 140, ease: 'Sine.easeOut' }),
                this.wait(120),
                // ...and fade away.
                this.tween({ alpha: 0, duration: 300 }),
                this.wait(500)
            );
        }
        else
        {
            steps.push(
                // Bounce - the "impact": spring up past normal size, then settle back with a small bounce.
                this.tween({ scaleX: baseScale * BOUNCE_SCALE, scaleY: baseScale * BOUNCE_SCALE, duration: 150, ease: 'Quad.easeOut' }),
                this.tween({ scaleX: baseScale, scaleY: baseScale, duration: 360, ease: 'Bounce.easeOut' }),
                this.wait(200),
                this.tween({ alpha: 0, duration: 300 }),
                this.wait(650)
            );
        }
        this.sequence(id, steps, () => this.cycle(id));
    }

    // ------------------------------------------------------------------ small animation helpers

    /** Cancels whatever step is running and invalidates its callbacks. */
    interrupt ()
    {
        this.runId += 1;
        this.cancelStep?.();
        this.cancelStep = null;
    }

    /** Calls `fn` after `ms`, as the current step (so interrupt() cancels it). */
    after (ms, fn)
    {
        const timer = this.scene.time.delayedCall(ms, fn);
        this.cancelStep = () => timer.remove(false);
    }

    /** @returns {(done: () => void) => void} a step that waits `ms`. */
    wait (ms)
    {
        return (done) => this.after(ms, done);
    }

    /** @returns {(done: () => void) => void} a step that tweens the cursor image with `config`. */
    tween (config)
    {
        return (done) => {
            const tween = this.scene.tweens.add({ targets: this.image, ...config, onComplete: done });
            this.cancelStep = () => tween.stop();
        };
    }

    /**
     * Runs steps one after another, then `onEnd`. Stops quietly if the run `id` was replaced or stopped.
     *
     * @param {number} id
     * @param {Array<(done: () => void) => void>} steps
     * @param {() => void} onEnd
     */
    sequence (id, steps, onEnd)
    {
        const next = (index) => {
            if (id !== this.runId || this.destroyed)
            {
                return;
            }
            if (index >= steps.length)
            {
                onEnd();
                return;
            }
            steps[index](() => next(index + 1));
        };
        next(0);
    }
}
