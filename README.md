# Unleash integration for GitHub workflows
The unleash integration for GitHub workflows adds Unleash feature flag capabilities to GitHub Actions/Workflows.  
It's built on top of unleash-proxy-client-js and fetches feature flags from Unleash front-end API or Unleash Edge/Unleash proxy.  
This allows you to use killswitches, release-toggles, variants and more to guide flow in your GitHub Actions.

## Getting started

#### Set up

Begin by adding a step to your workflow yaml file that references Unleash/unleash-action@v1, giving it an id unique to that step, and set up options:  
[Available options](#available-options)


```yaml
  steps:
    # ...
    - name: Unleash feature management
      id: featureflags
      uses: Unleash/unleash-action@v1
      with: 
        app-name: my-workflow
        url: http://localhost/api/frontend 
        api-key: ${{ secrets.YOUR_SECRET_API_KEY }}
        get-variant: your-feature-name
        is-enabled: a-feature-name
        context: |-
          clientId=${{ inputs.client-id }}
```

For every feature name defined in is-enabled, Unleash-action will output the result of the feature flag evaluation in an output variable with same name as the feature.  
For every feature name defined in get-variant, Unleash-action will output the result of the evaluation in an output variable with same name as the feature, and if it is enabled it will output the payload result of the variant into an output variable with the same name appended _variant.

#### Using the results

Now you can use these evaluation results in your workflow:

```yaml
  steps:
    # ...
    - name: Unleash feature management # feature flags
      # ...
    - name: Step that uses feature flag
      if: steps.featureflags.outputs.your-feature-name == 'true'
      run: echo "Payload is ${{ steps.featureflags.outputs.your-feature-name_variant }}"
```

## Setting feature flags and variants

Besides reading flags, the action can change them through the [Unleash Admin API](https://docs.getunleash.io/reference/api/unleash).
The frontend API used for evaluation is read-only, so this needs a separate **admin API token or personal access token** with permission to update the flags, plus the Unleash server base URL.

```yaml
  steps:
    - name: Flip feature flags
      uses: transmitsecurity-dev/unleash-action@main
      with:
        admin-url: https://unleash.example.com
        admin-api-key: ${{ secrets.UNLEASH_ADMIN_TOKEN }}
        project: default
        environment: production
        enable: |-
          new-checkout
        disable: |-
          legacy-checkout
        set-variant: |-
          checkout-theme=dark
          checkout-banner=promo:Black Friday sale
```

- `enable` / `disable` turn each listed flag on / off in `environment`. A flag may not appear in both.
- `set-variant` takes `flag=variant` or `flag=variant:payload` lines. It **replaces** the flag's environment variants with that single variant at 100% weight; the payload type comes from `variant-payload-type` (default `string`). Only the first `=` and the first `:` after it are separators, so a payload may contain both (e.g. JSON with `variant-payload-type: json`).
- Setting a variant does not enable the flag; add it to `enable` too if needed.
- If the flag has *strategy* variants in that environment, they take precedence over environment variants during evaluation. The action logs a warning in that case.

Set operations run before any `is-enabled` / `get-variant` evaluation in the same step. Evaluation goes through the frontend API / Edge, which may cache, so the read in the same step may not reflect the change yet.

When only setting flags, `app-name`, `url` and `api-key` can be left out.

## Metrics

Unleash-action will post metrics for evaluations of the features and variants defined in the is-enabled and get-variant options when it's setting their output results

## Available options

Options to use when configuring the Unleash-action:

| option            | required | default | description                                                                                                                                      |
|-------------------|----------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| app-name   | for get | n/a | The application name for the GitHub Action as you want it to appear in Unleash metrics | 
| api-key   | for get | n/a | The frontend API token to use with Unleash - We recommend you store this in a secret and reference the variable here | 
| url   | for get | n/a | The Unleash Proxy URL to connect to. E.g.: `https://examples.com/proxy` | 
| is-enabled   | no | n/a | Newline-separated multiline string with feature flag names to evaluate | 
| get-variant   | no | n/a | Newline-separated multiline string with feature flag names to get variants for | 
| context   | no | n/a | Multiline list of key=value context and custom parameter pairs that will be string split on = | 
| admin-url   | for set | n/a | Base URL of the Unleash server, e.g. `https://unleash.example.com` (a trailing `/api` is accepted) | 
| admin-api-key   | for set | n/a | Admin API token or personal access token allowed to update the flags - store it in a secret | 
| project   | no | `default` | Unleash project the flags to set belong to | 
| environment   | for set | n/a | Unleash environment to change, e.g. `production` | 
| enable   | no | n/a | Newline-separated flag names to turn on in `environment` | 
| disable   | no | n/a | Newline-separated flag names to turn off in `environment` | 
| set-variant   | no | n/a | Newline-separated `flag=variant` or `flag=variant:payload` lines; replaces the flag's environment variants with that one variant | 
| variant-payload-type   | no | `string` | Payload type for `set-variant`: `string`, `json`, `csv` or `number` | 
