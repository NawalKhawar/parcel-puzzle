import { Scene } from 'phaser';
import companyData from '../../data/company.json';
import { makePressable } from '../objects/pressFeedback.js';
import { UI_SCALE } from '../uiScale.js';

/**
 * DayCompleteScene.js
 *
 * The end-of-day popup (the "Shift Complete!" screen from docs/game_concept.pdf), shown after
 * the last truck of a level (day) is packed. It is styled as a little report from the
 * player's employer (name and department come from src/data/company.json) and shows:
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
 * PuzzleScene launches this on top of itself (paused), so the finished board shows dimmed
 * behind the popup, the same dimming used for the pause overlay. Shop and Apartment hand
 * this scene's data back via their Back buttons, which restart this scene so the popup
 * reappears exactly as the player left it.
 */

/** Vertical spacing between the report's rows, in design pixels. */
const ROW_HEIGHT = 36;

/** The order the difficulty breakdown rows are shown in, and their display names. */
const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];
const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

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
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // Dim the whole screen so the finished board is visible but clearly not the focus.
        this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.45);

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
        rows.push({ label: 'Total earned today', value: `$${data.earned}`, total: true });

        const headerHeight = 172; // company block + divider + level line, above the rows
        const lastLevelNoteHeight = data.isLastLevel ? 40 : 0;
        const buttonsOffset = headerHeight + rows.length * ROW_HEIGHT + lastLevelNoteHeight + 52;
        const panelWidth = 640 * S;
        const panelHeight = (buttonsOffset + 56) * S;
        const panelTop = centerY - panelHeight / 2;

        this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0xfaf3e4).setStrokeStyle(2 * S, 0x3a362f);

        // ---- Company header: the name, and the department the player works in.
        this.add
            .text(centerX, panelTop + 46 * S, companyData.name, {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: 30 * S,
                color: '#3a362f',
            })
            .setOrigin(0.5);
        this.add
            .text(centerX, panelTop + 82 * S, companyData.department.toUpperCase(), {
                fontFamily: 'Fredoka, Arial', fontStyle: '400',
                fontSize: 13 * S,
                color: '#8a7f6a',
            })
            .setOrigin(0.5);

        this.add.rectangle(centerX, panelTop + 104 * S, 540 * S, 2 * S, 0xcfc3a8);

        this.add
            .text(centerX, panelTop + 134 * S, `Level ${data.levelIndex + 1} complete`, {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: 20 * S,
                color: '#3a362f',
            })
            .setOrigin(0.5);

        // ---- The report rows.
        const labelX = centerX - 230 * S;
        const valueX = centerX + 230 * S;
        rows.forEach((row, index) => {
            const y = panelTop + (headerHeight + index * ROW_HEIGHT) * S;

            if (row.total)
            {
                // A thin rule above the total, like the sum line on a receipt.
                this.add.rectangle(centerX, y - (ROW_HEIGHT / 2) * S, 460 * S, 1 * S, 0xcfc3a8);
            }

            const style = {
                fontFamily: row.total ? 'Fredoka, Arial Black' : 'Fredoka, Arial',
                fontStyle: row.total ? '700' : '400',
                fontSize: (row.total ? 24 : 21) * S,
                color: row.color ?? '#3a362f',
            };
            this.add.text(labelX, y, row.label, style).setOrigin(0, 0.5);
            this.add.text(valueX, y, row.value, style).setOrigin(1, 0.5);
        });

        if (data.isLastLevel)
        {
            this.add
                .text(centerX, panelTop + (headerHeight + rows.length * ROW_HEIGHT + 14) * S, "That's every level - great work!", {
                    fontFamily: 'Fredoka, Arial', fontStyle: '400',
                    fontSize: 18 * S,
                    color: '#6b6354',
                })
                .setOrigin(0.5);
        }

        // ---- Three buttons in a row. A tiny local helper keeps their styling identical.
        const buttonY = panelTop + buttonsOffset * S;
        const spacing = 200 * S;
        const makeButton = (x, label, onClick) => {
            const button = this.add
                .text(x, buttonY, label, {
                    fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                    fontSize: 24 * S,
                    color: '#3a362f',
                    backgroundColor: '#f0b86e',
                    padding: { x: 22 * S, y: 12 * S },
                })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });
            makePressable(this, button, onClick, { delay: 140 });
            return button;
        };

        makeButton(centerX - spacing, 'Shop', () => this.scene.start('ShopScene', data));
        makeButton(centerX, 'Decorate', () => this.scene.start('ApartmentScene', data));

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
