import { Scene } from 'phaser';
import { UI_SCALE } from '../uiScale.js';

/**
 * TitleScene.js
 *
 * The first screen the player sees: the game's name and a single Play button. Pressing
 * Play goes straight into truck 1 of level 1 (PuzzleScene) - there is deliberately no
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

        const playButton = this.add
            .text(centerX, centerY + 70 * UI_SCALE, 'Play', {
                fontFamily: 'Arial Black',
                fontSize: 40 * UI_SCALE,
                color: '#3a362f',
                backgroundColor: '#f0b86e',
                padding: { x: 56 * UI_SCALE, y: 16 * UI_SCALE },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        playButton.on('pointerdown', () => {
            // A brand-new game starts with an empty wallet. ('totalEarned' is the all-time
            // running total; it is never reset between days, only here.) PuzzleScene
            // resets the per-day totals itself whenever it starts truck 0.
            this.registry.set('totalEarned', 0);
            this.registry.set('apartmentLayout', {}); // ...and an empty apartment.
            this.scene.start('PuzzleScene', { levelIndex: 0, truckIndex: 0 });
        });
    }
}
