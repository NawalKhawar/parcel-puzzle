import { Scene } from 'phaser';
import { initSave } from '../progress.js';

/**
 * Boot.js
 *
 * The very first scene. It has nothing to load (the loading screen is a plain colour and a progress
 * bar, see Preloader), so it reads the saved game - once, before anything else can ask whether there
 * is one (the title screen's Continue button) - and hands straight over to the Preloader.
 */
export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    create ()
    {
        initSave();
        this.scene.start('Preloader');
    }
}
