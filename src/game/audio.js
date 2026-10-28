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

// ------------------------------------------------------------------ making sure the sound can start

/**
 * Taps / clicks / key presses that browsers accept as "the player wants sound now". The list is wide on
 * purpose: which of them counts differs between Chrome, Firefox and Safari, on desktop and on phones.
 */
const UNLOCK_GESTURES = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'keydown'];

/** The most recent reason the browser refused to start the audio, for the ?audiodebug=1 overlay. */
let lastResumeProblem = '';

/**
 * Restarts the current background music if it is supposed to be playing but is silent - for example a
 * track that was asked for while the browser still blocked audio, and was not picked up when it unlocked.
 * A track that is merely paused (under a jingle) or muted (it plays on silently) is left alone.
 */
function restartMusicIfSilent()
{
    if (currentBgm && !currentBgm.isPlaying && !currentBgm.isPaused)
    {
        currentBgm.play();
    }
}

/**
 * Makes the game's sound start reliably on every browser and phone. Call it once, as soon as the game
 * exists (main.js).
 *
 * Browsers keep the audio switched off until the player taps or clicks, and Phaser's own unlock gives up
 * for good after ONE refused attempt (on a phone the first event is often touchstart, which some browsers
 * refuse, and Phaser then removes all its listeners and never tries again - the game stays silent
 * forever). So this adds a second, patient unlock that:
 *
 *   - retries on EVERY tap / click / key press until the audio is really running (and keeps listening
 *     afterwards at no cost, in case the browser suspends it again);
 *   - resumes the audio when the tab comes back to the front, the page is restored, or the window regains
 *     focus (a phone call, a locked screen and an alt-tab all suspend it);
 *   - tells Phaser the unlock happened (so sounds that were waiting start) and restarts music that is
 *     silent when it should not be;
 *   - on iPhones / iPads (Safari 16.4+) asks for the "playback" audio session, so the sound is NOT muted
 *     by the ring / silent switch.
 *
 * Add ?audiodebug=1 to the page address to see a live status box (handy on a phone, which has no console).
 *
 * @param {import('phaser').Game} game
 */
export function installAudioUnlock(game)
{
    const manager = game.sound;
    const context = manager && manager.context;
    if (!context)
    {
        // No Web Audio in this browser (Phaser fell back to plain audio tags): nothing more to do here.
        return;
    }

    try
    {
        if (navigator.audioSession)
        {
            navigator.audioSession.type = 'playback';
        }
    }
    catch
    {
        // An older browser without the audio-session setting: the ring / silent switch may mute the game.
    }

    /** The audio is running: let Phaser release the sounds that were waiting, then make sure music plays. */
    const onRunning = () =>
    {
        if (context.state !== 'running')
        {
            return;
        }
        lastResumeProblem = '';
        if (manager.locked)
        {
            // Phaser's own bookkeeping: its next update emits "unlocked" and starts anything that waited.
            manager.unlocked = true;
        }
        window.setTimeout(restartMusicIfSilent, 250);
    };

    /** Asks the browser to start / restart the audio (a no-op while it is running). */
    const tryResume = () =>
    {
        if (context.state === 'running')
        {
            return;
        }
        try
        {
            const attempt = context.resume();
            if (attempt && attempt.then)
            {
                attempt.then(onRunning, (error) => { lastResumeProblem = String(error && error.message ? error.message : error); });
            }
        }
        catch (error)
        {
            lastResumeProblem = String(error && error.message ? error.message : error);
        }
    };

    for (const type of UNLOCK_GESTURES)
    {
        window.addEventListener(type, tryResume, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { tryResume(); } });
    window.addEventListener('pageshow', tryResume);
    window.addEventListener('focus', tryResume);
    // Also covers the audio starting through Phaser's own unlock.
    context.addEventListener('statechange', onRunning);

    installAudioDebug(game);
}

/**
 * The ?audiodebug=1 overlay: a small box in the corner showing whether the audio is running, what Phaser
 * thinks is playing and the mute switches - so "there is no sound" can be diagnosed on a phone.
 *
 * @param {import('phaser').Game} game
 */
function installAudioDebug(game)
{
    if (!new URLSearchParams(window.location.search).has('audiodebug'))
    {
        return;
    }
    const manager = game.sound;
    const box = document.createElement('pre');
    box.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;margin:0;padding:6px 8px;max-width:100vw;' +
        'background:rgba(0,0,0,0.78);color:#7CFC7C;font:11px/1.35 monospace;white-space:pre-wrap;pointer-events:none';
    document.body.appendChild(box);
    window.setInterval(() =>
    {
        const playing = manager.sounds.filter((sound) => sound.isPlaying).map((sound) => sound.key).join(', ') || 'nothing';
        const decoded = ['title-bgm', 'gameplay-bgm', 'pop', 'cash-register'].map((key) => `${key}:${game.cache.audio.exists(key) ? 'ok' : 'MISSING'}`).join(' ');
        box.textContent =
            `audio context: ${manager.context.state}   Phaser locked: ${manager.locked}\n` +
            `music muted: ${musicMuted}   sound effects muted: ${sfxMuted}   master mute: ${manager.mute}\n` +
            `playing: ${playing}\n` +
            `files: ${decoded}\n` +
            `last problem: ${lastResumeProblem || 'none'}   (tap the screen if the context is not running)`;
    }, 400);
}
