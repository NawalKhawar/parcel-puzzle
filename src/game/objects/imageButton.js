import { UI_SCALE } from '../uiScale.js';
import { getArtBounds } from './artBounds.js';

/**
 * imageButton.js
 *
 * Creates a button from one of the button pictures in assets/ui/ (labels such as "Shop" are painted
 * into the pictures). The pictures are authored at 3x the design size, so instead of a magic
 * multiplier each button is sized by the HEIGHT it should have in the 1280x720 design space; the
 * width follows the picture's own proportions. Swapping in new art of any resolution therefore
 * needs no code change.
 *
 * The caller makes it pressable (makePressable) as with any other button.
 */

/**
 * @param {import('phaser').Scene} scene
 * @param {number} x - centre x (screen pixels).
 * @param {number} y - centre y (screen pixels).
 * @param {string} key - the texture key, e.g. 'button-shop'.
 * @param {number} designHeight - how tall the button is in design pixels (multiplied by UI_SCALE here).
 * @param {boolean} [byVisible] - size and centre by the painted part of the picture instead of its
 *   whole canvas. The pictures have different amounts of empty margin, so buttons sized by canvas
 *   look unequal; sized this way, equal heights look equal. The image then carries `visibleWidth`
 *   (screen pixels) for laying buttons out side by side.
 * @returns {import('phaser').GameObjects.Image} an interactive image.
 */
export function addImageButton(scene, x, y, key, designHeight, byVisible = false)
{
    const image = scene.add.image(x, y, key).setOrigin(0.5);
    if (byVisible)
    {
        const bounds = getArtBounds(scene, key);
        const scale = (designHeight * UI_SCALE) / bounds.height;
        image.setScale(scale);
        // Origin on the painted part's centre, so (x, y) is where the visible button sits and
        // press/hover growth is about its middle.
        image.setOrigin((bounds.x + bounds.width / 2) / image.width, (bounds.y + bounds.height / 2) / image.height);
        image.visibleWidth = bounds.width * scale;
        image.setInteractive({ useHandCursor: true });
        return image;
    }
    // One uniform scale from the target height keeps the picture's proportions.
    image.setScale((designHeight * UI_SCALE) / image.height);
    image.setInteractive({ useHandCursor: true });
    return image;
}
