import { Scene, Textures } from 'phaser';

import { RoomLayout, spriteRect, snapToTile } from '../../core/RoomLayout.js';
import { TILE, ROOM_W, ROOM_H, WALL_ROWS, HEADROOM_ROWS, PIXEL_ART } from '../../core/roomConfig.js';
import { loadItems } from '../../data/loadItems.js';
import { getEconomyState } from '../economy.js';
import { saveProgress, isTutorialSkippable, skipTutorial } from '../progress.js';
import { addSkipButton } from '../objects/skipButton.js';
import { GuideCursor } from '../objects/GuideCursor.js';
import { FTUE_ITEM_ID } from '../../core/ftueTrail.js';
import itemsRaw from '../../data/items.json';
import { loadWallpapers } from '../../data/loadWallpapers.js';
import wallpapersRaw from '../../data/wallpapers.json';
import { makePressable } from '../objects/pressFeedback.js';
import { addImageButton } from '../objects/imageButton.js';
import { showCornerTip } from '../objects/cornerTip.js';
import { playSfx, playBgm, GAMEPLAY_BGM_VOLUME } from '../audio.js';
import { addFittedIcon, getArtBounds } from '../objects/artBounds.js';
import { UI_SCALE } from '../uiScale.js';

/**
 * ApartmentScene.js
 *
 * The apartment: a top-down "3/4 oblique" room (Pokemon FireRed style), reached from the
 * "Decorate" button on the end-of-day popup (DayCompleteScene). The camera is fixed and flat:
 * square floor tiles, a back wall shown as a strip of tiles above the floor, and furniture
 * that shows its top plus its front face. Nothing is slanted and vertical edges stay vertical.
 *
 *   - Furniture waits in the inventory panel on the right and is dragged into the room. It
 *     snaps to whole tiles; a ghost on the footprint shows green (can go here) or red (can't).
 *   - Tapping a placed item sends it back to the inventory. Pressing and dragging moves it.
 *   - Dropping onto the panel puts an item away; dropping anywhere invalid puts it back where
 *     it came from.
 *   - Undo / Redo / Clear act on the whole layout.
 *
 * Where the logic lives (see "Architectural boundary" in PROJECT_STRUCTURE.md):
 *   - src/core/roomConfig.js  tile size, room size, wall rows, pixel-art flag.
 *   - src/core/RoomLayout.js  placement rules, draw order, picking, save/load, sprite maths.
 *   - src/data/items.json     the furniture catalogue (also what the shop sells).
 * This scene only turns those into pixels and mouse handling.
 *
 * SCALING. Everything in the room is drawn in "room pixels" (TILE per tile) and then multiplied
 * by one whole number, roomScale, so pixel art is never stretched by an awkward fraction. Room
 * pixel (px, py) is on screen at (roomX + px * roomScale, roomY + py * roomScale), where py = 0
 * is the top of the wall strip (see toScreen / toRoom).
 *
 * The layout is remembered between visits in the Phaser registry ('apartmentLayout'), and
 * cleared when a new game starts from the title screen.
 */

// All non-room pixel constants are in the 1280x720 design space, multiplied by UI_SCALE like the
// rest of src/game/ (see uiScale.js).
const S = UI_SCALE;

/** Gap kept above and below the room and the inventory panel (design px). */
const ROOM_MARGIN_Y = 8;

/** Rows drawn top to bottom: empty headroom (for tall sprites), the wall strip, then the floor. */
const TOTAL_ROWS = HEADROOM_ROWS + WALL_ROWS + ROOM_H;

/**
 * The biggest WHOLE-NUMBER scale at which the room (with its headroom) still fits the screen's
 * height. At the normal 1280x720 canvas that's 2 (a 896x704 room); on a high-DPI canvas
 * (UI_SCALE 2) it's 4, the same size on screen with twice the detail.
 */
const ROOM_SCALE = Math.max(1, Math.floor(((720 - 2 * ROOM_MARGIN_Y) * S) / (TOTAL_ROWS * TILE)));

const ROOM_SCREEN_W = ROOM_W * TILE * ROOM_SCALE;
const ROOM_SCREEN_H = (WALL_ROWS + ROOM_H) * TILE * ROOM_SCALE;

/** The buttons' column, left of the room (design px from the screen's left edge). */
const BUTTONS_X = 16 * S;
/** Right edge of that column: Undo + Redo side by side are 96px wide (the widest row). */
const BUTTONS_RIGHT = 112 * S;

/**
 * The bottom edge shared by the room and the inventory panel. The room (and so the panel) is as
 * tall as the screen allows, with the same margin above and below so it sits centred.
 */
const BOTTOM_Y = (720 - ROOM_MARGIN_Y) * S;

/**
 * The inventory: a narrow panel at the right edge, two slots across. It is exactly as tall as the
 * room and ends on the same line, so the two line up top and bottom.
 */
const PANEL = { x: (1280 - 16 - 232) * S, y: BOTTOM_Y - ROOM_SCREEN_H, width: 232 * S, height: ROOM_SCREEN_H };

/**
 * Top-left of the wall strip on screen. The room is the main thing on this screen: it is centred
 * in the space between the button column and the inventory, and ROOM_W (roomConfig.js) is chosen
 * to fill that space. Its bottom edge is BOTTOM_Y. Rounded so every tile edge lands on a whole pixel.
 */
const ROOM_X = Math.round((BUTTONS_RIGHT + PANEL.x) / 2 - ROOM_SCREEN_W / 2);
const ROOM_Y = BOTTOM_Y - ROOM_SCREEN_H;
const SLOT = { size: 104 * S, gap: 8 * S, firstY: PANEL.y + 48 * S, columns: 2 };
/** Left edge of the first slot, so the row of slots is centred in the panel. */
const SLOT_X = PANEL.x + (PANEL.width - (SLOT.columns * SLOT.size + (SLOT.columns - 1) * SLOT.gap)) / 2;
/** Height kept free at the bottom of the panel for the scroll arrows. */
const SCROLL_STRIP_HEIGHT = 44 * S;

/** Height of the Clear picture button (design px). */
const CLEAR_BUTTON_HEIGHT = 48;

/** Height of the Back picture button (design px). */
const BACK_BUTTON_HEIGHT = 60;
/** How many whole rows of slots fit; the inventory scrolls a row at a time (no clipping needed). */
const VISIBLE_SLOT_ROWS = Math.floor((PANEL.y + PANEL.height - SCROLL_STRIP_HEIGHT - SLOT.firstY + SLOT.gap) / (SLOT.size + SLOT.gap));

/** Colours of the ghost drawn on the footprint while dragging. */
const GHOST_VALID_COLOR = 0x6fd08c;
const GHOST_INVALID_COLOR = 0xe0605f;

/**
 * Draw depths. The room is at the bottom; placed items use PLACED_DEPTH_BASE + their index in
 * RoomLayout.drawOrder(); placeholder name labels sit above all furniture (so a rug's label isn't
 * hidden under the bed standing on it); the held item and its ghost on top.
 */
const WALL_DEPTH = 0;
const FLOOR_DEPTH = 1;
const PLACED_DEPTH_BASE = 10;
const LABEL_DEPTH = 800;
const HELD_DEPTH = 900;
const GHOST_DEPTH = 1000;
/** The first-day hand cursor: above the item being carried and its ghost. */
const GUIDE_CURSOR_DEPTH = 1100;

/** How far (screen px) a press on a placed item must move before it counts as a drag, not a tap. */
const TAP_SLOP = 6 * S;

/** Registry key under which the layout is remembered: { [itemId]: { x, y } }. */
const LAYOUT_KEY = 'apartmentLayout';

/** Registry key of the chosen wallpaper's id (absent/null = the original wall). Not part of undo/redo. */
const WALLPAPER_KEY = 'apartmentWallpaper';

/** The colour of the original wall (the swatch for "no wallpaper" is drawn in it, so every swatch is the colour the wall will show). */
const ORIGINAL_WALL_COLOR = '#f8e7ce';

/** Wallpaper swatch size, gap and columns in the left-hand column (design px). */
const SWATCH = { size: 26, gap: 6, columns: 3 };

/**
 * Whether two saved layouts put every item in the same place. Compared by item id rather than
 * as raw JSON, because an item that is picked up and put back moves to the end of the layout's
 * key order without having moved at all.
 *
 * @param {Object} a
 * @param {Object} b
 * @returns {boolean}
 */
function sameLayout (a, b)
{
    const ids = Object.keys(a);
    return ids.length === Object.keys(b).length && ids.every((id) => id in b && a[id].x === b[id].x && a[id].y === b[id].y);
}

/**
 * Room pixel -> screen pixel.
 *
 * @param {number} px
 * @param {number} py - 0 is the top of the wall strip.
 * @returns {{x: number, y: number}}
 */
function toScreen (px, py)
{
    return { x: ROOM_X + px * ROOM_SCALE, y: ROOM_Y + py * ROOM_SCALE };
}

/**
 * Screen pixel -> room pixel (the inverse of toScreen).
 *
 * @param {number} x
 * @param {number} y
 * @returns {{px: number, py: number}}
 */
function toRoom (x, y)
{
    return { px: (x - ROOM_X) / ROOM_SCALE, py: (y - ROOM_Y) / ROOM_SCALE };
}

export class ApartmentScene extends Scene
{
    constructor ()
    {
        super('ApartmentScene');
    }

    /**
     * @param {Object} data - the DayCompleteScene data payload, handed back untouched by Back - or, when
     *   opened from the pause menu, { levelIndex, returnTo: { scene, data } }, where Back goes to `returnTo`.
     */
    init (data)
    {
        this.dayCompleteData = data;
        /** The drag in progress, or null. See startDrag(). */
        this.drag = null;
        /** A press on a placed item that hasn't moved far enough to be a drag yet, or null. */
        this.pending = null;
        /** Layouts from before each change, most recent last - what Undo steps back to. */
        this.history = [];
        /** Layouts Undo has stepped back from, most recent last - what Redo steps forward to. */
        this.future = [];
        /** The first-day hand cursor showing how to drag the clock onto the wall, while it is running. */
        this.guideCursor = null;
        /** The tutorial Skip button while the hand cursor is running, else null. */
        this.skipButton = null;
        // Scene objects are rebuilt on every visit; forget the previous visit's wallpaper swatches.
        this.swatches = [];
        this.wallImage = null;
        this.wallColour = null;
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0xf5ead6);
        // The same music as gameplay (a no-op if it is already playing).
        playBgm(this, 'gameplay-bgm', GAMEPLAY_BGM_VOLUME);
        // The paused PuzzleScene may still be rendered underneath, so cover the canvas.
        this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xf5ead6);

        /** @type {Map<string, import('../../data/loadItems.js').ItemDef>} */
        this.defs = new Map(loadItems(itemsRaw).map((item) => [item.id, item]));
        this.room = new RoomLayout();

        this.drawRoom();

        // The first visit: the worker says what to do, in the room's lower-left corner (empty floor).
        if (!this.registry.get('apartmentTipDone'))
        {
            this.registry.set('apartmentTipDone', true);
            showCornerTip(this, {
                message: 'Drag items from the inventory to place them in the room.',
                head: 'worker-head',
                left: ROOM_X + 16 * S,
                bottom: ROOM_Y + ROOM_SCREEN_H - 16 * S,
            });
        }
        this.createTopBar();

        this.panelGraphics = this.add.graphics();
        this.drawPanel(false);
        this.add
            .text(PANEL.x + PANEL.width / 2, PANEL.y + 24 * S, 'Inventory', {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: 18 * S,
                color: '#3a362f',
            })
            .setOrigin(0.5);
        /** Everything drawn inside the panel's slot area, rebuilt by refreshInventory(). */
        this.inventoryObjects = [];
        /** Click targets for the inventory slots, rebuilt with the objects above. */
        this.slotRects = [];
        /** The first visible row of slots; see scrollInventory(). */
        this.inventoryScroll = 0;
        this.createScrollArrows();

        // One sprite (plus a name label while it's a placeholder) per catalogue item, created up
        // front and shown/hidden as items move between the room and the inventory.
        /** @type {Map<string, {image: import('phaser').GameObjects.Image, label: import('phaser').GameObjects.Text | null}>} */
        this.sprites = new Map();
        /** The visible picture's box per item (RoomLayout's ArtHit), used for clicking and the wall-item ghost. */
        this.hits = new Map();
        for (const def of this.defs.values())
        {
            const sprite = this.createItemSprite(def);
            this.sprites.set(def.id, sprite);
            if (sprite.hit)
            {
                this.hits.set(def.id, sprite.hit);
            }
        }

        this.ghostGraphics = this.add.graphics().setDepth(GHOST_DEPTH);

        this.room.load(this.registry.get(LAYOUT_KEY), this.defs);
        this.syncSprites();
        // The top bar was built before the saved room was loaded, so bring Clear's dimming up to date.
        this.refreshHistoryButtons();
        this.refreshInventory();

        this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));
        this.input.on('pointermove', (pointer) => this.onPointerMove(pointer));
        this.input.on('pointerup', (pointer) => this.onPointerUp(pointer));
        // Releasing the button outside the canvas should still drop the item.
        this.input.on('pointerupoutside', (pointer) => this.onPointerUp(pointer));
        // The mouse wheel scrolls the inventory while the mouse is over it (one row per notch).
        this.input.on('wheel', (pointer, over, deltaX, deltaY) => {
            if (!this.drag && this.isOverPanel(pointer) && deltaY !== 0)
            {
                this.scrollInventory(Math.sign(deltaY));
            }
        });

        this.startGuideCursor();
    }

    // ------------------------------------------------------------------ the first-day hand cursor

    /**
     * First-day trail: while the clock is waiting in the inventory on day 1, a hand cursor loops a
     * demonstration of dragging it onto the wall - it presses on the clock's slot, slides over to a
     * spot on the wall and lets go. It is only a picture: the real clock is not picked up. It goes
     * away for good once the clock is placed.
     */
    startGuideCursor ()
    {
        const clock = this.defs.get(FTUE_ITEM_ID);
        const owned = getEconomyState(this.registry).ownedItems.includes(FTUE_ITEM_ID);
        if (!clock || !owned || this.room.has(FTUE_ITEM_ID) || this.dayCompleteData?.levelIndex !== 0 || this.dayCompleteData?.returnTo || this.registry.get('tutorialSkipped'))
        {
            return;
        }
        const spot = this.findWallSpot(clock);
        if (!spot)
        {
            return;
        }
        // The middle of the clock's footprint, where the held item sits under the mouse (see onPointerDown).
        const to = toScreen((spot.x + clock.footprint.w / 2) * TILE, (spot.y + clock.footprint.h / 2) * TILE);
        this.guideCursor = new GuideCursor(this, { depth: GUIDE_CURSOR_DEPTH });
        this.guideCursor.playDrag(
            () => {
                // The slot is looked up each loop: the inventory is rebuilt whenever it changes.
                const slot = this.slotRects.find((rect) => rect.id === FTUE_ITEM_ID);
                return slot ? { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 } : null;
            },
            () => to,
            { delay: 800 }
        );

        // A returning player can skip the tutorial: the hand goes away (the room works as normal).
        if (isTutorialSkippable(this.registry))
        {
            this.skipButton = addSkipButton(this, {
                // Bottom-right of the room (the left column is too narrow for it, and the worker's tip is bottom-left).
                x: ROOM_X + ROOM_SCREEN_W - 100 * S,
                y: ROOM_Y + ROOM_SCREEN_H - 48 * S,
                depth: GUIDE_CURSOR_DEPTH,
                onSkip: () => {
                    skipTutorial(this.registry);
                    this.endGuideCursor();
                },
            });
        }
    }

    /** Removes the hand cursor and the Skip button for good. */
    endGuideCursor ()
    {
        this.guideCursor?.stop();
        this.guideCursor = null;
        this.skipButton?.destroy();
        this.skipButton = null;
    }

    /**
     * A legal spot for a wall item, near the middle of the wall (for the cursor demonstration).
     *
     * @param {import('../../data/loadItems.js').ItemDef} def
     * @returns {{x: number, y: number} | null} the footprint's top-left tile, or null if it fits nowhere.
     */
    findWallSpot (def)
    {
        const { w, h } = def.footprint;
        // Columns ordered by how close they are to the middle of the room.
        const middle = (ROOM_W - w) / 2;
        const columns = Array.from({ length: ROOM_W - w + 1 }, (_, x) => x).sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle));
        for (const x of columns)
        {
            const rows = [];
            for (let y = 0; y <= WALL_ROWS - h; y++)
            {
                if (this.room.canPlace(def, x, y))
                {
                    rows.push(y);
                }
            }
            if (rows.length > 0)
            {
                return { x, y: rows[Math.floor(rows.length / 2)] }; // the middle of the legal rows
            }
        }
        return null;
    }

    /**
     * After the room changed (or a drag ended): the hand cursor is done once the clock is placed, and
     * carries on if the clock is back in the inventory.
     */
    updateGuideCursor ()
    {
        if (!this.guideCursor)
        {
            return;
        }
        if (this.room.has(FTUE_ITEM_ID))
        {
            this.endGuideCursor();
        }
        else
        {
            this.guideCursor.resume();
        }
    }

    // ------------------------------------------------------------------ the room

    /**
     * Draws the static room once: the back wall art (assets/apartment/apartment-wall.png, ROOM_W x
     * WALL_ROWS tiles) with the floor art (apartment-floor.png, ROOM_W x ROOM_H tiles) directly
     * below it, and a thin outline round the whole room to match the inventory panel.
     */
    drawRoom ()
    {
        const wallHeight = WALL_ROWS * TILE * ROOM_SCALE;
        this.wallImage = this.addRoomImage('apartment-wall', ROOM_Y, wallHeight, WALL_DEPTH);
        // A chosen wallpaper replaces the wall art entirely (rather than tinting it, which would muddy
        // the colour): a plain rectangle over the same area, shown only while a wallpaper is chosen.
        this.wallColour = this.add
            .rectangle(ROOM_X, ROOM_Y, ROOM_SCREEN_W, wallHeight, 0xffffff)
            .setOrigin(0, 0)
            .setDepth(WALL_DEPTH)
            .setVisible(false);
        this.applyWallpaper(this.registry.get(WALLPAPER_KEY) ?? null);
        this.addRoomImage('apartment-floor', ROOM_Y + wallHeight, ROOM_H * TILE * ROOM_SCALE, FLOOR_DEPTH);

        this.add
            .graphics()
            .setDepth(FLOOR_DEPTH)
            .lineStyle(2 * S, 0x3a362f, 1)
            .strokeRect(ROOM_X, ROOM_Y, ROOM_SCREEN_W, ROOM_SCREEN_H);
    }

    /**
     * Places one piece of room art across the room's full width, with its top-left corner at
     * (ROOM_X, y). It is stretched to the given height and the room's width, so the art can be drawn
     * at any whole multiple of the base size (the wall is 1x, the floor 2x) as long as its
     * proportions are the area's (ROOM_W x its rows of tiles).
     *
     * @param {string} key - the texture key (the file name without .png).
     * @param {number} y - screen y of the image's top edge.
     * @param {number} height - screen height of the area the art covers.
     * @param {number} depth
     * @returns {import('phaser').GameObjects.Image}
     */
    addRoomImage (key, y, height, depth)
    {
        if (PIXEL_ART)
        {
            this.textures.get(key).setFilter(Textures.FilterMode.NEAREST);
        }
        return this.add.image(ROOM_X, y, key).setOrigin(0, 0).setDisplaySize(ROOM_SCREEN_W, height).setDepth(depth);
    }

    /**
     * Creates the image (and, for a placeholder, a name label) that shows one item in the room.
     * The image uses the item's own art (assets/apartment/<sprite>.png) if it exists, otherwise a generated
     * placeholder block of exactly the shape real art must be (see placeholderTexture). It is
     * anchored at its bottom-left corner (origin 0, 1), the point spriteRect() positions.
     *
     * The image is scaled so its WIDTH is exactly the item's footprint width in tiles, and its height
     * follows the art's own proportions. So art drawn at any whole multiple of the 32px-per-tile
     * base - the supplied furniture art is at 2x - lands in the same place, and art whose canvas
     * isn't quite the shape the item's data says is never stretched out of proportion.
     *
     * Art is supplied centred on its canvas with transparent space around the picture, so a floor
     * item would hover above its footprint's front edge by whatever space is under it. `drop` is
     * that space (screen pixels): showSpriteAt moves the image down by it so the VISIBLE bottom of
     * the picture is what sits on the floor tile. Flat items (rugs) and wall items have no "bottom
     * on the floor", so they are never moved.
     *
     * @param {import('../../data/loadItems.js').ItemDef} def
     * @returns {{image: import('phaser').GameObjects.Image, label: import('phaser').GameObjects.Text | null, drop: number, hasArt: boolean}}
     */
    createItemSprite (def)
    {
        const hasArt = this.textures.exists(def.sprite);
        const key = hasArt ? def.sprite : this.placeholderTexture(def);
        if (PIXEL_ART)
        {
            // Nearest-neighbour, so scaled art pixels stay hard squares instead of blurring.
            this.textures.get(key).setFilter(Textures.FilterMode.NEAREST);
        }
        const artSize = this.textures.get(key).getSourceImage();
        // artScale (data) shrinks the picture below its footprint width; it is then centred in the
        // footprint (inset) rather than hugging its left edge.
        const artScale = def.artScale ?? 1;
        const footprintWidth = def.footprint.w * TILE * ROOM_SCALE;
        const scale = (footprintWidth * artScale) / artSize.width;
        const inset = Math.round((footprintWidth * (1 - artScale)) / 2);
        const image = this.add.image(0, 0, key).setOrigin(0, 1).setScale(scale).setVisible(false);
        const label = hasArt
            ? null
            : this.add
                .text(0, 0, def.name, { fontFamily: 'Fredoka, Arial', fontStyle: '700', fontSize: 13 * S, color: '#ffffff', stroke: '#3a362f', strokeThickness: 3 * S })
                .setOrigin(0.5)
                .setVisible(false);

        let drop = 0;
        if (hasArt && !def.flat && !def.wallMounted)
        {
            const bounds = getArtBounds(this, key);
            const emptyBelow = artSize.height - (bounds.y + bounds.height); // art pixels
            drop = Math.round(emptyBelow * scale);
        }

        // The visible picture's box relative to the footprint's bottom-left corner, in base room
        // pixels (screen pixels / ROOM_SCALE): where the image really is, not its padded canvas.
        let hit = null;
        if (hasArt)
        {
            const bounds = getArtBounds(this, key);
            const top = drop - artSize.height * scale; // the image's top edge, from the anchor
            hit = {
                left: (inset + bounds.x * scale) / ROOM_SCALE,
                right: (inset + (bounds.x + bounds.width) * scale) / ROOM_SCALE,
                top: (top + bounds.y * scale) / ROOM_SCALE,
                bottom: (top + (bounds.y + bounds.height) * scale) / ROOM_SCALE,
            };
        }
        return { image, label, drop, inset, hit, hasArt };
    }

    /**
     * Makes (once) a plain placeholder texture for an item, at the exact pixel size its real art
     * will have: footprint.w tiles wide and (footprint.h + heightRows) tiles tall. The top
     * footprint.h tiles are the item's TOP surface (lighter), the bottom heightRows tiles its FRONT
     * face (darker) - the two faces a 3/4 view shows. A rug (heightRows 0) is all top.
     *
     * @param {import('../../data/loadItems.js').ItemDef} def
     * @returns {string} the texture key.
     */
    placeholderTexture (def)
    {
        const key = `placeholder-${def.id}`;
        if (this.textures.exists(key))
        {
            return key;
        }
        const width = def.footprint.w * TILE;
        const topHeight = def.footprint.h * TILE;
        const frontHeight = def.heightRows * TILE;
        const color = parseInt(def.color.slice(1), 16);

        const g = this.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(color, 1);
        g.fillRect(0, 0, width, topHeight);
        if (frontHeight > 0)
        {
            // Darken the front face by scaling each colour channel to 70%.
            const darker = (((color >> 16) & 0xff) * 0.7) << 16 | (((color >> 8) & 0xff) * 0.7) << 8 | (color & 0xff) * 0.7;
            g.fillStyle(darker, 1);
            g.fillRect(0, topHeight, width, frontHeight);
            g.lineStyle(1, 0x3a362f, 0.6);
            g.lineBetween(0, topHeight + 0.5, width, topHeight + 0.5);
        }
        g.lineStyle(1, 0x3a362f, 1);
        g.strokeRect(0.5, 0.5, width - 1, topHeight + frontHeight - 1);
        g.generateTexture(key, width, topHeight + frontHeight);
        g.destroy();
        return key;
    }

    /**
     * Moves an item's sprite so its footprint's top-left tile is at room tile (x, y) - fractional
     * tiles allowed, for an item following the mouse.
     *
     * @param {string} id
     * @param {number} x
     * @param {number} y
     * @param {number} [alpha]
     */
    showSpriteAt (id, x, y, alpha = 1)
    {
        const { image, label, drop, inset } = this.sprites.get(id);
        const rect = spriteRect(this.defs.get(id), x, y);
        const anchor = toScreen(rect.anchorX, rect.anchorY);
        image.setPosition(anchor.x + inset, anchor.y + drop).setAlpha(alpha).setVisible(true);
        if (label)
        {
            const centre = toScreen(rect.left + rect.width / 2, rect.top + rect.height / 2);
            label.setPosition(centre.x, centre.y).setAlpha(alpha).setVisible(true);
        }
    }

    /** @param {string} id */
    hideSprite (id)
    {
        const { image, label } = this.sprites.get(id);
        image.setVisible(false);
        label?.setVisible(false);
    }

    /** @param {string} id @param {number} depth */
    setSpriteDepth (id, depth)
    {
        const { image, label } = this.sprites.get(id);
        image.setDepth(depth);
        // Labels stay above all placed furniture; a held item's label rides above the held item.
        label?.setDepth(depth === HELD_DEPTH ? HELD_DEPTH + 0.5 : LABEL_DEPTH);
    }

    /**
     * Brings every sprite in line with the layout: placed items shown at their tiles, in
     * RoomLayout's back-to-front order; everything else hidden.
     */
    syncSprites ()
    {
        for (const id of this.defs.keys())
        {
            if (!this.room.has(id) && this.drag?.id !== id)
            {
                this.hideSprite(id);
            }
        }
        this.room.drawOrder().forEach((placement, index) => {
            this.showSpriteAt(placement.id, placement.x, placement.y);
            this.setSpriteDepth(placement.id, PLACED_DEPTH_BASE + index);
        });
    }

    // ------------------------------------------------------------------ top bar and history

    /**
     * Creates the Back, Undo, Redo and Clear buttons, stacked in a column in
     * the space left of the room (the room is centred, so the screen's sides hold the controls).
     */
    createTopBar ()
    {
        // Back is the shop's previous-page arrow picture; the column below is spaced from its height.
        const size = 44 * S;
        const backButton = addImageButton(this, 0, 0, 'button-page-prev', BACK_BUTTON_HEIGHT);
        backButton.setOrigin(0, 0).setPosition(BUTTONS_X, ROOM_Y);
        // Back returns to the end-of-day popup it came from, rebuilt from the same data - or, when the
        // room was opened from the pause menu, to the truck that was being played.
        makePressable(this, backButton, () => {
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

        // Undo and Redo reuse the HUD's reset icon (an anticlockwise arrow); Redo is it mirrored.
        // Each row of the column sits 16px below the one above.
        const iconsY = backButton.y + backButton.displayHeight + 16 * S;
        const makeIcon = (x, flipX, onClick) => {
            const button = this.add
                .image(x + size / 2, iconsY + size / 2, 'reset-icon')
                .setDisplaySize(size, size)
                .setFlipX(flipX)
                .setInteractive({ useHandCursor: true });
            makePressable(this, button, onClick);
            return button;
        };
        this.undoButton = makeIcon(BUTTONS_X, false, () => this.undo());
        this.redoButton = makeIcon(BUTTONS_X + size + 8 * S, true, () => this.redo());

        // Clear is a picture button (label painted in), sized to the column's width.
        this.clearButton = addImageButton(this, 0, 0, 'button-clear', CLEAR_BUTTON_HEIGHT);
        this.clearButton.setOrigin(0, 0).setPosition(BUTTONS_X, iconsY + size + 16 * S);
        makePressable(this, this.clearButton, () => this.clearRoom());

        this.createWallpaperSwatches(iconsY + size + 16 * S + this.clearButton.displayHeight + 24 * S);
        this.refreshHistoryButtons();
    }

    /**
     * Builds the wallpaper picker under the Clear button: a small grid of colour swatches (the
     * original wall first). Clicking one repaints the wall; the choice is remembered in the registry.
     *
     * @param {number} top - screen y of the picker's label.
     */
    createWallpaperSwatches (top)
    {
        this.add
            .text(BUTTONS_X, top, 'Wallpaper', { fontFamily: 'Fredoka, Arial', fontStyle: '700', fontSize: 16 * S, color: '#3a362f' })
            .setOrigin(0, 0);
        // The original wall is always there; a bought wallpaper adds its swatch.
        const owned = new Set(getEconomyState(this.registry).ownedItems);
        const options = [{ id: null, color: ORIGINAL_WALL_COLOR }, ...loadWallpapers(wallpapersRaw).filter((wallpaper) => owned.has(wallpaper.id))];
        const size = SWATCH.size * S;
        const gap = SWATCH.gap * S;
        this.swatches = options.map((option, i) => {
            const x = BUTTONS_X + (i % SWATCH.columns) * (size + gap);
            const y = top + 26 * S + Math.floor(i / SWATCH.columns) * (size + gap);
            // Rounded squares come from two small generated textures: plain, and outlined for the chosen one.
            const swatch = this.add
                .image(x + size / 2, y + size / 2, this.swatchTexture(option.color, false))
                .setInteractive({ useHandCursor: true });
            makePressable(this, swatch, () => {
                this.registry.set(WALLPAPER_KEY, option.id);
                saveProgress(this.registry);
                this.applyWallpaper(option.id);
                playSfx(this, 'pop-high');
            });
            return { option, swatch };
        });
        this.applyWallpaper(this.registry.get(WALLPAPER_KEY) ?? null);
    }

    /**
     * Makes (once) a rounded-square swatch texture in a colour, with a dark thick outline when it is
     * the chosen one and a thin soft one otherwise.
     *
     * @param {string} color - "#rrggbb".
     * @param {boolean} chosen
     * @returns {string} the texture key.
     */
    swatchTexture (color, chosen)
    {
        const key = `swatch-${color}-${chosen ? 'on' : 'off'}`;
        if (!this.textures.exists(key))
        {
            const size = Math.round(SWATCH.size * S);
            const line = Math.max(1, Math.round((chosen ? 3 : 1) * S));
            const g = this.make.graphics({ x: 0, y: 0 }, false);
            g.fillStyle(parseInt(color.slice(1), 16), 1);
            g.fillRoundedRect(0, 0, size, size, 7 * S);
            g.lineStyle(line, 0x3a362f, chosen ? 1 : 0.5);
            g.strokeRoundedRect(line / 2, line / 2, size - line, size - line, 7 * S);
            g.generateTexture(key, size, size);
            g.destroy();
        }
        return key;
    }

    /**
     * Paints the wall in a wallpaper's colour: the wall art is hidden and a plain rectangle of the
     * exact colour shown instead (so the colour appears true). Also outlines that wallpaper's swatch.
     *
     * @param {string | null} id - wallpaper id, or null for the original wall.
     */
    applyWallpaper (id)
    {
        const wallpaper = id ? loadWallpapers(wallpapersRaw).find((entry) => entry.id === id) : null;
        if (this.wallImage && this.wallColour)
        {
            // Wallpaper: hide the wall art and show the pure colour. Original wall: the art alone.
            this.wallImage.setVisible(!wallpaper);
            this.wallColour.setVisible(Boolean(wallpaper));
            if (wallpaper)
            {
                this.wallColour.setFillStyle(parseInt(wallpaper.color.slice(1), 16), 1);
            }
        }
        for (const { option, swatch } of this.swatches ?? [])
        {
            swatch.setTexture(this.swatchTexture(option.color, option.id === id));
        }
    }

    /** Dims Undo, Redo and Clear when they have nothing to do. */
    refreshHistoryButtons ()
    {
        this.undoButton.setAlpha(this.history.length > 0 ? 1 : 0.35);
        this.redoButton.setAlpha(this.future.length > 0 ? 1 : 0.35);
        this.clearButton.setAlpha(this.room.placed.size > 0 ? 1 : 0.35);
    }

    /**
     * Records that the room changed from `before`: Undo can return to it, and anything that had
     * been undone can no longer be redone (the usual undo behaviour).
     *
     * @param {Object} before - a layout from RoomLayout.serialize().
     */
    recordChange (before)
    {
        this.history.push(before);
        this.future = [];
    }

    /** Steps back to the layout before the last change. Does nothing mid-drag or with nothing to undo. */
    undo ()
    {
        if (this.drag || this.history.length === 0)
        {
            return;
        }
        this.future.push(this.room.serialize());
        this.applyLayout(this.history.pop());
    }

    /** Re-applies the change Undo just stepped back from. Does nothing mid-drag or with nothing to redo. */
    redo ()
    {
        if (this.drag || this.future.length === 0)
        {
            return;
        }
        this.history.push(this.room.serialize());
        this.applyLayout(this.future.pop());
    }

    /** Puts every item back in the inventory. Can be undone. */
    clearRoom ()
    {
        if (this.drag || this.room.placed.size === 0)
        {
            return;
        }
        this.recordChange(this.room.serialize());
        this.applyLayout({});
    }

    /**
     * Replaces the room's contents with a layout and brings everything on screen up to date.
     *
     * @param {Object} layout - from RoomLayout.serialize() ({} for an empty room).
     */
    applyLayout (layout)
    {
        this.room.load(layout, this.defs);
        this.afterChange();
    }

    /**
     * Redraws, saves and refreshes the panel and buttons after the layout changed. Runs once per
     * finished action (an item dropped, put away, moved, or an Undo / Redo / Clear) - never while a
     * drag is still in progress - so it is a fine moment to write the save.
     */
    afterChange ()
    {
        this.syncSprites();
        this.registry.set(LAYOUT_KEY, this.room.serialize());
        saveProgress(this.registry);
        this.refreshInventory();
        this.refreshHistoryButtons();
        this.updateGuideCursor();
    }

    // ------------------------------------------------------------------ inventory panel

    /**
     * Draws the inventory panel's background, highlighted (green outline) while an item is held
     * over it, to say "drop here to put this away".
     *
     * @param {boolean} highlighted
     */
    drawPanel (highlighted)
    {
        const g = this.panelGraphics;
        g.clear();
        g.fillStyle(highlighted ? 0xe4f3e4 : 0xfaf3e4, 1);
        g.fillRoundedRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 14 * S);
        g.lineStyle((highlighted ? 4 : 2) * S, highlighted ? GHOST_VALID_COLOR : 0x3a362f, 1);
        g.strokeRoundedRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 14 * S);
    }

    /**
     * @param {{x: number, y: number}} pointer
     * @returns {boolean} whether the point is over the inventory panel.
     */
    isOverPanel (pointer)
    {
        return pointer.x >= PANEL.x && pointer.x <= PANEL.x + PANEL.width && pointer.y >= PANEL.y && pointer.y <= PANEL.y + PANEL.height;
    }

    /** Creates the up/down scroll arrows at the bottom of the panel (shown only when needed). */
    createScrollArrows ()
    {
        const y = PANEL.y + PANEL.height - SCROLL_STRIP_HEIGHT / 2;
        const makeArrow = (x, key, delta) => {
            const arrow = addImageButton(this, x, y, key, 34);
            makePressable(this, arrow, () => this.scrollInventory(delta));
            return arrow;
        };
        this.scrollUpArrow = makeArrow(PANEL.x + PANEL.width / 2 - 34 * S, 'button-scroll-up', -1);
        this.scrollDownArrow = makeArrow(PANEL.x + PANEL.width / 2 + 34 * S, 'button-scroll-down', 1);
    }

    /**
     * Scrolls the inventory by whole rows (negative = up). refreshInventory() keeps it in range.
     *
     * @param {number} rows
     */
    scrollInventory (rows)
    {
        this.inventoryScroll += rows;
        this.refreshInventory();
    }

    /**
     * Rebuilds the inventory slots: one for every item the player has bought that is neither in
     * the room nor being held. Each slot shows the item's picture (art or placeholder) fitted inside
     * it, its name and footprint size. Only VISIBLE_SLOT_ROWS rows are drawn, from inventoryScroll down.
     */
    refreshInventory ()
    {
        for (const object of this.inventoryObjects)
        {
            object.destroy();
        }
        this.inventoryObjects = [];
        this.slotRects = [];

        // Only items the player has BOUGHT (see ShopScene) are in the inventory, and only while they are
        // neither in the room nor being held - each is a single copy.
        const owned = new Set(getEconomyState(this.registry).ownedItems);
        const available = [...this.defs.values()].filter((def) => owned.has(def.id) && !this.room.has(def.id) && this.drag?.id !== def.id);

        // Keep the scroll in range - the list shrinks as items are placed and grows as they're put away.
        const totalRows = Math.ceil(available.length / SLOT.columns);
        const maxScroll = Math.max(0, totalRows - VISIBLE_SLOT_ROWS);
        this.inventoryScroll = Math.max(0, Math.min(maxScroll, this.inventoryScroll));
        // The arrows are always there (so it's clear the list can scroll), dimmed when there's
        // nothing further in that direction.
        this.scrollUpArrow.setAlpha(this.inventoryScroll > 0 ? 1 : 0.35);
        this.scrollDownArrow.setAlpha(this.inventoryScroll < maxScroll ? 1 : 0.35);

        const first = this.inventoryScroll * SLOT.columns;
        const shown = available.slice(first, first + VISIBLE_SLOT_ROWS * SLOT.columns);

        shown.forEach((def, index) => {
            const x = SLOT_X + (index % SLOT.columns) * (SLOT.size + SLOT.gap);
            const y = SLOT.firstY + Math.floor(index / SLOT.columns) * (SLOT.size + SLOT.gap);

            const g = this.add.graphics();
            g.fillStyle(0xf0e4cc, 1);
            g.fillRoundedRect(x, y, SLOT.size, SLOT.size, 10 * S);

            // The picture (its visible part), fitted into the slot's upper area above the two text
            // lines, keeping its proportions.
            const pictureHeight = SLOT.size - 44 * S;
            const { image: roomImage, hasArt } = this.sprites.get(def.id);
            const picture = addFittedIcon(this, roomImage.texture.key, x + SLOT.size / 2, y + 6 * S + pictureHeight / 2, SLOT.size - 20 * S, pictureHeight, hasArt);

            const name = this.add
                .text(x + SLOT.size / 2, y + SLOT.size - 27 * S, def.name, { fontFamily: 'Fredoka, Arial Black', fontStyle: '700', fontSize: 13 * S, color: '#3a362f' })
                .setOrigin(0.5);
            // The footprint ("3x2" tiles) under the name; the price no longer matters once it is owned.
            const detail = this.add
                .text(x + SLOT.size / 2, y + SLOT.size - 11 * S, `${def.footprint.w}x${def.footprint.h}`, { fontFamily: 'Fredoka, Arial', fontStyle: '400', fontSize: 11 * S, color: '#6b6354' })
                .setOrigin(0.5);

            this.inventoryObjects.push(g, picture, name, detail);
            this.slotRects.push({ id: def.id, x, y, width: SLOT.size, height: SLOT.size });
        });

        if (available.length === 0)
        {
            const message = owned.size === 0
                ? 'Your inventory is empty.\nBuy items in the shop\nand they will show up here.'
                : 'Everything is placed.\nTap an item or drag it here\nto put it away.';
            this.inventoryObjects.push(
                this.add
                    .text(PANEL.x + PANEL.width / 2, SLOT.firstY + 40 * S, message, {
                        fontFamily: 'Fredoka, Arial', fontStyle: '400',
                        fontSize: 15 * S,
                        color: '#6b6354',
                        align: 'center',
                    })
                    .setOrigin(0.5, 0)
            );
        }
    }

    // ------------------------------------------------------------------ mouse handling

    /**
     * Mouse pressed. On an inventory slot: start dragging that item straight away. On a placed
     * item (anywhere on its visible sprite): wait to see whether this is a tap or a drag.
     *
     * @param {import('phaser').Input.Pointer} pointer
     */
    onPointerDown (pointer)
    {
        if (this.drag || this.pending)
        {
            return;
        }
        const slot = this.slotRects.find(
            (rect) => pointer.x >= rect.x && pointer.x <= rect.x + rect.width && pointer.y >= rect.y && pointer.y <= rect.y + rect.height
        );
        if (slot)
        {
            // Grab the footprint by its centre, so the item sits centred under the mouse.
            const { w, h } = this.defs.get(slot.id).footprint;
            this.startDrag(slot.id, pointer, { px: (w * TILE) / 2, py: (h * TILE) / 2 });
            return;
        }

        const { px, py } = toRoom(pointer.x, pointer.y);
        const id = this.room.pickAt(px, py, this.defs, TILE, this.hits);
        if (id)
        {
            this.pending = { id, x: pointer.x, y: pointer.y };
        }
    }

    /**
     * Begins dragging an item. One picked up from the room is removed from the layout straight
     * away (so it doesn't block its own new spot) but remembered in `origin`, so an invalid drop
     * can put it back.
     *
     * @param {string} id
     * @param {import('phaser').Input.Pointer} pointer
     * @param {{px: number, py: number}} grab - where the mouse holds the item, in room pixels from
     *   its footprint's top-left corner. Kept fixed so the item doesn't jump when picked up.
     */
    startDrag (id, pointer, grab)
    {
        // The room before this pick-up, taken before removing the item. onPointerUp compares
        // against it to decide whether anything really changed (and so needs an undo step).
        const before = this.room.serialize();
        const origin = this.room.remove(id) ?? null;
        playSfx(this, 'pop'); // picked up - the same sound as lifting a parcel in the puzzle
        this.drag = { id, def: this.defs.get(id), origin, grab, before, target: { type: 'none' } };
        this.setSpriteDepth(id, HELD_DEPTH);
        this.syncSprites();
        this.refreshInventory();
        this.updateDrag(pointer);
        // The player has taken hold of the clock themselves: the demonstration steps aside.
        if (id === FTUE_ITEM_ID)
        {
            this.guideCursor?.suspend();
        }
    }

    /**
     * Mouse moved: turn a pending press into a drag once it has moved far enough, and move the
     * held item.
     *
     * @param {import('phaser').Input.Pointer} pointer
     */
    onPointerMove (pointer)
    {
        if (this.pending && Math.hypot(pointer.x - this.pending.x, pointer.y - this.pending.y) > TAP_SLOP)
        {
            const { id, x, y } = this.pending;
            this.pending = null;
            // Hold the item where it was pressed (not where the mouse is now), so it doesn't jump.
            const placement = this.room.get(id);
            const pressed = toRoom(x, y);
            this.startDrag(id, pointer, { px: pressed.px - placement.x * TILE, py: pressed.py - placement.y * TILE });
            return;
        }
        if (this.drag)
        {
            this.updateDrag(pointer);
        }
    }

    /**
     * Updates the held item, the ghost and the drop target for the current mouse position.
     *
     * The footprint's top-left corner is the mouse (in room pixels) minus the grab offset;
     * snapToTile rounds that to the nearest tile. Over the room, the item is drawn at the snapped
     * tile with a green/red ghost on its footprint. Elsewhere it just follows the mouse.
     *
     * @param {import('phaser').Input.Pointer} pointer
     */
    updateDrag (pointer)
    {
        const { id, def, grab } = this.drag;
        const { px, py } = toRoom(pointer.x, pointer.y);
        const cornerX = px - grab.px;
        const cornerY = py - grab.py;
        const { x, y } = snapToTile(cornerX, cornerY);
        const { w, h } = def.footprint;

        const overPanel = this.isOverPanel(pointer);
        this.drawPanel(overPanel);
        this.ghostGraphics.clear();

        // A footprint wholly outside the room isn't a placement attempt (the mouse is somewhere
        // else on screen), so it gets no ghost; partly outside gets a red one.
        const touchesRoom = x + w > 0 && x < ROOM_W && y + h > 0 && y < WALL_ROWS + ROOM_H;

        if (overPanel || !touchesRoom)
        {
            this.showSpriteAt(id, cornerX / TILE, cornerY / TILE, 0.8);
            this.drag.target = { type: overPanel ? 'inventory' : 'none' };
            return;
        }

        const valid = this.room.canPlace(def, x, y);
        this.showSpriteAt(id, x, y, 0.8);

        // Where the pointer is aiming: green if the item can go there, red if not.
        this.drawItemGhost(def, x, y, valid ? GHOST_VALID_COLOR : GHOST_INVALID_COLOR, 0.45);

        // Not legal there: on release the item lands in the nearest legal spot instead (found from the
        // exact, unsnapped position so it picks the side the mouse is leaning towards). A fainter
        // green ghost shows where that is. If it fits nowhere at all, `landing` is null.
        let landing = null;
        if (!valid)
        {
            landing = this.room.findNearestValid(def, cornerX / TILE, cornerY / TILE);
            if (landing)
            {
                this.drawItemGhost(def, landing.x, landing.y, GHOST_VALID_COLOR, 0.25);
            }
        }
        this.drag.target = { type: 'room', x, y, valid, landing };
    }

    /**
     * Draws the ghost for an item at a tile. A floor item's ghost covers its footprint tiles; a
     * wall item's hugs its visible picture instead (its footprint is the whole canvas, which is
     * bigger than the poster or frame drawn on it).
     *
     * @param {import('../../data/loadItems.js').ItemDef} def
     * @param {number} x - footprint's left tile.
     * @param {number} y - footprint's top tile.
     * @param {number} color
     * @param {number} fillAlpha
     */
    drawItemGhost (def, x, y, color, fillAlpha)
    {
        const hit = this.hits.get(def.id);
        if (!def.wallMounted || !hit)
        {
            this.drawFootprintGhost(x, y, def.footprint.w, def.footprint.h, color, fillAlpha);
            return;
        }
        const anchor = spriteRect(def, x, y);
        const corner = toScreen(anchor.anchorX + hit.left, anchor.anchorY + hit.top);
        const width = (hit.right - hit.left) * ROOM_SCALE;
        const height = (hit.bottom - hit.top) * ROOM_SCALE;
        this.ghostGraphics.fillStyle(color, fillAlpha);
        this.ghostGraphics.fillRect(corner.x, corner.y, width, height);
        this.ghostGraphics.lineStyle(3 * S, color, 1);
        this.ghostGraphics.strokeRect(corner.x, corner.y, width, height);
    }

    /**
     * Draws a ghost over a footprint: its tiles that lie inside the room, filled and outlined.
     *
     * @param {number} x - footprint's left tile.
     * @param {number} y - footprint's top tile.
     * @param {number} w - width in tiles.
     * @param {number} h - depth in tiles.
     * @param {number} color
     * @param {number} fillAlpha - opacity of the fill (the outline is always solid).
     */
    drawFootprintGhost (x, y, w, h, color, fillAlpha)
    {
        const left = Math.max(0, x);
        const top = Math.max(0, y);
        const right = Math.min(ROOM_W, x + w);
        const bottom = Math.min(WALL_ROWS + ROOM_H, y + h);
        const corner = toScreen(left * TILE, top * TILE);
        const size = TILE * ROOM_SCALE;
        this.ghostGraphics.fillStyle(color, fillAlpha);
        this.ghostGraphics.fillRect(corner.x, corner.y, (right - left) * size, (bottom - top) * size);
        this.ghostGraphics.lineStyle(3 * S, color, 1);
        this.ghostGraphics.strokeRect(corner.x, corner.y, (right - left) * size, (bottom - top) * size);
    }

    /**
     * Mouse released.
     *   - A press on a placed item that never became a drag is a TAP: the item goes back to the inventory.
     *   - A drag dropped over the room is placed there if that spot is legal, otherwise in the nearest
     *     legal spot; on the panel it's put away; anywhere else (or if it fits nowhere) it goes back
     *     where it came from (its old spot, or the inventory).
     *
     * @param {import('phaser').Input.Pointer} pointer
     */
    onPointerUp (pointer)
    {
        if (this.pending)
        {
            const before = this.room.serialize();
            this.room.remove(this.pending.id);
            this.pending = null;
            playSfx(this, 'pop'); // a tap puts the item away
            this.recordChange(before);
            this.afterChange();
            return;
        }
        if (!this.drag)
        {
            return;
        }
        this.updateDrag(pointer);

        const { id, def, origin, target, before } = this.drag;
        if (target.type === 'room' && (target.valid || target.landing))
        {
            // Exactly where it was dropped if that is legal, otherwise the nearest legal spot.
            const spot = target.valid ? target : target.landing;
            this.room.place(def, spot.x, spot.y);
            playSfx(this, 'pop-high'); // placed - the same sound as setting a parcel down in the puzzle
        }
        else if (target.type !== 'inventory' && origin)
        {
            this.room.place(def, origin.x, origin.y);
        }

        this.drag = null;
        this.ghostGraphics.clear();
        this.drawPanel(false);
        if (!this.room.has(id))
        {
            this.hideSprite(id);
        }
        // Only a drop that actually moved something is an undoable change.
        if (!sameLayout(this.room.serialize(), before))
        {
            this.recordChange(before);
        }
        this.afterChange();
    }
}
