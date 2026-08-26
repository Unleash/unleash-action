import { jest, test, expect } from '@jest/globals';
import { UnleashAction } from '../src/unleash-action';

test('checks features', async () => {
    const unleash = {};
    unleash.isEnabled = () => {
        return true;
    };
    unleash.on = () => {};
    unleash.start = () => {};
    unleash.stop = () => {};
    unleash.getVariant = () => {
        return { name: 'variant-1', payload: {} };
    };

    let resultSet = false;
    const action = new UnleashAction({
        client: unleash,
        url: 'http://localhost:3000',
        clientKey: 'client-1',
        appName: 'test-app',
        context: {},
        features: ['feature-1'],
        setResult: (name, value) => {
            resultSet = true;
            expect(name).toBe('feature-1');
            expect(value).toBe(true);
        },
    });
    await action.run();
    expect(resultSet).toBe(true);
});

test('checks variants', async () => {
    const unleash = {};
    unleash.isEnabled = () => {
        return true;
    };
    unleash.on = () => {};
    unleash.start = () => {};
    unleash.stop = () => {};
    unleash.getVariant = () => {
        return {
            name: 'variant-1',
            enabled: true,
            payload: { value: 'red' },
        };
    };

    let resultSets = [];
    const action = new UnleashAction({
        client: unleash,
        url: 'http://localhost:3000',
        clientKey: 'client-1',
        appName: 'test-app',
        context: {},
        variants: ['variant-1'],
        setResult: (name, value) => {
            resultSets.push({ name, value });
        },
    });
    await action.run();
    expect(resultSets).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ name: 'variant-1', value: true }),
            expect.objectContaining({
                name: 'variant-1_variant',
                value: 'red',
            }),
        ]),
    );
});

test('end sends metrics and stops the client', async () => {
    const unleash = {};
    unleash.on = () => {};
    unleash.sendMetrics = jest.fn();
    unleash.stop = jest.fn();
    const action = new UnleashAction({
        client: unleash,
        url: 'http://localhost:3000',
        clientKey: 'client-1',
        appName: 'test-app',
        context: {},
        variants: ['variant-1'],
        setResult: () => {},
    });

    await action.end();
    expect(unleash.sendMetrics).toHaveBeenCalled();
    expect(unleash.stop).toHaveBeenCalled();
});

test('sets results for multiple features and variants', async () => {
    const unleash = {};
    unleash.isEnabled = () => {
        return true;
    };
    unleash.on = () => {};
    unleash.start = () => {};
    unleash.stop = () => {};
    unleash.getVariant = () => {
        return {
            name: 'variant-1',
            enabled: true,
            payload: { value: 'red' },
        };
    };

    const setResult = jest.fn();
    const action = new UnleashAction({
        client: unleash,
        url: 'http://localhost:3000',
        clientKey: 'client-1',
        appName: 'test-app',
        context: {},
        features: ['feature-1', 'feature-2'],
        variants: ['variant-1'],
        setResult,
    });
    await action.run();
    expect(setResult).toHaveBeenCalledWith('feature-1', true);
    expect(setResult).toHaveBeenCalledWith('feature-2', true);
    expect(setResult).toHaveBeenCalledWith('variant-1', true);
    expect(setResult).toHaveBeenCalledWith('variant-1_variant', 'red');
    expect(setResult).toHaveBeenCalledTimes(4);
});

test('doesnt set variant result if variant is not enabled', async () => {
    const unleash = {};
    unleash.isEnabled = () => {
        return false;
    };
    unleash.on = () => {};
    unleash.start = () => {};
    unleash.stop = () => {};
    unleash.getVariant = () => {
        return {
            name: 'variant-1',
            enabled: false,
            payload: { value: 'red' },
        };
    };

    const setResult = jest.fn();
    const action = new UnleashAction({
        client: unleash,
        url: 'http://localhost:3000',
        clientKey: 'client-1',
        appName: 'test-app',
        context: {},
        variants: ['variant-1'],
        setResult,
    });
    await action.run();
    expect(setResult).toHaveBeenCalledTimes(1);
    expect(setResult).toHaveBeenCalledWith('variant-1', false);
    expect(setResult).not.toHaveBeenCalledWith('variant-1_variant');
});

test('sets feature result to false if feature is not enabled', async () => {
    const unleash = {};
    unleash.isEnabled = () => {
        return false;
    };
    unleash.on = () => {};
    unleash.start = () => {};
    unleash.stop = () => {};
    unleash.getVariant = () => {
        return {
            name: 'variant-1',
            enabled: false,
            payload: { value: 'red' },
        };
    };

    const setResult = jest.fn();
    const action = new UnleashAction({
        client: unleash,
        url: 'http://localhost:3000',
        clientKey: 'client-1',
        appName: 'test-app',
        context: {},
        features: ['feature-1'],
        setResult,
    });
    await action.run();
    expect(setResult).toHaveBeenCalledTimes(1);
    expect(setResult).toHaveBeenCalledWith('feature-1', false);
});
