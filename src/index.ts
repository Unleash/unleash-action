import { createUnleashAction } from './unleash-action';
import { getInput, getMultilineInput, setOutput } from '@actions/core';

const appName = getInput('app-name');
const url = getInput('url');
const clientKey = getInput('api-key');
const environment = getInput('environment');

const context: Record<string, string> = {};
const contextLines = getMultilineInput('context');
contextLines?.forEach((l) => {
    let keyVal = l.split('=');
    context[keyVal[0]] = keyVal[1];
});

const features = getMultilineInput('is-enabled');
const variants = getMultilineInput('get-variant');

createUnleashAction({
    url: url,
    clientKey: clientKey,
    appName: appName,
    environment: environment,
    context: context,
    features: features,
    variants: variants,
    setResult: setOutput,
}).then(() => {
    console.log('Done!');
});
