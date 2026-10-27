import { Scene } from 'phaser';
import { economy } from '../economy.js';
import { promotionRaisePercent } from '../../core/economy.js';
import { addCoverArt, addProceedButton } from '../objects/fullScreenArt.js';
import { startDay } from '../dayFlow.js';
import { UI_SCALE } from '../uiScale.js';
import { playJingle } from '../audio.js';

/**
 * PromotionScene.js
 *
 * The promotion screen ("You Got Promoted!", assets/promotion.png), shown before the gameplay of
 * a day on which the player's pay rank goes up (days 20 and 40 in the shipped config - the rule is
 * core/economy.promotionRank). The picture says "Wages increased by ___ of starting pay" with a
 * blank in the middle; this scene writes the raise in that blank: 20% for the first promotion, 40%
 * for the second (worked out by core/economy.promotionRaisePercent from the rank pay in
 * economy.json). The fanfare plays (the background music pauses and stays paused until the player goes on
 * to gameplay), and the arrow button in the
 * lower-right corner carries on - to the bonus screen if one is due that day, else to gameplay.
 *
 * The picture is scaled to cover the whole canvas, and the text sits at a spot given as a fraction of
 * the picture, so it stays in its blank if the art is replaced by a different size.
 */

/** Where the percentage goes, as fractions of the picture: the blank between the two lines of text. */
const AMOUNT_SPOT = { x: 0.5, y: 0.83 };
/** How tall the percentage is, in the picture's own pixels (the blank is about 110 tall). */
const AMOUNT_ART_SIZE = 125;

export class PromotionScene extends Scene
{
    constructor ()
    {
        super('PromotionScene');
    }

    /**
     * @param {Object} data
     * @param {number} data.levelIndex - 0-based index of the day about to start.
     */
    init (data)
    {
        this.levelIndex = data.levelIndex;
    }

    create ()
    {
        const S = UI_SCALE;
        this.cameras.main.setBackgroundColor(0x000000);
        const art = addCoverArt(this, 'promotion');

        // "20%" in the art's own blue with a cream outline, like its headline, written in the blank.
        const percent = promotionRaisePercent(this.levelIndex + 1, economy);
        const spot = art.at(AMOUNT_SPOT.x, AMOUNT_SPOT.y);
        const amount = this.add
            .text(spot.x, spot.y, `${percent}%`, {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: art.px(AMOUNT_ART_SIZE),
                color: '#4a72b0',
                stroke: '#fff6e0',
                strokeThickness: Math.max(2 * S, art.px(14)),
            })
            .setOrigin(0.5)
            .setScale(0);
        this.tweens.add({ targets: amount, scale: 1, duration: 520, delay: 250, ease: 'Back.easeOut' });

        playJingle(this, 'fanfare', { holdMusic: true }); // the music pauses and stays quiet until the player moves on to gameplay
        addProceedButton(this, () => startDay(this, this.levelIndex, 'promotion'));
    }
}
