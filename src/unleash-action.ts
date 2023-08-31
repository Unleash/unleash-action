import { UnleashClient } from "unleash-proxy-client";
import Metrics from "unleash-proxy-client/build/metrics";
import fetch from "node-fetch";

interface IUnleashActionOptions {
  url: string;
  clientKey: string;
  appName: string;
  environment: string;
  context: Record<string, string>;
  features?: string[];
  variants?: string[];
  setResult: (name: string, value: any) => void;
}

export const createUnleashAction = async (
  options: IUnleashActionOptions
): Promise<void> => {
  const action = new UnleashAction(options);
  await action.run();
  await action.end();
};

export class UnleashAction {
  private unleash: UnleashClient;
  private metrics: Metrics;
  private features: string[];
  private variants: string[];
  private setResult: (name: string, value: any) => void;

  constructor(options: IUnleashActionOptions) {
    this.unleash = this.createClient(options);
    this.unleash.on("ready", () => {
      console.log("Ready!");
    });

    this.metrics = this.createMetrics(options);

    this.features = options.features || [];
    this.variants = options.variants || [];
    this.setResult = options.setResult;
  }

  async run(): Promise<void> {
    console.log("starting.");
    await this.unleash.start();

    console.log("Checking features.");
    await this.checkFeatures();

    console.log("Checking variants.");
    await this.checkVariants();
  }

  async end(): Promise<void> {
    console.log("Sending metrics.");
    await this.metrics.sendMetrics();

    console.log("Stopping.");
    await this.unleash.stop();
  }

  private createClient(options: IUnleashActionOptions): UnleashClient {
    return new UnleashClient({
      appName: options.appName,
      url: options.url,
      clientKey: options.clientKey,
      environment: options.environment,
      refreshInterval: 0,
      metricsInterval: 0,
      disableMetrics: true,
    });
  }

  private createMetrics(options: IUnleashActionOptions): Metrics {
    return new Metrics({
      fetch: fetch,
      headerName: "Authorization",
      onError: (e) => {},
      appName: options.appName,
      url: options.url,
      clientKey: options.clientKey,
      disableMetrics: false,
      metricsInterval: 0,
    });
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
      this.setResult(`${featureName}_variant`, variant.payload?.value);
    });
  }
}
