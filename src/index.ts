import {
    getInput,
    getMultilineInput,
    info,
    setFailed,
    setOutput,
} from '@actions/core';
import { createUnleashAction } from './unleash-action.js';
import {
    PAYLOAD_TYPES,
    type PayloadType,
    parseVariantAssignments,
    UnleashAdmin,
} from './unleash-admin.js';

const requireInputs = (purpose: string, names: string[]): void => {
    const missing = names.filter((n) => !getInput(n));
    if (missing.length > 0) {
        throw new Error(`${purpose} requires inputs: ${missing.join(', ')}`);
    }
};

const runSet = async (): Promise<void> => {
    const enable = getMultilineInput('enable');
    const disable = getMultilineInput('disable');
    const setVariants = parseVariantAssignments(
        getMultilineInput('set-variant'),
    );
    if (enable.length + disable.length + setVariants.length === 0) {
        return;
    }

    requireInputs('enable/disable/set-variant', [
        'admin-url',
        'admin-api-key',
        'environment',
    ]);

    const payloadType = (getInput('variant-payload-type') ||
        'string') as PayloadType;
    if (!PAYLOAD_TYPES.includes(payloadType)) {
        throw new Error(
            `variant-payload-type must be one of: ${PAYLOAD_TYPES.join(', ')}`,
        );
    }

    await new UnleashAdmin({
        adminUrl: getInput('admin-url'),
        adminApiKey: getInput('admin-api-key'),
        project: getInput('project') || 'default',
        environment: getInput('environment'),
        enable,
        disable,
        setVariants,
        payloadType,
    }).run();
};

const runGet = async (): Promise<void> => {
    const features = getMultilineInput('is-enabled');
    const variants = getMultilineInput('get-variant');
    const url = getInput('url');
    const clientKey = getInput('api-key');

    if (!url && !clientKey && features.length + variants.length === 0) {
        return;
    }
    requireInputs('is-enabled/get-variant', ['app-name', 'url', 'api-key']);

    const context: Record<string, string> = {};
    getMultilineInput('context').forEach((l) => {
        const eq = l.indexOf('=');
        if (eq === -1) {
            context[l] = '';
            return;
        }
        context[l.slice(0, eq)] = l.slice(eq + 1);
    });

    await createUnleashAction({
        url,
        clientKey,
        appName: getInput('app-name'),
        context,
        features,
        variants,
        setResult: setOutput,
    });
};

const main = async (): Promise<void> => {
    await runSet();
    await runGet();
    info('Done!');
};

main().catch((err: unknown) => {
    setFailed(err instanceof Error ? err.message : String(err));
});
