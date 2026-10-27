/**
 * roomConfig.js
 *
 * Every size constant for the apartment room, in one place. The room is a top-down "3/4 oblique"
 * grid (Pokemon FireRed style): flat square floor tiles, a back wall shown as a strip of tiles
 * above the floor, and furniture that shows its top surface plus its front face.
 *
 * All sizes here are in ROOM PIXELS - the pixel grid the art is drawn on. The scene draws the
 * room at a whole-number multiple of these (2x, 3x, 4x...) so pixel art stays crisp; see
 * ApartmentScene. Must never import 'phaser' - see "Architectural boundary" in PROJECT_STRUCTURE.md.
 */

/** Size of one tile, in room pixels. Item art is drawn on this grid. */
export const TILE = 32;

/**
 * Room width, in tiles (the back wall and the floor are both this wide). 14 fills the apartment
 * screen exactly at 2x scale: 16px margin, the button column, a gap, 14 x 64 = 896px of room, a gap,
 * the inventory panel and a 16px margin add up to the 1280px screen.
 */
export const ROOM_W = 14;

/** Number of FLOOR rows (front to back depth of the floor). */
export const ROOM_H = 8;

/** Height of the back wall strip above the floor, in tiles. */
export const WALL_ROWS = 3;

/**
 * How many rows of the wall strip wall items may hang in, counted from the top. The lowest wall row
 * (the one just above the floor) is kept clear - furniture stands against it - so wall items only
 * go on the top WALL_ROWS - 1 rows.
 */
export const WALL_HANG_ROWS = WALL_ROWS - 1;

/**
 * The bottom rows of the wall that wall items never use (WALL_ROWS - WALL_HANG_ROWS, i.e. the one
 * just above the floor). Big floor items that ask for it (items.json "intoWall") may stand with
 * their back edge in these rows, so they sit flush against the wall.
 */
export const WALL_RESERVED_ROWS = WALL_ROWS - WALL_HANG_ROWS;

/**
 * True for pixel art: textures are scaled with nearest-neighbour filtering, so pixels stay hard
 * squares instead of being blurred. Set false for smooth, painted art.
 */
export const PIXEL_ART = true;

/**
 * The most rows an item's sprite may stick up above its footprint. An item standing on the
 * backmost floor row can reach up WALL_ROWS rows and still stay inside the wall strip, so no
 * sprite can ever leave the screen - which is why the room needs no empty headroom above it.
 */
export const MAX_HEIGHT_ROWS = WALL_ROWS;

/**
 * Empty rows the scene keeps above the wall strip: how far the tallest item allowed (MAX_HEIGHT_ROWS)
 * standing on the back floor row would poke out above the wall. Zero while that cap equals the wall's
 * height; if the cap is ever raised above WALL_ROWS this becomes the room the scene must leave.
 */
export const HEADROOM_ROWS = MAX_HEIGHT_ROWS - WALL_ROWS;
