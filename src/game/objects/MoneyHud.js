import { UI_SCALE } from '../uiScale.js';

/**
 * MoneyHud.js
 *
 * The money counter shown on the gameplay screen and the shop: the money-HUD art (a cash icon on its
 * left third, blank panel to its right) with the player's total drawn on the blank part,
 * right-aligned and with no currency sign - the icon says "this is money".
 *
 * It is drawn at a base height matching the square HUD buttons beside it in gameplay, times an
 * optional `scale`, so the shop can show the same HUD a little larger.
 */

/** assets/ui/money-HUD.png is 270x96 art pixels; the panel keeps that shape at any size. */
const ART_ASPECT = 270 / 96;

/** The panel's height at scale 1, in design pixels: the same as the gameplay HUD's icon buttons. */
const BASE_HEIGHT = 48;
/** The number's size, and how far from the panel's right edge it ends, at scale 1 (design pixels). */
const BASE_FONT_SIZE = 18;
const BASE_RIGHT_PADDING = 16;

export class MoneyHud {
    /**
     * @param {import('phaser').Scene} scene
     * @param {number} amount - the total to show.
     * @param {number} [scale] - 1 matches the gameplay HUD; bigger makes the whole panel larger.
     */
    constructor(scene, amount, scale = 1) {
        /** Panel size in screen pixels (UI_SCALE included). */
        this.height = BASE_HEIGHT * scale * UI_SCALE;
        this.width = this.height * ART_ASPECT;
        this.rightPadding = BASE_RIGHT_PADDING * scale * UI_SCALE;

        this.panel = scene.add.image(0, 0, 'money-HUD').setOrigin(0, 0).setDisplaySize(this.width, this.height);
        this.text = scene.add
            .text(0, 0, String(amount), {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: BASE_FONT_SIZE * scale * UI_SCALE,
                color: '#3a362f',
            })
            .setOrigin(1, 0.5);
    }

    /**
     * Moves the whole HUD so its panel's top-left corner is at (x, y).
     *
     * @param {number} x
     * @param {number} y
     */
    setPosition(x, y) {
        this.panel.setPosition(x, y);
        this.text.setPosition(x + this.width - this.rightPadding, y + this.height / 2);
    }

    /** @param {number} amount - the new total to show. */
    setAmount(amount) {
        this.text.setText(String(amount));
    }
}
