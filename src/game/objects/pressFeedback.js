/**
 * pressFeedback.js
 *
 * Mouse feedback for buttons, as a Phaser tween on the button's scale (so it works on any button -
 * an image, a text button - without separate artwork for each state):
 *   - HOVER:   the button grows smoothly while the mouse is over it, and eases back to its normal
 *              size when the mouse leaves.
 *   - PRESS:   with a MOUSE it squashes down a little (below its normal size), and when let go it
 *              springs back with a small overshoot - to the hover size if the mouse is still on it,
 *              otherwise to normal.
 *   - TOUCH:   a finger covers the button, so a squash would be hidden and there is no hover; instead the
 *              button GROWS while the finger is down (TOUCH_PRESSED_SCALE) and springs back to normal when
 *              the finger lifts or slides off. That is the "I pressed it" feedback on a phone.
 * All three are one size multiplier `k` (1 = normal) applied to the button's own scale, so the
 * states blend into each other instead of fighting.
 */

import { playSfx } from '../audio.js';

/** Size multipliers for each state (1 = the button's normal size). */
const HOVER_SCALE = 1.08;
const PRESSED_SCALE = 0.9;
/** How much bigger a button gets while a FINGER is held on it (see the TOUCH note above). */
const TOUCH_PRESSED_SCALE = 1.14;
const HOVER_MS = 120;
const PRESS_MS = 70;
const RELEASE_MS = 170;

/**
 * Makes a (already interactive) button react to the mouse, and runs `onActivate` when it is pressed.
 *
 * The size change is centred on the button's middle whatever its origin is (a text button with its
 * origin at the top-left would otherwise grow towards the bottom-right corner).
 *
 * While the mouse is over the button its data key 'hovered' is true, so other code that animates the
 * same button (the hint pulse) can leave it alone.
 *
 * @param {import('phaser').Scene} scene - the scene that owns the button.
 * @param {import('phaser').GameObjects.GameObject} target - the button; must already be interactive.
 * @param {() => void} onActivate - what the button does.
 * @param {Object} [options]
 * @param {number} [options.delay] - milliseconds to wait before running onActivate, so the
 *   squash is visible. Use ~120 for buttons that change scene (the old scene is gone the instant
 *   they act, so there would be nothing to see); 0 for buttons that act in place. A button with a
 *   delay can only be activated once (a second quick click is ignored).
 * @param {number} [options.hoverScale] - how much bigger the button gets while the mouse is over it
 *   (1 = no growth). Defaults to HOVER_SCALE; the wallpaper swatches ask for a bigger pop.
 */
export function makePressable(scene, target, onActivate, options = {}) {
    const delay = options.delay ?? 0;
    const hoverScale = options.hoverScale ?? HOVER_SCALE;
    let activated = false;
    let hovering = false;
    let pressing = false;
    let rest = null; // the button's size and position at k = 1, read whenever it is at rest
    let k = 1; // current size multiplier
    let animation = null;

    const stopAnimation = () => {
        if (animation) {
            animation.stop();
            animation = null;
        }
    };

    /**
     * Records the button's normal size and position. Only done while it is at rest (k = 1), because
     * the scene may have moved or resized the button since the last time, and mid-animation the
     * numbers would already include the multiplier.
     */
    const captureRest = () => {
        if (!rest || k === 1) {
            rest = {
                scaleX: target.scaleX,
                scaleY: target.scaleY,
                x: target.x,
                y: target.y,
                displayWidth: target.displayWidth,
                displayHeight: target.displayHeight,
            };
        }
    };

    /** Animates the size multiplier from where it is now to `to`. */
    const animateTo = (to, duration, ease) => {
        captureRest();
        stopAnimation();
        animation = scene.tweens.addCounter({
            from: k,
            to,
            duration,
            ease,
            onUpdate: (tween) => {
                // The button may have been destroyed (scene changed) mid-animation.
                if (!target.active) {
                    stopAnimation();
                    return;
                }
                k = tween.getValue();
                target.setScale(rest.scaleX * k, rest.scaleY * k);
                // Keep the button's centre fixed: when the origin is not the middle, the
                // position must move as the size changes.
                target.setPosition(
                    rest.x + (0.5 - target.originX) * rest.displayWidth * (1 - k),
                    rest.y + (0.5 - target.originY) * rest.displayHeight * (1 - k)
                );
            },
        });
    };

    /**
     * Eases the button to the size it should rest at when nothing is pressing it: the hover size
     * while the mouse is on it, normal size otherwise.
     *
     * @param {string} ease - Phaser ease name; the release after a press uses a springy one.
     */
    const settle = (ease = 'Sine.easeOut') => {
        if (hovering) {
            animateTo(hoverScale, HOVER_MS, ease);
        } else if (k !== 1) {
            animateTo(1, RELEASE_MS, ease);
        }
    };

    target.on('pointerover', (pointer) => {
        // A finger has no "hover": Phaser still fires pointerover as the touch lands, which would leave
        // the button stuck at the hover size after the press, so touch is ignored here.
        if (pointer?.wasTouch) {
            return;
        }
        hovering = true;
        target.setData('hovered', true);
        if (!pressing) {
            settle();
        }
    });

    target.on('pointerout', () => {
        hovering = false;
        pressing = false;
        target.setData('hovered', false);
        settle('Back.easeOut');
    });

    target.on('pointerdown', (pointer) => {
        if (activated) {
            return;
        }
        pressing = true;
        // Finger: grow (it stays visible beside the fingertip). Mouse: squash.
        animateTo(pointer?.wasTouch ? TOUCH_PRESSED_SCALE : PRESSED_SCALE, PRESS_MS, 'Quad.easeOut');
        playSfx(scene, 'pop');

        if (delay > 0) {
            activated = true;
            scene.time.delayedCall(delay, onActivate);
        } else {
            onActivate();
        }
    });

    target.on('pointerup', () => {
        pressing = false;
        settle('Back.easeOut');
    });
}
