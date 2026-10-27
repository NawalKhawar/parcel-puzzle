import { BossPanel } from './BossPanel.js';

/**
 * FtueGuide.js
 *
 * The first-time-user experience: a short guided start for the very first puzzle of a new game.
 * Instead of the usual day-start popup, a boss panel (BossPanel) sits beside the truck and walks the
 * player through placing their first parcel:
 *
 *   1. "Welcome to your first day on the job, kid! Let's get to work." + a Next button. The rest of
 *      the screen is dimmed and blocked, so nothing else can be touched yet.
 *   2. "Drag a parcel onto the truck with your mouse." The dimming goes, and now (and only now) the
 *      scene highlights one parcel in the tray and where it goes on the board.
 *   3. As soon as the player places any piece: "Not bad. Now pack the rest of the truck. Make sure to
 *      fit all the given parcels." + a Next button (the player can keep packing meanwhile).
 *   4. Next shows the pay message: "You get paid for every truck you pack. The trickier the truck,
 *      the more you get paid!" + an Okay button. Only when the player presses Okay does the panel pop
 *      off the screen, leaving them to finish the level on their own.
 *
 * The panel resizes to fit each message. The guide holds no puzzle logic: PuzzleScene supplies
 * callbacks to show/clear the highlights and to be told when it is over, and calls notifyPlaced()
 * whenever a piece lands on the board.
 */

/** What the boss says at each step. */
const TEXT_WELCOME = "Welcome to your first day on the job, kid! Let's get to work.";
const TEXT_DRAG = 'Drag a parcel onto the truck with your mouse.';
const TEXT_DONE = 'Not bad. Now pack the rest of the truck. Make sure to fit all the given parcels.';

const TEXT_PAY = 'You get paid for every truck you pack. The trickier the truck, the more you get paid!';

/** Depth of the dimming layer: above everything in PuzzleScene, just under the panel. */
const BLOCKER_DEPTH = 2000;

export class FtueGuide
{
    /**
     * @param {import('phaser').Scene} scene - PuzzleScene.
     * @param {Object} options
     * @param {number} options.left - screen x of the panel's left edge.
     * @param {number} options.centerY - screen y the panel is centred on.
     * @param {number} options.width - panel width in screen pixels.
     * @param {() => void} options.onHighlight - show the parcel + placement highlights (step 2).
     * @param {() => void} options.onClearHighlight - remove them again (step 3).
     * @param {() => void} options.onDone - the panel has left; the player is on their own.
     */
    constructor (scene, { left, centerY, width, onHighlight, onClearHighlight, onDone })
    {
        this.scene = scene;
        this.onHighlight = onHighlight;
        this.onClearHighlight = onClearHighlight;
        this.onDone = onDone;
        /** 'welcome' | 'drag' | 'done' | 'pay' | 'finished' (or 'cancelled') - which message is up. */
        this.step = 'welcome';

        // Dims the board and swallows every click until the player presses Next.
        this.blocker = scene.add
            .rectangle(scene.scale.width / 2, scene.scale.height / 2, scene.scale.width, scene.scale.height, 0x000000, 0.4)
            .setDepth(BLOCKER_DEPTH)
            .setInteractive();

        this.panel = new BossPanel(scene, { left, centerY, width });
    }

    /** Pops the panel in with the welcome message. */
    start ()
    {
        this.panel.show(TEXT_WELCOME, { button: 'Next', onButton: () => this.advance() });
        this.panel.popIn();
    }

    /** Next pressed (welcome -> drag): lifts the dimming, says what to do, and starts the highlights. */
    advance ()
    {
        if (this.step !== 'welcome')
        {
            return;
        }
        this.step = 'drag';
        // The blocker must stop swallowing clicks at once, not when its fade ends.
        this.blocker.disableInteractive();
        this.scene.tweens.add({
            targets: this.blocker,
            alpha: 0,
            duration: 250,
            onComplete: () => this.blocker.destroy(),
        });
        this.panel.show(TEXT_DRAG);
        this.panel.bounce();
        this.onHighlight();
    }

    /** Called by the scene whenever a piece is placed on the board; the first one moves the guide on. */
    notifyPlaced ()
    {
        if (this.step !== 'drag')
        {
            return;
        }
        this.step = 'done';
        this.onClearHighlight();
        // The boss is pleased now, so he gets his happy face. The player can keep packing while the
        // panel is up; it only moves on when they press its button (no timers).
        this.panel.show(TEXT_DONE, { head: 'boss-happy-head', button: 'Next', onButton: () => this.showPay() });
        this.panel.bounce();
    }

    /** Next pressed (done -> pay): explains how the pay works; its Okay button sends the panel away. */
    showPay ()
    {
        if (this.step !== 'done')
        {
            return;
        }
        this.step = 'pay';
        this.panel.show(TEXT_PAY, { head: 'boss-happy-head', button: 'Okay', onButton: () => this.finish() });
        this.panel.bounce();
    }

    /** Okay pressed on the last message: the panel leaves and the player is on their own. */
    finish ()
    {
        if (this.step !== 'pay')
        {
            return;
        }
        this.step = 'finished';
        this.panel.popOut(() => this.onDone());
    }

    /**
     * The player skipped the tutorial: drops the dimming, the highlights and the panel at once. The
     * guide does nothing further (notifyPlaced is ignored), and onDone is called so the scene lets
     * the player play.
     */
    cancel ()
    {
        // Nothing to cancel once the guide has ended (its panel is already leaving).
        if (this.step === 'cancelled' || this.step === 'finished')
        {
            return;
        }
        this.step = 'cancelled';
        if (this.blocker?.active)
        {
            this.blocker.destroy();
        }
        this.onClearHighlight();
        this.panel.popOut(() => this.onDone());
    }
}
