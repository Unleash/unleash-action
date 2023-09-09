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

    const metrics = {};
    metrics.count = () => {};
    metrics.countVariant = () => {};
    metrics.sendMetrics = () => {};
    let resultSet = false;
    const action = new UnleashAction({
        client: unleash,
        metrics,
        url: 'http://localhost:3000',
        clientKey: 'client-1',
        appName: 'test-app',
        environment: 'test',
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

    const metrics = {};
    metrics.count = () => {};
    metrics.countVariant = () => {};
    metrics.sendMetrics = () => {};
    let resultSets = [];
    const action = new UnleashAction({
        client: unleash,
        metrics,
        url: 'http://localhost:3000',
        clientKey: 'client-1',
        appName: 'test-app',
        environment: 'test',
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
            expect.objectContaining({ name: 'variant-1_variant', value: 'red' }),
        ])
    );
});

test('end calls sendMetrics and stop', async () => { 
    const unleash = {};
    unleash.stop = jest.fn();
    unleash.on = () => {};
    const metrics = {};
    metrics.sendMetrics = jest.fn();
    const action = new UnleashAction({
        client: unleash,
        metrics,
        url: 'http://localhost:3000',
        clientKey: 'client-1',
        appName: 'test-app',
        environment: 'test',
        context: {},
        variants: ['variant-1'],
        setResult: (name, value) => {
            resultSets.push({ name, value });
        },
    });
    
    await action.end();
    expect(metrics.sendMetrics).toBeCalled();
    expect(unleash.stop).toBeCalled();
});