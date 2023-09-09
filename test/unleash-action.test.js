import { UnleashAction } from '../src/unleash-action';

test('calls home', async () => {
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
