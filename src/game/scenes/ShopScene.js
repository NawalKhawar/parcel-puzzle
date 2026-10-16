import { Scene } from 'phaser';

import { loadShop } from '../../data/loadApartment.js';
import shopRaw from '../../data/shop.json';
import { UI_SCALE } from '../uiScale.js';

/**
 * ShopScene.js
 *
 * The shop, reached from the "Shop" button on the end-of-day popup (DayCompleteScene).
 * Three horizontal tabs along the top - Clothes, Accessories, Decor - each showing a grid
 * of placeholder item boxes with a label. The tabs and their items come from
 * src/data/shop.json, so adding a tab or an item is a data change, not a code change.
 *
 * This is deliberately only the basic UI: the boxes are placeholders and nothing can be
 * bought yet. Back returns to the end-of-day popup it came from.
 */

const S = UI_SCALE;

const TAB = { width: 220 * S, height: 52 * S, gap: 12 * S, y: 104 * S };
const PANEL = { x: 120 * S, y: 172 * S, width: 784 * S, height: 440 * S };
const ITEM_BOX = { size: 160 * S, gap: 24 * S, columns: 4 };

const TAB_SELECTED_COLOR = 0xf0b86e;
const TAB_IDLE_COLOR = 0xe8dcc4;

export class ShopScene extends Scene
{
    constructor ()
    {
        super('ShopScene');
    }

    /**
     * @param {Object} data - the DayCompleteScene data payload, handed back untouched by Back.
     */
    init (data)
    {
        this.dayCompleteData = data;
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0xf5ead6);
        // The paused PuzzleScene is still rendered underneath, so cover the canvas.
        this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xf5ead6);

        this.shop = loadShop(shopRaw);

        const backButton = this.add
            .text(24 * S, 24 * S, '< Back', {
                fontFamily: 'Arial Black',
                fontSize: 22 * S,
                color: '#3a362f',
                backgroundColor: '#f0b86e',
                padding: { x: 16 * S, y: 8 * S },
            })
            .setInteractive({ useHandCursor: true });
        backButton.on('pointerdown', () => {
            this.scene.start('DayCompleteScene', this.dayCompleteData);
        });

        this.add
            .text(this.scale.width / 2, 40 * S, 'Shop', {
                fontFamily: 'Arial Black',
                fontSize: 32 * S,
                color: '#3a362f',
            })
            .setOrigin(0.5);

        this.add
            .text(this.scale.width - 24 * S, 24 * S, `$${this.registry.get('totalEarned') ?? 0}`, {
                fontFamily: 'Arial Black',
                fontSize: 18 * S,
                color: '#3a362f',
                backgroundColor: '#f6dca0',
                padding: { x: 14 * S, y: 8 * S },
            })
            .setOrigin(1, 0);

        // The panel the item boxes sit in, drawn once; only the boxes inside it change per tab.
        const panel = this.add.graphics();
        panel.fillStyle(0xfaf3e4, 1);
        panel.fillRoundedRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 14 * S);
        panel.lineStyle(2 * S, 0x3a362f, 1);
        panel.strokeRoundedRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 14 * S);

        this.createTabs();

        /** Objects belonging to the currently shown tab's item grid, destroyed on a tab change. */
        this.contentObjects = [];
        this.selectTab(0);
    }

    /**
     * Creates the tab buttons in a horizontal row, centred on the screen. Each is a filled
     * rectangle with a centred label; selectTab() recolours them to show which is active.
     */
    createTabs ()
    {
        const tabs = this.shop.tabs;
        const totalWidth = tabs.length * TAB.width + (tabs.length - 1) * TAB.gap;
        const startX = (this.scale.width - totalWidth) / 2;

        /** @type {Array<{background: import('phaser').GameObjects.Rectangle}>} */
        this.tabButtons = tabs.map((tab, index) => {
            const x = startX + index * (TAB.width + TAB.gap) + TAB.width / 2;
            const background = this.add
                .rectangle(x, TAB.y + TAB.height / 2, TAB.width, TAB.height, TAB_IDLE_COLOR)
                .setStrokeStyle(2 * S, 0x3a362f)
                .setInteractive({ useHandCursor: true });
            this.add
                .text(x, TAB.y + TAB.height / 2, tab.label, {
                    fontFamily: 'Arial Black',
                    fontSize: 22 * S,
                    color: '#3a362f',
                })
                .setOrigin(0.5);
            background.on('pointerdown', () => this.selectTab(index));
            return { background };
        });
    }

    /**
     * Shows one tab: highlights its button, and replaces the item grid with that tab's
     * placeholder boxes (a label centred in an empty box).
     *
     * @param {number} index - which tab, in the order they appear in shop.json.
     */
    selectTab (index)
    {
        this.tabButtons.forEach((button, i) => {
            button.background.setFillStyle(i === index ? TAB_SELECTED_COLOR : TAB_IDLE_COLOR);
        });

        for (const object of this.contentObjects)
        {
            object.destroy();
        }
        this.contentObjects = [];

        const items = this.shop.tabs[index].items;
        const gridWidth = ITEM_BOX.columns * ITEM_BOX.size + (ITEM_BOX.columns - 1) * ITEM_BOX.gap;
        const startX = PANEL.x + (PANEL.width - gridWidth) / 2;
        const startY = PANEL.y + 28 * S;

        items.forEach((item, i) => {
            const column = i % ITEM_BOX.columns;
            const row = Math.floor(i / ITEM_BOX.columns);
            const x = startX + column * (ITEM_BOX.size + ITEM_BOX.gap) + ITEM_BOX.size / 2;
            const y = startY + row * (ITEM_BOX.size + ITEM_BOX.gap) + ITEM_BOX.size / 2;

            const box = this.add
                .rectangle(x, y, ITEM_BOX.size, ITEM_BOX.size, 0xf0e4cc)
                .setStrokeStyle(2 * S, 0xcfc3a8);
            const label = this.add
                .text(x, y, item.name, {
                    fontFamily: 'Arial',
                    fontSize: 18 * S,
                    color: '#3a362f',
                    align: 'center',
                    wordWrap: { width: ITEM_BOX.size - 20 * S },
                })
                .setOrigin(0.5);
            this.contentObjects.push(box, label);
        });
    }
}
