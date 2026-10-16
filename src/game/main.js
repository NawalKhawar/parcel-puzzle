import { Boot } from './scenes/Boot';
import { Game as MainGame } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { Preloader } from './scenes/Preloader';
import { PuzzleScene } from './scenes/PuzzleScene';
import { WinScene } from './scenes/WinScene';
import { TitleScene } from './scenes/TitleScene';
import { DayCompleteScene } from './scenes/DayCompleteScene';
import { ShopScene } from './scenes/ShopScene';
import { ApartmentScene } from './scenes/ApartmentScene';
import { UI_SCALE } from './uiScale.js';
import { AUTO, Game, Scale } from 'phaser';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
//  width/height are multiplied by UI_SCALE (not left at the 1024x768 design size) so
//  the canvas has enough real pixels to stay sharp once Scale.FIT stretches it to fill
//  a full-screen/high-DPI display - see uiScale.js for why this is necessary. Every
//  scene's own pixel constants (cell size, margins, font sizes, etc.) are multiplied
//  by the same UI_SCALE, so the game still looks the same size on screen - just crisper.
const config = {
    type: AUTO,
    width: 1024 * UI_SCALE,
    height: 768 * UI_SCALE,
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
        WinScene,
        DayCompleteScene,
        ShopScene,
        ApartmentScene,
        MainGame,
        GameOver
    ]
};

const StartGame = (parent) => {

    return new Game({ ...config, parent });

}

export default StartGame;
