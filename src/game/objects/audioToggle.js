import { UI_SCALE } from '../uiScale.js';

/**
 * audioToggle.js
 *
 * A square button for the pause menu that switches one kind of sound on or off: a musical note
 * for the music, a speaker for the sound effects. The icons are drawn with shapes (there is no
 * art for them), in the same cream-and-brown style as the arrow buttons. When muted the icon is
 * faded and crossed out with a red slash.
 */

const BACKGROUND = 0xf6ecd6;
const BORDER = 0x8a6a4d;
const ICON = 0x6b4a32;
const SLASH = 0xc0392b;

/**
 * Draws the button's picture into a Graphics, centred on (0, 0).
 *
 * @param {import('phaser').GameObjects.Graphics} g
 * @param {'music' | 'sfx'} kind
 * @param {boolean} muted
 * @param {number} size - side of the square, in screen pixels.
 */
function drawToggle(g, kind, muted, size)
{
    const half = size / 2;
    g.clear();
    g.fillStyle(BACKGROUND, 1);
    g.fillRoundedRect(-half, -half, size, size, size * 0.2);
    g.lineStyle(Math.max(2, size * 0.05), BORDER, 1);
    g.strokeRoundedRect(-half, -half, size, size, size * 0.2);

    // Everything below is positioned as a fraction of the size, so the icon scales with the button.
    const alpha = muted ? 0.4 : 1;
    g.fillStyle(ICON, alpha);
    g.lineStyle(size * 0.07, ICON, alpha);
    if (kind === 'music')
    {
        // A single note: oval head, stem rising from its right side, and a flag at the top.
        g.fillEllipse(-size * 0.1, size * 0.17, size * 0.28, size * 0.21);
        g.fillRect(size * 0.03, -size * 0.24, size * 0.06, size * 0.42);
        g.fillTriangle(size * 0.09, -size * 0.24, size * 0.27, -size * 0.1, size * 0.09, -size * 0.02);
    }
    else
    {
        // A speaker: a small box, a cone opening to the right, and two sound waves.
        g.fillRect(-size * 0.28, -size * 0.1, size * 0.14, size * 0.2);
        g.fillTriangle(-size * 0.14, -size * 0.1, size * 0.02, -size * 0.24, size * 0.02, size * 0.24);
        g.fillTriangle(-size * 0.14, -size * 0.1, size * 0.02, size * 0.24, -size * 0.14, size * 0.1);
        for (const radius of [0.14, 0.25])
        {
            g.beginPath();
            g.arc(size * 0.04, 0, size * radius, -0.8, 0.8);
            g.strokePath();
        }
    }
    if (muted)
    {
        g.lineStyle(size * 0.08, SLASH, 1);
        g.lineBetween(-size * 0.3, -size * 0.3, size * 0.3, size * 0.3);
    }
}

/**
 * Adds a square mute toggle. Clicking flips it: the new state is passed to onChange (which does
 * the actual muting) and the picture is redrawn. The caller makes it pressable and calls
 * `toggle` from the click.
 *
 * @param {import('phaser').Scene} scene
 * @param {number} x - centre x (screen pixels).
 * @param {number} y - centre y.
 * @param {number} designSize - side length in design pixels (multiplied by UI_SCALE here).
 * @param {'music' | 'sfx'} kind
 * @param {boolean} muted - the starting state.
 * @param {(muted: boolean) => void} onChange - called with the new state after each click.
 * @returns {{button: import('phaser').GameObjects.Container, toggle: () => void}} the button, and
 *   the function a click runs.
 */
export function addAudioToggle(scene, x, y, designSize, kind, muted, onChange)
{
    const size = designSize * UI_SCALE;
    const graphics = scene.add.graphics();
    drawToggle(graphics, kind, muted, size);
    const button = scene.add.container(x, y, [graphics]).setSize(size, size);
    button.setInteractive({ useHandCursor: true });
    const toggle = () => {
        muted = !muted;
        drawToggle(graphics, kind, muted, size);
        onChange(muted);
    };
    return { button, toggle };
}
