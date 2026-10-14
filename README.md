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

- **Click and drag** polyomino pieces from the tray (bottom) onto the grid (top) to place them
- **Snap alignment:** Pieces snap to the grid when dragged nearby
- **Undo, Reset, Pause buttons** in the top-right HUD
- **Coin counter** shows your running total across the current shift (all 7 levels)


This is a fan project built with Phaser. Phaser is open source under the MIT License.
