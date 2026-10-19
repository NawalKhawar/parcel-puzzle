import { Scene } from 'phaser';

import { RoomGrid } from '../../core/RoomGrid.js';
import { createRoomProjection, getBoxFaces, pointInBox } from '../../core/RoomProjection.js';
import { loadApartment } from '../../data/loadApartment.js';
import apartmentRaw from '../../data/apartment.json';
import { FurnitureView, drawBox, parseColor } from '../objects/FurnitureView.js';
import { makePressable } from '../objects/pressFeedback.js';
import { UI_SCALE } from '../uiScale.js';

/**
 * ApartmentScene.js
 *
 * The apartment: a small 2.5D room where furniture is arranged on a grid, reached from the
 * "Decorate" button on the end-of-day popup (DayCompleteScene). Furniture waits in an
 * inventory panel on the right and is dragged onto the floor:
 *
 *   - While dragging, the item follows the mouse and a GHOST shows the grid cells it would
 *     occupy: green if the spot is legal, red if not.
 *   - Letting go over a green spot places the item there (snapped to the grid). Letting go
 *     over red/nothing puts it back where it came from.
 *   - A placed item can be picked up again (click it), moved, or dragged back onto the
 *     inventory panel to put it away.
 *
 * Where the logic lives (see "Architectural boundary" in PROJECT_STRUCTURE.md):
 *   - src/core/RoomGrid.js      the placement rules and back-to-front draw order.
 *   - src/core/RoomProjection.js  the 2.5D maths (floor cell <-> screen pixel, box polygons).
 *   - src/data/apartment.json   the room size and the furniture catalog.
 * This scene is the thin layer that turns those into pixels and mouse handling.
 *
 * Layout is remembered between visits in the Phaser registry ('apartmentLayout'), and
 * cleared when a new game starts from the title screen.
 */

// All pixel constants are in the 1280x720 design space, multiplied by UI_SCALE like the rest
// of src/game/ (see uiScale.js).
const S = UI_SCALE;

/** Where the room sits on screen: the floor trapezoid (narrow at the back wall, wide at the front). */
const ROOM_VIEW = {
    centerX: 528 * S,
    backY: 240 * S,
    frontY: 660 * S,
    backWidth: 480 * S,
    frontWidth: 800 * S,
};

/** The back wall is a flat rectangle from this y down to the floor's back edge; the side walls
 *  angle out to the (slightly higher) front corners. */
const WALL_TOP_Y = 88 * S;
const WALL_FRONT_TOP_Y = 72 * S;
/** Thickness of the floor slab drawn under the front edge, purely cosmetic. */
const FLOOR_SLAB_HEIGHT = 16 * S;

/** The inventory panel on the right. */
const PANEL = { x: 1056 * S, y: 80 * S, width: 208 * S, height: 600 * S };
const SLOT = { size: 88 * S, gap: 8 * S, padding: 12 * S, firstY: 124 * S, columns: 2 };

/** Colours of the ghost drawn on the floor while dragging. */
const GHOST_VALID_COLOR = 0x6fd08c;
const GHOST_INVALID_COLOR = 0xe0605f;

/** Draw depths: placed furniture uses 10 + its back-to-front index; the held item sits above
 *  all of it, and the ghost above the held item so the green/red tint is always visible. */
const PLACED_DEPTH_BASE = 10;
const HELD_DEPTH = 900;
const GHOST_DEPTH = 1000;

/** Registry key under which the layout is remembered: { [itemId]: { col, row } }. */
const LAYOUT_KEY = 'apartmentLayout';

export class ApartmentScene extends Scene
{
    constructor ()
    {
        super('ApartmentScene');
    }

    /**
     * @param {Object} data - the DayCompleteScene data payload, handed back untouched by Back.
     */
    init (data)
    {
        this.dayCompleteData = data;
        /** The drag in progress, or null. See startDrag(). */
        this.drag = null;
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0xf5ead6);
        // The paused PuzzleScene is still rendered underneath, so cover the canvas.
        this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xf5ead6);

        const apartment = loadApartment(apartmentRaw);
        /** @type {Map<string, import('../../data/loadApartment.js').FurnitureDef>} */
        this.defs = new Map(apartment.items.map((item) => [item.id, item]));

        this.roomGrid = new RoomGrid(apartment.room.cols, apartment.room.rows);
        this.projection = createRoomProjection({ cols: apartment.room.cols, rows: apartment.room.rows, ...ROOM_VIEW });

        this.drawRoom();
        this.createTopBar();

        this.panelGraphics = this.add.graphics();
        this.drawPanel(false);
        this.add
            .text(PANEL.x + PANEL.width / 2, PANEL.y + 22 * S, 'Inventory', {
                fontFamily: 'Arial Black',
                fontSize: 18 * S,
                color: '#3a362f',
            })
            .setOrigin(0.5);
        /** Everything currently drawn inside the panel's slot area, rebuilt by refreshInventory(). */
        this.inventoryObjects = [];
        /** Click targets for the inventory slots, rebuilt with the objects above. */
        this.slotRects = [];

        // One view per catalog item, created up front and shown/hidden as items move.
        /** @type {Map<string, FurnitureView>} */
        this.views = new Map();
        for (const def of this.defs.values())
        {
            this.views.set(def.id, new FurnitureView(this, this.projection, def));
        }

        this.ghostGraphics = this.add.graphics().setDepth(GHOST_DEPTH);

        this.restoreLayout();
        this.updateDepths();
        this.refreshInventory();

        this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));
        this.input.on('pointermove', (pointer) => this.onPointerMove(pointer));
        this.input.on('pointerup', (pointer) => this.onPointerUp(pointer));
        // Releasing the button outside the canvas should still drop the item.
        this.input.on('pointerupoutside', (pointer) => this.onPointerUp(pointer));
    }

    // ------------------------------------------------------------------ drawing the room

    /**
     * Draws the static room: flat back wall, angled side walls, the checkered floor grid and
     * the floor's front edge. Drawn once; furniture goes on top of it.
     */
    drawRoom ()
    {
        const g = this.add.graphics().setDepth(0);
        const P = this.projection;
        const backLeft = P.project(0, 0);
        const backRight = P.project(P.cols, 0);
        const frontLeft = P.project(0, P.rows);
        const frontRight = P.project(P.cols, P.rows);

        const fill = (points, color) => {
            g.fillStyle(color, 1);
            g.fillPoints(points, true, true);
        };

        // Side walls first, then the back wall on top of their shared edges. The back wall is a
        // plain axis-aligned rectangle: completely flat, as the design asks.
        fill([{ x: backLeft.x, y: WALL_TOP_Y }, { x: frontLeft.x, y: WALL_FRONT_TOP_Y }, frontLeft, backLeft], 0xd9c9a8);
        fill([{ x: backRight.x, y: WALL_TOP_Y }, { x: frontRight.x, y: WALL_FRONT_TOP_Y }, frontRight, backRight], 0xcdbd9c);
        fill([{ x: backLeft.x, y: WALL_TOP_Y }, { x: backRight.x, y: WALL_TOP_Y }, backRight, backLeft], 0xefe3c8);

        // A baseboard where the back wall meets the floor, and a window on the wall.
        fill([{ x: backLeft.x, y: backLeft.y - 10 * S }, { x: backRight.x, y: backRight.y - 10 * S }, backRight, backLeft], 0xcdb88f);
        const windowWidth = 130 * S;
        const windowHeight = 84 * S;
        const windowX = ROOM_VIEW.centerX - windowWidth / 2;
        const windowY = 112 * S;
        g.fillStyle(0xbfe3f5, 1);
        g.fillRect(windowX, windowY, windowWidth, windowHeight);
        g.lineStyle(4 * S, 0xfaf3e4, 1);
        g.strokeRect(windowX, windowY, windowWidth, windowHeight);
        g.lineBetween(windowX + windowWidth / 2, windowY, windowX + windowWidth / 2, windowY + windowHeight);
        g.lineBetween(windowX, windowY + windowHeight / 2, windowX + windowWidth, windowY + windowHeight / 2);

        // The floor, one trapezoid per cell in two alternating tones so the grid is easy to read.
        for (let row = 0; row < P.rows; row++)
        {
            for (let col = 0; col < P.cols; col++)
            {
                const corners = [P.project(col, row), P.project(col + 1, row), P.project(col + 1, row + 1), P.project(col, row + 1)];
                fill(corners, (row + col) % 2 === 0 ? 0xd2a874 : 0xc99d68);
                g.lineStyle(1 * S, 0x9c7448, 0.35);
                g.strokePoints(corners, true, true);
            }
        }

        // The thickness of the floor under its front edge.
        fill(
            [frontLeft, frontRight, { x: frontRight.x, y: frontRight.y + FLOOR_SLAB_HEIGHT }, { x: frontLeft.x, y: frontLeft.y + FLOOR_SLAB_HEIGHT }],
            0x9a6e42
        );
    }

    /** Creates the Back button, the "Apartment" title and the coin balance across the top. */
    createTopBar ()
    {
        const backButton = this.add
            .text(24 * S, 24 * S, '< Back', {
                fontFamily: 'Arial Black',
                fontSize: 22 * S,
                color: '#3a362f',
                backgroundColor: '#f0b86e',
                padding: { x: 16 * S, y: 8 * S },
            })
            .setInteractive({ useHandCursor: true });
        // Back returns to the end-of-day popup it came from, rebuilt from the same data.
        makePressable(this, backButton, () => {
            this.scene.start('DayCompleteScene', this.dayCompleteData);
        }, { delay: 120 });

        this.add.text(150 * S, 24 * S, 'Apartment', {
            fontFamily: 'Arial Black',
            fontSize: 22 * S,
            color: '#3a362f',
            backgroundColor: '#faf3e4',
            padding: { x: 16 * S, y: 8 * S },
        });

        this.add
            .text(PANEL.x - 16 * S, 24 * S, `$${this.registry.get('totalEarned') ?? 0}`, {
                fontFamily: 'Arial Black',
                fontSize: 18 * S,
                color: '#3a362f',
                backgroundColor: '#f6dca0',
                padding: { x: 14 * S, y: 8 * S },
            })
            .setOrigin(1, 0);
    }

    /**
     * Draws the inventory panel's background. Highlighted (green outline) while the player
     * is holding an item over it, to say "drop here to put this away".
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
     * Rebuilds the inventory slots: one for every catalog item that is neither in the room
     * nor currently being held. Each slot shows the item's footprint (to scale), its name and
     * its size, so different-sized items are easy to tell apart.
     */
    refreshInventory ()
    {
        for (const object of this.inventoryObjects)
        {
            object.destroy();
        }
        this.inventoryObjects = [];
        this.slotRects = [];

        const available = [...this.defs.values()].filter(
            (def) => !this.roomGrid.has(def.id) && !(this.drag && this.drag.id === def.id)
        );

        available.forEach((def, index) => {
            const column = index % SLOT.columns;
            const row = Math.floor(index / SLOT.columns);
            const x = PANEL.x + SLOT.padding + column * (SLOT.size + SLOT.gap);
            const y = SLOT.firstY + row * (SLOT.size + SLOT.gap);

            const g = this.add.graphics();
            g.fillStyle(0xf0e4cc, 1);
            g.fillRoundedRect(x, y, SLOT.size, SLOT.size, 10 * S);

            // The footprint drawn to scale (16px per cell), centred in the upper part of the slot.
            const cell = 16 * S;
            const iconWidth = def.cols * cell;
            const iconHeight = def.rows * cell;
            g.fillStyle(parseColor(def.color), 1);
            g.fillRect(x + (SLOT.size - iconWidth) / 2, y + 8 * S + (48 * S - iconHeight) / 2, iconWidth, iconHeight);

            const name = this.add
                .text(x + SLOT.size / 2, y + 62 * S, def.name, { fontFamily: 'Arial Black', fontSize: 12 * S, color: '#3a362f' })
                .setOrigin(0.5);
            const size = this.add
                .text(x + SLOT.size / 2, y + 77 * S, `${def.cols} x ${def.rows}`, { fontFamily: 'Arial', fontSize: 11 * S, color: '#6b6354' })
                .setOrigin(0.5);

            this.inventoryObjects.push(g, name, size);
            this.slotRects.push({ id: def.id, x, y, width: SLOT.size, height: SLOT.size });
        });

        if (available.length === 0)
        {
            this.inventoryObjects.push(
                this.add
                    .text(PANEL.x + PANEL.width / 2, SLOT.firstY + 40 * S, 'Everything is placed.\nDrag items here\nto put them away.', {
                        fontFamily: 'Arial',
                        fontSize: 14 * S,
                        color: '#6b6354',
                        align: 'center',
                    })
                    .setOrigin(0.5, 0)
            );
        }
    }

    // ------------------------------------------------------------ placed furniture state

    /**
     * Gives every placed item a draw depth from RoomGrid's back-to-front order, so nearer
     * furniture is drawn over farther furniture (and tall items hide what's behind them).
     */
    updateDepths ()
    {
        this.roomGrid.getDrawOrder().forEach((placement, index) => {
            this.views.get(placement.id).setDepth(PLACED_DEPTH_BASE + index);
        });
    }

    /** Remembers the current layout in the registry so it survives leaving the screen. */
    saveLayout ()
    {
        const layout = {};
        for (const placement of this.roomGrid.placed.values())
        {
            layout[placement.id] = { col: placement.col, row: placement.row };
        }
        this.registry.set(LAYOUT_KEY, layout);
    }

    /** Puts back whatever was in the room last time (silently skipping anything that no longer fits). */
    restoreLayout ()
    {
        const layout = this.registry.get(LAYOUT_KEY) ?? {};
        for (const [id, position] of Object.entries(layout))
        {
            const def = this.defs.get(id);
            if (def && this.roomGrid.canPlace(def, position.col, position.row))
            {
                this.roomGrid.place(def, position.col, position.row);
                this.views.get(id).drawAt(position.col, position.row);
            }
        }
    }

    /**
     * Finds the placed item under a screen point, front-most first (so clicking where a tall
     * item overlaps something behind it picks the item in front).
     *
     * @param {number} x
     * @param {number} y
     * @returns {string | null} the item id, or null if the point isn't on any placed item.
     */
    hitTestPlaced (x, y)
    {
        const frontToBack = this.roomGrid.getDrawOrder().reverse();
        for (const placement of frontToBack)
        {
            const def = this.defs.get(placement.id);
            const faces = getBoxFaces(this.projection, placement.col, placement.row, placement.cols, placement.rows, def.height * S);
            if (pointInBox(x, y, faces))
            {
                return placement.id;
            }
        }
        return null;
    }

    // ------------------------------------------------------------------ mouse handling

    /**
     * Mouse pressed: start dragging whatever is under it - an inventory slot or a placed item.
     *
     * @param {import('phaser').Input.Pointer} pointer
     */
    onPointerDown (pointer)
    {
        if (this.drag)
        {
            return;
        }

        const slot = this.slotRects.find(
            (rect) => pointer.x >= rect.x && pointer.x <= rect.x + rect.width && pointer.y >= rect.y && pointer.y <= rect.y + rect.height
        );
        if (slot)
        {
            this.startDrag(slot.id, 'inventory', pointer);
            return;
        }

        const placedId = this.hitTestPlaced(pointer.x, pointer.y);
        if (placedId)
        {
            this.startDrag(placedId, 'room', pointer);
        }
    }

    /**
     * Begins dragging an item. An item picked up from the room is removed from the RoomGrid
     * straight away (so it doesn't block its own new position) but remembered in `origin` so
     * it can be put back if it's dropped somewhere illegal.
     *
     * The mouse might grab a tall item by its top, far above its floor footprint. `grab`
     * records the offset from the mouse to the footprint's centre so the item doesn't jump
     * when picked up; the footprint then follows (mouse + grab).
     *
     * @param {string} id
     * @param {'inventory' | 'room'} source
     * @param {import('phaser').Input.Pointer} pointer
     */
    startDrag (id, source, pointer)
    {
        const def = this.defs.get(id);
        let origin = null;
        let grab = { x: 0, y: 0 };

        if (source === 'room')
        {
            origin = this.roomGrid.remove(id);
            const footprintCentre = this.projection.project(origin.col + def.cols / 2, origin.row + def.rows / 2);
            grab = { x: footprintCentre.x - pointer.x, y: footprintCentre.y - pointer.y };
        }

        this.drag = { id, def, origin, grab, target: { type: 'none' } };
        this.views.get(id).setDepth(HELD_DEPTH);
        this.updateDepths();
        this.refreshInventory();
        this.updateDrag(pointer);
    }

    /**
     * Mouse moved: while dragging, move the held item and update the ghost.
     *
     * @param {import('phaser').Input.Pointer} pointer
     */
    onPointerMove (pointer)
    {
        if (this.drag)
        {
            this.updateDrag(pointer);
        }
    }

    /**
     * Updates the held item, the ghost and the drop target for the current mouse position.
     *
     * The floor position of the item's footprint centre is the mouse position plus the grab
     * offset, run backwards through the projection (unproject). Dividing out half the
     * footprint gives the back-left corner; rounding that to whole cells is the grid snap.
     *
     * @param {import('phaser').Input.Pointer} pointer
     */
    updateDrag (pointer)
    {
        const { id, def, grab } = this.drag;
        const view = this.views.get(id);

        const floorPoint = this.projection.unproject(pointer.x + grab.x, pointer.y + grab.y);
        if (!floorPoint)
        {
            return;
        }
        const exactCol = floorPoint.u - def.cols / 2;
        const exactRow = floorPoint.v - def.rows / 2;

        const overPanel = pointer.x >= PANEL.x && pointer.x <= PANEL.x + PANEL.width && pointer.y >= PANEL.y && pointer.y <= PANEL.y + PANEL.height;

        // The held item follows the mouse exactly (fractional position), slightly see-through.
        if (overPanel)
        {
            // Far off to the side of the floor the projection would shear the item badly, so
            // over the panel draw it undistorted (centred, at the near edge's scale) and just
            // slide the whole view so it sits under the mouse.
            const referenceCol = (this.roomGrid.cols - def.cols) / 2;
            const referenceRow = this.roomGrid.rows - def.rows;
            view.drawAt(referenceCol, referenceRow, 0.8);
            const referenceCentre = this.projection.project(referenceCol + def.cols / 2, referenceRow + def.rows / 2);
            view.container.setPosition(pointer.x - referenceCentre.x, pointer.y - referenceCentre.y);
        }
        else
        {
            view.container.setPosition(0, 0);
            view.drawAt(exactCol, exactRow, 0.8);
        }

        this.ghostGraphics.clear();

        // Over the inventory panel: dropping here puts the item away. No ghost on the floor.
        this.drawPanel(overPanel);
        if (overPanel)
        {
            this.drag.target = { type: 'inventory' };
            return;
        }

        const col = Math.round(exactCol);
        const row = Math.round(exactRow);

        // A footprint wholly outside the floor isn't a placement attempt at all (the mouse is
        // somewhere else on screen), so it gets no ghost; partly outside gets a red ghost.
        const touchesFloor = col + def.cols > 0 && col < this.roomGrid.cols && row + def.rows > 0 && row < this.roomGrid.rows;
        if (!touchesFloor)
        {
            this.drag.target = { type: 'none' };
            return;
        }

        const valid = this.roomGrid.canPlace(def, col, row);
        this.drag.target = { type: 'floor', col, row, valid };
        this.drawGhost(def, col, row, valid);
    }

    /**
     * Draws the ghost for a would-be placement: the floor cells it covers filled green (legal)
     * or red (not), plus a faint tinted box so the item's height is visible too.
     *
     * @param {import('../../data/loadApartment.js').FurnitureDef} def
     * @param {number} col
     * @param {number} row
     * @param {boolean} valid
     */
    drawGhost (def, col, row, valid)
    {
        const color = valid ? GHOST_VALID_COLOR : GHOST_INVALID_COLOR;
        const faces = getBoxFaces(this.projection, col, row, def.cols, def.rows, def.height * S);
        const g = this.ghostGraphics;

        g.fillStyle(color, 0.55);
        g.fillPoints(faces.footprint, true, true);
        g.lineStyle(3 * S, color, 1);
        g.strokePoints(faces.footprint, true, true);

        if (!def.flat)
        {
            drawBox(g, faces, color, 0.35);
        }
    }

    /**
     * Mouse released: drop the held item.
     *   - Over the inventory panel: it goes (or stays) in the inventory.
     *   - Over a legal floor spot: it is placed there.
     *   - Anywhere else: it goes back where it came from (its old spot, or the inventory).
     *
     * @param {import('phaser').Input.Pointer} pointer
     */
    onPointerUp (pointer)
    {
        if (!this.drag)
        {
            return;
        }
        this.updateDrag(pointer);

        const { id, def, origin, target } = this.drag;
        const view = this.views.get(id);
        view.container.setPosition(0, 0); // drawings below are in absolute coordinates.

        if (target.type === 'floor' && target.valid)
        {
            this.roomGrid.place(def, target.col, target.row);
            view.drawAt(target.col, target.row);
        }
        else if (target.type !== 'inventory' && origin)
        {
            // Illegal drop of an item that came from the room: put it back exactly where it was.
            this.roomGrid.place(def, origin.col, origin.row);
            view.drawAt(origin.col, origin.row);
        }
        else
        {
            view.hide();
        }

        this.drag = null;
        this.ghostGraphics.clear();
        this.drawPanel(false);
        this.updateDepths();
        this.saveLayout();
        this.refreshInventory();
    }
}
