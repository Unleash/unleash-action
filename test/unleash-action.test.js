import { createServer } from 'node:http';
import { expect, jest, test } from '@jest/globals';
import { createUnleashAction, UnleashAction } from '../src/unleash-action';

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

    const resultSets = [];
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

const startMockUnleashServer = (toggles) => {
    const metricsRequests = [];

    const server = createServer((req, res) => {
        if (req.method === 'GET' && req.url.startsWith('/frontend')) {
            if (req.headers.authorization !== 'client-1') {
                res.writeHead(401);
                res.end();
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ toggles }));
            return;
        }

        if (req.method === 'POST' && req.url === '/frontend/client/metrics') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                metricsRequests.push(JSON.parse(body));
                res.writeHead(200);
                res.end();
            });
            return;
        }

        res.writeHead(404);
        res.end();
    });

    return new Promise((resolve) => {
        server.listen(0, () => {
            const { port } = server.address();
            resolve({
                url: `http://localhost:${port}/frontend`,
                metricsRequests,
                close: () => new Promise((r) => server.close(r)),
            });
        });
    });
};

test('integration: runs the full action against a real local Unleash frontend server', async () => {
    const { url, metricsRequests, close } = await startMockUnleashServer([
        {
            name: 'feature-1',
            enabled: true,
            variant: { name: 'disabled', enabled: false },
            impressionData: false,
        },
        {
            name: 'variant-1',
            enabled: true,
            variant: {
                name: 'variant-a',
                enabled: true,
                payload: { type: 'string', value: 'red' },
            },
            impressionData: false,
        },
    ]);

    const results = {};
    try {
        await createUnleashAction({
            url,
            clientKey: 'client-1',
            appName: 'test-app',
            context: {},
            features: ['feature-1'],
            variants: ['variant-1'],
            setResult: (name, value) => {
                results[name] = value;
            },
        });
    } finally {
        await close();
    }

    expect(results).toEqual({
        'feature-1': true,
        'variant-1': true,
        'variant-1_variant': 'red',
    });

    expect(metricsRequests).toHaveLength(1);
    expect(metricsRequests[0].appName).toBe('test-app');
    expect(metricsRequests[0].bucket.toggles['feature-1']).toEqual(
        expect.objectContaining({ yes: 1, no: 0 }),
    );
    expect(metricsRequests[0].bucket.toggles['variant-1']).toEqual(
        expect.objectContaining({
            yes: 1,
            no: 0,
            variants: { 'variant-a': 1 },
        }),
    );
});
