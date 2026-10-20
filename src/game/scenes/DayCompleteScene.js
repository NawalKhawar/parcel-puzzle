import { Scene } from 'phaser';
import { makePressable } from '../objects/pressFeedback.js';
import { UI_SCALE } from '../uiScale.js';
import { playSfx, stopBgm } from '../audio.js';

/**
 * DayCompleteScene.js
 *
 * The end-of-day report screen, shown after the last truck of a level (day) is packed. It is a
 * full-screen clipboard (assets/clipboard-screen.png, which has the company name and department
 * printed on it) with a "Day N Report" heading and the day's figures written on the paper. It shows:
 *
 *   - how many trucks were completed,
 *   - a breakdown of what was earned per truck difficulty (e.g. "2 Easy trucks  $20"),
 *   - any one-off bonuses (e.g. the first-day bonus), and
 *   - the total earned that day, at the bottom.
 *
 * Then three buttons:
 *
 *   Shop      - opens ShopScene (a grid of placeholder apartment items; Back returns here).
 *   Decorate  - opens ApartmentScene, where furniture is arranged on a grid (Back returns here).
 *   Next Day  - starts truck 1 of the next level. On the very last level there is no
 *               next day, so this button becomes "Finish" and returns to the title screen.
 *
 * PuzzleScene launches this on top of itself (paused); the clipboard art covers the whole screen. Shop and Apartment hand
 * this scene's data back via their Back buttons, which restart this scene so the popup
 * reappears exactly as the player left it.
 */

/** Preferred vertical spacing between the report's rows, in design pixels (shrinks if many rows). */
const ROW_HEIGHT = 64;

/** The lowest y (design pixels) the last report row (or the last-level note) may reach, so the buttons below it still fit on the paper. */
const ROWS_BOTTOM_LIMIT = 560;

/** Gap (design pixels) from the bottom of the report text down to the centre of the button row. */
const BUTTONS_GAP = 95;

/** The order the difficulty breakdown rows are shown in, and their display names. */
const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];
const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** The total line's text colour - a warm rust, so it stands out from the dark-brown rows and green bonuses. */
const TOTAL_COLOR = '#c0501f';

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
     * @param {number} data.truckEarnings - coins the trucks paid in total, before any bonuses.
     * @param {Object<string, {count: number, earned: number}>} data.byDifficulty - the same
     *   total split by truck difficulty, e.g. { easy: { count: 2, earned: 20 } }. Only
     *   difficulties actually played today appear as keys.
     * @param {Array<{label: string, amount: number}>} data.bonuses - one-off bonuses paid at the
     *   end of this level (empty on most days).
     * @param {number} data.earned - total earned that day: truckEarnings plus all bonuses.
     * @param {boolean} data.isLastLevel - true if no further level exists.
     */
    init (data)
    {
        this.dayData = data;
    }

    create ()
    {
        const S = UI_SCALE;
        const data = this.dayData;

        // This is a screen of its own: hide the paused game scene underneath and paint the
        // background black (it shows through the clipboard art's rounded corners).
        this.cameras.main.setBackgroundColor(0x000000);
        this.scene.setVisible(false, 'PuzzleScene');

        // Silence the gameplay music and play the jingle - once per report, not again when
        // returning from the Shop/Decorate screens (they hand this same data object back).
        stopBgm();
        if (!data.jinglePlayed)
        {
            data.jinglePlayed = true;
            playSfx(this, 'level-complete');
        }
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // The clipboard art fills the whole screen (this is its own screen now, not a popup over
        // the board). The art already has the company name and department printed on it, so
        // none of that is drawn in code.
        this.add.image(centerX, centerY, 'clipboard-screen').setDisplaySize(this.scale.width, this.scale.height);

        // ---- Work out the report's rows first, so the panel can be sized to fit them.
        // Each row is a label on the left and a value on the right, like a payslip.
        const bonuses = data.bonuses ?? [];
        const byDifficulty = data.byDifficulty ?? {};
        const rows = [{ label: 'Trucks completed', value: String(data.trucksCompleted) }];
        // One row per difficulty actually played today (easy/medium/hard, in that order), e.g.
        // "2 Easy trucks" -> "$20" - these already sum to data.truckEarnings, so there's no
        // separate subtotal row needed before them.
        for (const difficulty of DIFFICULTY_ORDER)
        {
            const entry = byDifficulty[difficulty];
            if (!entry || entry.count === 0)
            {
                continue;
            }
            const label = `${entry.count} ${DIFFICULTY_LABEL[difficulty]} truck${entry.count === 1 ? '' : 's'}`;
            rows.push({ label, value: `$${entry.earned}` });
        }
        for (const bonus of bonuses)
        {
            rows.push({ label: bonus.label, value: `+$${bonus.amount}`, color: '#3f7d4e' });
        }
        rows.push({ label: 'Total earned today', value: `$${data.earned}`, total: true, color: TOTAL_COLOR });

        // Vertical layout in design pixels, measured on the clipboard art: the printed heading block
        // ends around y=175, so the "Day N report" title sits just under it, then the rows, then
        // the buttons below the last row (kept above the bottom edge of the paper at ~y=686).
        const titleY = 244;
        const headerHeight = 330; // y of the first report row
        // Spread the rows out generously, but squeeze them together when a long report (many
        // bonuses) would otherwise run into the buttons. The last-level note needs extra room.
        const noteRoom = data.isLastLevel ? 30 : 0;
        const rowHeight = Math.max(34, Math.min(ROW_HEIGHT, (ROWS_BOTTOM_LIMIT - noteRoom - headerHeight) / Math.max(1, rows.length - 1)));
        // The buttons follow the text: a fixed gap below the last line, so they ride down when
        // the report is longer and up when it is shorter.
        const buttonsOffset = headerHeight + (rows.length - 1) * rowHeight + noteRoom + BUTTONS_GAP;
        const panelTop = 0; // the rows/buttons below are positioned from the top of the screen

        this.add
            .text(centerX, titleY * S, `Day ${data.levelIndex + 1} Report`, {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: 52 * S,
                color: '#3a362f',
            })
            .setOrigin(0.5);

        // A thin rule under the title, in the same tone as the receipt-style total rule below.
        this.add.rectangle(centerX, (titleY + 42) * S, 640 * S, 2 * S, 0xcfc3a8);

        // ---- The report rows.
        const labelX = centerX - 300 * S;
        const valueX = centerX + 300 * S;
        rows.forEach((row, index) => {
            const y = panelTop + (headerHeight + index * rowHeight) * S;

            if (row.total)
            {
                // A thin rule above the total, like the sum line on a receipt.
                this.add.rectangle(centerX, y - (rowHeight / 2) * S, 600 * S, 2 * S, 0xcfc3a8);
            }

            const style = {
                fontFamily: row.total ? 'Fredoka, Arial Black' : 'Fredoka, Arial',
                fontStyle: row.total ? '700' : '400',
                fontSize: (row.total ? 34 : 29) * S,
                color: row.color ?? '#3a362f',
            };
            this.add.text(labelX, y, row.label, style).setOrigin(0, 0.5);
            this.add.text(valueX, y, row.value, style).setOrigin(1, 0.5);
        });

        if (data.isLastLevel)
        {
            this.add
                .text(centerX, panelTop + (headerHeight + (rows.length - 1) * rowHeight + noteRoom) * S, "That's every level - great work!", {
                    fontFamily: 'Fredoka, Arial', fontStyle: '400',
                    fontSize: 22 * S,
                    color: '#6b6354',
                })
                .setOrigin(0.5);
        }

        // ---- Three buttons in a row. A tiny local helper keeps their styling identical.
        const buttonY = panelTop + buttonsOffset * S;
        const spacing = 290 * S;
        const makeButton = (x, label, fill, onClick) => {
            const button = this.add
                .text(x, buttonY, label, {
                    fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                    fontSize: 30 * S,
                    color: '#3a362f',
                    backgroundColor: fill,
                    padding: { x: 32 * S, y: 18 * S },
                })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });
            makePressable(this, button, onClick, { delay: 140 });
            return button;
        };

        // One colour per button so they're easy to tell apart at a glance.
        makeButton(centerX - spacing, 'Shop', '#8fc1e3', () => this.scene.start('ShopScene', data));
        makeButton(centerX, 'Decorate', '#a3d29c', () => this.scene.start('ApartmentScene', data));

        if (data.isLastLevel)
        {
            makeButton(centerX + spacing, 'Finish', '#f0b86e', () => {
                this.scene.stop('PuzzleScene');
                this.scene.start('TitleScene');
            });
        }
        else
        {
            makeButton(centerX + spacing, 'Next Day', '#f0b86e', () => {
                // Stop PuzzleScene explicitly so the next day gets a brand-new instance
                // (clean Grid, new PieceViews) rather than leftovers from the last truck.
                this.scene.stop('PuzzleScene');
                this.scene.start('PuzzleScene', { levelIndex: data.levelIndex + 1, truckIndex: 0 });
            });
        }
    }
}
