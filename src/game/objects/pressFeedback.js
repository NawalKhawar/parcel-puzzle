/**
 * pressFeedback.js
 *
 * Click feedback for buttons: when a button is pressed it squashes down a little, and when it is
 * let go (or the pointer slides off it) it springs back with a small overshoot. It is a Phaser
 * tween on the button's scale, so it works on any button - an image, a text button - without a
 * separate "pressed" version of the artwork.
 */

/** How small a button gets while pressed (1 = normal size). */
const PRESSED_SCALE = 0.9;
const PRESS_MS = 70;
const RELEASE_MS = 170;

/**
 * Makes a (already interactive) button react to being pressed, and runs `onActivate` when it is.
 *
 * The squash is centred on the button's middle whatever its origin is (a text button with its
 * origin at the top-left would otherwise shrink towards that corner).
 *
 * @param {import('phaser').Scene} scene - the scene that owns the button.
 * @param {import('phaser').GameObjects.GameObject} target - the button; must already be interactive.
 * @param {() => void} onActivate - what the button does.
 * @param {Object} [options]
 * @param {number} [options.delay] - milliseconds to wait before running onActivate, so the
 *   squash is visible. Use ~120 for buttons that change scene (the old scene is gone the instant
 *   they act, so there would be nothing to see); 0 for buttons that act in place. A button with a
 *   delay can only be activated once (a second quick click is ignored).
 */
export function makePressable(scene, target, onActivate, options = {}) {
    const delay = options.delay ?? 0;
    let activated = false;
    let restState = null; // the button's size and position when it was last at rest
    let animation = null;

    const stopAnimation = () => {
        if (animation) {
            animation.stop();
            animation = null;
        }
    };

    /** Animates the button between "rest" (k = 1) and "pressed" (k = PRESSED_SCALE). */
    const animateTo = (to, duration, ease) => {
        stopAnimation();
        const from = restState.currentK;
        animation = scene.tweens.addCounter({
            from,
            to,
            duration,
            ease,
            onUpdate: (tween) => {
                const k = tween.getValue();
                restState.currentK = k;
                target.setScale(restState.scaleX * k, restState.scaleY * k);
                // Keep the button's centre fixed: when the origin is not the middle, the
                // position must move as the size changes.
                target.setPosition(
                    restState.x + (0.5 - target.originX) * restState.displayWidth * (1 - k),
                    restState.y + (0.5 - target.originY) * restState.displayHeight * (1 - k)
                );
            },
        });
    };

    target.on('pointerdown', () => {
        if (activated) {
            return;
        }
        if (!restState || restState.currentK === 1) {
            // Record the resting size/position (read now rather than once at setup, because
            // the scene may have moved or resized the button since).
            restState = {
                scaleX: target.scaleX,
                scaleY: target.scaleY,
                x: target.x,
                y: target.y,
                displayWidth: target.displayWidth,
                displayHeight: target.displayHeight,
                currentK: 1,
            };
        }
        animateTo(PRESSED_SCALE, PRESS_MS, 'Quad.easeOut');

        if (delay > 0) {
            activated = true;
            scene.time.delayedCall(delay, onActivate);
        } else {
            onActivate();
        }
    });

    const release = () => {
        if (restState && restState.currentK !== 1) {
            animateTo(1, RELEASE_MS, 'Back.easeOut');
        }
    };
    target.on('pointerup', release);
    target.on('pointerout', release);
}
