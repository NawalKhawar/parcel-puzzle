import { Scene } from 'phaser';
import { UI_SCALE } from '../uiScale.js';

/**
 * DayCompleteScene.js
 *
 * The end-of-day popup (the "Shift Complete!" screen from docs/game_concept.pdf), shown
 * after the last truck of a level (day) is packed. It reports how many trucks were
 * completed and how much was earned that day, then offers three buttons:
 *
 *   Shop      - opens ShopScene, a blank placeholder screen with a Back button.
 *   Decorate  - opens DecorateScene, likewise a blank placeholder.
 *   Next Day  - starts truck 1 of the next level. On the very last level there is no
 *               next day, so this button becomes "Finish" and returns to the title screen.
 *
 * PuzzleScene launches this on top of itself (paused), so the finished board shows
 * dimmed behind the popup, the same treatment WinScene uses between trucks. Shop and
 * Decorate hand this scene's data back via their Back buttons, which restart this scene
 * so the popup reappears exactly as the player left it.
 */
export class DayCompleteScene extends Scene
{
    constructor ()
    {
        super('DayCompleteScene');
    }

    /**
     * Stores the data so it can be passed on to Shop/Decorate (and back again).
     *
     * @param {Object} data
     * @param {number} data.levelIndex - 0-based index of the level (day) just finished.
     * @param {number} data.trucksCompleted - trucks (puzzles) packed that day.
     * @param {number} data.earned - coins earned that day.
     * @param {number} data.totalEarned - all-time pay count (carries over between days).
     * @param {boolean} data.isLastLevel - true if no further level exists.
     */
    init (data)
    {
        this.dayData = data;
    }

    create ()
    {
        const data = this.dayData;
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // Dim the whole screen so the finished board is visible but clearly not the focus.
        this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.45);

        const panelWidth = 640 * UI_SCALE;
        const panelHeight = 360 * UI_SCALE;
        this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0xfaf3e4).setStrokeStyle(2 * UI_SCALE, 0x3a362f);

        const textStyle = { fontFamily: 'Arial', fontSize: 24 * UI_SCALE, color: '#3a362f', align: 'center' };

        this.add
            .text(centerX, centerY - 125 * UI_SCALE, `Level ${data.levelIndex + 1} Complete!`, {
                fontFamily: 'Arial Black',
                fontSize: 36 * UI_SCALE,
                color: '#3a362f',
                align: 'center',
            })
            .setOrigin(0.5);

        this.add
            .text(centerX, centerY - 60 * UI_SCALE, `Trucks completed:  ${data.trucksCompleted}`, textStyle)
            .setOrigin(0.5);

        this.add
            .text(centerX, centerY - 20 * UI_SCALE, `Earned today:  $${data.earned}`, textStyle)
            .setOrigin(0.5);

        this.add
            .text(centerX, centerY + 20 * UI_SCALE, `Total earned:  $${data.totalEarned}`, textStyle)
            .setOrigin(0.5);

        if (data.isLastLevel)
        {
            this.add
                .text(centerX, centerY + 55 * UI_SCALE, "That's every level - great work!", {
                    ...textStyle,
                    fontSize: 18 * UI_SCALE,
                })
                .setOrigin(0.5);
        }

        // Three buttons in a row. A tiny local helper keeps their styling identical.
        const buttonY = centerY + 100 * UI_SCALE;
        const spacing = 200 * UI_SCALE;
        const makeButton = (x, label, onClick) => {
            const button = this.add
                .text(x, buttonY, label, {
                    fontFamily: 'Arial Black',
                    fontSize: 24 * UI_SCALE,
                    color: '#3a362f',
                    backgroundColor: '#f0b86e',
                    padding: { x: 22 * UI_SCALE, y: 12 * UI_SCALE },
                })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });
            button.on('pointerdown', onClick);
            return button;
        };

        makeButton(centerX - spacing, 'Shop', () => this.scene.start('ShopScene', data));
        makeButton(centerX, 'Decorate', () => this.scene.start('DecorateScene', data));

        if (data.isLastLevel)
        {
            makeButton(centerX + spacing, 'Finish', () => {
                this.scene.stop('PuzzleScene');
                this.scene.start('TitleScene');
            });
        }
        else
        {
            makeButton(centerX + spacing, 'Next Day', () => {
                // Stop PuzzleScene explicitly so the next day gets a brand-new instance
                // (clean Grid, new PieceViews) rather than leftovers from the last truck.
                this.scene.stop('PuzzleScene');
                this.scene.start('PuzzleScene', { levelIndex: data.levelIndex + 1, truckIndex: 0 });
            });
        }
    }
}
