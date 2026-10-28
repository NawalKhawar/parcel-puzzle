/**
 * analytics.test.js
 *
 * src/analytics.js must never be able to hurt the game. Here (plain Node: no window, no SDK started) every exported
 * function is called, in every order, and none may throw - the same situation as a blocked or never-initialised SDK.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as analytics from '../src/analytics.js';

test('every tracking function is a harmless no-op when analytics was never started', () => {
    const names = Object.keys(analytics);
    // The documented API (plus the shop-opened twin of trackApartmentOpened).
    for (const name of ['initAnalytics', 'trackDayStart', 'trackDayComplete', 'trackTruckStart', 'trackTruckComplete', 'trackTutorialStep', 'trackHintUsed', 'trackReset', 'trackPurchase', 'trackApartmentOpened', 'trackShopOpened', 'trackMenuChoice']) {
        assert.ok(names.includes(name), `${name} is exported`);
    }
    assert.doesNotThrow(() => {
        analytics.trackDayStart(1);
        analytics.trackTruckStart(1, 0, 'easy');
        analytics.trackTutorialStep(1);
        analytics.trackHintUsed(3, 1);
        analytics.trackReset(3, 1);
        analytics.trackPurchase('clock');
        analytics.trackApartmentOpened();
        analytics.trackShopOpened();
        analytics.trackMenuChoice('new');
        analytics.trackMenuChoice('continue');
        analytics.trackTruckComplete(1, 0, 'easy');
        analytics.trackDayComplete(1);
        // nonsense arguments must not throw either
        analytics.trackDayStart(undefined);
        analytics.trackTruckStart(null, null, undefined);
        analytics.trackPurchase(undefined);
        analytics.trackMenuChoice();
    });
});
