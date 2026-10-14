/**
 * uiScale.js
 *
 * A single shared scale factor used to render the game at a sharper resolution on
 * high-density ("Retina"/HiDPI) displays and when the canvas is stretched larger by
 * Phaser's Scale.FIT mode (e.g. full-screen on a monitor bigger than this game's
 * 1024x768 design size). Phaser's ScaleManager only ever resizes the on-screen CSS
 * size of the canvas in FIT mode - it never increases the canvas's own internal pixel
 * buffer to match it - so without this, full-screen (or any Retina display) ends up
 * showing a fixed 1024x768 image stretched larger by the browser, which is exactly
 * what caused the blurry text/graphics reported after Milestone 7.
 *
 * The fix used throughout this game: render everything at UI_SCALE times its normal
 * pixel size (a bigger canvas buffer, with proportionally bigger shapes/fonts/gaps),
 * while the actual on-screen (CSS) size Scale.FIT computes stays exactly the same -
 * the game looks the same size on screen, just sharper, because there are now more
 * real pixels backing every shape and letter.
 *
 * Capped at 2 (rather than using window.devicePixelRatio directly, which can be 3 or
 * more on some phones) so this doesn't demand an excessive amount of GPU memory/fill
 * rate for a sharpness improvement beyond what's visually noticeable.
 */
export const UI_SCALE = Math.min(window.devicePixelRatio || 1, 2);
