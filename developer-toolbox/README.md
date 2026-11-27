# Eclipse Tractus-X developer toolbox

A Tractus-X dataspace inside a GitHub runner, for end-to-end (E2E) tests on every
pull request. It is a [composite action](action.yml) that brings up, in a
[kind](https://kind.sigs.k8s.io/) cluster, the dataspace a YAML configuration describes:

- any number of participants, each with its own DID and BPN and a wallet (IdentityHub),
  and, as you choose, a connector and a Digital Twin Registry,
- an IssuerService and a BDRS, with each participant's credentials already issued,
- an echo backend, a stub caller and a submodel server that stand in for a product,
- your own Helm charts, for example the chart your pull request builds,
- [TestLab](https://pypi.org/project/tractusx-testlab/), the test engine, in the version you pin.

It is built from the [Tractus-X Umbrella](https://github.com/eclipse-tractusx/tractus-x-umbrella)
chart. Every version is pinned and every version can be changed. The cluster lives as long
as the job.

## Use it

```yaml
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: eclipse-tractusx/tractusx-starter-kit/developer-toolbox@main
        id: toolbox
        with:
          config: ci/toolbox.yaml   # optional: without it you get toolbox.yaml
      - run: testlab run my.tck --config "${{ steps.toolbox.outputs.variables-file }}"
      - if: failure() || cancelled()
        uses: eclipse-tractusx/tractusx-starter-kit/developer-toolbox/diagnostics@main
      - if: always()
        run: kind delete cluster --name "${{ steps.toolbox.outputs.cluster-name }}" || true
```

Most product teams do not call it directly: the reusable
[E2E workflow](https://eclipse-tractusx.github.io/tutorial-resources/e2e-testing/reference/workflow/)
in `tutorial-resources` calls it for them.

## Run it on your machine

The same dataspace, from the same configuration, runs on your laptop in Docker, so you can
develop a Tractus-X solution against it, or run the E2E tests before you push:

```bash
git clone https://github.com/eclipse-tractusx/tractusx-starter-kit
cd tractusx-starter-kit
./developer-toolbox/toolbox up --config developer-toolbox/examples/minimal.yaml
```

It needs Docker (Docker Desktop, Rancher Desktop, Colima or Docker Engine) and Python 3.10
or later, on macOS or Linux; on Windows, use WSL 2. kind, kubectl and Helm are taken from your
`PATH`; any that are missing are downloaded once, in the versions the action pins, and
checked against their published checksums.

`up` takes the same configuration file as the action's `config` input, and prints every
participant at the end: its DID, BPN, management API and key, DSP address and registry.

| Command | What it does |
| --- | --- |
| `toolbox up [--config FILE]` | Start the dataspace. `--memory 6g` caps what the cluster may use, so it cannot take memory from your other containers. `--no-hosts` leaves `/etc/hosts` alone. |
| `toolbox info` | Show the participants, their URLs and API keys, and the variables file. `--json` prints them as JSON, `--variables-file` prints only that file's path. |
| `toolbox status` | Show the dataspace's pods. |
| `toolbox kubectl …`, `toolbox helm …` | Run kubectl or Helm against the dataspace, for example `toolbox kubectl logs -n umbrella deploy/umbrella-provider-connector-controlplane`. |
| `toolbox testlab run my.tck` | Run TestLab, in the version `testlab.version` names, with the variables file. |
| `toolbox hosts` | Add the dataspace hostnames to `/etc/hosts`; `--print` only prints the lines. |
| `toolbox render [--config FILE]` | Only read the configuration, then render and validate the release: no cluster. |
| `toolbox down` | Delete the cluster, the `/etc/hosts` lines and everything the toolbox stored. |

What it changes on your machine, and where:

- **The kind cluster.** Its ingress listens on `127.0.0.1:80` and `:443`, so ports 80 and 443
  must be free, and the dataspace is not reachable from your network.
- **A kubeconfig of its own**, in `~/.tractusx-developer-toolbox`. Your current kubectl context
  is never used or changed.
- **The dataspace hostnames**, such as `provider.local`, in `/etc/hosts`, between two marker
  lines, so your browser, your application and TestLab reach the participants by the names
  in their DIDs. Adding them needs sudo, which asks for your password. `up` brings the
  dataspace up without them when it cannot ask (`--no-hosts`, or no terminal); then run
  `toolbox hosts` later.
- **A Python virtual environment and the downloaded tools**, also in
  `~/.tractusx-developer-toolbox`. Set `TOOLBOX_HOME` to put them somewhere else.

Your own application can run in the cluster, as an entry under
[`applications`](#stand-ins-applications-and-testlab) with an image you built (`docker build -t
my-app:dev .`, then `images: [my-app:dev]`), or on your machine, talking to the participants'
URLs. A pod reaches your machine at the address `mock_server_external_url` names in the
variables file.

Keep the dataspace small: two connectors need about 4 GB of memory for Docker, and every
further connector about 1.5 GB more. [`examples/minimal.yaml`](examples/minimal.yaml) is the
smallest: two connectors, no registry, no stand-ins.

## Configure it

The configuration is a YAML file in your repository. [`toolbox.yaml`](toolbox.yaml) is the
default and the reference: every key there is documented, and your file is merged over it,
so it only needs the keys you change. Mappings merge; lists, such as `participants`,
replace the default list as a whole.

```yaml
# ci/toolbox.yaml: three connectors, two registries, a wallet-only participant,
# the chart of this pull request, and pinned versions.
dataspace:
  umbrella:
    chart-version: "26.03.00"
    profile-ref: "umbrella-26.03.00"

credentials:
  QualityCredential:            # a credential type of your own
    mappings:
      quality_level: credentialSubject.qualityLevel

participants:
  - name: provider
    bpn: BPNL000000000001
    dtr: true
  - name: consumer
    bpn: BPNL000000000002
  - name: supplier
    bpn: BPNL0000000000AA
    did: did:web:supplier.local:identityhub:BPNL0000000000AA
    dtr: true
    claims:
      quality_level: gold       # so it can hold a QualityCredential
  - name: auditor
    bpn: BPNL0000000000CC
    connector: false            # an identity and credentials, nothing that negotiates

applications:
  - name: my-product
    chart: ./charts/my-product  # the chart in this pull request
    values: [ci/my-product.values.yaml]
    set:
      image.repository: my-product
      image.tag: ci
    images: [my-product:ci]     # built by an earlier step of the job
    hosts: [my-product.local]

testlab:
  version: "1.0.0a24"
  sut: supplier
  engine: consumer
```

More in [`examples/`](examples): [`minimal.yaml`](examples/minimal.yaml) (two connectors,
nothing else) and [`multi-participant.yaml`](examples/multi-participant.yaml) (five
participants, two registries, an external partner and a credential of its own).

### `dataspace`: the software and its versions

| Key | Default | What it sets |
| --- | --- | --- |
| `umbrella.chart-version` | `26.03.00` | The Umbrella chart the dataspace is deployed from. |
| `umbrella.profile-ref` | `umbrella-26.03.00` | The Umbrella tag the decentralized-IdentityHub profile is read from. |
| `identityhub.chart-version` | `v0.4.0` | The IdentityHub and IssuerService chart release. |
| `identityhub.image` | tag `0.4.0-SNAPSHOT`, pull `Always` | The wallets' image: `repository`, `tag`, `pull-policy`. |
| `issuerservice.image` | `tractusx/issuerservice-memory:0.4.0-SNAPSHOT` | The IssuerService's image. |
| `connector.image` | `tractusx/edc-runtime-memory`, the chart's tag | The Tractus-X EDC runtime every connector runs. |
| `connector.dsp-version` | `2025-1` | The DSP version path connectors are addressed on. |
| `issuer.bpn` | `BPNL000000000003` | The IssuerService's BPN; its DID is `did:web:issuerservice.local:<bpn>`. |

### `participants`: who is in the dataspace

| Key | Default | What it sets |
| --- | --- | --- |
| `name` | required | Lower case, at most 20 characters. It names the participant's Kubernetes objects and hostnames. |
| `bpn` | required | The participant's BPN. |
| `did` | `did:web:<hostname>:identityhub:<bpn>` | The participant's DID. A `did:web` DID is resolved at its host, so its host is the participant's hostname. |
| `hostname` | `<name>.local` | The public hostname: DID document, credentials, STS, EDR public API. |
| `connector` | `true` | `false` for a wallet only. A mapping sets `api-key` (default `password`), the management API key. |
| `dtr` | `false` | `true` for a Digital Twin Registry behind the participant's connector. |
| `credentials` | every type it has the claims for | The credential types it is issued, from `credentials`. |
| `claims` | none | Claims merged over the common `claims`, for example the ones a credential of your own maps. |
| `external` | none | A participant that runs elsewhere: `dsp-url`, `management-url`, `api-key`. Its BPN and DID go into the BPN directory and its URLs into the variables file; nothing is deployed and nothing is issued. |

Each deployed participant answers on `<hostname>`, `<name>.intranet` (its wallet's identity
API), `<name>-dsp.local` and `<name>-management.local` (its connector) and `<name>-dtr.local`
(its registry). Every hostname resolves on the runner and in the cluster.

### `credentials` and `claims`: what the IssuerService issues

`credentials` maps each credential type the IssuerService issues to the claims it carries,
as `<claim>: <credential path>`. Every credential also carries the holder's DID and BPN. The
defaults are the four Catena-X credentials: `MembershipCredential`, `BpnCredential`,
`UsagePurposeCredential` and `DataExchangeGovernanceCredential`. `claims` are the values
every participant is attested with; a participant's own `claims` are merged over them.

### `stand-ins`, `applications` and `testlab`

| Key | Default | What it sets |
| --- | --- | --- |
| `stand-ins.echo` | `true` | An echo backend behind the provider's connector (`product_internal_url`). |
| `stand-ins.stub-caller` | `true` | A system under test that calls back when told to (`stub_caller_url`). |
| `stand-ins.submodel-server` | `true` | A payload store for submodels (`infrastructure.engine.dtr.submodel_base_url`). |
| `applications[]` | none | Your Helm charts, deployed after the dataspace: `name`, `chart` (a path in your checkout, a chart name with `repository`, or `oci://…`), `version`, `namespace`, `values` (files), `set` (`key: value`), `images` (images built in the job, loaded into kind), `hosts` (hostnames to resolve), `wait`, `timeout`. |
| `testlab.version` | `1.0.0a24` | The `tractusx-testlab` version installed from PyPI. Empty installs nothing. |
| `testlab.sut`, `testlab.engine` | the first two connectors | The participant under test and the one TestLab drives. |

To deploy what your pull request builds, build the image in the job before the toolbox
step, list it under `images`, and point your chart at it with `set` or a values file. The
configuration is read as it is, with no expressions: a value that changes per run, such as
an image tag from `github.sha`, goes into a values file your workflow writes before the
toolbox step.

## Inputs

| Input | Default | Use it to |
| --- | --- | --- |
| `config` | none | Read your configuration, merged over [`toolbox.yaml`](toolbox.yaml). |
| `render-only` | `false` | Only read the configuration, render and validate the dataspace and install TestLab: no cluster. |
| `umbrella-chart-version` | from the configuration | Override `dataspace.umbrella.chart-version`. |
| `umbrella-values-ref` | from the configuration | Override `dataspace.umbrella.profile-ref`. |
| `identityhub-chart-version` | from the configuration | Override `dataspace.identityhub.chart-version`. |
| `testlab-version` | from the configuration | Override `testlab.version`; `none` installs nothing. |
| `extra-values` | none | Add a Helm values file to the Umbrella release, applied last. |
| `namespace` | `umbrella` | Deploy into another namespace. |
| `cluster-name` | `tck-e2e` | Name the kind cluster. |
| `kind-version`, `kind-node-image`, `kubectl-version`, `helm-version` | pinned | Change the tool versions. |
| `helm-timeout` | `25m` | Wait longer or shorter for the release. |
| `mock-server-port` | `8100` | Match the test engine's mock server port on the runner. |

## Outputs

| Output | What it is |
| --- | --- |
| `variables-file` | A YAML file with `variables:` for the dataspace, ready for `testlab run --config`. |
| `participants-file` | A JSON file with every participant: DID, BPN, credentials, connector and registry URLs. |
| `plan-file` | The resolved configuration the toolbox deployed. |
| `dtr-base-url`, `dtr-internal-url` | The registry under test (the SUT's, or the first one), from the runner and from a pod. |
| `mock-server-external-url` | The runner's mock server, from a pod. |
| `stub-caller-url`, `submodel-server-url`, `product-internal-url` | The stand-ins; empty when switched off. |
| `umbrella-chart-version`, `identityhub-chart-version`, `testlab-version` | The versions deployed. |
| `namespace`, `cluster-name` | Where it runs. |

### The variables file

The TestLab roles are written as the bindings TestLab knows, and every participant is also
there by name, for tests that address more than two:

| Variable | What it is |
| --- | --- |
| `infrastructure.sut.connector.*`, `infrastructure.engine.connector.*` | `management_url`, `api_key`, `participant_id` (the DID) and `dsp_url` of `testlab.sut` and `testlab.engine`. |
| `sut_bpnl`, `engine_bpnl` | Their BPNs. |
| `infrastructure.sut.dtr.base_url`, `infrastructure.engine.dtr.base_url`, `dtr_internal_url` | The registry under test and the engine's. |
| `infrastructure.engine.dtr.submodel_base_url`, `stub_caller_url`, `product_internal_url`, `mock_server_external_url` | The stand-ins and the runner's mock server. |
| `participants.<name>.bpn`, `participants.<name>.did` | Every participant's identity. |
| `participants.<name>.connector.*`, `participants.<name>.dtr.*` | Every participant's connector and registry. |

## Sizing

Every connector is three JVMs (control plane, data plane and wallet) and every registry
brings its own Postgres. The default two-participant dataspace fits the 4 vCPUs and 16 GB of
`ubuntu-latest`. For more, run the job on a larger runner: about 2 vCPUs and 4 GB per
further connector.

## What is in this folder

| Path | What it is |
| --- | --- |
| [`action.yml`](action.yml) | The bring-up on a GitHub runner: configuration, cluster, DNS, Umbrella release, credentials, applications, preflight checks. |
| [`toolbox`](toolbox) | The same bring-up on your machine; see [Run it on your machine](#run-it-on-your-machine). |
| [`toolbox.yaml`](toolbox.yaml) | The default configuration, and the reference for your own. |
| [`examples/`](examples) | More configurations. |
| [`diagnostics/action.yml`](diagnostics/action.yml) | Collects pods, events and logs when a run fails. |
| [`values/`](values) | The Helm values (the shared components, and the template every participant is rendered from), the kind cluster and the stand-ins' manifests. |
| [`scripts/`](scripts) | Rendering and validating the configuration, CoreDNS, credential issuance, applications, the stand-in services, the probes and `toolbox`'s commands. Their Python dependencies are in [`requirements.txt`](requirements.txt). |
| [`tests/`](tests) | The configuration and chart this repository's own workflow brings up. |

The bring-up, the values and the stand-in scripts come from
[Tractus-X TestLab](https://github.com/eclipse-tractusx/tractusx-testlab/tree/e75ebb96ee3793fab2372213868df3296094da1c/tests/e2e/connector-dtr-smoke/ci)
by way of `tutorial-resources`.

## NOTICE

This work is licensed under the [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode).

- SPDX-License-Identifier: CC-BY-4.0
- SPDX-FileCopyrightText: 2026 Contributors to the Eclipse Foundation
- Source URL: https://github.com/eclipse-tractusx/tractusx-starter-kit
