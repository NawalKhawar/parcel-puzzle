/**
 * money.js
 *
 * Showing an amount of money. Wherever the game shows a price or a payment it uses the currency
 * NOTE icon (assets/ui/money-note-icon.png) in front of the number instead of a "$" sign:
 * addMoneyText() builds that "[note] 40" (or "+[note] 40") as one object you can position, fade and
 * tween like a single piece of text.
 */

/** Key of the full-size note art (the file name, no folder - see Preloader). It is 1619x971. */
const NOTE_SOURCE_KEY = 'money-note-icon';

/**
 * Key of the small copy the game actually draws. The art is far bigger than any place the note is
 * shown (the biggest is about 80px wide), and the graphics card's plain scaling-down skips most of
 * a picture that much larger and looks jagged and glittery - so a small, properly smoothed copy
 * is made once at start-up (createMoneyNoteTexture) and used everywhere instead.
 */
export const MONEY_NOTE_KEY = 'money-note';

/** Width in pixels of the small copy: roughly twice the biggest size it is shown at on a sharp screen. */
const NOTE_COPY_WIDTH = 192;

/**
 * Makes the small, smoothed copy of the note icon (see MONEY_NOTE_KEY). The picture is halved
 * repeatedly until it is just over the target size and then drawn once more to the exact size -
 * each halving averages neighbouring pixels, which is what keeps the thin outline from breaking up.
 * Call once, after the art has loaded (Preloader.create). Does nothing if it already exists.
 *
 * @param {import('phaser').Scene} scene - any scene whose texture manager holds the loaded art.
 */
export function createMoneyNoteTexture(scene) {
    if (scene.textures.exists(MONEY_NOTE_KEY)) {
        return;
    }
    const source = scene.textures.get(NOTE_SOURCE_KEY).getSourceImage();
    const targetWidth = NOTE_COPY_WIDTH;
    const targetHeight = Math.round((targetWidth * source.height) / source.width);

    // Repeatedly draw the picture at half size onto a scratch canvas.
    let current = source;
    let width = source.width;
    let height = source.height;
    while (width / 2 >= targetWidth * 1.5) {
        width = Math.round(width / 2);
        height = Math.round(height / 2);
        const half = document.createElement('canvas');
        half.width = width;
        half.height = height;
        const halfContext = half.getContext('2d');
        halfContext.imageSmoothingQuality = 'high';
        halfContext.drawImage(current, 0, 0, width, height);
        current = half;
    }

    const texture = scene.textures.createCanvas(MONEY_NOTE_KEY, targetWidth, targetHeight);
    texture.context.imageSmoothingQuality = 'high';
    texture.context.drawImage(current, 0, 0, targetWidth, targetHeight);
    texture.refresh();
}

/**
 * Adds "[note icon] amount" to a scene: an optional prefix (such as "+"), the note, then the number,
 * all in one container so it moves, fades and tweens as a unit.
 *
 * @param {import('phaser').Scene} scene
 * @param {number} x - the anchor point; which part of the amount sits on it depends on `align`.
 * @param {number} y - the amount is centred vertically on this.
 * @param {number} amount - the number to show.
 * @param {Object} style
 * @param {number} style.fontSize - the number's size in pixels (the note is drawn to match it).
 * @param {string} [style.color] - the number's colour.
 * @param {string} [style.fontFamily]
 * @param {string} [style.fontStyle] - Fredoka weight, e.g. '400' or '700'.
 * @param {string} [style.stroke] - outline colour for the text (not the note, which has its own).
 * @param {number} [style.strokeThickness]
 * @param {string} [style.prefix] - text shown before the note, e.g. '+'.
 * @param {string} [style.suffix] - text shown straight after the number, e.g. ' · 3x2'.
 * @param {'left' | 'center' | 'right'} [style.align] - which edge or the middle of the amount is at x.
 * @returns {import('phaser').GameObjects.Container}
 */
export function addMoneyText(scene, x, y, amount, style) {
    const { fontSize, color = '#3a362f', fontFamily = 'Fredoka, Arial', fontStyle = '400', stroke, strokeThickness, prefix = '', suffix = '', align = 'left' } = style;
    const textStyle = { fontFamily, fontStyle, fontSize, color };
    if (stroke) {
        textStyle.stroke = stroke;
        textStyle.strokeThickness = strokeThickness;
    }

    // The note is a little smaller than the digits are tall, with a small gap either side of it.
    const noteTexture = scene.textures.get(MONEY_NOTE_KEY).getSourceImage();
    const noteHeight = fontSize * 0.8;
    const noteWidth = noteHeight * (noteTexture.width / noteTexture.height);
    const gap = fontSize * 0.2;

    // Lay the parts out left to right from 0, then shift the whole container for the alignment.
    const parts = [];
    let cursor = 0;
    if (prefix) {
        const prefixText = scene.add.text(cursor, 0, prefix, textStyle).setOrigin(0, 0.5);
        parts.push(prefixText);
        cursor += prefixText.width + gap / 2;
    }
    parts.push(scene.add.image(cursor, 0, MONEY_NOTE_KEY).setOrigin(0, 0.5).setDisplaySize(noteWidth, noteHeight));
    cursor += noteWidth + gap;
    // The number and any suffix are one text, so they sit together with normal letter spacing.
    const numberText = scene.add.text(cursor, 0, String(amount) + suffix, textStyle).setOrigin(0, 0.5);
    parts.push(numberText);
    const totalWidth = cursor + numberText.width;

    const shift = { left: 0, center: 0.5, right: 1 }[align] * totalWidth;
    return scene.add.container(x - shift, y, parts);
}
