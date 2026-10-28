import { getArtBounds } from './artBounds.js';
import { isPortrait } from '../layout.js';
import { UI_SCALE } from '../uiScale.js';

/**
 * badge.js
 *
 * The small RED DOT that sits on the edge of a button to say "there is something here for you" - on the
 * Shop button (and the shop's Furniture / Wallpapers tabs) when the player can afford something, and on the
 * Decorate button when there is a new item in the apartment's inventory. WHEN a dot shows is decided by the
 * pure rules in core/badges.js; this file only draws it.
 *
 * A badge is a red circle with a cream ring and a soft pulse (so it catches the eye without being loud),
 * pinned to the button's top-right corner. It is a separate object, placed once after the button has been
 * positioned, and it is not part of the button's press / hover size animation.
 */

/** Radius of the dot in design px: a little bigger on a phone, where everything is viewed smaller. */
const RADIUS_LANDSCAPE = 11;
const RADIUS_PORTRAIT = 16;
/** How far the dot's centre sits inside the corner, as a fraction of its radius (so it sits ON the edge, not off it). */
const INSET = 0.35;

/**
 * Draws a red dot centred at a point.
 *
 * @param {import('phaser').Scene} scene
 * @param {number} x - centre x (screen px).
 * @param {number} y - centre y (screen px).
 * @param {number} depth - draw depth; keep it above the button the dot belongs to.
 * @returns {import('phaser').GameObjects.Container} the dot; call setVisible(false) to hide it.
 */
export function addDot(scene, x, y, depth)
{
    const radius = (isPortrait(scene) ? RADIUS_PORTRAIT : RADIUS_LANDSCAPE) * UI_SCALE;
    const g = scene.add.graphics();
    g.fillStyle(0xe53935, 1);
    g.fillCircle(0, 0, radius);
    // The cream ring separates the dot from whatever is behind it.
    g.lineStyle(Math.max(2, radius * 0.22), 0xfff6e0, 1);
    g.strokeCircle(0, 0, radius);
    // A little highlight, like the rest of the game's glossy buttons.
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(-radius * 0.3, -radius * 0.3, radius * 0.28);
    const dot = scene.add.container(x, y, [g]).setDepth(depth);
    scene.tweens.add({ targets: dot, scale: 1.12, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return dot;
}

/**
 * Pins a red dot to the top-right corner of a button picture's PAINTED part (the pictures have empty
 * margins, so the canvas corner would float away from the visible button). Works for any origin.
 *
 * @param {import('phaser').Scene} scene
 * @param {import('phaser').GameObjects.Image} image - a button made by addImageButton, already positioned.
 * @param {boolean} shown - whether the dot is visible.
 * @returns {import('phaser').GameObjects.Container} the dot.
 */
export function addBadgeToImage(scene, image, shown)
{
    const bounds = getArtBounds(scene, image.texture.key);
    const radius = (isPortrait(scene) ? RADIUS_PORTRAIT : RADIUS_LANDSCAPE) * UI_SCALE;
    // The painted part's top-right corner on screen (texture px -> screen px through the image's scale and origin).
    const right = image.x + (bounds.x + bounds.width - image.width * image.originX) * image.scaleX;
    const top = image.y + (bounds.y - image.height * image.originY) * image.scaleY;
    const dot = addDot(scene, right - radius * INSET, top + radius * INSET, (image.depth ?? 0) + 1);
    dot.setVisible(shown);
    return dot;
}

/**
 * Pins a red dot to the top-right corner of a rectangle (a tab or any box button).
 *
 * @param {import('phaser').Scene} scene
 * @param {number} centerX - the box's centre.
 * @param {number} centerY
 * @param {number} width
 * @param {number} height
 * @param {boolean} shown
 * @param {number} [depth]
 * @returns {import('phaser').GameObjects.Container} the dot.
 */
export function addBadgeToBox(scene, centerX, centerY, width, height, shown, depth = 50)
{
    const radius = (isPortrait(scene) ? RADIUS_PORTRAIT : RADIUS_LANDSCAPE) * UI_SCALE;
    const dot = addDot(scene, centerX + width / 2 - radius * INSET, centerY - height / 2 + radius * INSET, depth);
    dot.setVisible(shown);
    return dot;
}
