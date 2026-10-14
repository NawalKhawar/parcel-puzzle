import { Scene } from 'phaser';
import { UI_SCALE } from '../uiScale.js';

/**
 * ShiftCompleteScene.js
 *
 * The "Shift Complete!" summary screen from docs/game_concept.pdf's art reference —
 * shown once the player has packed every truck in the current shift (i.e. completed
 * every level in src/data/levels.json, in order). Reports the running totals that
 * built up across the whole shift (trucks completed, total earned), which PuzzleScene
 * accumulates in the Phaser Data Manager (`this.registry`) as each level/truck is
 * completed — see PuzzleScene.handleWin().
 *
 * The concept doc's full daily loop is "Start Day → Pack Trucks → Receive Paycheck →
 * Go Home → Spend/Save → Next Day", including an apartment/shop step after the
 * paycheck — that whole meta-loop is explicitly deferred in ROADMAP.md's "Future / Not
 * Yet Scheduled" section until the puzzle core itself is approved. This scene's job
 * ends at "Receive Paycheck": its one button starts a brand new shift from the first
 * level, resetting the running totals back to zero.
 */
export class ShiftCompleteScene extends Scene
{
    constructor ()
    {
        super('ShiftCompleteScene');
    }

    /**
     * @param {Object} data
     * @param {number} data.trucksCompleted - total levels completed this shift.
     * @param {number} data.totalEarned - total coins earned this shift.
     */
    create (data)
    {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // A dimming overlay over the whole screen, so the finished board is still
        // visible underneath but clearly no longer the focus — same treatment as
        // WinScene's per-level overlay.
        this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.45);

        const panelWidth = 440 * UI_SCALE;
        const panelHeight = 320 * UI_SCALE;
        this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0xfaf3e4).setStrokeStyle(2 * UI_SCALE, 0x3a362f);

        this.add
            .text(centerX, centerY - 110 * UI_SCALE, 'Shift Complete!', {
                fontFamily: 'Arial Black',
                fontSize: 36 * UI_SCALE,
                color: '#3a362f',
                align: 'center',
            })
            .setOrigin(0.5);

        this.add
            .text(centerX, centerY - 40 * UI_SCALE, `Trucks completed:  ${data.trucksCompleted}`, {
                fontFamily: 'Arial',
                fontSize: 22 * UI_SCALE,
                color: '#3a362f',
                align: 'center',
            })
            .setOrigin(0.5);

        this.add
            .text(centerX, centerY, `Total earned:  $${data.totalEarned}`, {
                fontFamily: 'Arial',
                fontSize: 22 * UI_SCALE,
                color: '#3a362f',
                align: 'center',
            })
            .setOrigin(0.5);

        const button = this.add
            .text(centerX, centerY + 110 * UI_SCALE, 'Back to Home', {
                fontFamily: 'Arial Black',
                fontSize: 26 * UI_SCALE,
                color: '#3a362f',
                backgroundColor: '#f0b86e',
                padding: { x: 24 * UI_SCALE, y: 12 * UI_SCALE },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        button.on('pointerdown', () => {
            // A new shift starts from a clean slate: both the running counters this
            // scene just displayed, and a brand-new PuzzleScene instance at level 0
            // (not a mutated leftover one), mirroring the "fresh instance per level"
            // approach WinScene already uses for moving between individual levels.
            this.registry.set('shiftTrucksCompleted', 0);
            this.registry.set('shiftTotalEarned', 0);

            this.scene.stop('PuzzleScene');
            this.scene.stop('ShiftCompleteScene');
            this.scene.start('PuzzleScene', { levelIndex: 0 });
        });
    }
}
