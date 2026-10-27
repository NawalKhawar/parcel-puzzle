import { Scene } from 'phaser';
import { economy, getEconomyState, setEconomyState } from '../economy.js';
import { claimBonuses } from '../../core/economy.js';
import { addCoverArt, addProceedButton } from '../objects/fullScreenArt.js';
import { addMoneyText } from '../objects/money.js';
import { startDay } from '../dayFlow.js';
import { playJingle } from '../audio.js';

/**
 * BonusScene.js
 *
 * The bonus screen ("Employee of the Month!", assets/bonus.png), shown before the gameplay of a day on
 * which a one-time cash prize is due (the bonuses flagged `screen: true` in economy.json - the first
 * week and first month). The picture says "Awarded a one-time bonus of" with a blank under it; this
 * scene writes the amount there, with the currency note icon. The prize is paid into the wallet as the
 * screen opens (and recorded as claimed, so it can never be paid again - re-opening the screen finds
 * nothing due and moves straight on). The fanfare plays (the background music pauses and stays paused until the
 * player goes on to gameplay), and the
 * arrow button in the lower-right corner carries on to the day's gameplay.
 *
 * The picture is scaled to cover the whole canvas, and the amount sits at a spot given as a fraction of
 * the picture, so it stays in its blank if the art is replaced by a different size.
 */

/** Where the amount goes, as fractions of the picture: the blank under "Awarded a one-time bonus of". */
const AMOUNT_SPOT = { x: 0.5, y: 0.815 };
/** How tall the amount is, in the picture's own pixels. */
const AMOUNT_ART_SIZE = 115;

export class BonusScene extends Scene
{
    constructor ()
    {
        super('BonusScene');
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
        // Pay out whatever is due before this day's gameplay (nothing, if it has been paid already).
        const claim = claimBonuses(getEconomyState(this.registry), this.levelIndex + 1, economy, 'start');
        if (claim.granted.length === 0)
        {
            startDay(this, this.levelIndex, 'bonus');
            return;
        }
        setEconomyState(this.registry, claim.state);
        const total = claim.granted.reduce((sum, bonus) => sum + bonus.amount, 0);

        this.cameras.main.setBackgroundColor(0x000000);
        const art = addCoverArt(this, 'bonus');

        // "[note] 50" in the art's warm brown, written in the blank.
        const spot = art.at(AMOUNT_SPOT.x, AMOUNT_SPOT.y);
        const amount = addMoneyText(this, spot.x, spot.y, total, {
            fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
            fontSize: art.px(AMOUNT_ART_SIZE),
            color: '#7a4a2e',
            align: 'center',
        });
        // It fades up from slightly below. (A scale pop would grow from the container's left edge, not its middle.)
        amount.setAlpha(0).setY(amount.y + art.px(24));
        this.tweens.add({ targets: amount, alpha: 1, y: spot.y, duration: 600, delay: 250, ease: 'Back.easeOut' });

        playJingle(this, 'fanfare', { holdMusic: true }); // the music pauses and stays quiet until the player moves on to gameplay
        addProceedButton(this, () => startDay(this, this.levelIndex, 'bonus'));
    }
}
