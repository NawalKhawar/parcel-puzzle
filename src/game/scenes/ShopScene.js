import { Scene, Textures } from 'phaser';

import { loadItems } from '../../data/loadItems.js';
import itemsRaw from '../../data/items.json';
import { loadWallpapers } from '../../data/loadWallpapers.js';
import wallpapersRaw from '../../data/wallpapers.json';
import { makePressable } from '../objects/pressFeedback.js';
import { addPulse } from '../objects/pulse.js';
import { addImageButton } from '../objects/imageButton.js';
import { addPillButton } from '../objects/pillButton.js';
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
import { isPortrait } from '../layout.js';
import { addBadgeToBox } from '../objects/badge.js';
import { trackPurchase, trackShopOpened } from '../../analytics.js';
import { shopHasBuyable } from '../../core/badges.js';

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
 * The cards themselves are not buttons (they do not react to the mouse at all). Each card that can be
 * bought has a "Buy" button on it, and THAT is what grows when the mouse is over it and squashes when
 * pressed. Pressing Buy buys the item (core/economy.purchaseItem) if the day has reached its unlock day
 * and the wallet covers it: the price is taken, the cash register rings, and the card changes to "Owned"
 * (items are bought once; owned items then appear in the apartment's inventory). A card for an item that
 * is not unlocked yet is dimmed, says when it unlocks and has no Buy button; one that costs too much has
 * its price in red and a quieter Buy button that, when pressed, shakes the card and says how much more
 * money is needed. Back returns to the end-of-day popup.
 *
 * First-day trail (core/ftueTrail.js): on day 1, until the clock is bought, the clock's card has a gold
 * border and its Buy button pulses; every other card, the tabs, the page arrows and the Back arrow are
 * dead and dimmed, so the player can neither buy something else nor leave without it. Buying the clock
 * lifts all of that.
 *
 * On a phone (portrait) the cards are one wide column so the Buy button can be finger-sized.
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

/**
 * PORTRAIT (phone) layout. The canvas is 720 design px wide and 1000-1560 tall, shown at roughly half
 * size on a phone, so everything is big enough to tap: cards in two columns, tabs and arrows 68-88 px
 * tall. Only the HEIGHT varies between phones, so the number of card rows per page is worked out from
 * it (see buildLayout) and the page count follows.
 */
const PORTRAIT = {
    /** Panel: side margin, top (under the tabs) and the room kept under it for the page line, the hint line,
     *  the arrows and the tutorial Skip button. */
    panelMargin: 12 * S, panelTop: 204 * S, bottomRoom: 220 * S, panelPadding: 20 * S,
    // One wide column: icon on the left, name and price in the middle, a finger-sized Buy button on the right.
    // (The card's width is worked out from the panel's in buildLayout.)
    card: { height: 170 * S, gap: 16 * S, columns: 1, padding: 16 * S, iconGap: 16 * S, cornerRadius: 18 * S },
    /** The Buy button (design px): at least 76 tall so a finger can hit it. */
    buy: { width: 196, height: 84, fontSize: 36 },
    tab: { width: 300 * S, height: 80 * S, dx: 164 * S, y: 146 * S, fontSize: 30 * S },
    arrowSize: 88 * S,
};

/** The Buy button on a landscape card (design px): small enough to share the card's bottom row with the price. */
const BUY_LANDSCAPE = { width: 84, height: 38, fontSize: 22 };

/** Which shop categories each tab lists (the Furniture tab holds decor and furniture; luxury items would be there too). */
const TAB_CATEGORIES = { items: ['decor', 'furniture', 'luxury'], wallpapers: ['wallpaper'] };

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

    /**
     * Works out where everything goes for the current canvas shape. The landscape branch just collects
     * the original constants (so the landscape shop is exactly as it always was); the portrait branch
     * stacks the screen top to bottom - Back / title / money, tabs, the card panel, then the page line,
     * hint line, arrows and Skip button - sized for a phone and fitted to the canvas height.
     *
     * @returns {Object} every position and size the scene needs (design px already times UI_SCALE).
     */
    buildLayout ()
    {
        const { width, height } = this.scale;
        if (!isPortrait(this))
        {
            const panelX = (width - PANEL.width) / 2;
            const midY = PANEL.y + PANEL.height / 2;
            return {
                portrait: false,
                panel: { x: panelX, y: PANEL.y, width: PANEL.width, height: PANEL.height, padding: PANEL.padding },
                card: CARD,
                buy: BUY_LANDSCAPE,
                columns: CARD.columns,
                itemsPerPage: ITEMS_PER_PAGE,
                iconSize: ICON_SIZE,
                nameSize: 26 * S, lineSize: 22 * S,
                back: { x: 24 * S + 30 * S, y: 24 * S + 38 * S, height: 76 },
                title: { x: width / 2, y: 48 * S, size: 32 * S },
                tab: { width: 140 * S, height: 40 * S, dx: 190 * S, y: 48 * S, fontSize: 20 * S },
                money: { x: width - 24 * S, y: 16 * S },
                arrow: { size: 96, prevX: panelX / 2, nextX: panelX + PANEL.width + panelX / 2, y: midY },
                pageText: { y: PANEL.y + PANEL.height + 30 * S, size: 18 * S },
                hint: { y: PANEL.y + PANEL.height + 58 * S, size: 16 * S, wrap: 0 },
                skip: { x: width - 100 * S, y: height - 48 * S, height: undefined },
            };
        }

        const panelWidth = width - 2 * PORTRAIT.panelMargin;
        const panelHeight = height - PORTRAIT.panelTop - PORTRAIT.bottomRoom;
        // The card fills the panel's width (less its padding on both sides).
        const card = { ...PORTRAIT.card, width: panelWidth - 2 * PORTRAIT.panelPadding };
        // As many rows as fit (the panel's padding on top and bottom, a gap between rows); at least one.
        const rows = Math.max(1, Math.floor((panelHeight - 2 * PORTRAIT.panelPadding + card.gap) / (card.height + card.gap)));
        const panelBottom = PORTRAIT.panelTop + panelHeight;
        const arrowY = panelBottom + 110 * S;
        return {
            portrait: true,
            panel: { x: PORTRAIT.panelMargin, y: PORTRAIT.panelTop, width: panelWidth, height: panelHeight, padding: PORTRAIT.panelPadding },
            card,
            buy: PORTRAIT.buy,
            columns: card.columns,
            itemsPerPage: card.columns * rows,
            iconSize: card.height - 2 * card.padding,
            nameSize: 32 * S, lineSize: 28 * S,
            back: { x: 24 * S + 30 * S, y: 24 * S + 42 * S, height: 84 },
            title: { x: width / 2, y: 62 * S, size: 44 * S },
            tab: PORTRAIT.tab,
            money: { x: width - 16 * S, y: 28 * S },
            arrow: { size: 88, prevX: PORTRAIT.arrowSize * 0.5 + 12 * S, nextX: width - PORTRAIT.arrowSize * 0.5 - 12 * S, y: arrowY },
            pageText: { y: panelBottom + 32 * S, size: 24 * S },
            hint: { y: panelBottom + 68 * S, size: 22 * S, wrap: width - 48 * S },
            skip: { x: width / 2, y: arrowY, height: 84 },
        };
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0xf5ead6);
        trackShopOpened(); // analytics
        // Where everything goes for this canvas shape (landscape: the original numbers).
        this.ui = this.buildLayout();
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
        this.guidePage = this.guideActive ? Math.floor(clockIndex / this.ui.itemsPerPage) : 0;

        // The panel is centred horizontally (landscape: the design width is wider than the panel).
        this.panelX = this.ui.panel.x;

        // Back is the previous-page arrow picture, in the top-left corner.
        const backButton = addImageButton(this, this.ui.back.x, this.ui.back.y, 'button-page-prev', this.ui.back.height);
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
            .text(this.ui.title.x, this.ui.title.y, 'Shop', {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: this.ui.title.size,
                color: '#3a362f',
            })
            .setOrigin(0.5);

        // Tabs either side of the title: Furniture and Wallpapers, rounded like the cards.
        this.tabs = {};
        for (const [section, label, side] of [['items', 'Furniture', -1], ['wallpapers', 'Wallpapers', 1]])
        {
            const { width, height, dx, y, fontSize } = this.ui.tab;
            const background = this.add.graphics();
            const text = this.add
                .text(0, 0, label, { fontFamily: 'Fredoka, Arial Black', fontStyle: '700', fontSize, color: '#3a362f' })
                .setOrigin(0.5);
            const tab = this.add.container(this.scale.width / 2 + side * dx, y, [background, text]);
            tab.setSize(width, height).setInteractive({ useHandCursor: true });
            makePressable(this, tab, () => this.showSection(section));
            // A red dot on the tab when something in that section can be bought right now.
            const dot = addBadgeToBox(this, tab.x, tab.y, width, height, false, 60);
            this.tabs[section] = { tab, background, width, height, dot };
            if (this.guideActive)
            {
                tab.setAlpha(0.5);
            }
        }

        // The player's money, top-right: the gameplay HUD, larger.
        this.moneyHud = new MoneyHud(this, getEconomyState(this.registry).money, MONEY_HUD_SCALE);
        this.moneyHud.setPosition(this.ui.money.x - this.moneyHud.width, this.ui.money.y);

        // The panel the item cards sit in.
        const { x: panelX, y: panelY, width: panelW, height: panelH } = this.ui.panel;
        const panel = this.add.graphics();
        panel.fillStyle(0xfaf3e4, 1);
        panel.fillRoundedRect(panelX, panelY, panelW, panelH, 14 * S);
        panel.lineStyle(2 * S, 0x3a362f, 1);
        panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 14 * S);

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
                x: this.ui.skip.x,
                y: this.ui.skip.y,
                // (undefined = the button's default height, the landscape look; portrait asks for a finger-sized 84.)
                height: this.ui.skip.height,
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

    /** Highlights the tab of the section being shown, and lights the red dot on a tab with something buyable. */
    refreshTabs ()
    {
        const wallet = getEconomyState(this.registry);
        for (const [section, { background, width, height, dot }] of Object.entries(this.tabs))
        {
            dot.setVisible(shopHasBuyable(this.day, wallet, economy, TAB_CATEGORIES[section]));
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
        this.pageCount = Math.max(1, Math.ceil(items.length / this.ui.itemsPerPage));
    }

    /**
     * Creates the left/right arrow buttons either side of the panel using image textures, the "Page N of M"
     * line and the hint under it, and hooks up the keyboard's arrow keys to do the same as the buttons.
     */
    createPageControls ()
    {
        const { arrow: arrowLayout } = this.ui;
        const makeArrow = (x, buttonTexture, delta) => {
            const arrow = addImageButton(this, x, arrowLayout.y, buttonTexture, arrowLayout.size);
            makePressable(this, arrow, () => this.showPage(this.page + delta));
            return arrow;
        };
        // Landscape: centred in the margin between the screen edge and the panel, level with its middle.
        // Portrait: in the bottom corners, beside the page line and the hint.
        this.prevArrow = makeArrow(arrowLayout.prevX, 'button-page-prev', -1);
        this.nextArrow = makeArrow(arrowLayout.nextX, 'button-page-next', 1);

        this.pageText = this.add
            .text(this.scale.width / 2, this.ui.pageText.y, '', {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: this.ui.pageText.size,
                color: '#3a362f',
            })
            .setOrigin(0.5);
        /** The line under the page number: the usual hint, briefly replaced by "why not" messages. */
        this.hintText = this.add
            .text(this.scale.width / 2, this.ui.hint.y, SHOP_HINT, {
                fontFamily: 'Fredoka, Arial', fontStyle: '400',
                fontSize: this.ui.hint.size,
                color: '#6b6354',
                // (0 = no wrapping, the landscape behaviour; portrait wraps long messages inside the screen.)
                ...(this.ui.hint.wrap ? { wordWrap: { width: this.ui.hint.wrap }, align: 'center' } : {}),
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
        const { card, columns, itemsPerPage, panel } = this.ui;
        const gridWidth = columns * card.width + (columns - 1) * card.gap;
        const startX = panel.x + (panel.width - gridWidth) / 2;
        const startY = panel.y + panel.padding;

        const items = this.section === 'items' ? this.items : this.wallpapers;
        const pageItems = items.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
        pageItems.forEach((item, i) => {
            const x = startX + (i % columns) * (card.width + card.gap);
            const y = startY + Math.floor(i / columns) * (card.height + card.gap);
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
     * Adds one card to the current page: a rounded card with the item/wallpaper's icon on the left
     * (inside CARD.padding on every side) and its name beside it. What is under the name depends on the
     * item's status (core/economy.shopStatus):
     *
     *   - buyable       the price (note icon then amount) and a "Buy" button;
     *   - too-expensive the price in RED and a quieter (cream) Buy button - pressing it shakes the card and
     *                   says how much more money is needed;
     *   - locked        "Unlocks Day N" in grey, the card dimmed, and no button;
     *   - owned         "Owned" in green on a green card, and no button.
     *
     * The card itself is NOT interactive - it never grows or reacts to the mouse. Only the Buy button
     * does (hover growth and press squash from makePressable). Landscape: name on top, then a bottom row with the
     * price on the left and the small Buy button on the right. Portrait: one wide card, name and price in the
     * middle and a big finger-sized Buy button on the right.
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
        // This layout's card and icon sizes (landscape: the original constants).
        const CARD = this.ui.card;
        const ICON_SIZE = this.ui.iconSize;
        const portrait = this.ui.portrait;
        const status = shopStatus(item.id, this.day, getEconomyState(this.registry), economy);
        const isGuideCard = this.guideActive && item.id === FTUE_ITEM_ID;
        const card = this.add.graphics();
        card.fillStyle(status === 'owned' ? 0xdcebd0 : 0xf0e4cc, 1);
        card.fillRoundedRect(x, y, CARD.width, CARD.height, CARD.cornerRadius);
        // The first-day trail's card gets a thick gold border so it is easy to spot.
        card.lineStyle(isGuideCard ? 5 * S : 2 * S, isGuideCard ? 0xf0b030 : 0xcfc3a8, 1);
        card.strokeRoundedRect(x, y, CARD.width, CARD.height, CARD.cornerRadius);
        // Everything on the card is gathered in one list, then grouped so the whole card can be dimmed,
        // shaken and bounced as one.
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

        // Does this card carry a Buy button? (Owned and locked cards do not.)
        const hasBuyButton = status === 'buyable' || status === 'too-expensive';
        const BUY = this.ui.buy;
        const buyWidth = BUY.width * S;
        const buyHeight = BUY.height * S;

        // Name and price, left-aligned at the same x, to the right of the icon.
        const textX = x + CARD.padding + ICON_SIZE + CARD.iconGap;
        // Portrait: the text column stops before the Buy button (wide when there is no button).
        const textRight = portrait && hasBuyButton ? x + CARD.width - CARD.padding - buyWidth - 14 * S : x + CARD.width - CARD.padding;
        const textWidth = textRight - textX;
        // The price / status line sits level with the middle of the card in portrait; landscape puts it in a
        // bottom row (the same row as the Buy button) to leave room for the button under a two-line name.
        const lineY = portrait ? y + CARD.height / 2 + 24 * S : y + CARD.height - CARD.padding - (BUY.height / 2) * S;
        const name = this.add
            .text(textX, portrait ? y + CARD.height / 2 - 6 * S : y + (lineY - y - 19 * S) / 2 + 2 * S, item.name, {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: this.ui.nameSize,
                color: '#3a362f',
                wordWrap: { width: textWidth },
            })
            // Portrait: sits just above the middle line, growing upwards. Landscape: centred in the space above the bottom row.
            .setOrigin(0, portrait ? 1 : 0.5);
        // Under the name: the price (red when the wallet is short), or why there is no price to pay.
        const lineStyle = { fontFamily: 'Fredoka, Arial', fontStyle: '600', fontSize: this.ui.lineSize };
        let line;
        if (status === 'owned')
        {
            line = this.add.text(textX, lineY, 'Owned', { ...lineStyle, fontStyle: '700', color: '#3f7d4e' }).setOrigin(0, 0.5);
        }
        else if (status === 'locked')
        {
            line = this.add.text(textX, lineY, `Unlocks Day ${item.unlockDay}`, { ...lineStyle, color: '#8a8272' }).setOrigin(0, 0.5);
        }
        else
        {
            line = addMoneyText(this, textX, lineY, item.price, { ...lineStyle, color: status === 'too-expensive' ? '#b5472f' : '#6b6354' });
        }
        parts.push(name, line);

        // The Buy button: bottom-right of a landscape card, vertically centred on the right of a portrait one.
        let buyButton = null;
        if (hasBuyButton)
        {
            const buyX = x + CARD.width - CARD.padding - buyWidth / 2;
            const buyY = portrait ? y + CARD.height / 2 : lineY;
            buyButton = addPillButton(this, buyX, buyY, {
                width: BUY.width, height: BUY.height, label: 'Buy', fontSize: BUY.fontSize,
                // A cream button when the wallet is short: still pressable (it explains why not), but quieter.
                style: status === 'too-expensive' ? 'secondary' : 'primary',
            });
            parts.push(buyButton);
        }

        // Group the parts into a container centred on the card (shifting each part by the same
        // amount, so nothing moves on screen) so the card can be dimmed, shaken and bounced as a whole.
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
        // NOTE: the card group is deliberately NOT interactive - no hover growth, no click. Only the Buy button reacts.
        if (this.guideActive && item.id !== FTUE_ITEM_ID)
        {
            // First-day trail: everything but the clock is dimmed and its Buy button cannot be pressed.
            group.setAlpha(0.45);
        }
        else
        {
            if (status === 'locked')
            {
                group.setAlpha(0.55);
            }
            if (buyButton)
            {
                // The clock's Buy button pulses to say "this one" (addPulse must come before makePressable).
                if (this.guideActive)
                {
                    this.guidePulse = addPulse(this, buyButton);
                }
                makePressable(this, buyButton, () => this.onBuyPressed(item, status, group));
            }
        }
        this.pageContainer.add(group);
        this.cardGroups.set(item.id, group);
    }

    /**
     * A Buy button was pressed: buy the item if it can be bought; otherwise shake the card and say why.
     * (Locked and owned cards have no Buy button, but the checks are kept so this stays correct on its own.)
     *
     * @param {Object} item - the shop entry joined with its art.
     * @param {string} status - from core/economy.shopStatus when the page was drawn.
     * @param {import('phaser').GameObjects.Container} group - the card the button is on.
     */
    onBuyPressed (item, status, group)
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
        trackPurchase(item.id); // analytics
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
        this.refreshTabs(); // the wallet changed: a tab's red dot may go out
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
