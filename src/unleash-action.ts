import { UnleashClient } from 'unleash-proxy-client';
import { Metrics } from './metrics';

interface ICreateUnleashActionOptions {
    url: string;
    clientKey: string;
    appName: string;
    environment: string;
    context: Record<string, string>;
    features?: string[];
    variants?: string[];
    setResult: (name: string, value: any) => void;
}

interface IUnleashActionOptions extends ICreateUnleashActionOptions {
    client: UnleashClient;
    metrics: Metrics;
}

export const createUnleashAction = async (
    options: ICreateUnleashActionOptions,
): Promise<void> => {
    const client = createClient(options);
    const metrics = createMetrics(options);
    const action = new UnleashAction({ ...options, client, metrics });
    await action.run();
    await action.end();
};

const createMetrics = (options: ICreateUnleashActionOptions): Metrics => {
    return new Metrics({
        headerName: 'Authorization',
        appName: options.appName,
        url: options.url,
        clientKey: options.clientKey,
    });
};

const createClient = (options: ICreateUnleashActionOptions): UnleashClient => {
    return new UnleashClient({
        appName: options.appName,
        url: options.url,
        clientKey: options.clientKey,
        environment: options.environment,
        refreshInterval: 0,
        metricsInterval: 0,
        disableMetrics: true,
    });
};

export class UnleashAction {
    private unleash: UnleashClient;
    private metrics: Metrics;
    private features: string[];
    private variants: string[];
    private setResult: (name: string, value: any) => void;

    constructor(options: IUnleashActionOptions) {
        this.unleash = options.client;
        this.metrics = options.metrics;

        this.unleash.on('ready', () => {
            console.log('Ready!');
        });

        this.features = options.features || [];
        this.variants = options.variants || [];
        this.setResult = options.setResult;
    }

    async run(): Promise<void> {
        console.log('starting.');
        await this.unleash.start();

        console.log('Checking features.');
        await this.checkFeatures();

        console.log('Checking variants.');
        await this.checkVariants();
    }

    async end(): Promise<void> {
        console.log('Sending metrics.');
        await this.metrics.sendMetrics();

        console.log('Stopping.');
        await this.unleash.stop();
    }

    private async checkFeatures(): Promise<void> {
        this.features.forEach((featureName) => {
            const isEnabled = this.unleash.isEnabled(featureName);
            this.metrics.count(featureName, isEnabled);
            this.setResult(featureName, isEnabled);
        });
    }

    private async checkVariants(): Promise<void> {
        this.variants.forEach((featureName) => {
            const variant = this.unleash.getVariant(featureName);
            if (variant.name) {
                this.metrics.countVariant(featureName, variant.name);
            }
            this.metrics.count(featureName, variant.enabled);
            this.setResult(featureName, variant.enabled);

            if (variant.enabled) {
                this.setResult(
                    `${featureName}_variant`,
                    variant.payload?.value,
                );
            }
        });
    }
}
