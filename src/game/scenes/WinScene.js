import { Scene } from 'phaser';
import { UI_SCALE } from '../uiScale.js';

/**
 * WinScene.js
 *
 * A small overlay scene shown when a level ("truck") is completed. PuzzleScene
 * launches this on top of itself (via `this.scene.launch('WinScene', data)`) rather
 * than replacing itself, so the just-completed board stays visible, dimmed, behind the
 * overlay — PuzzleScene is paused for the duration (see PuzzleScene.handleWin) so the
 * board can't be interacted with while this is up.
 *
 * As of Milestone 9, this also reports the coins just earned and the running shift
 * total (see docs/game_concept.pdf's "Shift Complete!" art reference, which this
 * mirrors at the single-truck scale) — it still holds no puzzle-rule logic of its own,
 * and is only ever shown for a level that *isn't* the last one in the shift: reaching
 * the final level routes straight to ShiftCompleteScene instead (see
 * PuzzleScene.handleWin), so this scene no longer needs to know anything about
 * wraparound or "last level" — its button always means "next truck".
 */
export class WinScene extends Scene
{
    constructor ()
    {
        super('WinScene');
    }

    /**
     * @param {Object} data
     * @param {string} data.levelId - the level just completed, for display.
     * @param {number} data.reward - coins earned for this one level/truck.
     * @param {number} data.totalEarned - running shift total after this reward.
     * @param {number} data.nextLevelIndex - the levels.json index PuzzleScene should
     *   restart at when the button is pressed.
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
            .text(centerX, centerY - 30 * UI_SCALE, data.levelId, {
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
            // next level gets a brand-new Scene instance — a clean Grid and new
            // PieceViews, not state left over from the just-completed level.
            this.scene.stop('PuzzleScene');
            this.scene.stop('WinScene');
            this.scene.start('PuzzleScene', { levelIndex: data.nextLevelIndex });
        });
    }
}
