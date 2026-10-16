/**
 * RoomProjection.test.js
 *
 * Tests for src/core/RoomProjection.js: the floor-grid <-> screen mapping (including that
 * it round-trips exactly, which is what makes mouse placement land on the right cell),
 * the depth cues (things further back are smaller, rows are horizontal), and the box
 * polygons used to draw and click furniture.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createRoomProjection, getBoxFaces, pointInPolygon, pointInBox } from '../../src/core/RoomProjection.js';

const config = { cols: 8, rows: 6, centerX: 400, backY: 260, frontY: 690, backWidth: 440, frontWidth: 720 };
const projection = createRoomProjection(config);

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ''} expected ${expected}, got ${actual}`);

describe('createRoomProjection - mapping floor <-> screen', () => {
    test('the four floor corners land where the config says', () => {
        assert.deepEqual(projection.project(0, 0), { x: 400 - 220, y: 260 }); // back-left
        assert.deepEqual(projection.project(8, 0), { x: 400 + 220, y: 260 }); // back-right
        assert.deepEqual(projection.project(0, 6), { x: 400 - 360, y: 690 }); // front-left
        assert.deepEqual(projection.project(8, 6), { x: 400 + 360, y: 690 }); // front-right
    });

    test('the floor is narrower at the back than the front, and row lines are horizontal', () => {
        assert.equal(projection.widthAt(0), 440);
        assert.equal(projection.widthAt(6), 720);
        assert.ok(projection.widthAt(3) > 440 && projection.widthAt(3) < 720);
        for (let v = 0; v <= 6; v++) {
            assert.equal(projection.project(0, v).y, projection.project(8, v).y, `row line ${v} must be horizontal`);
        }
    });

    test('scaleAt is 1 at the near edge and shrinks toward the back', () => {
        close(projection.scaleAt(6), 1);
        close(projection.scaleAt(0), 440 / 720);
        assert.ok(projection.scaleAt(2) < projection.scaleAt(4));
    });

    test('unproject exactly inverts project, everywhere on the floor', () => {
        for (let u = 0; u <= 8; u += 0.5) {
            for (let v = 0; v <= 6; v += 0.5) {
                const { x, y } = projection.project(u, v);
                const back = projection.unproject(x, y);
                close(back.u, u, `u at (${u},${v})`);
                close(back.v, v, `v at (${u},${v})`);
            }
        }
    });

    test('the centre of every cell unprojects back into that cell', () => {
        for (let col = 0; col < 8; col++) {
            for (let row = 0; row < 6; row++) {
                const { x, y } = projection.project(col + 0.5, row + 0.5);
                const { u, v } = projection.unproject(x, y);
                assert.equal(Math.floor(u), col);
                assert.equal(Math.floor(v), row);
            }
        }
    });

    test('unproject returns null for a point so far above the room that the floor width would be <= 0', () => {
        assert.equal(projection.unproject(400, -5000), null);
    });
});

describe('getBoxFaces - what a piece of furniture looks like', () => {
    test('every face is a 4-point polygon; the top is shifted straight up from the footprint', () => {
        const faces = getBoxFaces(projection, 2, 2, 2, 1, 100);
        for (const face of [faces.footprint, faces.front, faces.top]) {
            assert.equal(face.length, 4);
        }
        // Footprint corners are [backLeft, backRight, frontRight, frontLeft]; the top face's
        // corners are the same x positions, higher up the screen (smaller y).
        for (let i = 0; i < 4; i++) {
            assert.equal(faces.top[i].x, faces.footprint[i].x);
            assert.ok(faces.top[i].y < faces.footprint[i].y);
        }
    });

    test('perspective: the front edge of a box is drawn taller than its back edge', () => {
        const faces = getBoxFaces(projection, 2, 1, 2, 3, 100);
        const backLift = faces.footprint[0].y - faces.top[0].y;
        const frontLift = faces.footprint[3].y - faces.top[3].y;
        assert.ok(frontLift > backLift);
    });

    test('a box at the back is drawn smaller than the same box at the front', () => {
        const back = getBoxFaces(projection, 3, 0, 2, 1, 100);
        const front = getBoxFaces(projection, 3, 5, 2, 1, 100);
        const widthOf = (faces) => faces.front[1].x - faces.front[0].x;
        const heightOf = (faces) => faces.front[0].y - faces.front[3].y;
        assert.ok(widthOf(back) < widthOf(front));
        assert.ok(heightOf(back) < heightOf(front));
    });

    test('boxes left of centre show their right side, right of centre show their left side', () => {
        assert.equal(getBoxFaces(projection, 0, 2, 1, 1, 50).sideSide, 'right');
        assert.equal(getBoxFaces(projection, 7, 2, 1, 1, 50).sideSide, 'left');
        const centred = getBoxFaces(projection, 3, 2, 2, 1, 50); // columns 3-4: exactly centred on an 8-wide floor
        assert.equal(centred.side, null);
        assert.equal(centred.sideSide, null);
    });

    test('a nearer box sits lower on the screen than a farther one', () => {
        const far = getBoxFaces(projection, 3, 0, 1, 1, 10);
        const near = getBoxFaces(projection, 3, 5, 1, 1, 10);
        assert.ok(near.footprint[0].y > far.footprint[0].y);
    });
});

describe('pointInPolygon / pointInBox - picking furniture with the mouse', () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

    test('inside and outside a square', () => {
        assert.equal(pointInPolygon(5, 5, square), true);
        assert.equal(pointInPolygon(15, 5, square), false);
        assert.equal(pointInPolygon(5, -1, square), false);
    });

    test('works for a concave-free slanted quad (a floor trapezoid)', () => {
        const floor = [projection.project(0, 0), projection.project(8, 0), projection.project(8, 6), projection.project(0, 6)];
        assert.equal(pointInPolygon(400, 400, floor), true);
        assert.equal(pointInPolygon(100, 261, floor), false, 'left of the narrow back edge');
        assert.equal(pointInPolygon(100, 689, floor), true, 'but inside the wide front edge');
    });

    test('a tall box can be grabbed by its upper body, not just its footprint', () => {
        const faces = getBoxFaces(projection, 2, 3, 2, 1, 140);
        const frontMiddle = {
            x: (faces.front[0].x + faces.front[1].x) / 2,
            y: (faces.front[0].y + faces.front[3].y) / 2,
        };
        assert.equal(pointInBox(frontMiddle.x, frontMiddle.y, faces), true);
        assert.equal(pointInBox(frontMiddle.x, faces.top[0].y - 20, faces), false, 'above the box');
        assert.equal(pointInBox(5, 5, faces), false, 'nowhere near the box');
    });
});
