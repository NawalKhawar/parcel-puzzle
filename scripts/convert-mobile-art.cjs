/**
 * convert-mobile-art.cjs
 *
 * Turns the hand-made PORTRAIT (phone) paintings in assets-original/mobile/*.png into the WebP files
 * the game loads from assets/mobile/. Run it by hand whenever one of those PNGs changes (the outputs are
 * committed; the game never runs this):
 *
 *     node scripts/convert-mobile-art.cjs
 *
 * It needs the `sharp` image library, which is deliberately NOT a project dependency (it is only needed to
 * (re)generate these files). Install it somewhere (e.g. `npm install sharp` in a scratch folder) and point
 * SHARP_PATH at that node_modules/sharp, or let it fall back to a normal `require`.
 *
 * What it does to each picture (the file name without extension becomes the texture key, see Preloader.js,
 * so a PNG called title-bg-portrait.png is the texture 'title-bg-portrait'):
 *
 *   - Pictures with transparency (the clipboard and the conveyor belt) are TRIMMED to their visible part,
 *     so the scenes can size and place them without invisible margins. The scenes' numbers measured on the
 *     trimmed files are in PuzzleScene.js (belt) and DayCompleteScene.js (clipboard).
 *   - Stray, practically invisible pixels (alpha below 8) are cleared completely. The clipboard PNG has a
 *     column of almost-transparent RED pixels along its edges; left in, WebP compression smears them into a
 *     visible red fringe.
 *   - Everything is saved as WebP: lossy (quality 88) for the opaque paintings, lossy colour with a
 *     lossless alpha channel for the trimmed pictures with transparency.
 *
 * The original PNGs are only READ, never changed.
 */
const path = require('path');
const fs = require('fs');

/** Where `sharp` lives: SHARP_PATH if set, else a normal require, else the author's scratch install. */
let sharp;
try
{
    sharp = require(process.env.SHARP_PATH || 'sharp');
}
catch
{
    sharp = require('C:/Users/nawal/AppData/Local/Temp/claude/c--Users-nawal-parcel-puzzle/de258c57-102c-4e72-8e8c-337b5b0b2d51/scratchpad/tools/node_modules/sharp');
}

const SOURCE_DIR = path.join(__dirname, '..', 'assets-original', 'mobile');
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'mobile');

/** Pixels more transparent than this are wiped to fully transparent (see the header). */
const CLEAR_BELOW_ALPHA = 8;

/**
 * The pictures to convert. `trim` crops to the visible part (only meaningful with transparency).
 */
const PICTURES = [
    { name: 'title-bg-portrait', trim: false },
    { name: 'gameplay-bg-portrait', trim: false },
    { name: 'promotion-portrait', trim: false },
    { name: 'bonus-portrait', trim: false },
    { name: 'clipboard-screen-portrait', trim: true },
    { name: 'conveyor-belt-portrait', trim: true },
    // The apartment's phone room: tall seamless textures of which only a slice is ever shown (the room is about
    // as wide as the picture and 5 / 6 tiles high), so the unused part is cut off to save download size. The
    // wall shows its BOTTOM (the warm band that meets the floor), the floor its TOP.
    { name: 'wall-portrait', trim: false, keep: { from: 'bottom', height: 760 } },
    { name: 'floor-portrait', trim: false, keep: { from: 'top', height: 760 } },
];

/**
 * Converts one picture.
 *
 * @param {{name: string, trim: boolean, keep?: {from: 'top' | 'bottom', height: number}}} picture - `keep` cuts the picture down to
 *   its top or bottom `height` pixels (for tall textures of which only a slice is ever shown).
 * @returns {Promise<{name: string, width: number, height: number, bytes: number, offset: string}>}
 */
async function convert({ name, trim, keep })
{
    const { data, info } = await sharp(path.join(SOURCE_DIR, `${name}.png`)).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const { width, height } = info;

    // Wipe the near-invisible stray pixels (colour too, so compression cannot bleed it back).
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++)
    {
        for (let x = 0; x < width; x++)
        {
            const o = (y * width + x) * 4;
            if (data[o + 3] < CLEAR_BELOW_ALPHA)
            {
                data[o] = 0; data[o + 1] = 0; data[o + 2] = 0; data[o + 3] = 0;
            }
            else
            {
                minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            }
        }
    }

    let pipeline = sharp(data, { raw: { width, height, channels: 4 } });
    let offset = 'untrimmed';
    if (trim)
    {
        pipeline = pipeline.extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 });
        offset = `trimmed from x${minX} y${minY} (original ${width}x${height})`;
    }
    if (keep)
    {
        pipeline = pipeline.extract({ left: 0, top: keep.from === 'bottom' ? height - keep.height : 0, width, height: keep.height });
        offset = `kept the ${keep.from} ${keep.height} px of ${width}x${height}`;
    }
    const outPath = path.join(OUTPUT_DIR, `${name}.webp`);
    await pipeline.webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(outPath);
    const out = await sharp(outPath).metadata();
    return { name, width: out.width, height: out.height, bytes: fs.statSync(outPath).size, offset };
}

(async () =>
{
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    for (const picture of PICTURES)
    {
        const result = await convert(picture);
        console.log(`${result.name.padEnd(28)} ${result.width}x${result.height}  ${(result.bytes / 1024).toFixed(0)} KB  ${result.offset}`);
    }
})();
