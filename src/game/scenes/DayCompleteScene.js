import { Scene } from 'phaser';
import { makePressable } from '../objects/pressFeedback.js';
import { addImageButton } from '../objects/imageButton.js';
import { addPulse } from '../objects/pulse.js';
import { showCornerTip } from '../objects/cornerTip.js';
import { addMoneyText } from '../objects/money.js';
import { UI_SCALE } from '../uiScale.js';
import { GuideCursor } from '../objects/GuideCursor.js';
import { economy, getMoney, getEconomyState } from '../economy.js';
import { shopStatus } from '../../core/economy.js';
import { ftueTrailStage, FTUE_ITEM_ID } from '../../core/ftueTrail.js';
import { startDay } from '../dayFlow.js';
import { isTutorialSkippable, skipTutorial } from '../progress.js';
import { addSkipButton } from '../objects/skipButton.js';
import { playJingle } from '../audio.js';
import { isPortrait } from '../layout.js';
import { addBadgeToImage } from '../objects/badge.js';
import { trackDayComplete } from '../../analytics.js';
import { shopHasBuyable, apartmentHasNew } from '../../core/badges.js';

/**
 * DayCompleteScene.js
 *
 * The end-of-day report screen, shown after the last truck of a level (day) is packed. It is a
 * full-screen clipboard (assets/backgrounds/clipboard-screen.png, which has the company name and department
 * printed on it) with a "Day N - End of Day Report" heading and the day's figures written on the paper. It shows:
 *
 *   - one line per truck packed, with its tier name and what it paid (an overtime truck is marked),
 *   - each one-off bonus on its own line (e.g. the first-day bonus),
 *   - a promotion notice, on a day the player's pay rank went up,
 *   - the total earned that day, and
 *   - the new balance (the wallet, read live, so it is right again after a trip to the Shop).
 *
 * Then three buttons:
 *
 *   Shop      - opens ShopScene (a grid of placeholder apartment items; Back returns here).
 *   Decorate  - opens ApartmentScene, where furniture is arranged on a grid (Back returns here).
 *   Next Day  - starts truck 1 of the next level - via the promotion and/or bonus screens first
 *               if the next day brings a raise or a one-time bonus. On the very last level there is no next day, so this button becomes
 *               "Finish" and returns to the title screen.
 *
 * On a phone (portrait canvas) the clipboard is the hand-made tall picture assets/mobile/clipboard-screen-portrait.webp
 * drawn as a 9-slice (only its plain paper stretches, so any phone height gets a whole clipboard), the rows use
 * the full paper width in one column at a larger text size, and the three buttons stack vertically at the
 * bottom (see the PORTRAIT_* constants).
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

/**
 * Portrait layout, in design pixels (the canvas is 720 wide and 1150-1560 tall). The clipboard picture is
 * drawn at the scale that makes it exactly as wide as the canvas (720 / 924 = 0.78), so its wood frame is
 * about 66 px thick on each side, the clip and the printed company header end about 226 px down, and the
 * paper's bottom edge is about 72 px above the canvas bottom.
 *  - PORTRAIT_TITLE_Y / PORTRAIT_HEADER_HEIGHT: y of the "Day N - End of Day Report" title and of the first report row;
 *  - PORTRAIT_ROW_HEIGHT: the preferred spacing of the report's rows (they squeeze together if many);
 *  - PORTRAIT_SIDE: how far in from the canvas edge the rows' text starts (clear of the wood border);
 *  - the three buttons are stacked PORTRAIT_BUTTON_PITCH apart, each PORTRAIT_BUTTON_HEIGHT tall (a fingertip
 *    needs at least ~76; these are big), starting just UNDER the last line of the report so there is no empty gap
 *    between the text and the buttons. The lowest is never lower than PORTRAIT_BUTTON_FROM_BOTTOM above the canvas
 *    bottom (inside the paper, clear of a phone's home-indicator strip);
 *  - PORTRAIT_BUTTON_BELOW_TEXT: from the centre of the last line to the centre of the first button;
 *  - PORTRAIT_ROWS_BOTTOM_MARGIN: how far above the canvas bottom the last row may reach, so the buttons fit
 *    under it;
 *  - CLIPBOARD_ART_MARGINS: the 9-slice margins in the picture's own pixels (trimmed 924x1617 file): the top
 *    340 rows (clip, header and a little paper) and bottom 137 rows (the lower paper edge and wood) never
 *    stretch, nor do the 80-px side columns; only the plain paper between stretches.
 */
const PORTRAIT_TITLE_Y = 282;
const PORTRAIT_HEADER_HEIGHT = 378;
const PORTRAIT_ROW_HEIGHT = 60;
const PORTRAIT_SIDE = 104;
const PORTRAIT_BUTTON_FROM_BOTTOM = 150;
const PORTRAIT_BUTTON_PITCH = 128;
const PORTRAIT_BUTTON_HEIGHT = 108;
const PORTRAIT_BUTTON_BELOW_TEXT = 104;
const PORTRAIT_ROWS_BOTTOM_MARGIN = 480;
const CLIPBOARD_ART_MARGINS = { left: 80, right: 80, top: 340, bottom: 137 };

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
     * @param {Array<{tier: string, amount: number, overtime: boolean}>} data.truckLog - one entry
     *   per truck packed that day, in order.
     * @param {number} data.truckEarnings - dollars the trucks paid in total, before any bonuses.
     * @param {Array<{label: string, amount: number}>} data.bonuses - one-off bonuses paid at the
     *   end of this level (empty on most days).
     * @param {{name: string} | null} data.promotion - the rank reached today, if the pay rank went up.
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
        // Analytics: the end-of-day results appeared = the workday is complete (sent once; a rebuilt screen sends nothing more).
        trackDayComplete(data.levelIndex + 1);
        const portrait = isPortrait(this);
        /** The canvas height in design pixels (the portrait canvas varies with the phone's shape). */
        const designHeight = this.scale.height / S;

        // This is a screen of its own: hide the paused game scene underneath and paint the
        // background black (it shows through the clipboard art's rounded corners).
        this.cameras.main.setBackgroundColor(0x000000);
        this.scene.setVisible(false, 'PuzzleScene');

        // Play the jingle with the gameplay music paused under it (it resumes when the jingle ends) -
        // once per report, not again when returning from the Shop/Decorate screens (they hand this
        // same data object back).
        if (!data.jinglePlayed)
        {
            data.jinglePlayed = true;
            playJingle(this, 'level-complete');
        }
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // The clipboard art fills the whole screen (this is its own screen now, not a popup over
        // the board). The art already has the company name and department printed on it, so
        // none of that is drawn in code.
        if (portrait)
        {
            // The clipboard is a 9-slice so the paper can be as tall as the phone is: the art is drawn at the
            // scale that makes it exactly as wide as the canvas, and only its middle rows stretch downwards.
            const artWidth = this.textures.get('clipboard-screen-portrait').getSourceImage().width;
            const artScale = this.scale.width / artWidth;
            this.add
                .nineslice(0, 0, 'clipboard-screen-portrait', undefined, artWidth, this.scale.height / artScale,
                    CLIPBOARD_ART_MARGINS.left, CLIPBOARD_ART_MARGINS.right, CLIPBOARD_ART_MARGINS.top, CLIPBOARD_ART_MARGINS.bottom)
                .setOrigin(0, 0)
                .setScale(artScale);
        }
        else
        {
            this.add.image(centerX, centerY, 'clipboard-screen').setDisplaySize(this.scale.width, this.scale.height);
        }

        // ---- Work out the paycheck's lines first, so the layout can be sized to fit them.
        // One line per truck packed (tier name and what it paid), then the "single" lines under
        // them: each bonus, a promotion notice if the pay rank went up today, the total, and the
        // new balance. A long day (5+ trucks) puts the truck lines in two columns to save height.
        const truckLog = data.truckLog ?? [];
        const bonuses = data.bonuses ?? [];
        const truckColumns = !portrait && truckLog.length > 4 ? 2 : 1;
        const truckRows = Math.ceil(truckLog.length / truckColumns);
        const singles = [];
        for (const bonus of bonuses)
        {
            singles.push({ label: bonus.label, money: bonus.amount, prefix: '+', color: '#3f7d4e' });
        }
        if (data.promotion)
        {
            singles.push({ label: `Promoted to ${data.promotion.name}!`, notice: true, color: TOTAL_COLOR });
        }
        singles.push({ label: 'Total earned today', money: data.earned, total: true, color: TOTAL_COLOR });
        singles.push({ label: 'New balance', money: getMoney(this.registry), balance: true });
        const rowCount = truckRows + singles.length;

        // Vertical layout in design pixels, measured on the clipboard art: the printed heading block
        // ends around y=175, so the "Day N report" title sits just under it, then the rows, then
        // the buttons below the last row (kept above the bottom edge of the paper at ~y=686).
        const titleY = portrait ? PORTRAIT_TITLE_Y : 244;
        const headerHeight = portrait ? PORTRAIT_HEADER_HEIGHT : 330; // y of the first report row
        // Spread the rows out generously, but squeeze them together when a long report would
        // otherwise run into the buttons. The last-level note needs extra room.
        const noteRoom = data.isLastLevel ? (portrait ? 46 : 30) : 0;
        // On a phone the rows may reach down to just above the stacked buttons, which depends on the canvas height.
        const rowsBottomLimit = portrait ? designHeight - PORTRAIT_ROWS_BOTTOM_MARGIN : ROWS_BOTTOM_LIMIT;
        const rowHeight = Math.max(portrait ? 30 : 34, Math.min(portrait ? PORTRAIT_ROW_HEIGHT : ROW_HEIGHT, (rowsBottomLimit - noteRoom - headerHeight) / Math.max(1, rowCount - 1)));
        // Portrait text shrinks a little when the rows are squeezed (never below 24 design px).
        const fontFactor = Math.max(0.75, Math.min(1, rowHeight / 56));
        const portraitFont = (size) => Math.max(24, Math.round(size * fontFactor));
        // The buttons follow the text: a fixed gap below the last line, so they ride down when
        // the report is longer and up when it is shorter.
        const buttonsOffset = headerHeight + (rowCount - 1) * rowHeight + noteRoom + BUTTONS_GAP;
        const panelTop = 0; // the rows/buttons below are positioned from the top of the screen

        this.add
            .text(centerX, titleY * S, `Day ${data.levelIndex + 1} - End of Day Report`, {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: (portrait ? 40 : 44) * S,
                color: '#3a362f',
            })
            .setOrigin(0.5);

        // A thin rule under the title, in the same tone as the receipt-style total rule below.
        this.add.rectangle(centerX, (titleY + (portrait ? 40 : 42)) * S, (portrait ? 520 : 640) * S, 2 * S, 0xcfc3a8);

        // ---- The truck lines: "Truck 2 · Medium" on the left, the amount (with the currency note
        // icon, see objects/money.js) on the right. Two columns share the paper's 600-wide text area.
        const labelX = portrait ? PORTRAIT_SIDE * S : centerX - 300 * S;
        const valueX = portrait ? this.scale.width - PORTRAIT_SIDE * S : centerX + 300 * S;
        const columnWidth = 285 * S;
        truckLog.forEach((truck, index) => {
            const column = index % truckColumns;
            const y = panelTop + (headerHeight + Math.floor(index / truckColumns) * rowHeight) * S;
            const left = truckColumns === 1 ? labelX : labelX + column * (valueX - labelX - columnWidth);
            const right = truckColumns === 1 ? valueX : left + columnWidth;
            const style = {
                fontFamily: 'Fredoka, Arial', fontStyle: '400',
                fontSize: (portrait ? portraitFont(32) : truckColumns === 1 ? 29 : 24) * S,
                color: truck.overtime ? TOTAL_COLOR : '#3a362f',
            };
            const name = economy.tiers[truck.tier].name;
            this.add.text(left, y, `${truck.overtime ? 'Overtime' : `Truck ${index + 1}`} \u00b7 ${name}`, style).setOrigin(0, 0.5);
            addMoneyText(this, right, y, truck.amount, { ...style, align: 'right' });
        });

        // ---- The single lines under them.
        singles.forEach((row, index) => {
            const y = panelTop + (headerHeight + (truckRows + index) * rowHeight) * S;

            if (row.total)
            {
                // A thin rule above the total, like the sum line on a receipt.
                this.add.rectangle(centerX, y - (rowHeight / 2) * S, (portrait ? 520 : 600) * S, 2 * S, 0xcfc3a8);
            }

            const style = {
                fontFamily: row.total || row.notice ? 'Fredoka, Arial Black' : 'Fredoka, Arial',
                fontStyle: row.total || row.notice || row.balance ? '700' : '400',
                fontSize: (portrait ? portraitFont(row.total ? 38 : row.notice ? 34 : 32) : row.total ? 34 : row.notice ? 30 : 29) * S,
                color: row.color ?? '#3a362f',
            };
            if (row.notice)
            {
                this.add.text(centerX, y, row.label, style).setOrigin(0.5);
                return;
            }
            this.add.text(labelX, y, row.label, style).setOrigin(0, 0.5);
            addMoneyText(this, valueX, y, row.money, { ...style, prefix: row.prefix, align: 'right' });
        });

        if (data.isLastLevel)
        {
            this.add
                .text(centerX, panelTop + (headerHeight + (rowCount - 1) * rowHeight + noteRoom) * S, "That's every level - great work!", {
                    fontFamily: 'Fredoka, Arial', fontStyle: '400',
                    fontSize: (portrait ? 24 : 22) * S,
                    color: '#6b6354',
                })
                .setOrigin(0.5);
        }

        // ---- Three picture buttons in a row (the labels are painted into the pictures). Their widths
        // differ, so they're laid out from those: centred as a group with an even gap between them.
        const buttonY = panelTop + buttonsOffset * S;
        const BUTTON_HEIGHT = portrait ? PORTRAIT_BUTTON_HEIGHT : 78; // design px (height of the painted button)
        const BUTTON_GAP = 20 * S;
        const lastButton = data.isLastLevel
            ? ['button-finish', () => {
                this.scene.stop('PuzzleScene');
                this.scene.start('TitleScene');
            }]
            : ['button-next-day', () => {
                // Stop PuzzleScene explicitly so the next day gets a brand-new instance
                // (clean Grid, new PieceViews) rather than leftovers from the last truck.
                this.scene.stop('PuzzleScene');
                // (Nothing is saved here: the save was written when this results screen appeared, and it
                // already names the next day, and the paycheck log was cleared with it.)
                // The next day may open with a promotion screen and/or a bonus screen before its
                // gameplay (see dayFlow.js); with neither, this goes straight to its first truck.
                startDay(this, data.levelIndex + 1);
            }];
        const specs = [
            ['button-shop', () => this.scene.start('ShopScene', data)],
            ['button-decorate', () => this.scene.start('ApartmentScene', data)],
            lastButton,
        ];
        const buttons = specs.map(([texture]) => addImageButton(this, 0, buttonY, texture, BUTTON_HEIGHT, true));
        const groupWidth = buttons.reduce((sum, button) => sum + button.visibleWidth, 0) + BUTTON_GAP * (buttons.length - 1);
        let cursorX = centerX - groupWidth / 2;
        // The first day leads the player by the hand (see core/ftueTrail.js): first the Shop button
        // pulses, with the hand cursor pressing it over and over, until it is pressed; then (on coming
        // back with the clock bought) the Decorate button does. While a step is pending, the buttons
        // that would skip it - Next Day always, Decorate before the shop - are dimmed and dead.
        const firstDay = data.levelIndex === 0;
        const wallet = getEconomyState(this.registry);
        const stage = ftueTrailStage({
            day: data.levelIndex + 1,
            ownedItems: wallet.ownedItems,
            clockBuyable: shopStatus(FTUE_ITEM_ID, data.levelIndex + 1, wallet, economy) === 'buyable',
            decorateVisited: this.registry.get('decorateVisited') ?? false,
            skipped: Boolean(this.registry.get('tutorialSkipped')),
        });
        /** Index of the button the trail wants pressed now (0 Shop, 1 Decorate), or -1 when the trail is over. */
        const guided = stage === 'shop' ? 0 : stage === 'decorate' ? 1 : -1;
        /** The hand cursor demonstrating the press on the guided button, if any. */
        let handCursor = null;
        const lastLineY = headerHeight + (rowCount - 1) * rowHeight + noteRoom;
        const stackTop = Math.min(
            (lastLineY + PORTRAIT_BUTTON_BELOW_TEXT) * S,
            this.scale.height - (PORTRAIT_BUTTON_FROM_BOTTOM + (specs.length - 1) * PORTRAIT_BUTTON_PITCH) * S
        );
        buttons.forEach((button, i) => {
            if (portrait)
            {
                // Stacked in a column, Shop at the top and the last button lowest, all centred: the top one just
                // under the last line of the report (but the stack never goes lower than PORTRAIT_BUTTON_FROM_BOTTOM).
                button.setPosition(centerX, stackTop + i * PORTRAIT_BUTTON_PITCH * S);
            }
            else
            {
                button.setX(cursorX + button.visibleWidth / 2);
                cursorX += button.visibleWidth + BUTTON_GAP;
            }

            const blocked = guided !== -1 && ((i === 2) || (i === 1 && guided === 0));
            if (blocked)
            {
                button.setAlpha(0.4).disableInteractive();
                return;
            }

            // addPulse must come before makePressable (see pulse.js).
            const pulse = i === guided ? addPulse(this, button) : null;
            if (pulse)
            {
                // Show the press: the fingertip lands on the button, a little above its middle - the
                // buttons sit near the bottom of the screen and the hand hangs below its fingertip, so
                // this keeps the whole hand on screen. Starts a moment after the screen has settled.
                handCursor = new GuideCursor(this, { depth: 900 });
                handCursor.playTap(() => ({ x: button.x, y: button.y - 22 * S }), { delay: 900 });
            }
            // Pressable only after positioning: it remembers the button's resting place.
            makePressable(this, button, () => {
                pulse?.stop();
                handCursor?.stop();
                if (i === 0) this.registry.set('shopVisited', true);
                if (i === 1) this.registry.set('decorateVisited', true);
                specs[i][1]();
            }, { delay: 140 });

            // The red dot on the button's corner: Shop when something can be bought now, Decorate when the
            // inventory holds an item the player has not seen yet (rules in core/badges.js). Added after the
            // button is positioned and pressable, and only on buttons that work (a locked one gets no dot).
            if (i === 0)
            {
                addBadgeToImage(this, button, shopHasBuyable(data.levelIndex + 1, wallet, economy));
            }
            else if (i === 1)
            {
                addBadgeToImage(this, button, apartmentHasNew(wallet.ownedItems, this.registry.get('seenItems') ?? []));
            }
        });

        // A returning player can skip the tutorial: the trail's pulse, hand and locks, and the worker's
        // tip. The screen is simply rebuilt, now with nothing guided on it.
        if (stage !== 'free' && isTutorialSkippable(this.registry))
        {
            addSkipButton(this, {
                // Landscape: the top-right corner of the paper. Portrait: on the empty paper just BELOW the
                // button stack (the stack now follows the report text closely), within thumb reach and a
                // finger-sized 100 tall.
                x: portrait ? this.scale.width - 200 * S : this.scale.width - 175 * S,
                y: portrait ? Math.min(buttons[2].y + (PORTRAIT_BUTTON_HEIGHT / 2 + 64) * S, this.scale.height - 110 * S) : 125 * S,
                height: portrait ? 84 : undefined,
                depth: 900,
                onSkip: () => {
                    skipTutorial(this.registry);
                    handCursor?.stop();
                    this.scene.restart(data);
                },
            });
        }

        // And the worker pipes up, once, in the lower-right corner.
        if (firstDay && !this.registry.get('shopTipShown'))
        {
            this.registry.set('shopTipShown', true);
            const width = portrait ? 560 : 480;
            const scale = portrait ? 1 : 1.05;
            showCornerTip(this, {
                message: 'Oh sweet, I can get some stuff for my room!',
                head: 'worker-head',
                // Big, so it is hard to miss: it covers the lower-right of the screen for a few seconds.
                // Landscape: the lower-right corner. Portrait: centred, low on the paper under the stacked buttons (they follow the report text closely, so above them is text).
                left: portrait ? (this.scale.width - width * scale * S) / 2 : this.scale.width - (12 + width * scale) * S,
                bottom: portrait ? this.scale.height - 100 * S : this.scale.height - 12 * S,
                width,
                scale,
            });
        }
    }
}
