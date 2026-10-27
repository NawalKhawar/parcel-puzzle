import { Scene, Textures } from 'phaser';

import { loadItems } from '../../data/loadItems.js';
import itemsRaw from '../../data/items.json';
import { loadWallpapers } from '../../data/loadWallpapers.js';
import wallpapersRaw from '../../data/wallpapers.json';
import { makePressable } from '../objects/pressFeedback.js';
import { addPulse } from '../objects/pulse.js';
import { addImageButton } from '../objects/imageButton.js';
import { MoneyHud } from '../objects/MoneyHud.js';
import { addMoneyText } from '../objects/money.js';
import { addFittedIcon } from '../objects/artBounds.js';
import { UI_SCALE } from '../uiScale.js';
import { playBgm, playSfx, GAMEPLAY_BGM_VOLUME } from '../audio.js';
import { economy, getEconomyState, setEconomyState } from '../economy.js';
import { shopStatus, purchaseItem } from '../../core/economy.js';
import { ftueTrailStage, FTUE_ITEM_ID } from '../../core/ftueTrail.js';
import { saveProgress, isTutorialSkippable, skipTutorial } from '../progress.js';
import { addSkipButton } from '../objects/skipButton.js';
import { showShopNotice } from '../objects/OfferPopup.js';

/**
 * ShopScene.js
 *
 * The shop, reached from the "Shop" button on the end-of-day popup (DayCompleteScene). What it sells,
 * for how much and from which day is the shop list in src/data/economy.json; the item's look
 * (art, footprint, colour) comes from the catalogues src/data/items.json and wallpapers.json. Items
 * switched off in the economy list (the luxury placeholders with no art yet) are not shown.
 *
 * The items are shown as pages of horizontal cards, each laid out the same way: the item's icon on
 * the left (with padding all round), its name beside it, and its price - the currency note icon
 * then the amount - under the name in a slightly smaller size. The left/right arrow buttons beside
 * the panel - or the keyboard's arrow keys - flip between pages. The player's money is shown in
 * the top-right corner, in the same HUD as the gameplay screen but a little larger.
 *
 * Clicking a card BUYS the item (core/economy.purchaseItem) if the day has reached its unlock day and the
 * wallet covers it: the price is taken, the cash register rings, and the card changes to "Owned"
 * (items are bought once; owned items then appear in the apartment's inventory). A card for an
 * item that is not unlocked yet is dimmed and says when it unlocks; one that costs too much has its
 * price in red. Clicking either shakes the card and says why. Back returns to the end-of-day popup.
 *
 * First-day trail (core/ftueTrail.js): on day 1, until the clock is bought, the clock's card pulses,
 * every other card, the tabs, the page arrows and the Back arrow are dead and dimmed, so the player
 * can neither buy something else nor leave without it. Buying the clock lifts all of that.
 */

const S = UI_SCALE;

/** The panel the cards sit in, centred horizontally. Enlarged to accommodate bigger cards. */
const PANEL = { y: 88 * S, width: 1060 * S, height: 524 * S, padding: 20 * S };
/** How the cards are laid out on a page. Larger cards with bigger text. */
const CARD = {
    width: 330 * S, height: 150 * S, gap: 16 * S, columns: 3, rows: 3,
    // Space between the card's edge and its contents, left/top/bottom: the icon never touches the border.
    padding: 16 * S,
    // Space between the icon and the name.
    iconGap: 18 * S,
    cornerRadius: 18 * S,
};
const ITEMS_PER_PAGE = CARD.columns * CARD.rows;
/** The side of the square the icon is fitted into: the card's height less its padding top and bottom. */
const ICON_SIZE = CARD.height - 2 * CARD.padding;

/** The line shown under the page number when there is nothing more pressing to say. */
const SHOP_HINT = 'Click on the arrows to see more items';

/** The line shown instead of it while the first-day trail has the player buying the clock. */
const GUIDE_HINT = 'Buy the clock to continue!';

/** The shop's money HUD is the gameplay one drawn this many times larger. */
const MONEY_HUD_SCALE = 1.35;

export class ShopScene extends Scene
{
    constructor ()
    {
        super('ShopScene');
    }

    /**
     * @param {Object} data - the DayCompleteScene data payload, handed back untouched by Back - or, when
     *   opened from the pause menu, { levelIndex, returnTo: { scene, data } }, where Back goes to `returnTo`.
     */
    init (data)
    {
        this.dayCompleteData = data;
        /** The day being shopped on (1-based): what unlocks is decided by it. */
        this.day = (data && typeof data.levelIndex === 'number' ? data.levelIndex : 0) + 1;
        /** The card currently on screen for each item id, so a purchase can make its card bounce. */
        this.cardGroups = new Map();
        // The scene object is reused on every visit, so forget the previous visit's page (a destroyed
        // container left here would make showPage(0) think page 0 is already drawn and show nothing).
        this.pageContainer = null;
        this.messageTimer = null;
        /** The page currently shown, from 0. */
        this.page = 0;
        /** Whether showing wallpapers ('wallpapers') or furniture ('items'). */
        this.section = 'items';
        /** True while the first-day trail has the player buying the clock (see create). */
        this.guideActive = false;
        /** The page the clock is on - the only page shown while the trail is active. */
        this.guidePage = 0;
        /** The pulse on the clock's card while the trail is active. */
        this.guidePulse = null;
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0xf5ead6);
        // The same music as gameplay (a no-op if it is already playing).
        playBgm(this, 'gameplay-bgm', GAMEPLAY_BGM_VOLUME);
        // The paused PuzzleScene is still rendered underneath, so cover the canvas.
        this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xf5ead6);

        // What is on sale: the economy's shop list (enabled entries only), each joined with its art
        // from the item / wallpaper catalogue. What is unlocked today comes first, cheapest first,
        // then the not-yet-unlocked items (also cheapest first), so today's choices are never buried
        // behind greyed-out cards. Wallpapers get their own tab.
        const art = new Map([...loadItems(itemsRaw), ...loadWallpapers(wallpapersRaw)].map((entry) => [entry.id, entry]));
        const isLocked = (entry) => Number(entry.unlockDay > this.day);
        const forSale = economy.shop
            .filter((entry) => entry.enabled)
            .map((entry) => ({ ...art.get(entry.id), ...entry }))
            .sort((a, b) => isLocked(a) - isLocked(b) || a.price - b.price || a.unlockDay - b.unlockDay);
        this.items = forSale.filter((entry) => entry.category !== 'wallpaper');
        this.wallpapers = forSale.filter((entry) => entry.category === 'wallpaper');

        // Update page counts for both sections.
        this.updatePageCount();

        // Is the first-day trail at its shop step? Then the clock must be bought before anything else.
        const wallet = getEconomyState(this.registry);
        const clockIndex = this.items.findIndex((entry) => entry.id === FTUE_ITEM_ID);
        // (Never when the shop was opened from the pause menu: the trail belongs to the end of the day.)
        this.guideActive = clockIndex >= 0 && !this.dayCompleteData?.returnTo && ftueTrailStage({
            day: this.day,
            ownedItems: wallet.ownedItems,
            clockBuyable: shopStatus(FTUE_ITEM_ID, this.day, wallet, economy) === 'buyable',
            decorateVisited: this.registry.get('decorateVisited') ?? false,
            skipped: Boolean(this.registry.get('tutorialSkipped')),
        }) === 'shop';
        // Open on the page the clock is on (it is the only page the player can see until it is bought).
        this.guidePage = this.guideActive ? Math.floor(clockIndex / ITEMS_PER_PAGE) : 0;

        // Centre the panel horizontally (the design width is 1280, wider than the panel).
        this.panelX = (this.scale.width - PANEL.width) / 2;

        // Back is the previous-page arrow picture, in the top-left corner.
        const backButton = addImageButton(this, 24 * S + 30 * S, 24 * S + 38 * S, 'button-page-prev', 76);
        this.backButton = backButton;
        makePressable(this, backButton, () => {
            // Opened from the pause menu: back to the truck that was being played. Otherwise the report.
            const back = this.dayCompleteData?.returnTo;
            if (back)
            {
                this.scene.start(back.scene, back.data);
            }
            else
            {
                this.scene.start('DayCompleteScene', this.dayCompleteData);
            }
        }, { delay: 120 });
        if (this.guideActive)
        {
            // No leaving until the clock is bought; endGuide() switches it back on.
            backButton.setAlpha(0.4);
            backButton.input.enabled = false;
        }

        this.add
            .text(this.scale.width / 2, 48 * S, 'Shop', {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: 32 * S,
                color: '#3a362f',
            })
            .setOrigin(0.5);

        // Tabs either side of the title: Furniture and Wallpapers, rounded like the cards.
        this.tabs = {};
        for (const [section, label, dx] of [['items', 'Furniture', -190], ['wallpapers', 'Wallpapers', 190]])
        {
            const width = 140 * S;
            const height = 40 * S;
            const background = this.add.graphics();
            const text = this.add
                .text(0, 0, label, { fontFamily: 'Fredoka, Arial Black', fontStyle: '700', fontSize: 20 * S, color: '#3a362f' })
                .setOrigin(0.5);
            const tab = this.add.container(this.scale.width / 2 + dx * S, 48 * S, [background, text]);
            tab.setSize(width, height).setInteractive({ useHandCursor: true });
            makePressable(this, tab, () => this.showSection(section));
            this.tabs[section] = { tab, background, width, height };
            if (this.guideActive)
            {
                tab.setAlpha(0.5);
            }
        }

        // The player's money, top-right: the gameplay HUD, larger.
        this.moneyHud = new MoneyHud(this, getEconomyState(this.registry).money, MONEY_HUD_SCALE);
        this.moneyHud.setPosition(this.scale.width - 24 * S - this.moneyHud.width, 16 * S);

        // The panel the item cards sit in.
        const panel = this.add.graphics();
        panel.fillStyle(0xfaf3e4, 1);
        panel.fillRoundedRect(this.panelX, PANEL.y, PANEL.width, PANEL.height, 14 * S);
        panel.lineStyle(2 * S, 0x3a362f, 1);
        panel.strokeRoundedRect(this.panelX, PANEL.y, PANEL.width, PANEL.height, 14 * S);

        this.createPageControls();
        if (this.guideActive)
        {
            this.hintText.setText(GUIDE_HINT).setColor('#b5472f');
        }
        this.showPage(this.guidePage);
        this.refreshTabs();

        // A returning player can skip the tutorial instead of buying the clock.
        this.skipButton = null;
        if (this.guideActive && isTutorialSkippable(this.registry))
        {
            this.skipButton = addSkipButton(this, {
                x: this.scale.width - 100 * S,
                y: this.scale.height - 48 * S,
                onSkip: () => this.skipGuide(),
            });
        }
    }

    /** Skip pressed: the tutorial is over, so the whole shop (and the way out) is free at once. */
    skipGuide ()
    {
        skipTutorial(this.registry);
        this.skipButton?.destroy();
        this.skipButton = null;
        this.endGuide();
        // Redraw the page so every card is live again, and put the usual hint line back.
        this.pageContainer.destroy();
        this.pageContainer = null;
        this.showPage(this.page);
        this.hintText.setText(SHOP_HINT).setColor('#6b6354');
        this.refreshTabs();
    }

    /**
     * Switches between the furniture and wallpaper listings, back to their first page.
     *
     * @param {'items' | 'wallpapers'} section
     */
    showSection (section)
    {
        if (section === this.section || this.guideActive)
        {
            return;
        }
        this.section = section;
        this.updatePageCount();
        // Drop the old page so showPage doesn't treat page 0 as "already shown".
        this.pageContainer?.destroy();
        this.pageContainer = null;
        this.showPage(0);
        this.refreshTabs();
    }

    /** Highlights the tab of the section being shown. */
    refreshTabs ()
    {
        for (const [section, { background, width, height }] of Object.entries(this.tabs))
        {
            background.clear();
            background.fillStyle(section === this.section ? 0xf0b86e : 0xe6dcc3, 1);
            background.fillRoundedRect(-width / 2, -height / 2, width, height, 12 * S);
        }
    }

    /**
     * Updates the page count for the current section (items or wallpapers).
     * Called when switching sections or initially in create().
     */
    updatePageCount ()
    {
        const items = this.section === 'items' ? this.items : this.wallpapers;
        this.pageCount = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
    }

    /**
     * Creates the left/right arrow buttons either side of the panel using image textures, the "Page N of M"
     * line and the hint under it, and hooks up the keyboard's arrow keys to do the same as the buttons.
     */
    createPageControls ()
    {
        const midY = PANEL.y + PANEL.height / 2;
        const makeArrow = (x, buttonTexture, delta) => {
            const arrow = addImageButton(this, x, midY, buttonTexture, 96);
            makePressable(this, arrow, () => this.showPage(this.page + delta));
            return arrow;
        };
        // Centred in the margin between the screen edge and the panel.
        this.prevArrow = makeArrow(this.panelX / 2, 'button-page-prev', -1);
        this.nextArrow = makeArrow(this.panelX + PANEL.width + this.panelX / 2, 'button-page-next', 1);

        this.pageText = this.add
            .text(this.scale.width / 2, PANEL.y + PANEL.height + 30 * S, '', {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: 18 * S,
                color: '#3a362f',
            })
            .setOrigin(0.5);
        /** The line under the page number: the usual hint, briefly replaced by "why not" messages. */
        this.hintText = this.add
            .text(this.scale.width / 2, PANEL.y + PANEL.height + 58 * S, SHOP_HINT, {
                fontFamily: 'Fredoka, Arial', fontStyle: '400',
                fontSize: 16 * S,
                color: '#6b6354',
            })
            .setOrigin(0.5);

        this.input.keyboard.on('keydown-LEFT', () => this.showPage(this.page - 1));
        this.input.keyboard.on('keydown-RIGHT', () => this.showPage(this.page + 1));
    }

    /**
     * Shows one page of cards, replacing the previous page. Asking for a page before the first or
     * after the last does nothing, so holding an arrow at the end just stays put.
     *
     * @param {number} page - from 0.
     */
    showPage (page)
    {
        if (page < 0 || page >= this.pageCount || (this.pageContainer && page === this.page) || (this.guideActive && page !== this.guidePage))
        {
            return;
        }
        this.page = page;
        if (this.pageContainer)
        {
            this.pageContainer.destroy();
        }
        this.pageContainer = this.add.container(0, 0);
        this.cardGroups.clear();

        // The grid of cards is centred in the panel, left to right then top to bottom.
        const gridWidth = CARD.columns * CARD.width + (CARD.columns - 1) * CARD.gap;
        const startX = this.panelX + (PANEL.width - gridWidth) / 2;
        const startY = PANEL.y + PANEL.padding;

        const items = this.section === 'items' ? this.items : this.wallpapers;
        const pageItems = items.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
        pageItems.forEach((item, i) => {
            const x = startX + (i % CARD.columns) * (CARD.width + CARD.gap);
            const y = startY + Math.floor(i / CARD.columns) * (CARD.height + CARD.gap);
            this.addCard(item, x, y, this.section);
        });

        const sectionLabel = this.section === 'items' ? 'Furniture' : 'Wallpapers';
        this.pageText.setText(`${sectionLabel} - Page ${page + 1} of ${this.pageCount}`);
        // Dim an arrow that has nowhere further to go.
        // (Both are dead while the first-day trail holds the player on the clock's page.)
        this.prevArrow.setAlpha(page > 0 && !this.guideActive ? 1 : 0.35);
        this.nextArrow.setAlpha(page < this.pageCount - 1 && !this.guideActive ? 1 : 0.35);
    }

    /**
     * Adds one card to the current page: a rounded horizontal card with the item/wallpaper's icon on the
     * left (inside CARD.padding on every side), the name to its right, and the price - note icon
     * then amount - just below the name in a slightly smaller size. The name and price block is
     * centred vertically on the card.
     *
     * For furniture: the icon is the item's own art if it has some (the visible part of the picture,
     * shrunk to fit its square and keeping its proportions), otherwise a plain block in the item's
     * colour shaped like its footprint.
     *
     * For wallpapers: the icon is a solid colour block.
     *
     * @param {import('../../data/loadItems.js').ItemDef | import('../../data/loadWallpapers.js').WallpaperDef} item
     * @param {number} x - card's top-left x.
     * @param {number} y - card's top-left y.
     * @param {'items' | 'wallpapers'} section - which section this card is in.
     */
    addCard (item, x, y, section = 'items')
    {
        // Where this item stands for the player today (owned / locked / too expensive / buyable).
        const status = shopStatus(item.id, this.day, getEconomyState(this.registry), economy);
        const card = this.add.graphics();
        card.fillStyle(status === 'owned' ? 0xdcebd0 : 0xf0e4cc, 1);
        card.fillRoundedRect(x, y, CARD.width, CARD.height, CARD.cornerRadius);
        card.lineStyle(2 * S, 0xcfc3a8, 1);
        card.strokeRoundedRect(x, y, CARD.width, CARD.height, CARD.cornerRadius);
        // Everything on the card is gathered in one list, then grouped so the whole card is one button.
        const parts = [card];

        // The icon, centred in its square (which starts CARD.padding in from the card's left edge).
        const iconCentreX = x + CARD.padding + ICON_SIZE / 2;
        const iconCentreY = y + CARD.height / 2;

        if (section === 'wallpapers')
        {
            // Wallpaper: solid colour block.
            card.fillStyle(parseInt(item.color.slice(1), 16), 1);
            card.fillRect(
                iconCentreX - ICON_SIZE / 2,
                iconCentreY - ICON_SIZE / 2,
                ICON_SIZE,
                ICON_SIZE
            );
        }
        else if (this.textures.exists(item.sprite))
        {
            // Furniture with art: smooth filtering for shrunk art.
            // (The apartment sets its own filter again whenever it is opened.)
            this.textures.get(item.sprite).setFilter(Textures.FilterMode.LINEAR);
            // Fitted by the picture's visible part, so a small picture on a big canvas still fills the square.
            parts.push(addFittedIcon(this, item.sprite, iconCentreX, iconCentreY, ICON_SIZE, ICON_SIZE));
        }
        else
        {
            // Furniture without art: colour block shaped like footprint.
            const { w, h } = item.footprint;
            const cell = (ICON_SIZE * 0.8) / Math.max(w, h);
            card.fillStyle(parseInt(item.color.slice(1), 16), 1);
            card.fillRect(iconCentreX - (w * cell) / 2, iconCentreY - (h * cell) / 2, w * cell, h * cell);
        }

        // Name, then price below it; both left-aligned at the same x, to the right of the icon.
        const textX = x + CARD.padding + ICON_SIZE + CARD.iconGap;
        const textWidth = x + CARD.width - CARD.padding - textX;
        const name = this.add
            .text(textX, y + CARD.height / 2 - 4 * S, item.name, {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: 26 * S,
                color: '#3a362f',
                wordWrap: { width: textWidth },
            })
            .setOrigin(0, 1);
        // Under the name: the price (red when the wallet is short), or why there is no price to pay.
        const lineStyle = { fontFamily: 'Fredoka, Arial', fontStyle: '600', fontSize: 22 * S };
        let line;
        if (status === 'owned')
        {
            line = this.add.text(textX, y + CARD.height / 2 + 20 * S, 'Owned', { ...lineStyle, fontStyle: '700', color: '#3f7d4e' }).setOrigin(0, 0.5);
        }
        else if (status === 'locked')
        {
            line = this.add.text(textX, y + CARD.height / 2 + 20 * S, `Unlocks Day ${item.unlockDay}`, { ...lineStyle, color: '#8a8272' }).setOrigin(0, 0.5);
        }
        else
        {
            line = addMoneyText(this, textX, y + CARD.height / 2 + 20 * S, item.price, { ...lineStyle, color: status === 'too-expensive' ? '#b5472f' : '#6b6354' });
        }
        parts.push(name, line);

        // Group the parts into a container centred on the card (shifting each part by the same
        // amount, so nothing moves on screen) so the card can grow on hover and squash on press as a
        // whole, and shake or bounce when it is clicked.
        const centreX = x + CARD.width / 2;
        const centreY = y + CARD.height / 2;
        const group = this.add.container(centreX, centreY);
        for (const part of parts)
        {
            part.x -= centreX;
            part.y -= centreY;
            group.add(part);
        }
        group.setSize(CARD.width, CARD.height);
        if (this.guideActive && item.id !== FTUE_ITEM_ID)
        {
            // First-day trail: everything but the clock is dimmed and cannot be pressed.
            group.setAlpha(0.45);
        }
        else
        {
            group.setInteractive({ useHandCursor: true });
            if (status === 'locked')
            {
                group.setAlpha(0.55);
            }
            // The clock's card pulses to say "this one" (addPulse must come before makePressable).
            if (this.guideActive)
            {
                this.guidePulse = addPulse(this, group);
            }
            makePressable(this, group, () => this.onCardPressed(item, status, group));
        }
        this.pageContainer.add(group);
        this.cardGroups.set(item.id, group);
    }

    /**
     * A card was clicked: buy the item if it can be bought; otherwise shake the card and say why.
     *
     * @param {Object} item - the shop entry joined with its art.
     * @param {string} status - from core/economy.shopStatus when the page was drawn.
     * @param {import('phaser').GameObjects.Container} group - the card that was clicked.
     */
    onCardPressed (item, status, group)
    {
        if (status === 'owned')
        {
            return;
        }
        if (status === 'buyable')
        {
            this.buy(item);
            return;
        }
        this.shake(group);
        // The card shakes AND the sad worker's popup says why: not unlocked yet, or how much more money is needed.
        if (status === 'locked')
        {
            showShopNotice(this, { itemName: item.name, unlockDay: item.unlockDay });
            return;
        }
        showShopNotice(this, { itemName: item.name, shortBy: item.price - getEconomyState(this.registry).money });
    }

    /**
     * Buys an item: takes its price, rings the cash register, floats the price off the money HUD
     * and redraws the page so the card reads "Owned" (and other cards' affordability is right).
     *
     * @param {Object} item - the shop entry joined with its art.
     */
    buy (item)
    {
        const purchase = purchaseItem(getEconomyState(this.registry), item.id, this.day, economy);
        if (!purchase.ok)
        {
            return;
        }
        setEconomyState(this.registry, purchase.state);
        saveProgress(this.registry); // a purchase
        playSfx(this, 'cash-register');
        this.moneyHud.setAmount(purchase.state.money);
        this.floatSpent(item.price);

        // Buying the clock ends the first-day trail's shop step (before the page is redrawn, so the
        // pulse is stopped while its card still exists and the redraw makes every card normal again).
        const endedGuide = this.guideActive && item.id === FTUE_ITEM_ID;
        if (endedGuide)
        {
            this.endGuide();
        }

        // Redraw the current page in place, then make the bought card bounce.
        this.pageContainer.destroy();
        this.pageContainer = null;
        this.showPage(this.page);
        const bought = this.cardGroups.get(item.id);
        if (bought)
        {
            this.tweens.add({ targets: bought, scale: { from: 1.14, to: 1 }, duration: 320, ease: 'Back.easeOut' });
        }
        this.say(endedGuide ? `You bought the ${item.name}! Press the arrow to go back.` : `You bought the ${item.name}!`, '#3f7d4e');
    }

    /** Ends the first-day trail's shop step: stops the clock's pulse and gives the player the whole shop (and the way out) back. */
    endGuide ()
    {
        this.guidePulse?.stop();
        this.guidePulse = null;
        this.guideActive = false;
        this.backButton.setAlpha(1);
        this.backButton.input.enabled = true;
        for (const { tab } of Object.values(this.tabs))
        {
            tab.setAlpha(1);
        }
    }

    /** A quick side-to-side shake: "no". */
    shake (group)
    {
        const baseX = group.x;
        this.tweens.add({ targets: group, x: { from: baseX - 8 * S, to: baseX + 8 * S }, duration: 55, yoyo: true, repeat: 2, onComplete: () => group.setX(baseX) });
    }

    /**
     * Shows a short message on the hint line under the page number, then puts the usual hint back.
     *
     * @param {string} message
     * @param {string} color
     */
    say (message, color)
    {
        this.hintText.setText(message).setColor(color);
        this.messageTimer?.remove(false);
        this.messageTimer = this.time.delayedCall(2200, () => this.hintText.setText(SHOP_HINT).setColor('#6b6354'));
    }

    /** The price just paid, floating down-and-away from the money HUD in red: "-[note] 40". */
    floatSpent (amount)
    {
        const text = addMoneyText(this, this.moneyHud.panel.x + this.moneyHud.width / 2, this.moneyHud.panel.y + this.moneyHud.height + 14 * S, amount, {
            fontFamily: 'Fredoka, Arial Black', fontStyle: '700', fontSize: 26 * S, color: '#b5472f', prefix: '-', align: 'center',
        });
        this.tweens.add({ targets: text, y: text.y + 40 * S, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => text.destroy() });
    }
}
