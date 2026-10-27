import { UI_SCALE } from '../uiScale.js';

/**
 * WorkerCharacter.js
 *
 * The little courier who stands beside the truck in PuzzleScene, there mostly for cosiness
 * rather than gameplay. Three poses (assets/characters/worker-neutral.png, worker-happy.png,
 * worker-celebrate.png - all 480x360 art pixels, the character roughly centred in that canvas):
 *
 *   - neutral   - the default, idle pose, shown throughout a puzzle. It gets a slow "breathing"
 *                 bob so the screen doesn't feel static while the player is thinking.
 *   - thinking  - shown for a few seconds when the player has been idle or slow on a puzzle
 *                 (PuzzleScene decides when; see think()), then back to neutral.
 *   - happy     - shown the moment an easy truck is solved.
 *   - happy2    - shown the moment a medium truck is solved (assets/characters/worker-happy2.png).
 *   - celebrate - shown the moment a hard truck is solved (it earns the biggest reaction).
 *
 * Also draws its own ground shadow - a flattened ellipse, not the truck's trapezoid (a single
 * standing figure doesn't need a shape that reads as "a rectangle in perspective" the way the
 * truck's rectangular footprint does), but at the same low, flat opacity so the two shadows read
 * as lit by the same light and standing on the same floor.
 *
 * This class only knows how to draw and animate itself; PuzzleScene decides WHEN a truck
 * counts as solved and which reaction pose that calls for (see handleWin()).
 */

/**
 * How long one "breath" takes (ms) - slow, so it reads as idling rather than bouncing. The
 * character does NOT move up or down: its origin is bottom-centre and only its vertical SCALE
 * is animated (a squash/stretch, like a gentle breath), so the feet stay planted on the floor
 * while the body subtly grows and shrinks - a bob without the character appearing to float.
 */
const IDLE_BOB_MS = 1800;
/** How much taller (as a multiple of normal height) the character gets at the peak of a breath. */
const IDLE_STRETCH = 1.02;

/** How long the thinking pose is held before the worker goes back to neutral (ms). */
const THINK_MS = 3500;

/** The little "pop" when switching to a reaction pose: how far it scales up, and how long. */
const REACT_POP_SCALE = 1.18;
const REACT_POP_MS = 240;

/**
 * THE WORKER'S SHADOW: a flat ellipse under its feet. Sized off the sprite's own display width
 * (rather than a fixed pixel size) so it automatically grows or shrinks if the character's own
 * scale is ever tuned. SHADOW_ALPHA deliberately matches TRUCK_SHADOW_ALPHA in PuzzleScene.js -
 * if that constant changes, update this one to match so both shadows still read as the same
 * light falling on the same floor.
 */
const SHADOW_WIDTH_FRACTION = 0.4; // relative to the sprite's full (padded) display width
const SHADOW_HEIGHT_RATIO = 0.3; // the ellipse's height as a fraction of its own width - flat, like a floor shadow in perspective
// Negative: the ellipse's centre sits slightly ABOVE the feet, not below, so the character
// stands roughly in its middle (its legs/feet overlap and hide the shadow's upper half) rather
// than the whole shadow trailing out behind it.
const SHADOW_Y_OFFSET = -10 * UI_SCALE;
const SHADOW_ALPHA = 0.16; // matches TRUCK_SHADOW_ALPHA

export class WorkerCharacter
{
    /**
     * @param {import('phaser').Scene} scene - the scene to draw into (PuzzleScene).
     * @param {number} x - horizontal centre, in design pixels.
     * @param {number} floorY - the "floor" the character stands on, in design pixels - the
     *   sprite's origin is bottom-centre, so this is where its feet touch down.
     * @param {Object} [options]
     * @param {number} [options.scale] - uniform scale applied to the 480x360 art, on top of
     *   UI_SCALE (so 1 means "480x360 art pixels = 480x360 game pixels at UI_SCALE 1").
     * @param {number} [options.depth] - draw depth (see PuzzleScene's depth constants). The
     *   shadow is drawn one depth behind this, so it never covers the character.
     */
    constructor (scene, x, floorY, options = {})
    {
        this.scene = scene;
        this.floorY = floorY;
        this.scale = (options.scale ?? 1) * UI_SCALE;
        const depth = options.depth ?? 0;

        this.sprite = scene.add
            .image(x, floorY, 'worker-neutral')
            .setOrigin(0.5, 1)
            .setScale(this.scale)
            .setDepth(depth);

        this.shadow = scene.add
            .ellipse(
                x,
                floorY + SHADOW_Y_OFFSET,
                this.sprite.displayWidth * SHADOW_WIDTH_FRACTION,
                this.sprite.displayWidth * SHADOW_WIDTH_FRACTION * SHADOW_HEIGHT_RATIO,
                0x000000,
                SHADOW_ALPHA
            )
            .setDepth(depth - 1);

        this.startIdle();
    }

    /**
     * Starts (or restarts) the neutral pose's idle bob: a slow, endless "breathing" squash and
     * stretch (see IDLE_BOB_MS). Only the sprite's own vertical scale is tweened, not its
     * position - the origin stays bottom-centre throughout, so the feet never leave floorY.
     */
    startIdle ()
    {
        this.idleTween = this.scene.tweens.add({
            targets: this.sprite,
            scaleY: this.scale * IDLE_STRETCH,
            duration: IDLE_BOB_MS,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });
    }

    /**
     * Switches to the thinking pose for THINK_MS, then back to neutral. The idle bob keeps going
     * throughout. Ignored if already thinking, or once a reaction pose has been shown (the truck
     * is solved - the worker stays happy).
     */
    think ()
    {
        if (this.isThinking || this.hasReacted)
        {
            return;
        }
        this.isThinking = true;
        this.sprite.setTexture('worker-thinking');
        this.thinkTimer = this.scene.time.delayedCall(THINK_MS, () => this.stopThinking());
    }

    /** Returns from the thinking pose to neutral (no-op if not thinking). */
    stopThinking ()
    {
        if (!this.isThinking)
        {
            return;
        }
        this.isThinking = false;
        if (this.thinkTimer)
        {
            this.thinkTimer.remove(false);
            this.thinkTimer = undefined;
        }
        this.sprite.setTexture('worker-neutral');
    }

    /**
     * Switches to a reaction pose with a little pop (scales up then settles back), and stops
     * the idle bob so the character holds still in the reaction pose rather than still bobbing.
     *
     * @param {'happy' | 'happy2' | 'celebrate'} pose
     */
    react (pose)
    {
        // A reaction overrides any thinking in progress, and thinking never resumes after it.
        this.hasReacted = true;
        this.isThinking = false;
        if (this.thinkTimer)
        {
            this.thinkTimer.remove(false);
            this.thinkTimer = undefined;
        }
        if (this.idleTween)
        {
            this.idleTween.stop();
            this.idleTween = undefined;
        }
        this.sprite.setScale(this.scale); // undo any mid-breath stretch before switching pose
        this.sprite.setTexture(`worker-${pose}`);

        this.scene.tweens.add({
            targets: this.sprite,
            scale: { from: this.scale * REACT_POP_SCALE, to: this.scale },
            duration: REACT_POP_MS,
            ease: 'Back.easeOut',
        });
    }
}
