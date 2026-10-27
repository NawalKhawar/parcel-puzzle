import { UI_SCALE } from '../uiScale.js';
import { playSfx } from '../audio.js';
import { addUiPanel } from './uiPanel.js';
import { makePressable } from './pressFeedback.js';

/**
 * BossPanel.js
 *
 * The wood-framed speech panel a character uses for guidance: his head, a message, and optionally a
 * Next button. The panel is sized to its CONTENT - the message is measured and the frame grows or
 * shrinks round it - so a short line never sits in a big empty box. Changing the message (show)
 * re-measures and resizes the panel round its centre.
 *
 * Two layouts: 'vertical' (head on top, text under it - used beside the truck) and 'horizontal'
 * (head on the left, text on the right - compact, used for corner tips). The head can be any of the
 * character head pictures (boss-head, boss-happy-head, worker-head), chosen per message.
 *
 * It only draws and animates; the callers (FtueGuide, PuzzleScene's tips, cornerTip) decide what to
 * say and when.
 */

/** Timings in milliseconds. */
const POP_IN_MS = 450;
const POP_OUT_MS = 300;

/** Draw depth: above everything in PuzzleScene (same as the day-start popup). */
export const BOSS_PANEL_DEPTH = 2001;

/** Head sizes in design px: big on top of the vertical layout, a bit smaller beside the text. */
const HEAD_VERTICAL = 140;
const HEAD_HORIZONTAL = 130;

export class BossPanel
{
    /**
     * @param {import('phaser').Scene} scene
     * @param {Object} options
     * @param {number} options.left - screen x of the panel's left edge.
     * @param {number} options.centerY - screen y the panel is centred on (it grows up and down from here).
     * @param {number} options.width - panel width in screen pixels.
     * @param {number} [options.depth]
     * @param {'vertical' | 'horizontal'} [options.layout]
     * @param {string} [options.head] - the default head texture key (boss-head if omitted).
     */
    constructor (scene, { left, centerY, width, depth = BOSS_PANEL_DEPTH, layout = 'vertical', head = 'boss-head' })
    {
        this.scene = scene;
        this.width = width;
        this.layout = layout;
        this.defaultHead = head;
        /** The panel's height as of the last show() (screen px), before any scaling. */
        this.height = 0;
        /** The size the panel pops in to (1 = full size; corner tips use less). */
        this.targetScale = 1;
        // Everything hangs off one container centred on the panel, so scaling it pops it in and out
        // from its middle. It starts at scale 0 (see popIn).
        this.container = scene.add.container(left + width / 2, centerY).setDepth(depth).setScale(0);
        /** The Next button while one is showing, else null. */
        this.button = null;
    }

    /**
     * Shows a message, replacing whatever was there, with the panel fitted to it: the height is the
     * frame, the head, the measured text, and the button if there is one - plus even padding.
     *
     * @param {string} message
     * @param {Object} [options]
     * @param {string | null} [options.button] - label of a button under the text, or null for none.
     * @param {(() => void) | null} [options.onButton] - called when that button is pressed.
     * @param {string} [options.head] - head texture key for this message (the default if omitted).
     */
    show (message, { button = null, onButton = null, head = this.defaultHead } = {})
    {
        const S = UI_SCALE;
        const scene = this.scene;
        const FRAME = 37 * S; // the wood frame's thickness
        const PAD = 16 * S;
        const GAP = 10 * S;
        const BUTTON = { width: 130 * S, height: 44 * S };
        const horizontal = this.layout === 'horizontal';
        const headSize = (horizontal ? HEAD_HORIZONTAL : HEAD_VERTICAL) * S;
        const paperWidth = this.width - 2 * (FRAME + PAD);
        // Beside the head the text has less room.
        const textWidth = horizontal ? paperWidth - headSize - 14 * S : paperWidth;

        this.container.removeAll(true);
        this.button = null;

        // The text is created first, only so its wrapped height can be measured.
        const text = scene.add
            .text(0, 0, message, {
                fontFamily: 'Fredoka, Arial', fontStyle: '600',
                // Bigger when the panel stands beside the truck (start-of-level guidance) than in a corner tip.
                fontSize: (horizontal ? 28 : 26) * S,
                color: '#3a362f',
                align: horizontal ? 'left' : 'center',
                wordWrap: { width: textWidth },
            })
            .setOrigin(horizontal ? 0 : 0.5, horizontal ? 0.5 : 0);

        const buttonSpace = button ? GAP + BUTTON.height : 0;
        const bodyHeight = horizontal ? Math.max(headSize, text.height) : headSize + GAP + text.height;
        const height = 2 * (FRAME + PAD) + bodyHeight + buttonSpace;
        this.height = height;

        this.container.add(addUiPanel(scene, 0, 0, this.width, height));
        const top = -height / 2 + FRAME + PAD;
        const hasHead = scene.textures.exists(head);
        let y;
        if (horizontal)
        {
            const left = -paperWidth / 2;
            if (hasHead)
            {
                this.container.add(scene.add.image(left + headSize / 2, top + bodyHeight / 2, head).setDisplaySize(headSize, headSize));
            }
            text.setPosition(left + headSize + 14 * S, top + bodyHeight / 2);
            y = top + bodyHeight + GAP;
        }
        else
        {
            if (hasHead)
            {
                this.container.add(scene.add.image(0, top + headSize / 2, head).setDisplaySize(headSize, headSize));
            }
            text.setPosition(0, top + headSize + GAP);
            y = top + bodyHeight + GAP;
        }
        this.container.add(text);

        if (button)
        {
            // A rounded orange pill, like the shop's tabs.
            const background = scene.add.graphics();
            background.fillStyle(0xf0b86e, 1);
            background.fillRoundedRect(-BUTTON.width / 2, -BUTTON.height / 2, BUTTON.width, BUTTON.height, 14 * S);
            background.lineStyle(2 * S, 0x8a6a4d, 1);
            background.strokeRoundedRect(-BUTTON.width / 2, -BUTTON.height / 2, BUTTON.width, BUTTON.height, 14 * S);
            const label = scene.add
                .text(0, 0, button, { fontFamily: 'Fredoka, Arial Black', fontStyle: '700', fontSize: 22 * S, color: '#3a362f' })
                .setOrigin(0.5);
            this.button = scene.add.container(0, y + BUTTON.height / 2, [background, label]);
            this.button.setSize(BUTTON.width, BUTTON.height).setInteractive({ useHandCursor: true });
            makePressable(scene, this.button, () => onButton && onButton());
            this.container.add(this.button);
        }
    }

    /** Pops the panel in from nothing, with a little overshoot. */
    popIn ()
    {
        playSfx(this.scene, 'pop');
        this.scene.tweens.add({ targets: this.container, scale: this.targetScale, duration: POP_IN_MS, ease: 'Back.easeOut' });
    }

    /** A small bounce, so a change of message is noticed. */
    bounce ()
    {
        playSfx(this.scene, 'pop');
        this.scene.tweens.add({ targets: this.container, scale: { from: this.targetScale * 1.06, to: this.targetScale }, duration: 220 });
    }

    /**
     * Shrinks the panel away and removes it.
     *
     * @param {() => void} [onDone] - called once it has gone.
     */
    popOut (onDone)
    {
        this.scene.tweens.add({
            targets: this.container,
            scale: 0,
            duration: POP_OUT_MS,
            ease: 'Back.easeIn',
            onComplete: () => {
                this.container.destroy();
                if (onDone)
                {
                    onDone();
                }
            },
        });
    }
}
