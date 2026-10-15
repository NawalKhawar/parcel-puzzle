import { PlaceholderScreenScene } from './PlaceholderScreenScene.js';

/**
 * DecorateScene.js
 *
 * Placeholder for the future apartment-decorating screen: a blank screen with a Back
 * button (see PlaceholderScreenScene). Reached from the "Decorate" button on the
 * end-of-day popup.
 */
export class DecorateScene extends PlaceholderScreenScene
{
    constructor ()
    {
        super('DecorateScene', 'Decorate');
    }
}
