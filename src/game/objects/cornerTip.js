import { UI_SCALE } from '../uiScale.js';
import { BossPanel } from './BossPanel.js';

/**
 * cornerTip.js
 *
 * A short tip from a character that pops into a corner of the screen, stays long enough to read,
 * and pops out again. It does not block anything underneath. Used on the end-of-day screen and in the
 * apartment, where the worker (not the boss) is the one talking, so the panel shows his head, with
 * the head beside the message to keep the panel small.
 */

/**
 * @param {import('phaser').Scene} scene
 * @param {Object} options
 * @param {string} options.message
 * @param {string} options.head - texture key of the talking character's head, e.g. 'worker-head'.
 * @param {number} options.left - screen x of the panel's left edge (as it appears, after scaling).
 * @param {number} options.bottom - screen y of the panel's bottom edge (as it appears).
 * @param {number} [options.width] - panel width in design px (default 460).
 * @param {number} [options.scale] - how big the panel appears, 1 = full size (default 1).
 * @returns {BossPanel} the panel (already popping in).
 */
export function showCornerTip(scene, { message, head, left, bottom, width = 460, scale = 1 })
{
    const panel = new BossPanel(scene, { left, centerY: 0, width: width * UI_SCALE, layout: 'horizontal', head });
    panel.show(message);
    // Sized to the message, so the bottom edge can now be set exactly.
    // The panel scales about its centre, so place the centre so the SCALED box has the asked-for edges.
    panel.targetScale = scale;
    panel.container.setPosition(left + (panel.width * scale) / 2, bottom - (panel.height * scale) / 2);
    panel.popIn();
    // About 2 seconds plus 45 ms a character, at most 8 seconds.
    const readMs = Math.min(8000, 2000 + 45 * message.length);
    scene.time.delayedCall(readMs, () => panel.popOut());
    return panel;
}
