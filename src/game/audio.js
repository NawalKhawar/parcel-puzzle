/**
 * audio.js
 *
 * Tiny helpers for the game's sound: one background-music track at a time (kept playing across
 * scene changes, so e.g. the gameplay music doesn't restart on every new truck) and one-shot
 * sound effects that layer on top of it.
 *
 * The sounds themselves are the .mp3 files in assets/, loaded by Preloader under their file names
 * ('title-bgm', 'gameplay-bgm', 'pop', 'pop-high', 'cash-register', 'level-complete'). A sound
 * whose file is missing is simply skipped, so a not-yet-delivered asset never crashes the game.
 *
 * Browsers refuse to play audio before the player has clicked/tapped the page once. Phaser holds
 * any early play() request and starts it at that first interaction, so the title music begins
 * as soon as the browser allows it.
 */

/** Volume of the title-screen music (0-1). */
export const TITLE_BGM_VOLUME = 0.7;
/** Volume of the in-game music (0-1) - quieter, so the sound effects on top of it stay clear. */
export const GAMEPLAY_BGM_VOLUME = 0.4;

/** The background-music sound currently playing (or waiting for the browser to allow audio), if any. */
let currentBgm = null;
/** The asset key of currentBgm, so asking for the same track again is a no-op instead of a restart. */
let currentBgmKey = null;

/** Volume every sound effect plays at (0-1) - quieter than full so they sit under the music nicely. */
export const SFX_VOLUME = 0.75;

/**
 * Plays a one-shot sound effect on top of whatever else is playing.
 *
 * @param {import('phaser').Scene} scene - any scene (used to reach the game-wide sound manager).
 * @param {string} key - the sound's asset key, e.g. 'pop'.
 * @param {number} [volume] - 0-1, defaults to SFX_VOLUME.
 */
export function playSfx(scene, key, volume = SFX_VOLUME)
{
    if (scene.cache.audio.exists(key))
    {
        scene.sound.play(key, { volume });
    }
}

/**
 * Starts a looping background-music track, replacing any other one. If that same track is
 * already playing it is left alone (so it carries on seamlessly from truck to truck).
 *
 * @param {import('phaser').Scene} scene - any scene.
 * @param {string} key - the track's asset key, e.g. 'gameplay-bgm'.
 * @param {number} volume - 0-1.
 */
export function playBgm(scene, key, volume)
{
    if (currentBgmKey === key)
    {
        return;
    }
    stopBgm();
    if (!scene.cache.audio.exists(key))
    {
        return;
    }
    currentBgm = scene.sound.add(key, { loop: true, volume });
    currentBgmKey = key;
    currentBgm.play();
}

/** Stops and discards the current background music, if any (silence until the next playBgm). */
export function stopBgm()
{
    if (currentBgm)
    {
        currentBgm.stop();
        currentBgm.destroy();
    }
    currentBgm = null;
    currentBgmKey = null;
}
