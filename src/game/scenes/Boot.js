import { Scene } from 'phaser';
import { initSave } from '../progress.js';
import { initAnalytics } from '../../analytics.js';

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
        // Analytics starts after the save is read. It loads in the background (see analytics.js) and never delays the first screen.
        initAnalytics();
        this.scene.start('Preloader');
    }
}
