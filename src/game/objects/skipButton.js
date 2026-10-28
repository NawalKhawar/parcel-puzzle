import { addImageButton } from './imageButton.js';
import { makePressable } from './pressFeedback.js';
import { UI_SCALE } from '../uiScale.js';

/**
 * skipButton.js
 *
 * The "skip tutorial >" button (assets/ui/skip-tut-button.webp, from assets-original/ui/skip-tut-button.png) that lets a RETURNING player - one who chose New
 * Game over an existing save - skip the whole first-day tutorial: every prompt, highlight, hand
 * cursor, pulse and lock. Each guided screen adds one while the tutorial is still ahead of the
 * player; what pressing it does (marking the tutorial skipped in the save, tidying that screen) is up
 * to the screen, via `onSkip`. See game/progress.js skipTutorial and isTutorialSkippable.
 */

/**
 * How tall the button is, in design pixels. The picture is a long pill (about 3.7 times as wide as it is tall, because
 * it spells out "skip tutorial"), so this is shorter than the old square-ish Skip button was: 64 is about 240 wide.
 */
const DEFAULT_HEIGHT = 64;

/** Keep this far (design px) between the button and the screen's edges: the picture is wide, so callers' centres are nudged inward. */
const EDGE_GAP = 12;

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
    if (!scene.textures.exists('skip-tut-button'))
    {
        return null;
    }
    const button = addImageButton(scene, x, y, 'skip-tut-button', height).setDepth(depth);
    // Never run off the side of the screen, whatever centre the caller asked for.
    const half = button.displayWidth / 2;
    const gap = EDGE_GAP * UI_SCALE;
    button.x = Math.max(half + gap, Math.min(scene.scale.width - half - gap, button.x));
    makePressable(scene, button, onSkip, { delay: 120 });
    return button;
}
