# Eclipse Tractus-X developer toolbox

A small Tractus-X dataspace inside a GitHub runner, for end-to-end (E2E) tests on every
pull request. It is a [composite action](action.yml) that brings up, in a
[kind](https://kind.sigs.k8s.io/) cluster:

- two connectors, each with a wallet (IdentityHub): a provider and a consumer,
- an IssuerService and a BDRS, with the Catena-X credentials already issued,
- a Digital Twin Registry,
- an echo backend, a stub caller and a submodel server that stand in for a product.

It is built from the [Tractus-X Umbrella](https://github.com/eclipse-tractusx/tractus-x-umbrella)
chart `26.03.00` with IdentityHub and IssuerService `v0.4.0`. Every version is pinned. The
cluster lives as long as the job.

## Use it

```yaml
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: eclipse-tractusx/tractusx-starter-kit/developer-toolbox@main
        id: toolbox
      - run: testlab run my.tck --config "${{ steps.toolbox.outputs.variables-file }}"
      - if: failure() || cancelled()
        uses: eclipse-tractusx/tractusx-starter-kit/developer-toolbox/diagnostics@main
      - if: always()
        run: kind delete cluster --name "${{ steps.toolbox.outputs.cluster-name }}" || true
```

Most product teams do not call it directly: the reusable
[E2E workflow](https://eclipse-tractusx.github.io/tutorial-resources/e2e-testing/reference/workflow/)
in `tutorial-resources` calls it for them.

## Inputs

| Input | Default | Use it to |
| --- | --- | --- |
| `extra-values` | none | Add a Helm values file, applied last. For example the image built from your pull request. |
| `umbrella-chart-version` | `26.03.00` | Pin another Umbrella chart. |
| `umbrella-values-ref` | `umbrella-26.03.00` | Read the decentralized-IdentityHub profile from another Umbrella tag. |
| `identityhub-chart-version` | `v0.4.0` | Pin another IdentityHub and IssuerService chart release. |
| `namespace` | `umbrella` | Deploy into another namespace. |
| `cluster-name` | `tck-e2e` | Name the kind cluster. |
| `kind-version`, `kind-node-image`, `kubectl-version`, `helm-version` | pinned | Change the tool versions. |
| `helm-timeout` | `25m` | Wait longer or shorter for the release. |
| `mock-server-port` | `8100` | Match the test engine's mock server port on the runner. |

## Outputs

| Output | What it is |
| --- | --- |
| `variables-file` | A YAML file with `variables:` for the dataspace, ready for `testlab run --config`. |
| `dtr-base-url`, `dtr-internal-url` | The Digital Twin Registry, from the runner and from a pod. |
| `mock-server-external-url` | The runner's mock server, from a pod. |
| `stub-caller-url`, `submodel-server-url`, `product-internal-url` | The stand-in services. |
| `namespace`, `cluster-name` | Where it runs. |

## What is in this folder

| Path | What it is |
| --- | --- |
| [`action.yml`](action.yml) | The bring-up: cluster, DNS, Umbrella release, credentials, preflight checks. |
| [`diagnostics/action.yml`](diagnostics/action.yml) | Collects pods, events and logs when a run fails. |
| [`values/`](values) | The Helm values, the dataspace variables and the hostnames. |
| [`scripts/`](scripts) | Credential issuance, the stand-in services and the probes. |

The bring-up, the values and the scripts come from
[Tractus-X TestLab](https://github.com/eclipse-tractusx/tractusx-testlab/tree/e75ebb96ee3793fab2372213868df3296094da1c/tests/e2e/connector-dtr-smoke/ci)
by way of `tutorial-resources`.

## NOTICE

This work is licensed under the [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode).

- SPDX-License-Identifier: CC-BY-4.0
- SPDX-FileCopyrightText: 2026 Contributors to the Eclipse Foundation
- Source URL: https://github.com/eclipse-tractusx/tractusx-starter-kit
