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
