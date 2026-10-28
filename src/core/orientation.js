/**
 * orientation.js
 *
 * The pure maths behind the game's two layouts (landscape for a wide window, portrait for a tall one
 * such as a phone held upright). No Phaser and no browser globals, so it can be unit-tested in Node;
 * src/game/layout.js applies it to the real window and canvas. See layout.js for how the switch works.
 */

/** The landscape design size (design pixels, before the UI scale). Always exactly this. */
export const LANDSCAPE_SIZE = { width: 1280, height: 720 };

/** The portrait design width, and the range its height is picked from (design pixels). */
export const PORTRAIT_WIDTH = 720;
export const PORTRAIT_MIN_HEIGHT = 1150;
export const PORTRAIT_MAX_HEIGHT = 1560;

/**
 * @param {number} windowWidth
 * @param {number} windowHeight
 * @returns {boolean} whether a window of this size gets the portrait layout (strictly taller than wide;
 *   a square window is landscape).
 */
export function windowIsPortrait(windowWidth, windowHeight)
{
    return windowHeight > windowWidth;
}

/**
 * The canvas size, in real canvas pixels (design pixels times the UI scale), for a window of the given
 * size. Landscape is always exactly the original 1280 x 720. Portrait is 720 wide and as tall as the
 * window's shape asks for (clamped to 1150-1560 design px), so the canvas matches the window's aspect
 * ratio and fills it edge to edge; a window taller than the clamp simply gets a little letterboxing.
 *
 * @param {number} windowWidth
 * @param {number} windowHeight
 * @param {number} uiScale - the game's UI_SCALE (devicePixelRatio capped at 2).
 * @returns {{width: number, height: number, portrait: boolean}}
 */
export function gameSizeForWindow(windowWidth, windowHeight, uiScale)
{
    if (!windowIsPortrait(windowWidth, windowHeight))
    {
        return { width: LANDSCAPE_SIZE.width * uiScale, height: LANDSCAPE_SIZE.height * uiScale, portrait: false };
    }
    const wanted = PORTRAIT_WIDTH * (windowHeight / windowWidth);
    const height = Math.round(Math.min(PORTRAIT_MAX_HEIGHT, Math.max(PORTRAIT_MIN_HEIGHT, wanted)));
    return { width: PORTRAIT_WIDTH * uiScale, height: height * uiScale, portrait: true };
}
