import { getShapeBounds, getShapeCells } from '../../core/Shape.js';
import { UI_SCALE } from '../uiScale.js';
import { playSfx } from '../audio.js';
import { addUiPanel } from './uiPanel.js';

/**
 * DayStartPopup.js
 *
 * The popup shown at the start of each level (day), displaying day number, truck count,
 * and an action line, with the boss's head beside them. The panel is fitted tightly to that
 * content (the text is measured), so there is no wasted white space.
 *
 * If the level introduces new parcels they get their own highlighted band under the day info:
 * a gold-tinted strip with a bold "New Parcel!" heading and the parcels drawn big, each with a
 * pulsing gold halo, and the popup stays up a little longer so they are noticed.
 *
 * The popup pops onto the screen with overshoot, stays for a moment, then shrinks back
 * and disappears. While it is up, a full-screen blocker swallows all pointer input.
 */

/** Timings in milliseconds. */
const POP_IN_MS = 450;
const HOLD_MS = 1600; // Longer hold time to read the day info.
const HOLD_NEW_MS = 2800; // ...and longer still when there are new parcels to look at.
const SHRINK_MS = 300;

/** Draw depth: above everything in PuzzleScene. */
const POPUP_DEPTH = 2000;

/** Size constants (design pixels before UI_SCALE). */
const NEW_CELL = 64; // one cell of a newly introduced parcel: large, so it stands out
const NEW_GAP = 44; // between several new parcels
const NEW_GOLD = 0xffd34d;

/** Action lines that vary every other day (every other day gets the same line). */
const ACTION_LINES = [
    'Pack the trucks!',
    'Load them up!',
    'Get packing!',
    'Time to work!',
    'Let\'s go!',
    'Keep moving!',
];

/**
 * Shows the day-start popup with day number, truck count, and optional new shapes.
 *
 * @param {import('phaser').Scene} scene - the scene to draw into (PuzzleScene).
 * @param {number} dayNumber - 1-indexed day/level number (1, 2, 3...).
 * @param {number} truckCount - how many trucks on this day.
 * @param {string[]} [shapeIds] - newly introduced shapes to show; empty if none.
 * @param {() => void} [onDone] - called once the popup has shrunk away and been removed.
 */
export function showDayStartPopup(scene, dayNumber, truckCount, shapeIds = [], onDone)
{
    const S = UI_SCALE;
    const centerX = scene.scale.width / 2;
    const centerY = scene.scale.height / 2;
    const cell = NEW_CELL * S;

    // Dims the board and blocks interaction.
    const blocker = scene.add
        .rectangle(centerX, centerY, scene.scale.width, scene.scale.height, 0x000000, 0.4)
        .setDepth(POPUP_DEPTH)
        .setInteractive();

    // Choose action line: alternate every other day.
    const actionLineIndex = Math.floor((dayNumber - 1) / 2) % ACTION_LINES.length;
    const actionLine = ACTION_LINES[actionLineIndex];

    // ---- Layout. Everything is measured first, then the panel is made exactly big enough.
    const FRAME = 37 * S; // the wood frame's thickness
    const PAD_X = 24 * S;
    const PAD_Y = 16 * S;
    const BOSS_SIZE = 180 * S;
    const TEXT_GAP = 6 * S; // between the three lines of text
    const HEAD_GAP = 36 * S; // between the text and the boss's head
    const ROW_GAP = 14 * S; // between the day info and the new-parcel band
    const BAND_PAD = 16 * S;

    // The three lines of text, made now so their real width and height can be used.
    const dayText = scene.add
        .text(0, 0, `Day ${dayNumber}`, { fontFamily: 'Fredoka, Arial Black', fontStyle: '700', fontSize: 48 * S, color: '#3a362f' })
        .setOrigin(0, 0);
    const trucksText = scene.add
        .text(0, 0, `${truckCount} Truck${truckCount === 1 ? '' : 's'}`, { fontFamily: 'Fredoka, Arial', fontStyle: '600', fontSize: 38 * S, color: '#6b6354' })
        .setOrigin(0, 0);
    const actionText = scene.add
        .text(0, 0, actionLine, { fontFamily: 'Fredoka, Arial', fontStyle: '600', fontSize: 32 * S, color: '#c0501f' })
        .setOrigin(0, 0);
    const lines = [dayText, trucksText, actionText];
    const textWidth = Math.max(...lines.map((line) => line.width));
    const textHeight = lines.reduce((sum, line) => sum + line.height, 0) + TEXT_GAP * (lines.length - 1);

    // The top row: the text on the left, the boss's head on the right, centred on each other.
    const topRowWidth = textWidth + HEAD_GAP + BOSS_SIZE;
    const topRowHeight = Math.max(textHeight, BOSS_SIZE);

    // The new-parcel band (only when the level introduces some).
    const shapes = shapeIds.map((id) => ({ id, bounds: getShapeBounds(id) }));
    let band = null;
    if (shapes.length > 0)
    {
        const heading = scene.add
            .text(0, 0, shapes.length > 1 ? 'New Parcels!' : 'New Parcel!', { fontFamily: 'Fredoka, Arial Black', fontStyle: '700', fontSize: 40 * S, color: '#c0501f' })
            .setOrigin(0.5, 0);
        const rowWidth = shapes.reduce((sum, shape) => sum + shape.bounds.cols * cell, 0) + (shapes.length - 1) * NEW_GAP * S;
        const tallest = Math.max(...shapes.map((shape) => shape.bounds.rows)) * cell;
        const halo = 10 * S; // how far the glow sticks out past a parcel
        band = {
            heading,
            rowWidth,
            tallest,
            halo,
            height: BAND_PAD + heading.height + 8 * S + halo + tallest + halo + BAND_PAD,
            width: Math.max(rowWidth + 2 * (BAND_PAD + halo) + 40 * S, heading.width + 2 * BAND_PAD),
        };
    }

    const innerWidth = Math.max(topRowWidth, band ? band.width : 0);
    const panelWidth = innerWidth + 2 * (FRAME + PAD_X);
    const panelHeight = topRowHeight + (band ? ROW_GAP + band.height : 0) + 2 * (FRAME + PAD_Y);

    // Everything is a child of one container centred, so scaling pops/shrinks from the middle.
    const container = scene.add.container(centerX, centerY).setDepth(POPUP_DEPTH + 1).setScale(0);
    container.add(addUiPanel(scene, 0, 0, panelWidth, panelHeight));

    const innerLeft = -innerWidth / 2;
    const innerTop = -panelHeight / 2 + FRAME + PAD_Y;

    // The text, stacked and centred vertically in the top row.
    let textY = innerTop + (topRowHeight - textHeight) / 2;
    for (const line of lines)
    {
        line.setPosition(innerLeft, textY);
        container.add(line);
        textY += line.height + TEXT_GAP;
    }

    // The boss's head, right-aligned in the top row.
    if (scene.textures.exists('boss-head'))
    {
        container.add(
            scene.add
                .image(innerLeft + innerWidth - BOSS_SIZE / 2, innerTop + topRowHeight / 2, 'boss-head')
                .setDisplaySize(BOSS_SIZE, BOSS_SIZE)
        );
    }

    // The new-parcel band: a gold-tinted rounded strip across the full width, heading, then the
    // parcels centred, each on a pulsing halo and gently bouncing.
    if (band)
    {
        const bandTop = innerTop + topRowHeight + ROW_GAP;
        const strip = scene.add.graphics();
        strip.fillStyle(0xfff0b8, 1);
        strip.fillRoundedRect(innerLeft, bandTop, innerWidth, band.height, 18 * S);
        strip.lineStyle(4 * S, 0xf0a020, 1);
        strip.strokeRoundedRect(innerLeft, bandTop, innerWidth, band.height, 18 * S);
        container.add(strip);

        band.heading.setPosition(0, bandTop + BAND_PAD);
        container.add(band.heading);

        const rowTop = bandTop + BAND_PAD + band.heading.height + 8 * S + band.halo;
        let cursorX = -band.rowWidth / 2;
        for (const shape of shapes)
        {
            const width = shape.bounds.cols * cell;
            const height = shape.bounds.rows * cell;
            // One container per parcel, centred on the parcel, so it can bounce about its middle.
            const parcel = scene.add.container(cursorX + width / 2, rowTop + band.tallest / 2);
            // The glow: a gold rounded square just bigger than each cell, behind the art, so
            // together they outline the whole shape.
            const glow = scene.add.graphics();
            glow.fillStyle(NEW_GOLD, 0.95);
            for (const shapeCell of getShapeCells(shape.id))
            {
                glow.fillRoundedRect(shapeCell.col * cell - width / 2 - band.halo, shapeCell.row * cell - height / 2 - band.halo, cell + 2 * band.halo, cell + 2 * band.halo, band.halo * 1.5);
            }
            parcel.add(glow);
            parcel.add(scene.add.image(0, 0, shape.id).setDisplaySize(width, height));
            container.add(parcel);
            scene.tweens.add({ targets: glow, alpha: { from: 1, to: 0.35 }, duration: 550, yoyo: true, repeat: -1 });
            scene.tweens.add({ targets: parcel, scale: { from: 1, to: 1.08 }, duration: 550, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
            cursorX += width + NEW_GAP * S;
        }
    }

    playSfx(scene, 'pop');

    // Pop in with overshoot, hold, then shrink back.
    scene.tweens.add({
        targets: container,
        scale: 1,
        duration: POP_IN_MS,
        ease: 'Back.easeOut',
        onComplete: () => {
            scene.time.delayedCall(shapes.length > 0 ? HOLD_NEW_MS : HOLD_MS, () => {
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
