import { UI_SCALE } from '../uiScale.js';

/**
 * pillButton.js
 *
 * A rounded, orange "pill" button drawn in code (the same look as the Next button on the boss's
 * speech panel and the shop's tabs): used by the offer popups and the promotion screen, where the
 * buttons have words that change (a price, "Free") and so cannot be painted pictures.
 *
 * The caller makes it pressable (makePressable), as with any other button.
 */

/** Colours: the normal orange pill, a quieter cream one for "no thanks", and a greyed-out one. */
export const PILL_STYLES = {
    primary: { fill: 0xf0b86e, stroke: 0x8a6a4d },
    secondary: { fill: 0xe6dcc3, stroke: 0x8a6a4d },
    disabled: { fill: 0xd9d2c3, stroke: 0xaaa293 },
};

/**
 * Adds a pill button: a rounded rectangle with a centred label, as one interactive container.
 *
 * @param {import('phaser').Scene} scene
 * @param {number} x - centre x (screen pixels).
 * @param {number} y - centre y.
 * @param {Object} options
 * @param {number} options.width - design pixels (UI_SCALE is applied here).
 * @param {number} options.height - design pixels.
 * @param {string} [options.label] - the label; leave out to add your own children.
 * @param {number} [options.fontSize] - label size in design pixels.
 * @param {keyof PILL_STYLES} [options.style]
 * @param {number} [options.labelY] - label's offset from the middle, design pixels (to make room for a second line).
 * @returns {import('phaser').GameObjects.Container} an interactive container; `.size` holds { width, height } in screen pixels.
 */
export function addPillButton(scene, x, y, { width, height, label, fontSize = 24, style = 'primary', labelY = 0 })
{
    const S = UI_SCALE;
    const w = width * S;
    const h = height * S;
    const { fill, stroke } = PILL_STYLES[style];

    const background = scene.add.graphics();
    background.fillStyle(fill, 1);
    background.fillRoundedRect(-w / 2, -h / 2, w, h, 16 * S);
    background.lineStyle(2 * S, stroke, 1);
    background.strokeRoundedRect(-w / 2, -h / 2, w, h, 16 * S);

    const parts = [background];
    if (label)
    {
        parts.push(
            scene.add
                .text(0, labelY * S, label, { fontFamily: 'Fredoka, Arial Black', fontStyle: '700', fontSize: fontSize * S, color: '#3a362f' })
                .setOrigin(0.5)
        );
    }
    const button = scene.add.container(x, y, parts);
    button.setSize(w, h).setInteractive({ useHandCursor: true });
    button.size = { width: w, height: h };
    return button;
}
