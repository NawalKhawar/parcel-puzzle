import { Geom, Scene } from 'phaser';
import { makePressable } from '../objects/pressFeedback.js';
import { playBgm, TITLE_BGM_VOLUME } from '../audio.js';
import { UI_SCALE } from '../uiScale.js';

/**
 * TitleScene.js
 *
 * The first screen the player sees: the full-art title background (assets/title-bg.png, which
 * has the "Cozy Couriers" logo and two characters baked in, so no separate text title is drawn
 * over it) and a single "Start Packing" button. Pressing it goes straight into truck 1 of
 * level 1 (PuzzleScene) - there is deliberately no menu, level select, or settings here yet.
 */

/** Where the button sits, as a fraction of the screen (0-1 from the top-left). title-bg.png
 *  leaves a gap of open warehouse floor between its two characters, below the logo - these
 *  fractions were measured against that gap so the button lands inside it rather than over the
 *  art. If title-bg.png is ever replaced, re-measure and update these two numbers. */
const BUTTON_X_FRACTION = 0.508;
const BUTTON_Y_FRACTION = 0.71;

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

        // The title art (1672x941 - very close to the game's own 16:9) stretched to cover the
        // whole screen; the game's own 1280x720 design is near enough the same ratio that this
        // is effectively undistorted.
        this.add.image(0, 0, 'title-bg').setOrigin(0, 0).setDisplaySize(this.scale.width, this.scale.height);

        // Title music (replaces the gameplay music when arriving here from Quit).
        playBgm(this, 'title-bgm', TITLE_BGM_VOLUME);

        const buttonX = this.scale.width * BUTTON_X_FRACTION;
        const buttonY = this.scale.height * BUTTON_Y_FRACTION;

        // The button art (assets/start-packing.png, 2048x768) is a pill with a soft glow around
        // it. Shown at 390x146 design pixels the pill itself is about 375x88. Only the pill
        // should respond to clicks, not the glow, so the clickable area is the pill's rectangle
        // in the image's own pixel coordinates (measured from the art's own opaque pixels).
        const playButton = this.add
            .image(buttonX, buttonY, 'start-packing')
            .setDisplaySize(390 * UI_SCALE, 146 * UI_SCALE)
            .setInteractive(new Geom.Rectangle(20, 132, 2006, 496), Geom.Rectangle.Contains);
        playButton.input.cursor = 'pointer';

        makePressable(this, playButton, () => {
            // A brand-new game starts with an empty wallet. ('totalEarned' is the all-time
            // running total; it is never reset between days, only here.) PuzzleScene
            // resets the per-day totals itself whenever it starts truck 0.
            this.registry.set('totalEarned', 0);
            this.registry.set('apartmentLayout', {}); // ...and an empty apartment.
            this.scene.start('PuzzleScene', { levelIndex: 0, truckIndex: 0 });
        }, { delay: 140 });
    }
}
