import { UI_SCALE } from '../uiScale.js';

/**
 * uiPanel.js
 *
 * A small helper around assets/ui/ui-panel.png, a wood-framed nine-slice panel (the corners and
 * edges stay crisp at any size; only the flat middle strips stretch). Used anywhere a simple
 * rounded panel is needed - currently the pause menu and the "New piece!" popup.
 */

/**
 * The thickness of the texture's non-stretching border, in the source image's own pixels
 * (ui-panel.png is 512x512 with a frame about 48px thick). Nine-slice border sizes are read in
 * the same units as the width/height you ask for, so this is multiplied by UI_SCALE below to
 * match how everything else in the game scales.
 */
const SOURCE_BORDER = 48;

/**
 * Adds a ui-panel nine-slice at the given centre and size.
 *
 * @param {import('phaser').Scene} scene
 * @param {number} x - centre x, design pixels (already includes UI_SCALE if the caller works in it).
 * @param {number} y - centre y.
 * @param {number} width - rendered width.
 * @param {number} height - rendered height.
 * @returns {import('phaser').GameObjects.NineSlice}
 */
export function addUiPanel(scene, x, y, width, height)
{
    const border = SOURCE_BORDER * UI_SCALE;
    return scene.add.nineslice(x, y, 'ui-panel', undefined, width, height, border, border, border, border);
}
