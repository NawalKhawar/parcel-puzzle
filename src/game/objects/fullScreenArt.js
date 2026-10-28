import { UI_SCALE } from '../uiScale.js';
import { addImageButton } from './imageButton.js';
import { addPulse } from './pulse.js';
import { makePressable } from './pressFeedback.js';
import { isPortrait } from '../layout.js';

/**
 * fullScreenArt.js
 *
 * Helpers for the full-screen picture screens (promotion, bonus): a picture that fills the whole
 * canvas whatever shape it is, text placed ON the picture at spots given as FRACTIONS of the
 * picture (so they stay in the right place if the art is replaced by a different resolution), and
 * the "next page" button in the lower-right corner that carries on to the next step.
 */

/**
 * Adds a picture covering the whole canvas: scaled up evenly until it fills both directions and
 * centred, so a picture that is not exactly the screen's shape is cropped a little at the edges
 * (never stretched). Returns the helpers to place things on it.
 *
 * The phone (portrait) paintings are 9:16 and go through this same function: on a taller phone the sides
 * are cropped, on a squarer one the top and bottom, and `at` keeps text on the right spot either way.
 *
 * @param {import('phaser').Scene} scene
 * @param {string} key - the texture key, e.g. 'promotion'.
 * @returns {{image: import('phaser').GameObjects.Image, scale: number,
 *   at: (fx: number, fy: number) => {x: number, y: number}, px: (artPixels: number) => number}}
 *   `at` maps a point given as fractions of the picture (0-1 across, 0-1 down) to screen pixels;
 *   `px` converts a size in the picture's own pixels to screen pixels.
 */
export function addCoverArt(scene, key)
{
    const { width, height } = scene.scale;
    const image = scene.add.image(width / 2, height / 2, key);
    const scale = Math.max(width / image.width, height / image.height);
    image.setScale(scale);
    return {
        image,
        scale,
        at: (fx, fy) => ({
            x: width / 2 + (fx - 0.5) * image.width * scale,
            y: height / 2 + (fy - 0.5) * image.height * scale,
        }),
        px: (artPixels) => artPixels * scale,
    };
}

/**
 * Adds the "next page" arrow button in the lower-right corner (the picture the shop uses for next
 * page), pulsing gently to say "press me". Pressing it runs `onProceed` once.
 *
 * @param {import('phaser').Scene} scene
 * @param {() => void} onProceed
 * @returns {import('phaser').GameObjects.Image} the button.
 */
export function addProceedButton(scene, onProceed)
{
    const S = UI_SCALE;
    // On a phone the arrow is bigger (a fingertip needs ~76 design px at least) and sits higher, clear of the
    // home-indicator strip at the very bottom.
    const portrait = isPortrait(scene);
    const button = addImageButton(scene, 0, 0, 'button-page-next', portrait ? 116 : 84);
    button.setPosition(
        scene.scale.width - (portrait ? 40 : 46) * S - button.displayWidth / 2,
        scene.scale.height - (portrait ? 70 : 46) * S - button.displayHeight / 2
    );
    // addPulse must come before makePressable (see pulse.js).
    const pulse = addPulse(scene, button);
    makePressable(scene, button, () => {
        pulse.stop();
        onProceed();
    }, { delay: 140 });
    return button;
}
