import { addImageButton } from './imageButton.js';
import { makePressable } from './pressFeedback.js';

/**
 * skipButton.js
 *
 * The "Skip >>" button (assets/ui/button-skip.webp) that lets a RETURNING player - one who chose New
 * Game over an existing save - skip the whole first-day tutorial: every prompt, highlight, hand
 * cursor, pulse and lock. Each guided screen adds one while the tutorial is still ahead of the
 * player; what pressing it does (marking the tutorial skipped in the save, tidying that screen) is up
 * to the screen, via `onSkip`. See game/progress.js skipTutorial and isTutorialSkippable.
 */

/** How tall the button is, in design pixels - the same ballpark as the other small picture buttons. */
const DEFAULT_HEIGHT = 72;

/**
 * Adds a Skip button.
 *
 * @param {import('phaser').Scene} scene
 * @param {Object} options
 * @param {number} options.x - centre x, screen pixels.
 * @param {number} options.y - centre y, screen pixels.
 * @param {() => void} options.onSkip - called when it is pressed.
 * @param {number} [options.depth] - draw depth (above whatever dims or covers the screen).
 * @param {number} [options.height] - design pixels.
 * @returns {import('phaser').GameObjects.Image | null} the button, or null if its picture is missing.
 */
export function addSkipButton(scene, { x, y, onSkip, depth = 0, height = DEFAULT_HEIGHT })
{
    if (!scene.textures.exists('button-skip'))
    {
        return null;
    }
    const button = addImageButton(scene, x, y, 'button-skip', height).setDepth(depth);
    makePressable(scene, button, onSkip, { delay: 120 });
    return button;
}
