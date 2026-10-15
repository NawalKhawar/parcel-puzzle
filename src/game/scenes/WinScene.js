import { Scene } from 'phaser';
import { UI_SCALE } from '../uiScale.js';

/**
 * WinScene.js
 *
 * A small overlay scene shown when a truck (puzzle) is completed - but NOT the last
 * truck of the day, which goes to DayCompleteScene instead (see PuzzleScene.handleWin).
 * PuzzleScene launches this on top of itself (via `this.scene.launch('WinScene', data)`)
 * rather than replacing itself, so the just-completed board stays visible, dimmed,
 * behind the overlay - PuzzleScene is paused for the duration so the board can't be
 * interacted with while this is up.
 *
 * It reports which truck was just finished ("Truck 2/4"), the coins that truck earned,
 * and the all-time pay count. It holds no puzzle-rule logic of its own, and since it is
 * only shown when another truck follows, its button always means "next truck".
 */
export class WinScene extends Scene
{
    constructor ()
    {
        super('WinScene');
    }

    /**
     * @param {Object} data
     * @param {number} data.truckNumber - 1-based number of the truck just completed.
     * @param {number} data.trucksTotal - how many trucks the current level has.
     * @param {number} data.reward - coins earned for this one truck.
     * @param {number} data.totalEarned - all-time running pay count after this reward.
     * @param {number} data.levelIndex - 0-based level (day) index, passed back to PuzzleScene.
     * @param {number} data.nextTruckIndex - 0-based index of the truck to start next.
     */
    create (data)
    {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // A dimming overlay over the whole screen, so the finished board is still
        // visible underneath but clearly no longer the focus.
        this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.45);

        this.add
            .text(centerX, centerY - 80 * UI_SCALE, 'Truck Complete!', {
                fontFamily: 'Arial Black',
                fontSize: 40 * UI_SCALE,
                color: '#ffffff',
                stroke: '#3a362f',
                strokeThickness: 6 * UI_SCALE,
                align: 'center',
            })
            .setOrigin(0.5);

        this.add
            .text(centerX, centerY - 30 * UI_SCALE, `Truck ${data.truckNumber}/${data.trucksTotal}`, {
                fontFamily: 'Arial',
                fontSize: 20 * UI_SCALE,
                color: '#ffffff',
                align: 'center',
            })
            .setOrigin(0.5);

        this.add
            .text(centerX, centerY + 10 * UI_SCALE, `+$${data.reward} earned  ·  Total: $${data.totalEarned}`, {
                fontFamily: 'Arial Black',
                fontSize: 22 * UI_SCALE,
                color: '#f0cf8e',
                align: 'center',
            })
            .setOrigin(0.5);

        const button = this.add
            .text(centerX, centerY + 70 * UI_SCALE, 'Next Truck', {
                fontFamily: 'Arial Black',
                fontSize: 28 * UI_SCALE,
                color: '#3a362f',
                backgroundColor: '#f0b86e',
                padding: { x: 24 * UI_SCALE, y: 12 * UI_SCALE },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        button.on('pointerdown', () => {
            // Stop both scenes explicitly (rather than relying on start() to implicitly
            // tear down whatever called it) before starting a fresh PuzzleScene, so the
            // next truck gets a brand-new Scene instance - a clean Grid and new
            // PieceViews, not state left over from the just-completed truck.
            this.scene.stop('PuzzleScene');
            this.scene.stop('WinScene');
            this.scene.start('PuzzleScene', { levelIndex: data.levelIndex, truckIndex: data.nextTruckIndex });
        });
    }
}
