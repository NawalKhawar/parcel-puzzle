import { Geom, Scene } from 'phaser';
import { makePressable } from '../objects/pressFeedback.js';
import { UI_SCALE } from '../uiScale.js';

/**
 * TitleScene.js
 *
 * The first screen the player sees: the game's name and a single "Start Packing" button.
 * Pressing it goes straight into truck 1 of level 1 (PuzzleScene) - there is deliberately no
 * menu, level select, or settings here yet.
 *
 * The game's name is a placeholder ("for now we're calling it Parcel Packing Puzzle"),
 * so it lives in one constant to make renaming a one-line change.
 */

/** Working title of the game, shown on the title screen. */
const GAME_TITLE = 'Parcel Packing Puzzle';

export class TitleScene extends Scene
{
    constructor ()
    {
        super('TitleScene');
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0xf5ead6);

        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        this.add
            .text(centerX, centerY - 110 * UI_SCALE, GAME_TITLE, {
                fontFamily: 'Arial Black',
                fontSize: 60 * UI_SCALE,
                color: '#3a362f',
                align: 'center',
                // Wrap onto two lines on narrow canvases instead of running off the edges.
                wordWrap: { width: this.scale.width * 0.9 },
            })
            .setOrigin(0.5);

        // The button art (assets/start-packing.png, 2048x768) is a pill with a soft glow around
        // it. Shown at 390x146 design pixels the pill itself is about 375x88. Only the pill
        // should respond to clicks, not the glow, so the clickable area is the pill's rectangle
        // in the image's own pixel coordinates.
        const playButton = this.add
            .image(centerX, centerY + 70 * UI_SCALE, 'start-packing')
            .setDisplaySize(390 * UI_SCALE, 146 * UI_SCALE)
            .setInteractive(new Geom.Rectangle(39, 152, 1970, 462), Geom.Rectangle.Contains);
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
