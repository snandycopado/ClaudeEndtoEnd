import { createElement } from 'lwc';
import ComponentName from 'c/componentName';
import getItems from '@salesforce/apex/FeatureController.getItems';

jest.mock('@salesforce/apex/FeatureController.getItems', () => {
    const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
    return { default: createApexTestWireAdapter(jest.fn()) };
}, { virtual: true });

describe('c-component-name', () => {
    afterEach(() => {
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
        jest.clearAllMocks();
    });

    it('shows the empty state when there are no items', async () => {
        const element = createElement('c-component-name', { is: ComponentName });
        document.body.appendChild(element);
        getItems.emit([]);
        await Promise.resolve();
        expect(element.shadowRoot.textContent).toContain('Nothing to show yet.');
    });

    it('shows an error message when the wire fails', async () => {
        const element = createElement('c-component-name', { is: ComponentName });
        document.body.appendChild(element);
        getItems.error({ message: 'Boom' });
        await Promise.resolve();
        expect(element.shadowRoot.querySelector('[role="alert"]')).not.toBeNull();
    });
});
