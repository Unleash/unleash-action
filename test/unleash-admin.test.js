import { createServer } from 'node:http';
import { expect, jest, test } from '@jest/globals';
import {
    normalizeAdminUrl,
    parseVariantAssignments,
    UnleashAdmin,
} from '../src/unleash-admin';

const okResponse = (body) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
});

const baseOptions = {
    adminUrl: 'https://unleash.example.com/api/',
    adminApiKey: 'admin-token',
    project: 'default',
    environment: 'production',
};

test('parses variant assignments with optional payloads', () => {
    expect(
        parseVariantAssignments([
            'flag-a=blue',
            'flag-b=red:#ff0000',
            'flag-c=json:{"a":"b=c"}',
        ]),
    ).toEqual([
        { featureName: 'flag-a', variantName: 'blue', payload: undefined },
        { featureName: 'flag-b', variantName: 'red', payload: '#ff0000' },
        { featureName: 'flag-c', variantName: 'json', payload: '{"a":"b=c"}' },
    ]);
});

test('rejects malformed variant assignments', () => {
    expect(() => parseVariantAssignments(['no-equals'])).toThrow(
        /expected flag=variant/,
    );
    expect(() => parseVariantAssignments(['flag=:payload'])).toThrow(
        /variant name is empty/,
    );
});

test('normalizes admin url', () => {
    expect(normalizeAdminUrl('https://x.io')).toBe('https://x.io');
    expect(normalizeAdminUrl('https://x.io/')).toBe('https://x.io');
    expect(normalizeAdminUrl('https://x.io/api')).toBe('https://x.io');
    expect(normalizeAdminUrl('https://x.io/unleash/api/')).toBe(
        'https://x.io/unleash',
    );
});

test('enables and disables flags in the environment', async () => {
    const fetchFn = jest.fn(async () => okResponse());
    await new UnleashAdmin({
        ...baseOptions,
        enable: ['flag-a'],
        disable: ['flag-b'],
        fetchFn,
    }).run();

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[0][0]).toBe(
        'https://unleash.example.com/api/admin/projects/default/features/flag-a/environments/production/on',
    );
    expect(fetchFn.mock.calls[0][1]).toEqual(
        expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
                Authorization: 'admin-token',
            }),
        }),
    );
    expect(fetchFn.mock.calls[1][0]).toBe(
        'https://unleash.example.com/api/admin/projects/default/features/flag-b/environments/production/off',
    );
});

test('refuses a flag in both enable and disable', async () => {
    const fetchFn = jest.fn(async () => okResponse());
    await expect(
        new UnleashAdmin({
            ...baseOptions,
            enable: ['flag-a'],
            disable: ['flag-a'],
            fetchFn,
        }).run(),
    ).rejects.toThrow(/both enable and disable: flag-a/);
    expect(fetchFn).not.toHaveBeenCalled();
});

test('sets a single environment variant with payload', async () => {
    const fetchFn = jest.fn(async () => okResponse({ environments: [] }));
    await new UnleashAdmin({
        ...baseOptions,
        setVariants: [
            { featureName: 'flag-a', variantName: 'red', payload: '{"x":1}' },
        ],
        payloadType: 'json',
        fetchFn,
    }).run();

    const put = fetchFn.mock.calls.find(([, init]) => init.method === 'PUT');
    expect(put[0]).toBe(
        'https://unleash.example.com/api/admin/projects/default/features/flag-a/environments/production/variants',
    );
    expect(JSON.parse(put[1].body)).toEqual([
        {
            name: 'red',
            weight: 1000,
            weightType: 'variable',
            stickiness: 'default',
            payload: { type: 'json', value: '{"x":1}' },
        },
    ]);
});

test('omits payload when none is given', async () => {
    const fetchFn = jest.fn(async () => okResponse({ environments: [] }));
    await new UnleashAdmin({
        ...baseOptions,
        setVariants: [{ featureName: 'flag-a', variantName: 'red' }],
        fetchFn,
    }).run();
    const put = fetchFn.mock.calls.find(([, init]) => init.method === 'PUT');
    expect(JSON.parse(put[1].body)[0]).not.toHaveProperty('payload');
});

test('surfaces admin API errors', async () => {
    const fetchFn = jest.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => '{"message":"no access"}',
    }));
    await expect(
        new UnleashAdmin({ ...baseOptions, enable: ['flag-a'], fetchFn }).run(),
    ).rejects.toThrow(/403 Forbidden.*no access/);
});

test('integration: sets variant and toggles against a local admin API', async () => {
    const requests = [];
    const server = createServer((req, res) => {
        let body = '';
        req.on('data', (c) => {
            body += c;
        });
        req.on('end', () => {
            requests.push({
                method: req.method,
                url: req.url,
                auth: req.headers.authorization,
                body: body ? JSON.parse(body) : undefined,
            });
            if (req.headers.authorization !== 'admin-token') {
                res.writeHead(401);
                res.end();
                return;
            }
            if (req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(
                    JSON.stringify({
                        name: 'flag-a',
                        environments: [{ name: 'production', strategies: [] }],
                    }),
                );
                return;
            }
            res.writeHead(200);
            res.end();
        });
    });
    await new Promise((r) => server.listen(0, r));
    const { port } = server.address();

    try {
        await new UnleashAdmin({
            adminUrl: `http://localhost:${port}`,
            adminApiKey: 'admin-token',
            project: 'my project',
            environment: 'production',
            enable: ['flag-a'],
            setVariants: [
                { featureName: 'flag-a', variantName: 'blue', payload: 'b' },
            ],
        }).run();
    } finally {
        await new Promise((r) => server.close(r));
    }

    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
        'GET /api/admin/projects/my%20project/features/flag-a',
        'PUT /api/admin/projects/my%20project/features/flag-a/environments/production/variants',
        'POST /api/admin/projects/my%20project/features/flag-a/environments/production/on',
    ]);
    expect(requests[1].body[0]).toEqual(
        expect.objectContaining({
            name: 'blue',
            payload: { type: 'string', value: 'b' },
        }),
    );
});
