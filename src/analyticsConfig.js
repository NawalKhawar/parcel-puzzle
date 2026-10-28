/**
 * analyticsConfig.js
 *
 * The GameAnalytics settings, in ONE place. src/analytics.js is the only file that reads them.
 *
 * !! DO NOT COMMIT THIS FILE TO A PUBLIC REPOSITORY !!
 * The Game Key and Secret Key identify your game's project in GameAnalytics. A browser game has to ship them
 * inside the built files, so they can never be truly secret, but they should not be advertised in public source
 * either (anyone holding them can send fake events into your dashboard). Keep this file out of public repos.
 *
 * If either key is still a placeholder ("YOUR_GAME_KEY" / "YOUR_SECRET_KEY") analytics switches itself off
 * silently and the game runs exactly as before.
 */

/** From the GameAnalytics dashboard: Game settings -> your game's Game Key. */
export const GA_GAME_KEY = 'f3cc4329110ae32cb86199aa1c6fc2bd';

/** From the same page: the Secret Key. */
export const GA_SECRET_KEY = '386b4eab409a956b2914ef22e65f0510edaadf40';

/**
 * The build / version string sent with every event (GameAnalytics' "Build" field, which the dashboard can filter
 * and group by). Bump it for each release. The docs recommend [major].[minor].[patch], optionally with a leading
 * platform word, e.g. "web 1.0.0". analytics.js appends "-dev" when the game runs from the Vite dev server and
 * "-test" when the page address has ?gatest=1, so test sessions never mix with real players' builds.
 */
export const GA_BUILD_VERSION = 'web 1.0.0';
