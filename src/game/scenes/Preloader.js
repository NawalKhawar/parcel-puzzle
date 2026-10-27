import { Scene } from 'phaser';
// The game's font, Fredoka, used everywhere now (the files come from the @fontsource package so it
// works offline). Three weights cover every use: 400 (regular body/label text), 600 (the licence-plate
// text on the truck), and 700 (headings and buttons, standing in for the old Arial Black). Latin only,
// .woff2 only - see fonts.css for why it is declared there rather than imported from the package.
import '../fonts.css';
import { createMoneyNoteTexture } from '../objects/money.js';

/**
 * Every image under assets/, in any subfolder (pieces/, characters/, truck/, backgrounds/, ui/,
 * apartment/ ...), as .webp or .png (the shipped art is WebP, which is far smaller; a new .png
 * dropped in works too - see assets-original/ for the full-size PNG masters). Vite turns each file into a URL that works both in the dev server and in a
 * production build, without the files having to be copied into public/.
 *
 * Each image is loaded under its FILE NAME without the extension - the folder is just for tidiness
 * and is not part of the texture key - so assets/pieces/plus.png becomes the texture 'plus' (which
 * is why the piece images are named after the shape ids) and assets/apartment/item-bed.png becomes
 * 'item-bed'. Because the key ignores the folder, file names must be unique across all folders;
 * keyedByFileName() throws if two collide, rather than letting one silently replace the other.
 */
const ART = import.meta.glob('../../../assets/**/*.{png,webp}', { eager: true, query: '?url', import: 'default' });

/**
 * Every sound under assets/audio/ (music/ and sfx/), keyed by file name without the extension in
 * the same way as the art, so assets/audio/sfx/pop.mp3 becomes the sound 'pop'. See audio.js.
 */
const AUDIO = import.meta.glob('../../../assets/audio/**/*.mp3', { eager: true, query: '?url', import: 'default' });

/**
 * Turns a glob result ({ path: url }) into [key, url] pairs, where the key is the file name without
 * its extension.
 *
 * @param {Record<string, string>} files - what import.meta.glob returned.
 * @param {RegExp} extension - the extension(s) to strip, e.g. /\.(png|webp)$/.
 * @returns {Array<[string, string]>}
 * @throws {Error} if two files in different folders would get the same key.
 */
function keyedByFileName(files, extension)
{
    const seen = new Map();
    return Object.entries(files).map(([file, url]) => {
        const key = file.split('/').pop().replace(extension, '');
        if (seen.has(key))
        {
            throw new Error(`Two asset files share the name "${key}": ${seen.get(key)} and ${file} - file names must be unique across assets/ subfolders`);
        }
        seen.set(key, file);
        return [key, url];
    });
}

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        // Positioned from this.scale.width/height (rather than the hardcoded 512/384
        // the template shipped with) so this still lands centered now that the canvas
        // is rendered at 1280*UI_SCALE x 720*UI_SCALE - see src/game/uiScale.js for why
        // that scale factor exists.
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;
        const barWidth = this.scale.width * 0.4; // ~512px of the 1280px design width
        const barHeight = this.scale.height * (32 / 720);

        // A plain warm background (no picture - nothing has loaded yet) with a brown progress bar.
        this.cameras.main.setBackgroundColor(0xf5ead6);

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(centerX, centerY, barWidth, barHeight).setStrokeStyle(2 * (this.scale.width / 1280), 0x8a6a4d);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const barInnerStart = 4 * (this.scale.width / 1280);
        const bar = this.add.rectangle(centerX - barWidth / 2 + barInnerStart / 2, centerY, barInnerStart, barHeight - 4, 0x8a6a4d);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress) => {

            //  Update the progress bar, growing from its starting sliver up to the outline's inner width.
            bar.width = barInnerStart + ((barWidth - barInnerStart) * progress);

        });
    }

    preload ()
    {
        //  The game's art. These URLs are complete already, so no load path is wanted.
        this.load.setPath('');
        for (let [key, url] of keyedByFileName(ART, /\.(png|webp)$/))
        {
            // The warehouse picture is assets/backgrounds/background - every scene refers to it as
            // 'warehouse-background' (a name kept from when the template used 'background').
            if (key === 'background')
            {
                key = 'warehouse-background';
            }
            this.load.image(key, url);
        }

        for (const [key, url] of keyedByFileName(AUDIO, /\.mp3$/))
        {
            this.load.audio(key, url);
        }
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.
        //  The currency note icon is far larger than anywhere it is shown, so make a small smoothed copy of it.
        createMoneyNoteTexture(this);

        //  A web font only starts downloading when something first uses it, and Phaser text drawn
        //  before it arrives would use a fallback font. So ask for every weight now and wait for
        //  all of them (a failure just means the fallback font is used).
        const start = () => this.scene.start('TitleScene');
        Promise.all(['400', '600', '700'].map((weight) => document.fonts.load(`${weight} 20px Fredoka`))).then(start, start);
    }
}
