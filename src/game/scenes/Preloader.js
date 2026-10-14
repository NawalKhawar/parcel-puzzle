import { Scene } from 'phaser';

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
        // is rendered at 1024*UI_SCALE x 768*UI_SCALE, not a fixed 1024x768 - see
        // src/game/uiScale.js for why that scale factor exists.
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;
        const barWidth = this.scale.width * 0.45; // ~468/1024 of the original design
        const barHeight = this.scale.height * (32 / 768);

        //  We loaded this image in our Boot Scene, so we can display it here
        this.add.image(centerX, centerY, 'background');

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(centerX, centerY, barWidth, barHeight).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const barInnerStart = 4 * (this.scale.width / 1024);
        const bar = this.add.rectangle(centerX - barWidth / 2 + barInnerStart / 2, centerY, barInnerStart, barHeight - 4, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress) => {

            //  Update the progress bar, growing from its starting sliver up to the outline's inner width.
            bar.width = barInnerStart + ((barWidth - barInnerStart) * progress);

        });
    }

    preload ()
    {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');

        this.load.image('logo', 'logo.png');
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        //  Skip the main menu entirely: the game should start immediately on the first
        //  level once assets are loaded.
        this.scene.start('PuzzleScene');
    }
}
