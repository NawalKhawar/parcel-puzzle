import { BossPanel } from './BossPanel.js';
import { isPortrait } from '../layout.js';
import { trackTutorialStep } from '../../analytics.js';

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
 * If the player solves the (tiny) first truck BEFORE pressing Next on the "Not bad" message, the guide does not
 * lose the pay message: PuzzleScene calls finishThen(), which jumps straight to it, and the truck only closes
 * once the player has pressed Okay.
 *
 * The panel resizes to fit each message. The guide holds no puzzle logic: PuzzleScene supplies
 * callbacks to show/clear the highlights and to be told when it is over, and calls notifyPlaced()
 * whenever a piece lands on the board.
 */

/** What the boss says at each step. */
const TEXT_WELCOME = "Welcome to your first day on the job, kid! Let's get to work.";
const TEXT_DRAG = 'Drag a parcel onto the truck with your mouse.';
/** The same step on a phone, where there is no mouse. */
const TEXT_DRAG_TOUCH = 'Drag a parcel onto the truck with your finger.';
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
     * @param {'vertical' | 'horizontal'} [options.layout] - the panel's layout (see BossPanel); vertical if omitted.
     * @param {() => void} options.onHighlight - show the parcel + placement highlights (step 2).
     * @param {() => void} options.onClearHighlight - remove them again (step 3).
     * @param {() => void} options.onDone - the panel has left; the player is on their own.
     */
    constructor (scene, { left, centerY, width, layout, onHighlight, onClearHighlight, onDone })
    {
        this.scene = scene;
        this.onHighlight = onHighlight;
        this.onClearHighlight = onClearHighlight;
        this.onDone = onDone;
        /** 'welcome' | 'drag' | 'done' | 'pay' | 'finished' (or 'cancelled') - which message is up. */
        this.step = 'welcome';
        /** Set by finishThen(): what to do once the panel has left (close the truck that was solved mid-guide). */
        this.afterLeaving = null;

        // Dims the board and swallows every click until the player presses Next.
        this.blocker = scene.add
            .rectangle(scene.scale.width / 2, scene.scale.height / 2, scene.scale.width, scene.scale.height, 0x000000, 0.4)
            .setDepth(BLOCKER_DEPTH)
            .setInteractive();

        this.panel = new BossPanel(scene, { left, centerY, width, layout });
    }

    /** Pops the panel in with the welcome message. */
    start ()
    {
        this.panel.show(TEXT_WELCOME, { button: 'Next', onButton: () => this.advance() });
        this.panel.popIn();
        trackTutorialStep(1); // analytics: Tutorial:Step1 (welcome)
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
        this.panel.show(isPortrait(this.scene) ? TEXT_DRAG_TOUCH : TEXT_DRAG);
        this.panel.bounce();
        this.onHighlight();
        trackTutorialStep(2); // analytics: Tutorial:Step2 (drag a parcel)
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
        trackTutorialStep(3); // analytics: Tutorial:Step3 ("Not bad...")
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
        trackTutorialStep(4); // analytics: Tutorial:Step4 (pay message)
    }

    /** Okay pressed on the last message: the panel leaves and the player is on their own. */
    finish ()
    {
        if (this.step !== 'pay')
        {
            return;
        }
        this.step = 'finished';
        this.leave();
    }

    /** The panel pops off the screen, then the scene is told the guide is over (and any waiting follow-up runs). */
    leave ()
    {
        this.panel.popOut(() => {
            this.onDone();
            const after = this.afterLeaving;
            this.afterLeaving = null;
            if (after)
            {
                after();
            }
        });
    }

    /**
     * The truck was solved while the guide was still talking. Makes sure the player still gets the pay message:
     * jumps to it (if it is not up already) and runs `callback` once the panel has gone - after Okay, or at
     * once if the guide is already over.
     *
     * @param {() => void} callback - what the scene does next (it closes the truck).
     */
    finishThen (callback)
    {
        if (this.step === 'finished' || this.step === 'cancelled')
        {
            callback();
            return;
        }
        this.afterLeaving = callback;
        if (this.step !== 'pay')
        {
            // Welcome / drag / done: drop whatever is still showing (dimming, highlights) and say the pay message.
            if (this.blocker?.active)
            {
                this.blocker.destroy();
            }
            this.onClearHighlight();
            this.step = 'pay';
            this.panel.show(TEXT_PAY, { head: 'boss-happy-head', button: 'Okay', onButton: () => this.finish() });
            this.panel.bounce();
            trackTutorialStep(4); // analytics: Tutorial:Step4 (reached early: the truck was solved first)
        }
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
        this.leave();
    }
}
