import { info, warning } from '@actions/core';

export type PayloadType = 'string' | 'json' | 'csv' | 'number';

export const PAYLOAD_TYPES: PayloadType[] = ['string', 'json', 'csv', 'number'];

export interface IVariantAssignment {
    featureName: string;
    variantName: string;
    payload?: string;
}

export interface IUnleashAdminOptions {
    adminUrl: string;
    adminApiKey: string;
    project: string;
    environment: string;
    enable?: string[];
    disable?: string[];
    setVariants?: IVariantAssignment[];
    payloadType?: PayloadType;
    fetchFn?: typeof fetch;
}

/**
 * Parses `flag=variant` or `flag=variant:payload` lines. Only the first `=`
 * and the first `:` after it are separators, so payloads may contain both.
 */
export const parseVariantAssignments = (
    lines: string[],
): IVariantAssignment[] =>
    lines.map((line) => {
        const eq = line.indexOf('=');
        if (eq <= 0) {
            throw new Error(
                `Invalid set-variant line "${line}": expected flag=variant[:payload]`,
            );
        }
        const featureName = line.slice(0, eq).trim();
        const rest = line.slice(eq + 1);
        const colon = rest.indexOf(':');
        const variantName = (colon === -1 ? rest : rest.slice(0, colon)).trim();
        if (!variantName) {
            throw new Error(
                `Invalid set-variant line "${line}": variant name is empty`,
            );
        }
        const payload = colon === -1 ? undefined : rest.slice(colon + 1);
        return { featureName, variantName, payload };
    });

/** Accepts `https://host`, `https://host/` or `https://host/api`. */
export const normalizeAdminUrl = (url: string): string =>
    url.replace(/\/+$/, '').replace(/\/api$/, '');

export class UnleashAdmin {
    private readonly baseUrl: string;
    private readonly fetchFn: typeof fetch;

    constructor(private readonly options: IUnleashAdminOptions) {
        this.baseUrl = normalizeAdminUrl(options.adminUrl);
        this.fetchFn = options.fetchFn ?? fetch;
    }

    async run(): Promise<void> {
        const enable = this.options.enable ?? [];
        const disable = this.options.disable ?? [];
        const both = enable.filter((f) => disable.includes(f));
        if (both.length > 0) {
            throw new Error(
                `Flags listed in both enable and disable: ${both.join(', ')}`,
            );
        }

        for (const featureName of this.options.setVariants ?? []) {
            await this.setVariant(featureName);
        }
        for (const featureName of enable) {
            await this.toggle(featureName, true);
        }
        for (const featureName of disable) {
            await this.toggle(featureName, false);
        }
    }

    private featurePath(featureName: string): string {
        const { project } = this.options;
        return `/api/admin/projects/${encodeURIComponent(project)}/features/${encodeURIComponent(featureName)}`;
    }

    private envPath(featureName: string): string {
        const { environment } = this.options;
        return `${this.featurePath(featureName)}/environments/${encodeURIComponent(environment)}`;
    }

    private async toggle(featureName: string, on: boolean): Promise<void> {
        const state = on ? 'on' : 'off';
        info(`Turning ${featureName} ${state} in ${this.options.environment}.`);
        await this.request('POST', `${this.envPath(featureName)}/${state}`);
    }

    private async setVariant({
        featureName,
        variantName,
        payload,
    }: IVariantAssignment): Promise<void> {
        await this.warnOnStrategyVariants(featureName);

        const variant: Record<string, unknown> = {
            name: variantName,
            weight: 1000,
            weightType: 'variable',
            stickiness: 'default',
        };
        if (payload !== undefined) {
            variant.payload = {
                type: this.options.payloadType ?? 'string',
                value: payload,
            };
        }
        info(
            `Setting ${featureName} variant to ${variantName} in ${this.options.environment}.`,
        );
        await this.request('PUT', `${this.envPath(featureName)}/variants`, [
            variant,
        ]);
    }

    /**
     * Strategy variants take precedence over environment variants during
     * evaluation, so an environment variant set here would be ignored.
     */
    private async warnOnStrategyVariants(featureName: string): Promise<void> {
        const feature = (await this.request(
            'GET',
            this.featurePath(featureName),
        )) as {
            environments?: {
                name: string;
                strategies?: { variants?: unknown[] }[];
            }[];
        };
        const env = feature?.environments?.find(
            (e) => e.name === this.options.environment,
        );
        if (env?.strategies?.some((s) => (s.variants?.length ?? 0) > 0)) {
            warning(
                `${featureName} has strategy variants in ${this.options.environment}; they take precedence over the environment variant being set.`,
            );
        }
    }

    private async request(
        method: string,
        path: string,
        body?: unknown,
    ): Promise<unknown> {
        const res = await this.fetchFn(`${this.baseUrl}${path}`, {
            method,
            headers: {
                Authorization: this.options.adminApiKey,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(
                `Unleash Admin API ${method} ${path} failed: ${res.status} ${res.statusText} ${text}`.trim(),
            );
        }
        const text = await res.text();
        return text ? JSON.parse(text) : undefined;
    }
}
