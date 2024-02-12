# Unleash integration for GitHub workflows
The unleash integration for GitHub workflows adds Unleash feature flag capabilities to GitHub Actions/Workflows.  
It's built on top of unleash-proxy-client-js and fetches feature flags from Unleash front-end API or Unleash Edge/Unleash proxy.  
This allows you to use killswitches, release-toggles, variants and more to guide flow in your GitHub Actions.

## Getting started

#### Set up

Begin by adding a step to your workflow yaml file that references Unleash/unleash-action, giving it an id unique to that step, and set up options:  
[Available options](#available-options)


```yaml
  steps:
    # ...
    - name: Unleash feature management
      id: featureflags
      uses: Unleash/unleash-action
      with: 
        app-name: my-workflow
        url: http://localhost/api/frontend 
        api-key: ${{ secrets.YOUR_SECRET_API_KEY }}
        environment: development
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

## Metrics

Unleash-action will post metrics for evaluations of the features and variants defined in the is-enabled and get-variant options when it's setting their output results

## Available options

Options to use when configuring the Unleash-action:

| option            | required | default | description                                                                                                                                      |
|-------------------|----------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| app-name   | yes | n/a | The application name for the GitHub Action as you want it to appear in Unleash metrics | 
| api-key   | yes | n/a | The frontend API token to use with Unleash - We recommend you store this in a secret and reference the variable here | 
| url   | yes | n/a | The Unleash Proxy URL to connect to. E.g.: `https://examples.com/proxy` | 
| environment   | no | n/a | The Unleash environment for which to evaluate the feature flags | 
| is-enabled   | no | n/a | Newline-separated multiline string with feature flag names to evaluate | 
| get-variant   | no | n/a | Newline-separated multiline string with feature flag names to get variants for | 
| context   | no | n/a | Multiline list of key=value context and custom parameter pairs that will be string split on = | 

