/**
 * TrayLayout.js
 *
 * The maths for laying a level's parcels out in a single row on the conveyor belt: how big
 * they should be, and where along the row each one goes. Pure maths with no Phaser dependency
 * (see "Architectural boundary" in PROJECT_STRUCTURE.md), so it can be unit-tested; the scene
 * just feeds in the piece sizes and applies the result.
 *
 * The row has to fit all of a level's pieces side by side across the belt. In order of
 * preference, the layout:
 *   1. keeps every piece at the largest allowed size, with a small gap between them, if that fits;
 *   2. otherwise lets neighbouring pieces overlap a little (so they read as sitting in front of
 *      and behind each other, but never covering enough of a neighbour to hide its shape),
 *      spreading the overlap evenly across the row so it is as little as possible;
 *   3. otherwise shrinks every piece (all by the same factor) a step at a time and tries again,
 *      stopping at a minimum size.
 */

/**
 * @typedef {Object} TrayLayoutOptions
 * @property {number} usableWidth - how wide the row may be, in px.
 * @property {number} maxScale - the largest size pieces may be shown at (1 = unscaled).
 * @property {number} minScale - the smallest size pieces may be shrunk to.
 * @property {number} maxHeight - the tallest the tallest piece may be once scaled, in px.
 * @property {number} gap - space between neighbouring pieces when they don't overlap, in px.
 * @property {number} maxOverlapFraction - the most a piece may be overlapped by a neighbour, as a
 *   fraction of the narrower of the two (e.g. 0.2 = a fifth).
 * @property {number} maxOverlapPx - an absolute cap on any single overlap, in px.
 */

/**
 * @typedef {Object} TrayLayout
 * @property {number} scale - the factor to draw every piece at.
 * @property {number[]} lefts - each piece's left edge, in px from the start of the row, in the
 *   same order as the input. Later pieces are further right.
 * @property {number} rowWidth - the total width of the row, in px.
 * @property {boolean} overlaps - true if any two neighbouring pieces overlap.
 * @property {boolean} fits - false only if even the smallest size with the largest overlap
 *   does not fit in usableWidth (the row is then wider than asked).
 */

/**
 * Works out the size and positions of the parcels in the row.
 *
 * @param {Array<{width: number, height: number}>} sizes - each piece's size at scale 1, in px.
 * @param {TrayLayoutOptions} options
 * @returns {TrayLayout}
 */
export function computeTrayLayout(sizes, options) {
    const { usableWidth, maxScale, minScale, maxHeight, gap, maxOverlapFraction, maxOverlapPx } = options;
    const count = sizes.length;
    if (count === 0) {
        return { scale: Math.min(1, maxScale), lefts: [], rowWidth: 0, overlaps: false, fits: true };
    }

    const tallest = Math.max(...sizes.map((size) => size.height));
    // The biggest the pieces may be at all: capped by maxScale and by the height limit.
    const ceiling = Math.max(minScale, Math.min(maxScale, maxHeight / tallest));

    /**
     * Tries to fit the row at one scale; returns the spacing between each neighbouring pair
     * (negative = overlap), or null if it can't be made to fit. The spacing runs from `gap`
     * (no squeeze needed) towards -maxOverlap (squeezed as far as allowed), by the same
     * fraction of the available squeeze for every pair, so overlap is spread evenly.
     */
    const trySpacing = (scale) => {
        const widths = sizes.map((size) => size.width * scale);
        const natural = widths.reduce((sum, w) => sum + w, 0) + gap * (count - 1);
        if (natural <= usableWidth) {
            return { widths, spacings: Array(count - 1).fill(gap) };
        }

        // How far each junction can be squeezed: from `gap` down to -(its maximum overlap).
        const squeezes = [];
        for (let i = 0; i < count - 1; i++) {
            const maxOverlap = Math.min(maxOverlapPx, maxOverlapFraction * Math.min(widths[i], widths[i + 1]));
            squeezes.push(gap + maxOverlap);
        }
        const capacity = squeezes.reduce((sum, s) => sum + s, 0);
        const needed = natural - usableWidth;
        if (needed > capacity) {
            return null;
        }
        const fraction = needed / capacity;
        return { widths, spacings: squeezes.map((squeeze) => gap - fraction * squeeze) };
    };

    // Shrink in small steps from the biggest allowed size until the row fits.
    let scale = ceiling;
    let result = trySpacing(scale);
    while (!result && scale > minScale) {
        scale = Math.max(minScale, scale - 0.01);
        result = trySpacing(scale);
    }

    let fits = true;
    if (!result) {
        // Even the smallest size doesn't fit: use the largest overlap everywhere (best effort).
        fits = false;
        const widths = sizes.map((size) => size.width * scale);
        const spacings = [];
        for (let i = 0; i < count - 1; i++) {
            spacings.push(-Math.min(maxOverlapPx, maxOverlapFraction * Math.min(widths[i], widths[i + 1])));
        }
        result = { widths, spacings };
    }

    const { widths, spacings } = result;
    const lefts = [];
    let cursor = 0;
    for (let i = 0; i < count; i++) {
        lefts.push(cursor);
        cursor += widths[i] + (i < count - 1 ? spacings[i] : 0);
    }

    return {
        scale,
        lefts,
        rowWidth: cursor,
        overlaps: spacings.some((spacing) => spacing < 0),
        fits,
    };
}

// ------------------------------------------------------------------ several rows (portrait screens)

/**
 * @typedef {Object} TrayRowsLayout
 * @property {number} scale - the one factor every piece is drawn at (all rows share it, so no
 *   parcel looks bigger than another just because of the row it is on).
 * @property {Array<{indices: number[], lefts: number[], rowWidth: number}>} rows - the pieces on each
 *   row, top row first: `indices` are positions in the input list (consecutive, in the original
 *   order), `lefts` each piece's left edge from the start of ITS row, `rowWidth` the row's width.
 * @property {boolean} fits - false only if a row is still wider than asked at the smallest size.
 */

/**
 * Splits the pieces, in their original order, into `rowCount` consecutive groups so that the widest
 * row is as narrow as it can be (a small dynamic programme - there are never more than a dozen
 * pieces). Keeping the original order means the player still meets the parcels in the order the
 * level lists them, just wrapped onto lines like text.
 *
 * @param {number[]} widths - each piece's width at scale 1.
 * @param {number} gap - space between neighbouring pieces on a row.
 * @param {number} rowCount - how many rows (at most one per piece).
 * @returns {number[][]} the piece indices on each row.
 */
function splitIntoRows(widths, gap, rowCount) {
    const n = widths.length;
    // How wide pieces i..j-1 are on one row, at scale 1.
    const span = (i, j) => {
        let total = gap * (j - i - 1);
        for (let k = i; k < j; k++) {
            total += widths[k];
        }
        return total;
    };
    // best[k][j]: the narrowest "widest row" when the first j pieces are split into k rows;
    // cut[k][j]: where the last of those k rows starts (so the split can be read back).
    const best = Array.from({ length: rowCount + 1 }, () => Array(n + 1).fill(Infinity));
    const cut = Array.from({ length: rowCount + 1 }, () => Array(n + 1).fill(0));
    best[0][0] = 0;
    for (let k = 1; k <= rowCount; k++) {
        for (let j = k; j <= n; j++) {
            for (let i = k - 1; i < j; i++) {
                const widest = Math.max(best[k - 1][i], span(i, j));
                if (widest < best[k][j]) {
                    best[k][j] = widest;
                    cut[k][j] = i;
                }
            }
        }
    }
    const rows = [];
    let end = n;
    for (let k = rowCount; k >= 1; k--) {
        const start = cut[k][end];
        rows.unshift(Array.from({ length: end - start }, (_, offset) => start + offset));
        end = start;
    }
    return rows;
}

/**
 * Lays the parcels out on `rowCount` rows (one conveyor lane each). Pieces never overlap; if even
 * the best split is too wide at the largest size, every piece shrinks by the same factor (never
 * below minScale). Like computeTrayLayout, pure maths with no Phaser dependency.
 *
 * @param {Array<{width: number, height: number}>} sizes - each piece's size at scale 1, in px.
 * @param {TrayLayoutOptions} options - as for computeTrayLayout (the overlap options are ignored:
 *   rows never overlap).
 * @param {number} rowCount - how many rows to use (clamped to 1..number of pieces).
 * @returns {TrayRowsLayout}
 */
export function computeTrayRows(sizes, options, rowCount) {
    const count = sizes.length;
    if (count === 0) {
        return { scale: Math.min(1, options.maxScale), rows: [], fits: true };
    }
    const rowsWanted = Math.max(1, Math.min(rowCount, count));
    const groups = splitIntoRows(sizes.map((size) => size.width), options.gap, rowsWanted);
    const noOverlap = { ...options, maxOverlapFraction: 0, maxOverlapPx: 0 };

    // Each row is first laid out on its own; the whole tray then uses the smallest scale any row needed.
    const solo = groups.map((indices) => computeTrayLayout(indices.map((i) => sizes[i]), noOverlap));
    const scale = Math.min(...solo.map((layout) => layout.scale));

    // Lay every row out again at that one shared scale (pinned by making min = max = scale).
    const pinned = { ...noOverlap, maxScale: scale, minScale: scale };
    const rows = groups.map((indices) => {
        const layout = computeTrayLayout(indices.map((i) => sizes[i]), pinned);
        return { indices, lefts: layout.lefts, rowWidth: layout.rowWidth };
    });
    return { scale, rows, fits: solo.every((layout) => layout.fits) };
}

/**
 * Chooses how many rows to use: the fewest (up to maxRows) whose shared scale is at least
 * `acceptScale`, or maxRows rows if none gets there. Fewer rows leave more room for the truck, so
 * they are preferred; more rows are only used when fewer would make the parcels too small.
 *
 * @param {Array<{width: number, height: number}>} sizes - each piece's size at scale 1, in px.
 * @param {TrayLayoutOptions} options - as for computeTrayRows.
 * @param {Object} choice
 * @param {number} choice.maxRows - the most rows allowed.
 * @param {number} choice.acceptScale - the smallest scale that is good enough (in the same units as maxScale).
 * @returns {TrayRowsLayout & {rowCount: number}}
 */
export function planTrayRows(sizes, options, { maxRows, acceptScale }) {
    const rowLimit = Math.max(1, Math.min(maxRows, sizes.length));
    let layout = null;
    for (let rowCount = 1; rowCount <= rowLimit; rowCount++) {
        layout = computeTrayRows(sizes, options, rowCount);
        if (layout.scale >= acceptScale) {
            return { ...layout, rowCount: layout.rows.length };
        }
    }
    return { ...layout, rowCount: layout ? layout.rows.length : 0 };
}
