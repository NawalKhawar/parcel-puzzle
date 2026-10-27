/**
 * audio.js
 *
 * Tiny helpers for the game's sound: one background-music track at a time (kept playing across
 * scene changes, so e.g. the gameplay music doesn't restart on every new truck) and one-shot
 * sound effects that layer on top of it.
 *
 * The sounds themselves are the .mp3 files in assets/audio/ (music/ and sfx/), loaded by Preloader under their file names
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
 * Whether the background music / the sound effects are switched off (the pause menu's toggles).
 * These live only in memory here; they are saved with the rest of the game (game/progress.js, whose
 * saveMute reads isMusicMuted / isSfxMuted) and put back at start-up with restoreMute.
 */
let musicMuted = false;
let sfxMuted = false;

/**
 * Sets both mute choices without announcing the change - used once at start-up to put back what the
 * save remembers. (Nothing is playing yet at that point, and setMusicMuted would not need to be
 * followed by a save.)
 *
 * @param {boolean} music - whether the music starts muted.
 * @param {boolean} sfx - whether the sound effects start muted.
 */
export function restoreMute(music, sfx)
{
    musicMuted = music;
    sfxMuted = sfx;
}

/** @returns {boolean} whether the music is muted. */
export function isMusicMuted()
{
    return musicMuted;
}

/** @returns {boolean} whether the sound effects are muted. */
export function isSfxMuted()
{
    return sfxMuted;
}

/**
 * Mutes or unmutes the music. The track keeps playing silently while muted (rather than being
 * stopped), so unmuting brings it straight back in time instead of restarting it.
 *
 * @param {boolean} muted
 */
export function setMusicMuted(muted)
{
    musicMuted = muted;
    if (currentBgm)
    {
        currentBgm.setMute(muted);
    }
}

/**
 * Mutes or unmutes the sound effects (those played from now on; a sound already playing finishes).
 *
 * @param {boolean} muted
 */
export function setSfxMuted(muted)
{
    sfxMuted = muted;
}

/**
 * Plays a one-shot sound effect on top of whatever else is playing.
 *
 * @param {import('phaser').Scene} scene - any scene (used to reach the game-wide sound manager).
 * @param {string} key - the sound's asset key, e.g. 'pop'.
 * @param {number} [volume] - 0-1, defaults to SFX_VOLUME.
 */
export function playSfx(scene, key, volume = SFX_VOLUME)
{
    if (!sfxMuted && scene.cache.audio.exists(key))
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
    currentBgm = scene.sound.add(key, { loop: true, volume, mute: musicMuted });
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

/**
 * Plays a jingle (e.g. the level-complete fanfare) with the background music paused underneath it:
 * the music pauses where it is, the jingle plays alone, and the music picks up from the same spot
 * the moment the jingle ends. If sound effects are muted, nothing plays and the music is left alone.
 * If no music is playing, it is just a normal sound effect.
 *
 * With `holdMusic` the music is NOT resumed when the jingle ends: it stays paused until the caller
 * brings it back with resumeBgm (the promotion and bonus screens keep it quiet until the player
 * presses the arrow to go on to gameplay).
 *
 * @param {import('phaser').Scene} scene - any scene (used to reach the game-wide sound manager).
 * @param {string} key - the jingle's asset key, e.g. 'level-complete'.
 * @param {Object} [options]
 * @param {number} [options.volume] - 0-1, defaults to SFX_VOLUME.
 * @param {boolean} [options.holdMusic] - leave the music paused after the jingle (default false).
 */
export function playJingle(scene, key, { volume = SFX_VOLUME, holdMusic = false } = {})
{
    if (sfxMuted || !scene.cache.audio.exists(key))
    {
        return;
    }
    const music = currentBgm;
    if (music && music.isPlaying)
    {
        music.pause();
    }
    const jingle = scene.sound.add(key, { volume });
    jingle.once('complete', () => {
        jingle.destroy();
        // Only resume if it is still the same track and nothing else has stopped or replaced it meanwhile.
        if (!holdMusic && music && music === currentBgm && music.isPaused)
        {
            music.resume();
        }
    });
    jingle.play();
}

/**
 * Brings back background music that is paused (by playJingle with holdMusic), from where it left off.
 *
 * @param {string} [key] - only resume if this is the track that is current (so a leftover track that is
 *   about to be replaced, e.g. the title music, is not blipped back on first).
 */
export function resumeBgm(key)
{
    if (currentBgm && currentBgm.isPaused && (key === undefined || key === currentBgmKey))
    {
        currentBgm.resume();
    }
}
