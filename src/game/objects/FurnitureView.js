import { getBoxFaces } from '../../core/RoomProjection.js';
import { UI_SCALE } from '../uiScale.js';

/**
 * FurnitureView.js
 *
 * Draws one piece of apartment furniture as a placeholder 3D box (a front face, a top
 * face and - when it's visible - a side face) plus a name label. All the geometry comes
 * from src/core/RoomProjection.js (getBoxFaces); this class only paints it with Phaser
 * Graphics, holds no placement rules (see src/core/RoomGrid.js), and knows nothing about
 * dragging - ApartmentScene decides where each view is drawn and when.
 *
 * A view draws in absolute screen coordinates (its container sits at 0, 0), so moving an
 * item is simply drawAt(newCol, newRow). The column/row may be fractional, which is how an
 * item being dragged follows the mouse smoothly before it snaps to a whole cell.
 */

/**
 * Parses a "#rrggbb" string (as used in apartment.json) into the 0xrrggbb number Phaser uses.
 *
 * @param {string} hex
 * @returns {number}
 */
export function parseColor(hex) {
    return parseInt(hex.slice(1), 16);
}

/**
 * Makes a colour darker (factor < 1) or lighter (factor > 1). Used to give each box's
 * faces different brightness so it reads as a solid object: top lightest, side darkest.
 *
 * @param {number} color - 0xrrggbb.
 * @param {number} factor - below 1 multiplies each channel (darker); above 1 mixes toward white.
 * @returns {number} 0xrrggbb
 */
export function shadeColor(color, factor) {
    const channels = [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff].map((channel) => {
        const shaded = factor <= 1 ? channel * factor : channel + (255 - channel) * (factor - 1);
        return Math.max(0, Math.min(255, Math.round(shaded)));
    });
    return (channels[0] << 16) | (channels[1] << 8) | channels[2];
}

/**
 * Paints a box's visible faces (side, then front, then top, so the top overlaps the
 * others' edges cleanly) onto a Graphics object.
 *
 * @param {import('phaser').GameObjects.Graphics} graphics
 * @param {import('../../core/RoomProjection.js').BoxFaces} faces
 * @param {number} color - base colour (the front face); the other faces are shaded from it.
 * @param {number} [alpha] - opacity of everything drawn.
 */
export function drawBox(graphics, faces, color, alpha = 1) {
    graphics.lineStyle(1.5 * UI_SCALE, shadeColor(color, 0.6), alpha);

    const paint = (points, faceColor) => {
        graphics.fillStyle(faceColor, alpha);
        graphics.fillPoints(points, true, true);
        graphics.strokePoints(points, true, true);
    };

    if (faces.side) {
        paint(faces.side, shadeColor(color, 0.78));
    }
    paint(faces.front, color);
    paint(faces.top, shadeColor(color, 1.2));
}

export class FurnitureView {
    /**
     * @param {import('phaser').Scene} scene
     * @param {import('../../core/RoomProjection.js').RoomProjection} projection
     * @param {import('../../data/loadApartment.js').FurnitureDef} def - the catalog entry to draw.
     */
    constructor(scene, projection, def) {
        this.projection = projection;
        this.def = def;
        this.color = parseColor(def.color);

        this.graphics = scene.add.graphics();
        this.label = scene.add
            .text(0, 0, def.name, {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: 12 * UI_SCALE,
                color: '#ffffff',
                stroke: '#3a362f',
                strokeThickness: 3 * UI_SCALE,
            })
            .setOrigin(0.5);

        // Hidden until the item is in the room or being dragged (while it sits in the inventory).
        this.container = scene.add.container(0, 0, [this.graphics, this.label]).setVisible(false);
    }

    /**
     * Draws the item with its back-left floor cell at (col, row) and shows it.
     *
     * @param {number} col - floor column (may be fractional while dragging).
     * @param {number} row - floor row (may be fractional while dragging).
     * @param {number} [alpha] - opacity; below 1 while the item is being held.
     */
    drawAt(col, row, alpha = 1) {
        const { cols, rows, height, flat } = this.def;
        const faces = getBoxFaces(this.projection, col, row, cols, rows, height * UI_SCALE);

        this.graphics.clear();
        drawBox(this.graphics, faces, this.color, alpha);

        // Put the name on the front face - or on the top face for flat/very short items
        // (a rug has almost no front face to write on). The text shrinks with distance so
        // labels on far-away items don't spill outside the item.
        const frontHeight = faces.front[0].y - faces.front[3].y;
        const useTop = flat || frontHeight < 18 * UI_SCALE;
        const face = useTop ? faces.top : faces.front;
        this.label.setPosition(
            (face[0].x + face[1].x + face[2].x + face[3].x) / 4,
            (face[0].y + face[1].y + face[2].y + face[3].y) / 4
        );
        const scale = this.projection.scaleAt(row + rows);
        this.label.setFontSize(Math.max(8, 12 * scale) * UI_SCALE);
        this.label.setAlpha(alpha);

        this.container.setVisible(true);
    }

    /** Hides the item (it is back in the inventory). */
    hide() {
        this.container.setVisible(false);
    }

    /**
     * Sets the draw depth: higher depths are drawn in front of lower ones.
     *
     * @param {number} depth
     */
    setDepth(depth) {
        this.container.setDepth(depth);
    }
}
