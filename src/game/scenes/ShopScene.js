import { Scene } from 'phaser';

import { loadShop } from '../../data/loadApartment.js';
import shopRaw from '../../data/shop.json';
import { makePressable } from '../objects/pressFeedback.js';
import { UI_SCALE } from '../uiScale.js';

/**
 * ShopScene.js
 *
 * The shop, reached from the "Shop" button on the end-of-day popup (DayCompleteScene). It only
 * sells items for the apartment, so there are no categories or tabs: just one grid of labelled
 * item boxes. The items come from src/data/shop.json, so adding an item is a data change, not a
 * code change.
 *
 * This is deliberately only the basic UI: the boxes are placeholders and nothing can be bought
 * yet. Back returns to the end-of-day popup it came from.
 */

const S = UI_SCALE;

const PANEL = { y: 100 * S, width: 784 * S, height: 440 * S };
const ITEM_BOX = { size: 160 * S, gap: 24 * S, columns: 4 };

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

        const shop = loadShop(shopRaw);

        // Centre the panel horizontally (the design width is 1280, wider than the panel).
        this.panelX = (this.scale.width - PANEL.width) / 2;

        const backButton = this.add
            .text(24 * S, 24 * S, '< Back', {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: 22 * S,
                color: '#3a362f',
                backgroundColor: '#f0b86e',
                padding: { x: 16 * S, y: 8 * S },
            })
            .setInteractive({ useHandCursor: true });
        makePressable(this, backButton, () => {
            this.scene.start('DayCompleteScene', this.dayCompleteData);
        }, { delay: 120 });

        this.add
            .text(this.scale.width / 2, 40 * S, 'Shop', {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: 32 * S,
                color: '#3a362f',
            })
            .setOrigin(0.5);

        this.add
            .text(this.scale.width - 24 * S, 24 * S, `$${this.registry.get('totalEarned') ?? 0}`, {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: 18 * S,
                color: '#3a362f',
                backgroundColor: '#f6dca0',
                padding: { x: 14 * S, y: 8 * S },
            })
            .setOrigin(1, 0);

        // The panel the item boxes sit in.
        const panel = this.add.graphics();
        panel.fillStyle(0xfaf3e4, 1);
        panel.fillRoundedRect(this.panelX, PANEL.y, PANEL.width, PANEL.height, 14 * S);
        panel.lineStyle(2 * S, 0x3a362f, 1);
        panel.strokeRoundedRect(this.panelX, PANEL.y, PANEL.width, PANEL.height, 14 * S);

        this.createItemGrid(shop.items);
    }

    /**
     * Lays the items out as a grid of placeholder boxes (a label centred in an empty box),
     * left to right then top to bottom, centred in the panel.
     *
     * @param {Array<{id: string, name: string}>} items
     */
    createItemGrid (items)
    {
        const gridWidth = ITEM_BOX.columns * ITEM_BOX.size + (ITEM_BOX.columns - 1) * ITEM_BOX.gap;
        const startX = this.panelX + (PANEL.width - gridWidth) / 2;
        const startY = PANEL.y + 28 * S;

        items.forEach((item, i) => {
            const column = i % ITEM_BOX.columns;
            const row = Math.floor(i / ITEM_BOX.columns);
            const x = startX + column * (ITEM_BOX.size + ITEM_BOX.gap) + ITEM_BOX.size / 2;
            const y = startY + row * (ITEM_BOX.size + ITEM_BOX.gap) + ITEM_BOX.size / 2;

            this.add.rectangle(x, y, ITEM_BOX.size, ITEM_BOX.size, 0xf0e4cc).setStrokeStyle(2 * S, 0xcfc3a8);
            this.add
                .text(x, y, item.name, {
                    fontFamily: 'Fredoka, Arial', fontStyle: '400',
                    fontSize: 18 * S,
                    color: '#3a362f',
                    align: 'center',
                    wordWrap: { width: ITEM_BOX.size - 20 * S },
                })
                .setOrigin(0.5);
        });
    }
}
