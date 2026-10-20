import { Scene } from 'phaser';
// The game's font, Fredoka, used everywhere now (bundled by the @fontsource package so it works
// offline). Three weights cover every use: 400 (regular body/label text), 600 (the licence-plate
// text on the truck), and 700 (headings and buttons, standing in for the old Arial Black).
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';

/**
 * Every image in the top-level assets/ folder (the game's art: the 12 pieces, the conveyor belt,
 * the Start Packing button, the HUD icons). Vite turns each file into a URL that works both in
 * the dev server and in a production build, without the files having to be copied into public/.
 * Each image is loaded under its file name without the extension, so assets/plus.png becomes
 * the texture 'plus' - which is why the piece images are named after the shape ids.
 */
const ART = import.meta.glob('../../../assets/*.png', { eager: true, query: '?url', import: 'default' });

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

        //  We loaded this image in our Boot Scene, so we can display it here
        // The template's picture is 1024x768, a different shape from the 16:9 canvas, so scale
        //  it up just enough to cover the whole screen (the overflow is cropped).
        const background = this.add.image(centerX, centerY, 'background');
        background.setScale(Math.max(this.scale.width / background.width, this.scale.height / background.height));

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(centerX, centerY, barWidth, barHeight).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const barInnerStart = 4 * (this.scale.width / 1280);
        const bar = this.add.rectangle(centerX - barWidth / 2 + barInnerStart / 2, centerY, barInnerStart, barHeight - 4, 0xffffff);

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
        for (const [file, url] of Object.entries(ART))
        {
            let key = file.split('/').pop().replace(/\.png$/, '');
            // 'background' is already taken by the stock template's placeholder (loaded as
            // 'background' from public/assets/bg.png in Boot.js, below) - rename ours so it
            // doesn't silently lose that key/value race and end up showing the placeholder.
            if (key === 'background')
            {
                key = 'warehouse-background';
            }
            this.load.image(key, url);
        }

        //  Template leftover, from public/assets.
        this.load.setPath('assets');
        this.load.image('logo', 'logo.png');
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        //  A web font only starts downloading when something first uses it, and Phaser text drawn
        //  before it arrives would use a fallback font. So ask for every weight now and wait for
        //  all of them (a failure just means the fallback font is used).
        const start = () => this.scene.start('TitleScene');
        Promise.all(['400', '600', '700'].map((weight) => document.fonts.load(`${weight} 20px Fredoka`))).then(start, start);
    }
}
