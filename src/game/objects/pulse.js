/**
 * pulse.js
 *
 * A steady "click me" pulse for a button: it gently grows and shrinks, over and over, until it is
 * stopped. Used to lead the player to the next button to press (Shop, then Decorate Room).
 *
 * The pulse and the hover/press feedback (pressFeedback.js) both change the button's scale, so they
 * take turns: while the mouse is over the button the pulse pauses and the button is put back to its
 * normal size (so the hover growth starts from the right size); once the mouse leaves, the pulse
 * resumes after a moment.
 *
 * IMPORTANT: call addPulse BEFORE makePressable on the same button. Event handlers run in the order
 * they were added, and the pulse has to put the scale back before makePressable reads it.
 */

/** How much bigger the button gets at the peak of a pulse, and how long one grow (or shrink) takes. */
const GROW = 1.12;
const BEAT_MS = 550;
/** How long after the mouse leaves before the pulse starts again. */
const RESUME_DELAY_MS = 1200;

/**
 * @param {import('phaser').Scene} scene
 * @param {import('phaser').GameObjects.GameObject} target - an interactive button, resting at its normal scale.
 *   It grows about its origin, so give it an origin at its middle for a centred pulse.
 * @returns {{stop: () => void}} stop ends the pulse for good (call it when the button is pressed).
 */
export function addPulse(scene, target)
{
    const baseX = target.scaleX;
    const baseY = target.scaleY;
    let tween = null;
    let resume = null;
    let stopped = false;

    const start = () => {
        if (stopped || tween || !target.active)
        {
            return;
        }
        tween = scene.tweens.add({
            targets: target,
            scaleX: baseX * GROW,
            scaleY: baseY * GROW,
            duration: BEAT_MS,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });
    };

    /** Stops the pulse and snaps the button back to its normal size. */
    const pause = () => {
        if (resume)
        {
            resume.remove(false);
            resume = null;
        }
        if (tween)
        {
            tween.stop();
            tween = null;
            if (target.active)
            {
                target.setScale(baseX, baseY);
            }
        }
    };

    target.on('pointerover', pause);
    target.on('pointerout', () => {
        if (!stopped)
        {
            resume = scene.time.delayedCall(RESUME_DELAY_MS, start);
        }
    });

    start();
    return {
        stop: () => {
            stopped = true;
            pause();
        },
    };
}
