import { Scene } from 'phaser';
import { UI_SCALE } from '../uiScale.js';

/**
 * PlaceholderScreenScene.js
 *
 * Base class for the not-yet-built full-screen menus reachable from the end-of-day
 * popup (ShopScene, DecorateScene). Each is deliberately a blank screen with a small
 * title and a Back button that returns to the day-complete popup it came from.
 *
 * To build one of these screens out for real later, override create() in the subclass
 * (call super.create() first to keep the title + Back button, or skip it for a fully
 * custom layout).
 */
export class PlaceholderScreenScene extends Scene
{
    /**
     * @param {string} key - the Phaser scene key (e.g. 'ShopScene').
     * @param {string} title - heading shown at the top of the screen (e.g. 'Shop').
     */
    constructor (key, title)
    {
        super(key);
        this.screenTitle = title;
    }

    /**
     * Receives the day-complete popup's data so Back can hand it straight back and
     * show the same totals the player left.
     *
     * @param {Object} data - the DayCompleteScene data payload, passed through untouched.
     */
    init (data)
    {
        this.dayCompleteData = data;
    }

    create ()
    {
        // The paused PuzzleScene is still rendered underneath (see DayCompleteScene), so
        // cover the whole canvas with an opaque backdrop to make this a truly blank screen.
        this.add
            .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xf5ead6);

        this.add
            .text(this.scale.width / 2, 40 * UI_SCALE, this.screenTitle, {
                fontFamily: 'Arial Black',
                fontSize: 32 * UI_SCALE,
                color: '#3a362f',
            })
            .setOrigin(0.5);

        const backButton = this.add
            .text(24 * UI_SCALE, 24 * UI_SCALE, '< Back', {
                fontFamily: 'Arial Black',
                fontSize: 22 * UI_SCALE,
                color: '#3a362f',
                backgroundColor: '#f0b86e',
                padding: { x: 16 * UI_SCALE, y: 8 * UI_SCALE },
            })
            .setInteractive({ useHandCursor: true });

        // Restarting DayCompleteScene (rather than "resuming" it) rebuilds the popup
        // from the same data, so it looks exactly as the player left it.
        backButton.on('pointerdown', () => {
            this.scene.start('DayCompleteScene', this.dayCompleteData);
        });
    }
}
