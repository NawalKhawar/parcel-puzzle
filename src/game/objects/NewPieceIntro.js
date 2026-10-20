import { getShapeBounds } from '../../core/Shape.js';
import { UI_SCALE } from '../uiScale.js';
import { playSfx } from '../audio.js';
import { addUiPanel } from './uiPanel.js';

/**
 * NewPieceIntro.js
 *
 * The "New piece!" popup shown at the start of a level that introduces new shapes. It pops
 * onto the screen with a little overshoot ("give"), stays for a moment, then shrinks back
 * and disappears, returning to gameplay. While it is up, a full-screen blocker swallows all
 * pointer input, so the puzzle can't be touched underneath; the player never has to dismiss it.
 *
 * The popup shows each new shape using its art image (the same image as the matching piece in
 * the tray), just the pieces themselves under the heading - no name label under each one. It
 * holds no puzzle logic; PuzzleScene decides when to show it.
 */

/** Timings in milliseconds. */
const POP_IN_MS = 450;
const HOLD_MS = 1100;
const SHRINK_MS = 300;

/** Draw depth: above everything in PuzzleScene, including the hint highlight. */
const INTRO_DEPTH = 2000;

/** Size of one cell of a previewed shape, in design pixels (before UI_SCALE). */
const PREVIEW_CELL = 40;
const PREVIEW_GAP = 56;

/**
 * Shows the popup and, when it has gone, calls `onDone`.
 *
 * @param {import('phaser').Scene} scene - the scene to draw into (PuzzleScene).
 * @param {string[]} shapeIds - the newly introduced shapes to show.
 * @param {() => void} [onDone] - called once the popup has shrunk away and been removed.
 */
export function showNewPieceIntro(scene, shapeIds, onDone)
{
    const S = UI_SCALE;
    const centerX = scene.scale.width / 2;
    const centerY = scene.scale.height / 2;
    const cell = PREVIEW_CELL * S;

    // Dims the board and, being interactive, stops every click/drag from reaching it.
    const blocker = scene.add
        .rectangle(centerX, centerY, scene.scale.width, scene.scale.height, 0x000000, 0.4)
        .setDepth(INTRO_DEPTH)
        .setInteractive();

    // ---- Layout of the panel, measured from the shapes it has to hold.
    const shapes = shapeIds.map((id) => ({ id, bounds: getShapeBounds(id) }));
    const rowWidth = shapes.reduce((sum, shape) => sum + shape.bounds.cols * cell, 0) + (shapes.length - 1) * PREVIEW_GAP * S;
    const tallest = Math.max(...shapes.map((shape) => shape.bounds.rows)) * cell;
    // The panel's wood frame is ~37px thick on every side, so the content (heading, gap, shapes)
    // sits on the paper inside it with an even PAD of breathing room all round.
    const FRAME = 37 * S;
    const PAD = 26 * S;
    const HEADING_HEIGHT = 42 * S;
    const HEADING_GAP = 22 * S;
    const panelWidth = Math.max(380 * S, rowWidth + 2 * (FRAME + 40 * S));
    const panelHeight = 2 * (FRAME + PAD) + HEADING_HEIGHT + HEADING_GAP + tallest;

    // Everything is a child of one container centred on (0, 0), so scaling the container
    // pops/shrinks the whole popup from its middle.
    const container = scene.add.container(centerX, centerY).setDepth(INTRO_DEPTH + 1).setScale(0);

    container.add(addUiPanel(scene, 0, 0, panelWidth, panelHeight));

    container.add(
        scene.add
            .text(0, -panelHeight / 2 + FRAME + PAD + HEADING_HEIGHT / 2, shapeIds.length > 1 ? 'New pieces!' : 'New piece!', {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700',
                fontSize: 34 * S,
                color: '#3a362f',
            })
            .setOrigin(0.5)
    );

    // The shapes themselves, left to right - just the pieces, no name label under each one.
    let cursorX = -rowWidth / 2;
    const shapesTop = -panelHeight / 2 + FRAME + PAD + HEADING_HEIGHT + HEADING_GAP;
    for (const shape of shapes)
    {
        container.add(
            scene.add
                .image(cursorX, shapesTop, shape.id)
                .setOrigin(0, 0)
                .setDisplaySize(shape.bounds.cols * cell, shape.bounds.rows * cell)
        );
        cursorX += shape.bounds.cols * cell + PREVIEW_GAP * S;
    }

    playSfx(scene, 'pop');

    // Pop in with an overshoot, hold, then shrink back (a slight anticipation, then away).
    scene.tweens.add({
        targets: container,
        scale: 1,
        duration: POP_IN_MS,
        ease: 'Back.easeOut',
        onComplete: () => {
            scene.time.delayedCall(HOLD_MS, () => {
                scene.tweens.add({
                    targets: container,
                    scale: 0,
                    duration: SHRINK_MS,
                    ease: 'Back.easeIn',
                    onComplete: () => {
                        container.destroy();
                        blocker.destroy();
                        if (onDone)
                        {
                            onDone();
                        }
                    },
                });
            });
        },
    });
}
