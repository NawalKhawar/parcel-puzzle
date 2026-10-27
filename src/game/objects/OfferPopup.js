import { UI_SCALE } from '../uiScale.js';
import { playSfx } from '../audio.js';
import { addUiPanel } from './uiPanel.js';
import { addPillButton } from './pillButton.js';
import { addImageButton } from './imageButton.js';
import { addMoneyText } from './money.js';
import { makePressable } from './pressFeedback.js';

/**
 * OfferPopup.js
 *
 * The boss's two "would you like...?" popups that sit on top of the puzzle: the OVERTIME offer
 * after a day's last truck ("One more truck? Time and a half.") and the extra-HINT offer once the
 * puzzle's free hint is spent. Both are a dimmed screen (which swallows every click, so nothing
 * underneath can be touched), a wood-framed panel with the boss's head, a title and two or three
 * buttons, popping in from nothing.
 *
 * The overtime offer deliberately does not say which tier the extra truck is or what it pays - the
 * game never shows a truck's tier or pay before the truck starts.
 */

/** Above the pause menu (1000) and everything else in PuzzleScene. */
const OFFER_DEPTH = 1100;

/**
 * Builds the shared frame: dim layer, panel, boss head, title and subtitle. Returns the pieces the
 * callers add their buttons to.
 *
 * @param {import('phaser').Scene} scene
 * @param {Object} options
 * @param {number} options.width - panel width, design px.
 * @param {number} options.height - panel height, design px.
 * @param {string} options.title
 * @param {string} options.subtitle
 * @param {string} [options.subtitleColor]
 * @param {string} [options.head] - texture key of the talking character's head (the boss by default).
 * @returns {{ blocker: import('phaser').GameObjects.Rectangle, box: import('phaser').GameObjects.Container, width: number, height: number, textX: number, subtitleY: number, close: (done?: () => void) => void }}
 */
function buildFrame(scene, { width, height, title, subtitle, subtitleColor = '#c0501f', head = 'boss-head' })
{
    const S = UI_SCALE;
    const w = width * S;
    const h = height * S;
    const FRAME = 37 * S;

    const blocker = scene.add
        .rectangle(scene.scale.width / 2, scene.scale.height / 2, scene.scale.width, scene.scale.height, 0x000000, 0.55)
        .setInteractive()
        .setDepth(OFFER_DEPTH);

    // Everything else hangs off one container centred on the screen, so scaling pops it in and out.
    const box = scene.add.container(scene.scale.width / 2, scene.scale.height / 2).setDepth(OFFER_DEPTH + 1).setScale(0);
    box.add(addUiPanel(scene, 0, 0, w, h));

    // The boss's head on the left of the top half, the words to its right.
    const headSize = 150 * S;
    const left = -w / 2 + FRAME + 16 * S;
    const topY = -h / 2 + FRAME + 16 * S;
    if (scene.textures.exists(head))
    {
        box.add(scene.add.image(left + headSize / 2, topY + headSize / 2, head).setDisplaySize(headSize, headSize));
    }
    const textX = left + headSize + 22 * S;
    const textWidth = w / 2 - FRAME - 16 * S - textX;
    box.add(
        scene.add
            .text(textX, topY + headSize / 2 - 10 * S, title, {
                fontFamily: 'Fredoka, Arial Black', fontStyle: '700', fontSize: 38 * S, color: '#3a362f', wordWrap: { width: textWidth },
            })
            .setOrigin(0, 1)
    );
    box.add(
        scene.add
            .text(textX, topY + headSize / 2 - 2 * S, subtitle, {
                fontFamily: 'Fredoka, Arial', fontStyle: '600', fontSize: 28 * S, color: subtitleColor, wordWrap: { width: textWidth },
            })
            .setOrigin(0, 0)
    );

    playSfx(scene, 'pop');
    scene.tweens.add({ targets: box, scale: 1, duration: 420, ease: 'Back.easeOut' });

    /** Pops the popup away and removes it, then calls `done`. */
    const close = (done) => {
        blocker.disableInteractive();
        scene.tweens.add({
            targets: box,
            scale: 0,
            duration: 260,
            ease: 'Back.easeIn',
            onComplete: () => {
                box.destroy();
                blocker.destroy();
                done?.();
            },
        });
    };
    return { blocker, box, width: w, height: h, close, textX, subtitleY: topY + headSize / 2 - 2 * S };
}

/**
 * The overtime offer: "One more truck? Time and a half." with a Yes and a No button.
 *
 * @param {import('phaser').Scene} scene
 * @param {Object} callbacks
 * @param {() => void} callbacks.onAccept - the player wants the extra truck.
 * @param {() => void} callbacks.onDecline - the player is done for the day (no penalty).
 */
export function showOvertimeOffer(scene, { onAccept, onDecline })
{
    const S = UI_SCALE;
    const frame = buildFrame(scene, { width: 680, height: 330, title: 'One more truck?', subtitle: 'Time and a half: it pays 1.5x the usual rate.' });
    const buttonY = frame.height / 2 - 37 * S - 16 * S - 28 * S;
    const yes = addPillButton(scene, -135 * S, buttonY, { width: 240, height: 56, label: "Sure, I'll do it", fontSize: 22 });
    const no = addPillButton(scene, 135 * S, buttonY, { width: 240, height: 56, label: 'No thanks', fontSize: 22, style: 'secondary' });
    frame.box.add([yes, no]);

    let chosen = false;
    const choose = (callback) => () => {
        if (!chosen)
        {
            chosen = true;
            frame.close(callback);
        }
    };
    makePressable(scene, yes, choose(onAccept));
    makePressable(scene, no, choose(onDecline));
}

/**
 * The extra-hint offer: today's free hint is spent, so the player can buy another with in-game money.
 * The buy button is greyed out and does nothing when the wallet is short (with the reason under it).
 * Closing the popup (No thanks) costs nothing.
 *
 * @param {import('phaser').Scene} scene
 * @param {Object} options
 * @param {number} options.cost - the paid hint's price in whole dollars.
 * @param {boolean} options.canAfford - whether the wallet covers it.
 * @param {() => void} options.onBuy - the player chose to pay (only called when canAfford).
 * @param {() => void} options.onClose - the player closed the popup without a hint.
 */
export function showHintOffer(scene, { cost, canAfford, onBuy, onClose })
{
    const S = UI_SCALE;
    const frame = buildFrame(scene, {
        width: 680, height: 410, title: 'Need another hint?', subtitle: "This puzzle's free hint is used up.", subtitleColor: '#6b6354', head: 'worker-head-sad',
    });
    const buttonY = frame.height / 2 - 37 * S - 16 * S - 100 * S;
    const closeY = frame.height / 2 - 37 * S - 12 * S - 20 * S;

    // "Buy a hint" then the price underneath; greyed out with a reason when the wallet is short.
    const buy = addPillButton(scene, 0, buttonY, {
        width: 280, height: 84, label: 'Buy a hint', fontSize: 22, labelY: -14, style: canAfford ? 'primary' : 'disabled',
    });
    if (canAfford)
    {
        buy.add(addMoneyText(scene, 0, 16 * S, cost, { fontSize: 22 * S, fontStyle: '600', color: '#3a362f', align: 'center' }));
    }
    else
    {
        // Greyed out: the price in grey, and the reason just under the button.
        buy.add(addMoneyText(scene, 0, 16 * S, cost, { fontSize: 22 * S, fontStyle: '600', color: '#8a8272', align: 'center' }));
        frame.box.add(
            scene.add
                .text(0, buttonY + 42 * S + 10 * S, 'Not enough money', { fontFamily: 'Fredoka, Arial', fontStyle: '600', fontSize: 16 * S, color: '#b5472f' })
                .setOrigin(0.5)
        );
    }

    const close = addPillButton(scene, 0, closeY, { width: 160, height: 40, label: 'No thanks', fontSize: 18, style: 'secondary' });
    frame.box.add([buy, close]);

    let chosen = false;
    const choose = (callback) => () => {
        if (!chosen)
        {
            chosen = true;
            frame.close(callback);
        }
    };
    if (canAfford)
    {
        makePressable(scene, buy, choose(onBuy));
    }
    makePressable(scene, close, choose(onClose));
}

/**
 * A Yes / No confirmation before something that cannot be undone or that leaves the game - used by
 * the title screen's New Game (which erases the save) and the pause menu's Quit. The two answers are
 * the picture buttons assets/ui/button-yes and button-no, the same height as the pause menu's buttons.
 *
 * @param {import('phaser').Scene} scene
 * @param {Object} options
 * @param {string} options.title - the question.
 * @param {string} options.subtitle - what will happen.
 * @param {() => void} options.onYes - the player confirmed (called once the popup has gone).
 * @param {() => void} [options.onNo] - the player backed out (called once the popup has gone).
 */
export function showConfirm(scene, { title, subtitle, onYes, onNo })
{
    const S = UI_SCALE;
    const frame = buildFrame(scene, { width: 680, height: 350, title, subtitle, subtitleColor: '#6b6354', head: 'worker-head-sad' });
    const buttonY = frame.height / 2 - 37 * S - 16 * S - 38 * S;
    const yes = addImageButton(scene, -120 * S, buttonY, 'button-yes', 76);
    const no = addImageButton(scene, 120 * S, buttonY, 'button-no', 76);
    frame.box.add([yes, no]);

    // Only the first press counts, even if both are hit while the popup is closing.
    let chosen = false;
    const choose = (callback) => () => {
        if (!chosen)
        {
            chosen = true;
            frame.close(callback);
        }
    };
    makePressable(scene, yes, choose(onYes));
    makePressable(scene, no, choose(onNo));
}

/**
 * The shop's "can't buy that" popup, with the SAD worker: either not enough money (shows how much
 * more is needed, with the currency note icon) or the item is not unlocked yet (says which day it
 * unlocks), and an OK button. The shop shakes the card as well; this makes sure the reason is
 * impossible to miss.
 *
 * @param {import('phaser').Scene} scene
 * @param {Object} options
 * @param {string} options.itemName - what they tried to buy.
 * @param {number} [options.shortBy] - how many more dollars they need (not enough money).
 * @param {number} [options.unlockDay] - the day the item unlocks (not unlocked yet; used when shortBy is absent).
 * @param {() => void} [options.onClose] - called once the popup has gone.
 */
export function showShopNotice(scene, { itemName, shortBy, unlockDay, onClose })
{
    const S = UI_SCALE;
    const notUnlocked = shortBy === undefined;
    const frame = buildFrame(scene, {
        width: 680,
        height: 360,
        title: notUnlocked ? 'Not unlocked yet!' : 'Not enough money!',
        subtitle: notUnlocked ? 'Not in stock yet.' : `You can't afford the ${itemName} yet.`,
        subtitleColor: '#6b6354',
        head: 'worker-head-sad',
    });
    const lineY = frame.subtitleY + 74 * S;
    const extra = [];
    if (notUnlocked)
    {
        extra.push(
            scene.add
                .text(frame.textX, lineY, `Unlocks on Day ${unlockDay}`, { fontFamily: 'Fredoka, Arial Black', fontStyle: '700', fontSize: 30 * S, color: '#b5472f' })
                .setOrigin(0, 0.5)
        );
    }
    else
    {
        // "Short by [note] 15" under the subtitle.
        const label = scene.add
            .text(frame.textX, lineY, 'Short by', { fontFamily: 'Fredoka, Arial', fontStyle: '600', fontSize: 28 * S, color: '#b5472f' })
            .setOrigin(0, 0.5);
        extra.push(
            label,
            addMoneyText(scene, frame.textX + label.width + 12 * S, lineY, shortBy, { fontFamily: 'Fredoka, Arial Black', fontStyle: '700', fontSize: 30 * S, color: '#b5472f' })
        );
    }
    const buttonY = frame.height / 2 - 37 * S - 16 * S - 28 * S;
    const ok = addPillButton(scene, 0, buttonY, { width: 200, height: 56, label: 'OK', fontSize: 24 });
    frame.box.add([...extra, ok]);

    let closed = false;
    makePressable(scene, ok, () => {
        if (!closed)
        {
            closed = true;
            frame.close(onClose);
        }
    });
}
