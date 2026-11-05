<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logos/svg/tractusx-starter-kit_horizontal-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/logos/svg/tractusx-starter-kit_horizontal-light.svg">
    <img alt="Eclipse Tractus-X Starter Kit logo" src="assets/logos/svg/tractusx-starter-kit_horizontal-light.svg" width="480">
  </picture>
</p>

# Eclipse Tractus-X Starter Kit

> [!NOTE]
> This project is at an **early stage**. We are currently defining scope, structure and the first implementation steps. Feedback and contributions are very welcome.

The **Tractus-X Starter Kit** is a guided entry point to Eclipse Tractus-X. A small configuration wizard asks a few questions and generates a ready-to-run **Docker Compose setup**, together with configuration files and tailored documentation.

**Goal:** get newcomers to their **first data exchange in about 15 minutes** after `docker compose up`, without Kubernetes, Helm or the full Umbrella deployment.

The concept is inspired by the [Eclipse BaSyx Starter Kit](https://basyx.org/get-started).

## Why a Starter Kit?

- **Kubernetes first is a barrier.** Most newcomers want a small local setup to try things out, not Helm charts and the full Umbrella deployment.
- **Wiring components together takes time.** Today you need to go through extensive documentation to combine the components. The wizard generates the setup for you.
- **A repeatable first success.** Seed data and a test collection prove that the generated setup works.

## Who is it for?

- Developers new to Tractus-X
- Use-case teams and Operating Service Providers (OSPs) evaluating Tractus-X
- Participants of Community Days, hackathons and demos
- Students and researchers

The Starter Kit is a **development and evaluation starter**. It is **not** intended for production use and does **not** replace the [Tractus-X Umbrella](https://github.com/eclipse-tractusx/tractus-x-umbrella) deployment. It is an additional, lightweight entry point.

## What is planned

### Level 1: minimum data exchange

A provider shares one asset, a consumer negotiates and pulls it.

| Component | Purpose |
|---|---|
| Provider connector (Tractus-X EDC) | Offers one asset |
| Consumer connector (Tractus-X EDC) | Negotiates the contract and pulls the asset |
| IdentityHub | Default identity component |
| BDRS (BPN-DID Resolution Service) | Resolves BPNs to DIDs |
| PostgreSQL (shared) | One instance for both connectors, alternatively in-memory for quick tests |
| BaSyx submodel service | Data source behind the provider instead of a full Digital Twin Registry |
| Seed data and test collection | Validate the first data exchange |

Not included in Level 1: Keycloak, Portal, BPDM, Discovery services, full DTR.

**Output package:** Docker Compose file, `.env` file, configuration folder and a tailored README, delivered as ZIP download or copy-paste.

### Next levels

- **Level 2:** interactive stepper UI to click through the first data exchange, without Postman or Bruno
- **Level 2+:** additional configuration options, such as number of connectors, portal yes/no or wallet selection

### Implementation approach

- Static web page with plain JavaScript in the browser, no backend
- Published via GitHub Pages as part of the Tractus-X web presence
- One YAML template per supported Tractus-X release milestone (e.g. latest and previous), derived from existing release information
- CI smoke test: generate, start and run one transfer for every supported combination

## Roadmap and status

Work is organized in GitHub issues and planned in 2-week iterations:

| Phase | Goal |
|---|---|
| 0 – Foundation | Repository setup, scope agreed, analysis of reusable resources (MXD, MVD, Umbrella, BaSyx) |
| 1 – First data exchange | Working Docker Compose setup with seed data (**Milestone 1**) |
| 2 – Templating | Version-based YAML templates |
| 3 – Wizard MVP | Level 1 wizard live on GitHub Pages, tested in CI (**Milestone 2**) |
| 4 – Later | Level 2 stepper, Level 2+ options, release process integration |

See the [open issues](https://github.com/eclipse-tractusx/tractusx-starter-kit/issues) for details.

## Get involved

The Starter Kit is community-driven as part of the **Tractus-X Accelerator**. There are no fixed deadlines: contributors, teams and students pick up issues when they have capacity and deliver via pull requests.

- **Open meeting:** bi-weekly on Thursday, see [Tractus-X Open Meetings](https://eclipse-tractusx.github.io/community/open-meetings/)
- **Issues:** look for [`good first issue`](https://github.com/eclipse-tractusx/tractusx-starter-kit/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) and [`help wanted`](https://github.com/eclipse-tractusx/tractusx-starter-kit/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
- **Mailing list:** [tractusx-dev@eclipse.org](https://accounts.eclipse.org/mailing-list/tractusx-dev)
- **Contribution guidelines:** see [CONTRIBUTING.md](CONTRIBUTING.md) and the [Tractus-X Community Guide](https://eclipse-tractusx.github.io/community/intro)

## Getting started

The wizard and generated Compose setup are not released yet. Visit the
[documentation site](https://eclipse-tractusx.github.io/tractusx-starter-kit/)
for the initial landing page, or follow [INSTALL.md](INSTALL.md) to preview it locally.
No application build or package installation is currently required.

## Repository governance

- [Contribution guide and license headers](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy and private vulnerability reporting](SECURITY.md)
- [Legal notices](NOTICE.md)
- [TRG baseline, security checks, Pages activation, and release prerequisites](INSTALL.md#repository-baseline)
- [Tractus-X Release Guidelines](https://eclipse-tractusx.github.io/docs/release)
- [Quality checks dashboard](https://eclipse-tractusx.github.io/sig-release/)

Changes will be documented using
[GitHub release notes](https://github.com/eclipse-tractusx/tractusx-starter-kit/releases)
starting with the first release.

## License

Distributed under [Apache-2.0](LICENSE) for code and
[CC-BY-4.0](LICENSE_non-code) for documentation and non-code content.
See [NOTICE.md](NOTICE.md) for attribution and third-party notices.

## NOTICE

This work is licensed under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode).

- SPDX-License-Identifier: CC-BY-4.0
- SPDX-FileCopyrightText: 2026 Contributors to the Eclipse Foundation
- Source URL: https://github.com/eclipse-tractusx/tractusx-starter-kit/blob/main/README.md
