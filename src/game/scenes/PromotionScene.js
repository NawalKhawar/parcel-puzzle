import { Scene } from 'phaser';
import { economy } from '../economy.js';
import { promotionBreakdown } from '../../core/economy.js';
import { addCoverArt, addProceedButton } from '../objects/fullScreenArt.js';
import { isPortrait } from '../layout.js';
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
 * for the second (worked out by core/economy.promotionBreakdown from the rank pay in
 * economy.json - always measured against the STARTING pay), with a smaller line under it saying what the
 * raise means per unit of work ("$5 -> $6 per unit"). The fanfare plays (the background music pauses and stays paused until the player goes on
 * to gameplay), and the arrow button in the
 * lower-right corner carries on - to the bonus screen if one is due that day, else to gameplay.
 *
 * The picture is scaled to cover the whole canvas, and the text sits at a spot given as a fraction of
 * the picture, so it stays in its blank if the art is replaced by a different size.
 *
 * On a phone (portrait canvas) the picture is the hand-made tall painting assets/mobile/promotion-portrait.webp
 * (941x1672), cover-scaled the same way; its blank is at a different spot and a different size
 * (PORTRAIT_AMOUNT_SPOT / PORTRAIT_AMOUNT_ART_SIZE, measured on that painting).
 */

/** Where the percentage goes, as fractions of the picture: the blank between the two lines of text. */
const AMOUNT_SPOT = { x: 0.5, y: 0.83 };
/** How tall the percentage is, in the picture's own pixels (the blank is about 110 tall). */
const AMOUNT_ART_SIZE = 125;

/** The same two measurements for the portrait painting: the blank between 'Wages increased by' and 'of starting pay'. */
const PORTRAIT_AMOUNT_SPOT = { x: 0.5, y: 0.789 };
const PORTRAIT_AMOUNT_ART_SIZE = 150;

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
        // Kept so the fanfare is not played again when this screen is rebuilt after the window flips between
        // wide and tall (layout.js restarts the scene with this same object).
        this.startData = data;
    }

    create ()
    {
        const S = UI_SCALE;
        this.cameras.main.setBackgroundColor(0x000000);
        const portrait = isPortrait(this);
        const art = addCoverArt(this, portrait ? 'promotion-portrait' : 'promotion');

        // "20%" in the art's own blue with a cream outline, like its headline, written in the blank.
        // The blank holds two lines: the percentage (a bit smaller than the blank so there is room) and,
        // under it, the old -> new pay per unit.
        const raise = promotionBreakdown(this.levelIndex + 1, economy);
        const where = portrait ? PORTRAIT_AMOUNT_SPOT : AMOUNT_SPOT;
        const spot = art.at(where.x, where.y);
        const amountSize = (portrait ? PORTRAIT_AMOUNT_ART_SIZE : AMOUNT_ART_SIZE) * 0.68;
        const amount = this.add
            .text(spot.x, spot.y - art.px(portrait ? 34 : 32), `${raise.percent}%`, {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: art.px(amountSize),
                color: '#4a72b0',
                stroke: '#fff6e0',
                strokeThickness: Math.max(2 * S, art.px(portrait ? 16 : 14)),
            })
            .setOrigin(0.5)
            .setScale(0);
        this.tweens.add({ targets: amount, scale: 1, duration: 520, delay: 250, ease: 'Back.easeOut' });

        const breakdown = this.add
            .text(spot.x, spot.y + art.px(portrait ? 40 : 32), raise.breakdown, {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: art.px(portrait ? 40 : 34),
                color: '#4a72b0',
                stroke: '#fff6e0',
                strokeThickness: Math.max(2 * S, art.px(portrait ? 8 : 7)),
            })
            .setOrigin(0.5)
            .setAlpha(0);
        this.tweens.add({ targets: breakdown, alpha: 1, duration: 400, delay: 700 });

        if (!this.startData.jinglePlayed)
        {
            this.startData.jinglePlayed = true;
            playJingle(this, 'fanfare', { holdMusic: true }); // the music pauses and stays quiet until the player moves on to gameplay
        }
        addProceedButton(this, () => startDay(this, this.levelIndex, 'promotion'));
    }
}
