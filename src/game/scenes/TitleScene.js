import { Geom, Scene } from 'phaser';
import { makePressable } from '../objects/pressFeedback.js';
import { addImageButton } from '../objects/imageButton.js';
import { trackMenuChoice } from '../../analytics.js';
import { showConfirm } from '../objects/OfferPopup.js';
import { playBgm, TITLE_BGM_VOLUME } from '../audio.js';
import { UI_SCALE } from '../uiScale.js';
import { hasSave, startNewGame, continueGame } from '../progress.js';
import { isPortrait } from '../layout.js';
import { addCoverArt } from '../objects/fullScreenArt.js';

/**
 * TitleScene.js
 *
 * The first screen the player sees: the full-art title background (assets/backgrounds/title-bg.png, which
 * has the "Cozy Couriers" logo and two characters baked in, so no separate text title is drawn
 * over it) and the start button(s). There is deliberately no level select or settings here yet.
 *
 *   - No saved game (a first-time player): the single painted "Start Packing" button, which starts a
 *     new game straight into truck 1 of level 1 (PuzzleScene).
 *   - A saved game: two picture buttons, "Continue" (carries on where the save left off) and "New
 *     Game", which asks Yes / No first because it erases the save. A returning player who says Yes is
 *     offered a Skip button for the tutorial (see progress.startNewGame).
 *
 * On a phone (portrait canvas) the painting is the hand-made tall one, assets/mobile/title-bg-portrait.webp
 * (941x1672), cover-scaled to the canvas; the button(s) sit on the open floor below the two characters, at a
 * spot given as a fraction of the painting so they follow the crop on any phone shape (see PORTRAIT_BUTTON_SPOT).
 */

/** Where the button sits, as a fraction of the screen (0-1 from the top-left). title-bg.png
 *  leaves a gap of open warehouse floor between its two characters, below the logo - these
 *  fractions were measured against that gap so the button lands inside it rather than over the
 *  art. If title-bg.png is ever replaced, re-measure and update these two numbers. */
const BUTTON_X_FRACTION = 0.508;
const BUTTON_Y_FRACTION = 0.71;

/** Portrait: where the button(s) go, as fractions of the 941x1672 painting - the open floor between the characters'
 *  feet (about y 0.75) and the boxes at the very bottom. If title-bg-portrait is ever replaced, re-measure. */
const PORTRAIT_BUTTON_SPOT = { x: 0.5, y: 0.86 };

/** Portrait: the least room (design px) kept between the lowest button's centre and the canvas bottom, so on a
 *  squarer phone the stack is pushed up off the screen edge / home-indicator strip rather than cut off. */
const PORTRAIT_CLEARANCE_START = 120;
const PORTRAIT_CLEARANCE_MENU = 180;

export class TitleScene extends Scene
{
    constructor ()
    {
        super('TitleScene');
    }

    create ()
    {
        // Fallback fill, in case the background image is ever missing or doesn't quite cover
        // the canvas (e.g. an unusual aspect ratio under Scale.FIT).
        this.cameras.main.setBackgroundColor(0xf5ead6);

        const portrait = isPortrait(this);
        let buttonX;
        let buttonY;
        if (portrait)
        {
            // One tall painting covering the canvas; the buttons go on its floor, but never nearer the bottom
            // edge than the clearance (a squarer phone shows less of the painting's lower part).
            const art = addCoverArt(this, 'title-bg-portrait');
            const spot = art.at(PORTRAIT_BUTTON_SPOT.x, PORTRAIT_BUTTON_SPOT.y);
            const clearance = (hasSave() ? PORTRAIT_CLEARANCE_MENU : PORTRAIT_CLEARANCE_START) * UI_SCALE;
            buttonX = spot.x;
            buttonY = Math.min(spot.y, this.scale.height - clearance);
        }
        else
        {
            // The title art (1672x941 - very close to the game's own 16:9) stretched to cover the
            // whole screen; the game's own 1280x720 design is near enough the same ratio that this
            // is effectively undistorted.
            this.add.image(0, 0, 'title-bg').setOrigin(0, 0).setDisplaySize(this.scale.width, this.scale.height);
            buttonX = this.scale.width * BUTTON_X_FRACTION;
            buttonY = this.scale.height * BUTTON_Y_FRACTION;
        }

        // Title music (replaces the gameplay music when arriving here from Quit).
        playBgm(this, 'title-bgm', TITLE_BGM_VOLUME);

        if (hasSave())
        {
            this.addSaveMenu(buttonX, buttonY, portrait);
        }
        else
        {
            this.addStartButton(buttonX, buttonY, portrait);
        }
    }

    /**
     * The painted "Start Packing" button (no saved game): starts a new game.
     *
     * @param {number} x - centre x, screen pixels.
     * @param {number} y - centre y, screen pixels.
     * @param {boolean} [portrait] - draw it larger, for a phone.
     */
    addStartButton (x, y, portrait = false)
    {
        // The button art (assets/ui/start-packing.webp, 1024x384 - half the original 2048x768 master)
        // is a pill with a soft glow around it. Shown at 390x146 design pixels the pill itself is
        // about 375x88. Only the pill should respond to clicks, not the glow, so the clickable area
        // is the pill's rectangle in the image's own pixel coordinates (measured from the art's
        // opaque pixels; halve it again if the art is ever shrunk further).
        const playButton = this.add
            .image(x, y, 'start-packing')
            .setDisplaySize((portrait ? 480 : 390) * UI_SCALE, (portrait ? 180 : 146) * UI_SCALE)
            .setInteractive(new Geom.Rectangle(10, 66, 1003, 248), Geom.Rectangle.Contains);
        playButton.input.cursor = 'pointer';

        makePressable(this, playButton, () => this.beginNewGame(false), { delay: 140 });
    }

    /**
     * The Continue / New Game pair (a saved game exists), stacked in the same gap in the art the
     * single button uses. Both are picture buttons of the same height, so they look like a set.
     *
     * @param {number} x - centre x of the pair, screen pixels.
     * @param {number} y - centre y of the pair, screen pixels.
     * @param {boolean} [portrait] - larger buttons, centred in the gap, for a phone.
     */
    addSaveMenu (x, y, portrait = false)
    {
        const S = UI_SCALE;
        // design px. A phone gets big, easy-to-tap buttons (136, was 104); the PC layout keeps its original 108.
        const height = portrait ? 136 : 108;
        const rowOffset = (portrait ? 80 : 62) * S; // each row sits this far above / below the centre
        if (!portrait)
        {
            y += 12 * S; // nudged down a little so the larger buttons stay clear of the logo
        }

        const continueButton = addImageButton(this, x, y - rowOffset, 'button-continue', height);
        const newGameButton = addImageButton(this, x, y + rowOffset, 'button-new-game', height);

        makePressable(this, continueButton, () => {
            trackMenuChoice('continue'); // analytics
            continueGame(this);
        }, { delay: 140 });

        // New Game erases the save, so ask first. No simply closes the question.
        makePressable(this, newGameButton, () => {
            showConfirm(this, {
                title: 'Start a new game?',
                subtitle: 'Your saved progress will be erased.',
                onYes: () => this.beginNewGame(true),
            });
        });
    }

    /**
     * Starts a brand-new game: erases any save, resets all progress (wallet, bonuses, items, apartment,
     * tutorials - see progress.startNewGame) and goes into truck 1 of level 1. PuzzleScene resets
     * the per-day totals itself whenever it starts truck 0.
     *
     * @param {boolean} returning - the player had a save and chose to replace it: they get a Skip
     *   button for the tutorial. (A first-time player does not.)
     */
    beginNewGame (returning)
    {
        trackMenuChoice('new'); // analytics (also the single Start Packing button: a first game is a new game)
        startNewGame(this.registry, { returning });
        this.scene.start('PuzzleScene', { levelIndex: 0, truckIndex: 0 });
    }
}
