import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { PuzzleScene } from './scenes/PuzzleScene';
import { TitleScene } from './scenes/TitleScene';
import { DayCompleteScene } from './scenes/DayCompleteScene';
import { PromotionScene } from './scenes/PromotionScene';
import { BonusScene } from './scenes/BonusScene';
import { ShopScene } from './scenes/ShopScene';
import { ApartmentScene } from './scenes/ApartmentScene';
import { UI_SCALE } from './uiScale.js';
import { AUTO, Game, Scale } from 'phaser';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
//  width/height are multiplied by UI_SCALE (not left at the 1280x720 design size) so
//  the canvas has enough real pixels to stay sharp once Scale.FIT stretches it to fill
//  a full-screen/high-DPI display - see uiScale.js for why this is necessary. Every
//  scene's own pixel constants (cell size, margins, font sizes, etc.) are multiplied
//  by the same UI_SCALE, so the game still looks the same size on screen - just crisper.
const config = {
    type: AUTO,
    width: 1280 * UI_SCALE,
    height: 720 * UI_SCALE,
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

    return new Game({ ...config, parent });

}

export default StartGame;
