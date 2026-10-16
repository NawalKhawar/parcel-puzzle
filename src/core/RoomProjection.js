/**
 * RoomProjection.js
 *
 * The 2.5D math for the apartment room: how floor-grid coordinates map to screen pixels
 * and back, and what a piece of furniture (a "box") looks like on screen. Pure maths with
 * no Phaser dependency (see "Architectural boundary" in PROJECT_STRUCTURE.md), so it can
 * be unit-tested and the scene only has to draw what this module computes.
 *
 * THE VIEW. The room is seen from the front and slightly above, like a dollhouse with the
 * front wall removed:
 *   - The BACK WALL is completely flat (a plain rectangle facing the player).
 *   - The FLOOR is a trapezoid: its far edge (against the back wall) is narrower than its
 *     near edge, so the side walls visibly angle outward toward the player. That narrowing
 *     is the depth cue.
 *   - Floor ROWS are horizontal lines, evenly spaced on screen. Row 0 is against the back
 *     wall, the last row is nearest the player.
 *   - Furniture stands up on its floor footprint; height is drawn straight up the screen,
 *     scaled by how far away the footprint is (things at the back look smaller).
 *
 * COORDINATES. Floor positions are (u, v) in grid units: u = column (0 at the left wall),
 * v = row (0 at the back wall). A whole-number (u, v) is a cell corner; the cell at
 * (col, row) covers u in [col, col+1] and v in [row, row+1].
 *
 * WHY THIS PROJECTION. Row lines are straight and horizontal and the width changes
 * linearly with depth, so (u, v) -> (x, y) can be inverted exactly in closed form
 * (unproject). That matters because the mouse position has to be turned back into a grid
 * cell, and a mapping that can't be inverted exactly would make placement feel off-by-one
 * near the back of the room. (It is not a true perspective divide - rows are evenly spaced
 * instead of bunching toward the back - but it reads as depth and keeps the math exact.)
 */

/**
 * @typedef {Object} Point
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} RoomProjectionConfig
 * @property {number} cols - floor width in cells.
 * @property {number} rows - floor depth in cells.
 * @property {number} centerX - screen x of the room's vertical centre line.
 * @property {number} backY - screen y of the floor's far edge (where the floor meets the back wall).
 * @property {number} frontY - screen y of the floor's near edge.
 * @property {number} backWidth - on-screen width of the far edge, in pixels.
 * @property {number} frontWidth - on-screen width of the near edge, in pixels (wider than backWidth).
 */

/**
 * @typedef {Object} RoomProjection
 * @property {number} cols
 * @property {number} rows
 * @property {RoomProjectionConfig} config
 * @property {(v: number) => number} widthAt - on-screen floor width at depth v.
 * @property {(v: number) => number} yAt - screen y of the row line at depth v.
 * @property {(v: number) => number} scaleAt - size factor at depth v: 1 at the near edge, smaller further back.
 * @property {(u: number, v: number) => Point} project - floor (u, v) to screen (x, y).
 * @property {(x: number, y: number) => ({u: number, v: number} | null)} unproject - screen (x, y) back to floor (u, v), assuming the point is on the floor plane.
 */

/**
 * Builds the projection functions for a room.
 *
 * @param {RoomProjectionConfig} config
 * @returns {RoomProjection}
 */
export function createRoomProjection(config) {
    const { cols, rows, centerX, backY, frontY, backWidth, frontWidth } = config;

    // Everything is linear in v (depth), so each helper is a simple interpolation from the
    // back edge (v = 0) to the front edge (v = rows).
    const widthAt = (v) => backWidth + (frontWidth - backWidth) * (v / rows);
    const yAt = (v) => backY + (frontY - backY) * (v / rows);
    const scaleAt = (v) => widthAt(v) / frontWidth;

    return {
        cols,
        rows,
        config,
        widthAt,
        yAt,
        scaleAt,

        project(u, v) {
            // Horizontally: u/cols is how far across the floor we are (0..1); subtract 0.5 to
            // measure from the centre line, then stretch by this depth's floor width.
            return { x: centerX + (u / cols - 0.5) * widthAt(v), y: yAt(v) };
        },

        unproject(x, y) {
            // Invert project() in the opposite order: y alone gives the depth (rows are
            // horizontal lines), and only then is the floor width at that depth known, which
            // is needed to turn x back into a column.
            const v = ((y - backY) / (frontY - backY)) * rows;
            const width = widthAt(v);
            if (width <= 0) {
                return null; // far above the room, past where the floor would shrink to nothing.
            }
            return { u: ((x - centerX) / width + 0.5) * cols, v };
        },
    };
}

/**
 * @typedef {Object} BoxFaces
 * @property {Point[]} footprint - the floor quad the item stands on.
 * @property {Point[]} front - the face looking at the player.
 * @property {Point[]} top - the top face.
 * @property {Point[] | null} side - the visible side face (the one turned toward the room's
 *   centre line), or null for an item exactly centred (no side is visible then).
 * @property {'left' | 'right' | null} sideSide - which side `side` is.
 */

/**
 * The on-screen polygons of a box-shaped item standing on the floor. The box covers
 * `footprintCols` x `footprintRows` cells with its back-left cell at (col, row), and is
 * `height` pixels tall at the near-edge scale (it is drawn smaller further back).
 *
 * Each top corner is its floor corner moved straight up by height * scaleAt(that corner's
 * depth), so a box leans naturally with the room's perspective: its front edge is taller
 * on screen than its back edge.
 *
 * Which side face shows: with a one-point view, you see the side of a box that faces the
 * centre line (a box left of centre shows its right side, and vice versa); the outer side
 * is hidden behind the box itself.
 *
 * @param {RoomProjection} projection
 * @param {number} col - back-left floor column of the footprint (may be fractional, e.g. while dragging).
 * @param {number} row - back-left floor row of the footprint (may be fractional).
 * @param {number} footprintCols - footprint width in cells.
 * @param {number} footprintRows - footprint depth in cells.
 * @param {number} height - box height in pixels at the near-edge scale.
 * @returns {BoxFaces}
 */
export function getBoxFaces(projection, col, row, footprintCols, footprintRows, height) {
    const backLeft = projection.project(col, row);
    const backRight = projection.project(col + footprintCols, row);
    const frontLeft = projection.project(col, row + footprintRows);
    const frontRight = projection.project(col + footprintCols, row + footprintRows);

    const backLift = height * projection.scaleAt(row);
    const frontLift = height * projection.scaleAt(row + footprintRows);
    const lift = (point, amount) => ({ x: point.x, y: point.y - amount });

    const backLeftTop = lift(backLeft, backLift);
    const backRightTop = lift(backRight, backLift);
    const frontLeftTop = lift(frontLeft, frontLift);
    const frontRightTop = lift(frontRight, frontLift);

    const centreCol = col + footprintCols / 2;
    const roomCentre = projection.cols / 2;
    let side = null;
    let sideSide = null;
    if (centreCol < roomCentre) {
        side = [backRight, frontRight, frontRightTop, backRightTop];
        sideSide = 'right';
    } else if (centreCol > roomCentre) {
        side = [backLeft, frontLeft, frontLeftTop, backLeftTop];
        sideSide = 'left';
    }

    return {
        footprint: [backLeft, backRight, frontRight, frontLeft],
        front: [frontLeft, frontRight, frontRightTop, frontLeftTop],
        top: [backLeftTop, backRightTop, frontRightTop, frontLeftTop],
        side,
        sideSide,
    };
}

/**
 * Even-odd ray-casting point-in-polygon test: shoots a ray to the right from the point and
 * counts how many polygon edges it crosses; an odd count means the point is inside.
 *
 * @param {number} x
 * @param {number} y
 * @param {Point[]} polygon - vertices in order (either winding).
 * @returns {boolean}
 */
export function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i];
        const b = polygon[j];
        // Does the edge a-b straddle the horizontal line through the point, and is the
        // crossing to the right of the point?
        const straddles = a.y > y !== b.y > y;
        if (straddles && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * Whether a screen point is on any visible part of a box (its footprint, front, top or
 * visible side). Used to pick up furniture by clicking on it - a tall item can be grabbed
 * by its upper body, not just by the floor it stands on.
 *
 * @param {number} x
 * @param {number} y
 * @param {BoxFaces} faces
 * @returns {boolean}
 */
export function pointInBox(x, y, faces) {
    return (
        pointInPolygon(x, y, faces.front) ||
        pointInPolygon(x, y, faces.top) ||
        (faces.side !== null && pointInPolygon(x, y, faces.side)) ||
        pointInPolygon(x, y, faces.footprint)
    );
}
