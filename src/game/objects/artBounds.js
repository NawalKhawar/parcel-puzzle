/**
 * artBounds.js
 *
 * Furniture art is supplied on a canvas sized for the item's slot (see items.json), and the picture
 * itself is usually centred in it with transparent space around it - a potted plant is a small
 * picture in the middle of a tall canvas. That is fine for drawing the item where it belongs, but
 * two places want the VISIBLE part of the picture instead:
 *   - the apartment, which stands each item on the floor tile it occupies, so the visible bottom
 *     (not the canvas bottom) must sit on the footprint's front edge or the item would hover;
 *   - icons (the shop cards and the inventory), which should fill their square, not shrink to a
 *     speck because of the empty canvas around the picture.
 * getArtBounds() finds that visible rectangle; addFittedIcon() uses it to draw an icon.
 */

/** Pixels at or below this opacity (0-255) count as empty when looking for the picture's edges. */
const EMPTY_ALPHA = 16;

/** @type {Map<string, {x: number, y: number, width: number, height: number}>} */
const cache = new Map();

/**
 * The smallest rectangle, in the texture's own pixels, that contains everything visible in it.
 * Worked out once per texture by reading its pixels, then remembered. A texture with nothing
 * visible in it counts as its whole size.
 *
 * @param {import('phaser').Scene} scene
 * @param {string} key - the texture key of a loaded image (not a generated placeholder).
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function getArtBounds(scene, key) {
    const known = cache.get(key);
    if (known) {
        return known;
    }

    const source = scene.textures.get(key).getSourceImage();
    const { width, height } = source;
    const scratch = document.createElement('canvas');
    scratch.width = width;
    scratch.height = height;
    const context = scratch.getContext('2d', { willReadFrequently: true });
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, width, height).data;

    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Every pixel is 4 numbers (red, green, blue, alpha); alpha is the 4th.
            if (pixels[(y * width + x) * 4 + 3] > EMPTY_ALPHA) {
                if (x < left) left = x;
                if (x > right) right = x;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
            }
        }
    }

    const bounds = right < 0
        ? { x: 0, y: 0, width, height }
        : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
    cache.set(key, bounds);
    return bounds;
}

/**
 * Adds an icon: the visible part of an image, scaled (keeping its proportions) to fit inside a box
 * and centred in it.
 *
 * @param {import('phaser').Scene} scene
 * @param {string} key - the texture key.
 * @param {number} centerX - the centre of the box.
 * @param {number} centerY
 * @param {number} boxWidth
 * @param {number} boxHeight
 * @param {boolean} [trim] - true (the default) fits the visible part of the picture; pass false for
 *   a texture whose whole canvas is the picture (generated placeholders), which needs no search.
 * @returns {import('phaser').GameObjects.Image}
 */
export function addFittedIcon(scene, key, centerX, centerY, boxWidth, boxHeight, trim = true) {
    const image = scene.add.image(0, 0, key).setOrigin(0, 0);
    const bounds = trim ? getArtBounds(scene, key) : { x: 0, y: 0, width: image.width, height: image.height };
    const scale = Math.min(boxWidth / bounds.width, boxHeight / bounds.height);
    // Show only the visible rectangle, then slide the image so that rectangle's centre is at the centre.
    image.setCrop(bounds.x, bounds.y, bounds.width, bounds.height);
    image.setScale(scale);
    image.setPosition(centerX - (bounds.x + bounds.width / 2) * scale, centerY - (bounds.y + bounds.height / 2) * scale);
    return image;
}
