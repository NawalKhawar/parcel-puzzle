/**
 * loadWallpapers.js
 *
 * Validates and prepares the wallpapers catalogue from src/data/wallpapers.json.
 */

/**
 * @typedef {Object} WallpaperDef
 * @property {string} id - Unique identifier (e.g. 'cream', 'soft-blue').
 * @property {string} name - Player-facing name (e.g. 'Cream', 'Soft Blue').
 *   (The price and unlock day are in economy.json.)
 * @property {string} color - Hex color code for the wall background (e.g. '#f5f0e8').
 */

/**
 * Validates and prepares the wallpapers catalogue. Throws if data is malformed.
 *
 * @param {Object} raw - Raw JSON from wallpapers.json: { wallpapers: [ {...}, ... ] }
 * @returns {WallpaperDef[]} Validated wallpaper definitions, in the order of the file.
 * @throws {Error} if the data is malformed or violates constraints.
 */
export function loadWallpapers(raw) {
    if (!raw || !Array.isArray(raw.wallpapers)) {
        throw new Error('wallpapers.json: expected { wallpapers: [...] }');
    }

    const defs = [];
    const seen = new Set();

    for (const w of raw.wallpapers) {
        // Validate id
        if (typeof w.id !== 'string' || !w.id) {
            throw new Error('wallpapers.json: every wallpaper must have a non-empty "id"');
        }
        if (seen.has(w.id)) {
            throw new Error(`wallpapers.json: duplicate id "${w.id}"`);
        }
        seen.add(w.id);

        // Validate name
        if (typeof w.name !== 'string' || !w.name) {
            throw new Error(`wallpaper "${w.id}": missing or empty "name"`);
        }

        // Validate color
        if (typeof w.color !== 'string' || !w.color.match(/^#[0-9a-fA-F]{6}$/)) {
            throw new Error(`wallpaper "${w.id}": "color" must be a hex color string like "#f5f0e8"`);
        }

        defs.push({
            id: w.id,
            name: w.name,
            color: w.color,
        });
    }

    return defs;
}
