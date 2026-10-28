import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { PuzzleScene } from './scenes/PuzzleScene';
import { TitleScene } from './scenes/TitleScene';
import { DayCompleteScene } from './scenes/DayCompleteScene';
import { PromotionScene } from './scenes/PromotionScene';
import { BonusScene } from './scenes/BonusScene';
import { ShopScene } from './scenes/ShopScene';
import { ApartmentScene } from './scenes/ApartmentScene';
import { gameSizeForWindow, watchOrientation } from './layout.js';
import { installAudioUnlock } from './audio.js';
import { AUTO, Game, Scale } from 'phaser';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
//  The canvas size comes from layout.js: on a wide window it is exactly the original 1280x720 design
//  size, on a tall window (a phone held upright) it is the portrait size. Both are multiplied by UI_SCALE
//  (see uiScale.js) so the canvas has enough real pixels to stay sharp once Scale.FIT stretches it to
//  fill a full-screen/high-DPI display; every scene's own pixel constants are multiplied by the same
//  UI_SCALE, so the game looks the same size on screen - just crisper.
const startSize = gameSizeForWindow(window.innerWidth, window.innerHeight);
const config = {
    type: AUTO,
    width: startSize.width,
    height: startSize.height,
    parent: 'game-container',
    backgroundColor: '#028af8',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        Boot,
        Preloader,
        TitleScene,
        PuzzleScene,
        DayCompleteScene,
        PromotionScene,
        BonusScene,
        ShopScene,
        ApartmentScene
    ]
};

const StartGame = (parent) => {

    const g = new Game({ ...config, parent });
    // A rotated phone / resized window that flips between wide and tall switches layout (layout.js).
    watchOrientation(g);
    // Make the sound start reliably after the player's first tap on every browser / phone (see audio.js).
    // The sound manager exists once the game has booted.
    if (g.isBooted) { installAudioUnlock(g); } else { g.events.once('boot', () => installAudioUnlock(g)); }
    return g;

}

export default StartGame;
