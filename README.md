# parcel-packing-puzzle
A puzzle game about packing mail trucks! 📦

## Prerequisites

### Node.js

This project requires **Node.js 18+** (LTS version recommended). Download from [nodejs.org](https://nodejs.org).

**To check your version:**
```bash
node --version
```

**If Node.js is not installed:**
1. Visit [nodejs.org](https://nodejs.org)
2. Download the LTS version (18 or later)
3. Run the installer and follow the prompts
4. After installation, restart your terminal and verify: `node --version`

### npm

`npm` comes bundled with Node.js. Verify it's installed:
```bash
npm --version
```

## Installation

1. **Clone or download this repository** to your computer.

2. **Open a terminal** in the project directory and install dependencies:
   ```bash
   npm install
   ```
   This downloads all required packages (Phaser, Vite, Playwright for testing, etc.) into a `node_modules` folder.

   **If installation fails:**
   - Ensure Node.js is installed and version 18+: `node --version`
   - Try clearing the npm cache: `npm cache clean --force`
   - Delete `node_modules` and `package-lock.json`, then run `npm install` again

## Running the Game

### Development Server
Start the dev server with hot-reload (recommended for playing/testing):
```bash
npm run dev
```

The game will open at `http://localhost:8080` in your browser. While the server is running, any code changes will automatically recompile and reload the page.

**To stop the dev server:** Press `Ctrl+C` in the terminal.

## Game Controls

- **Click and drag** polyomino pieces from the tray (bottom) onto the grid (top) to place them. Drag a placed piece to move it, or drag it off the grid to put it back in the tray
- **Snap alignment:** Pieces snap to the grid when dragged nearby
- **Reset and Pause buttons** in the top-left HUD (there is no Undo - just move pieces around)
- **Hint button** (top-left, from level 2 onwards) highlights, in gold, where one piece belongs on the board - it never moves your pieces, even if they are in the way. The highlight disappears once the right piece is placed there. It can be used once per truck and then fades out
- **Coin counter** (top-left) shows your total earnings, which carry over from day to day

## How the Game Flows

- The title screen has a **Play** button, which starts level 1 right away.
- The game has **30 levels** (each one is a day). Each level is a set of **trucks** (puzzles): level 1 has 3 (all easy), levels 2-7 have 4 (2 easy, 2 medium), levels 8-12 have 5 (2 easy, 2 medium, 1 hard), and levels 13-30 have 6 (2 easy, 2 medium, 2 hard). The header shows e.g. "Level 3 · Truck 2/4".
- Difficulty ramps up within each day and over the course of the game.
- Piece shapes are introduced gradually: levels 1-2 only have simple shapes, and new ones arrive at levels 3, 8, 13, 18 and 23. Each truck has a pool of five puzzles and the game rotates through them, so replaying a level gives fresh puzzles. On a level that introduces new shapes, a "New piece!" popup shows at the start.
- Trucks pay $10 (easy), $15 (medium) or $35 (hard). Day 1 adds a $10 first-day bonus, so you have $40 after the first day.
- After the last truck of a day, a report from Adequate Parcel Service ("Arrives Intact, Mostly") shows trucks completed, truck earnings, any bonuses and the total earned that day, with **Shop**, **Decorate** and **Next Day**.
- **Shop** is a single grid of placeholder apartment items - nothing can be bought yet.
- **Decorate** opens your apartment. Drag furniture from the inventory on the right onto the floor grid: a green ghost means the spot is free, red means it is not. Let go to place it. Click a placed item to pick it up again, or drag it back onto the inventory to put it away. Your layout is kept until you start a new game.

## Shape-Gated Puzzle Pool

`src/data/levels.shapes.json` is the set of puzzles the game plays (800 of them, 5 per truck slot) where shapes are introduced gradually: levels 1-2 use only simple shapes (dot, dominoes, straight 3-bar, square, straight 4-bar), level 3 adds the L-tromino and L-tetromino, and levels 8, 13, 18 and 23 each add one more (T, S, P, plus). It has the same trucks per day and easy/medium/hard order as the main levels. When a day starts, the game picks one puzzle from each slot's pool. To rebuild or check it:
```bash
node scripts/generate-levels.js --shape-gated        # add --pool=8 for 8 puzzles per slot
node scripts/validate-levels.js --shapes
```

## Regenerating the Levels

The levels in `src/data/levels.json` are generated. To change the number of trucks per day or the difficulty curve, edit the top of `scripts/generate-levels.js`, then run:
```bash
node scripts/generate-levels.js
node scripts/validate-levels.js
npm test
```


This is a fan project built with Phaser. Phaser is open source under the MIT License.
