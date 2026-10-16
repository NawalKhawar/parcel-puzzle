#!/usr/bin/env node
/**
 * screenshot.js
 *
 * Dev/QA helper: launches the Vite dev server, drives a headless Chromium (via
 * Playwright) through the game's boot sequence (Boot -> Preloader -> TitleScene, then
 * clicks Play -> PuzzleScene), and saves screenshots of the title screen and the first
 * puzzle. This is how UI work under src/game/ gets
 * visually verified per CLAUDE.md's "test the feature in a browser before reporting
 * complete" rule — Phaser renders everything to a single <canvas>, so there's no DOM
 * to inspect or assert against; a screenshot (plus a console-error check) is the only
 * real signal that something actually rendered correctly.
 *
 * Usage: node scripts/screenshot.js [out-path]
 *   out-path defaults to scripts/.screenshots/puzzle-scene.png (gitignored — these are
 *   throwaway verification artifacts, not something to commit).
 *
 * Unlike the rest of scripts/ (validate-levels.js, generate-levels.js), this one is NOT
 * Phaser-free by design — its whole job is to drive and inspect the real browser
 * build, not to run puzzle logic standalone.
 */
import { chromium } from '@playwright/test';
import { spawn, execSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = 8080;
const URL = `http://localhost:${PORT}/`;

/**
 * Polls `url` until it responds OK, or rejects after `timeoutMs`. Vite's first
 * compile can take a few seconds, so this is used instead of a blind sleep.
 *
 * @param {string} url
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
function waitForServer(url, timeoutMs = 30000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const tryOnce = async () => {
            try {
                const res = await fetch(url);
                if (res.ok)
                {
                    resolve();
                    return;
                }
            }
            catch
            {
                // Server not up yet — expected while Vite is still starting.
            }
            if (Date.now() - start > timeoutMs)
            {
                reject(new Error(`Dev server did not respond at ${url} within ${timeoutMs}ms`));
                return;
            }
            setTimeout(tryOnce, 300);
        };
        tryOnce();
    });
}

/**
 * Kills a process tree by pid. `child_process`'s `.kill()` alone only signals the
 * immediate child; on Windows `npm run dev` spawns a cmd.exe wrapper that spawns vite,
 * and SIGTERM doesn't propagate down that chain, so the vite process (and the port it
 * holds) survives a plain `.kill()`. `taskkill /T` kills the whole tree instead.
 *
 * @param {number} pid
 */
function killProcessTree(pid) {
    try
    {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    }
    catch
    {
        // Already exited, or nothing to kill — not an error for our purposes.
    }
}

async function main() {
    const outPath = process.argv[2] ?? path.join(__dirname, '.screenshots', 'puzzle-scene.png');
    await mkdir(path.dirname(outPath), { recursive: true });

    // npm resolves to npm.cmd on Windows, which can only be invoked through a shell —
    // spawning it directly throws EINVAL. Node also warns against combining
    // `shell: true` with an argument array (unescaped concatenation), so the whole
    // command is passed as one pre-built string instead, which sidesteps both issues
    // since there's no untrusted input being concatenated here.
    const devServer = spawn('npm run dev-nolog', { cwd: PROJECT_ROOT, shell: true });
    const consoleErrors = [];
    let browser;

    try
    {
        await waitForServer(URL);

        browser = await chromium.launch();
        const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

        page.on('console', (msg) => {
            if (msg.type() === 'error')
            {
                consoleErrors.push(msg.text());
            }
        });
        page.on('pageerror', (err) => consoleErrors.push(String(err)));

        await page.goto(URL);
        await page.waitForSelector('canvas');

        // Boot -> Preloader -> TitleScene runs automatically with no user interaction
        // needed. This fixed delay (rather than scene-aware polling) is acceptable for
        // a manual verification helper.
        await page.waitForTimeout(1000);

        // Capture the title screen too (saved next to the main screenshot).
        const titlePath = outPath.replace(/\.png$/, '-title.png');
        await page.screenshot({ path: titlePath });
        console.log(`Title screenshot saved to ${titlePath}`);

        // Click the Play button. Phaser draws to a canvas, so there's no DOM button to
        // target: instead click where TitleScene places it - horizontally centered, and
        // 70/768 of the canvas height below its vertical center.
        const box = await page.locator('canvas').boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height * (0.5 + 70 / 768));
        await page.waitForTimeout(500);

        await page.screenshot({ path: outPath });

        console.log(`Screenshot saved to ${outPath}`);
        if (consoleErrors.length > 0)
        {
            console.error('Console errors detected during the run:');
            for (const err of consoleErrors)
            {
                console.error(' -', err);
            }
            process.exitCode = 1;
        }
    }
    finally
    {
        if (browser)
        {
            await browser.close();
        }
        if (devServer.pid)
        {
            killProcessTree(devServer.pid);
        }
    }
}

main();
