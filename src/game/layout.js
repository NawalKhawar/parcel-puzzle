import { UI_SCALE } from './uiScale.js';
import { gameSizeForWindow as gameSizeFor, windowIsPortrait } from '../core/orientation.js';

export { LANDSCAPE_SIZE, PORTRAIT_WIDTH, PORTRAIT_MIN_HEIGHT, PORTRAIT_MAX_HEIGHT } from '../core/orientation.js';

/**
 * layout.js
 *
 * ORIENTATION: one build, two layouts. On a wide window the game is the original landscape game
 * (a 1280 x 720 design canvas). On a tall window - a phone held upright - the same game runs on a
 * portrait canvas: 720 design pixels wide and between 1150 and 1560 tall, picked at start-up from the
 * window's shape so a tall phone is filled edge to edge (Scale.FIT in main.js then fits that canvas to
 * the window). Every scene asks isPortrait(this) and lays itself out accordingly; the landscape
 * branch of every scene is the original, untouched layout.
 *
 * Switching: when the window changes shape (a phone is rotated, a desktop window is dragged from wide
 * to tall) watchOrientation() resizes the canvas and restarts the active scene, which rebuilds itself
 * in the new layout (a truck in progress comes back as the same truck with the parcels on the belt -
 * see PuzzleScene.getRelayoutData). Small window changes that do not flip the shape (a phone's address
 * bar sliding away) never restart anything: Scale.FIT just rescales the canvas.
 */

/**
 * The canvas size (real canvas pixels) for a window of the given size: see core/orientation.js, which
 * holds the maths; this applies the game's UI_SCALE.
 *
 * @param {number} windowWidth
 * @param {number} windowHeight
 * @returns {{width: number, height: number, portrait: boolean}}
 */
export function gameSizeForWindow(windowWidth, windowHeight)
{
    return gameSizeFor(windowWidth, windowHeight, UI_SCALE);
}

/**
 * @param {import('phaser').Scene} scene
 * @returns {boolean} whether the scene's canvas is the portrait one (taller than wide).
 */
export function isPortrait(scene)
{
    return scene.scale.height > scene.scale.width;
}

/** Scenes that are never restarted by an orientation change (they are only the loading screens). */
const NOT_RESTARTED = new Set(['Boot', 'Preloader']);

/**
 * Starts watching the window: when its shape flips between wide and tall, resizes the canvas to the
 * other layout's size and restarts every active scene so it rebuilds itself. Debounced, because a
 * phone rotation or a window drag fires a burst of resize events.
 *
 * A scene may define getRelayoutData() to say what data it should be restarted with (PuzzleScene uses
 * this to come back as the same truck); otherwise it restarts with the data it was started with. It may
 * also define relayoutBlocked() to ask for the switch to wait a moment (checked again every 0.4 s).
 *
 * @param {import('phaser').Game} game
 */
export function watchOrientation(game)
{
    let timer = null;
    const check = () =>
    {
        const wantPortrait = windowIsPortrait(window.innerWidth, window.innerHeight);
        const isNowPortrait = game.scale.height > game.scale.width;
        if (wantPortrait === isNowPortrait)
        {
            return;
        }
        // A scene can ask to wait (PuzzleScene while a solved truck is closing): try again shortly.
        const active = game.scene.getScenes(true);
        if (active.some((scene) => typeof scene.relayoutBlocked === 'function' && scene.relayoutBlocked()))
        {
            timer = setTimeout(check, 400);
            return;
        }
        const size = gameSizeForWindow(window.innerWidth, window.innerHeight);
        game.scale.setGameSize(size.width, size.height);
        for (const scene of active)
        {
            if (NOT_RESTARTED.has(scene.sys.settings.key))
            {
                continue;
            }
            const data = typeof scene.getRelayoutData === 'function' ? scene.getRelayoutData() : scene.sys.settings.data;
            scene.scene.restart(data);
        }
    };
    const onChange = () =>
    {
        clearTimeout(timer);
        timer = setTimeout(check, 200);
    };
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
}
