# Installation and documentation

The Starter Kit is in initial development. There is no released wizard or
generated Docker Compose setup to install yet. See the [README](README.md) for
the planned functionality.

## View the documentation

The documentation site is published at
https://eclipse-tractusx.github.io/tractusx-starter-kit/.

The initial site is plain HTML and CSS in `docs/`, with no framework, package
manager, external assets, or build dependencies. Open `docs/index.html` directly,
or preview it from the repository root using Python 3:

```shell
python3 -m http.server 8000 --bind 127.0.0.1 --directory docs
```

Visit http://127.0.0.1:8000/. Stop the server with Ctrl+C.
Keep site asset links relative so the site also works under `/tractusx-starter-kit/`.

## Repository baseline

- `main` is the development and release-source branch.
- `.tractusx` identifies this repository as the Starter Kit's leading repository.
  This is the initial metadata boundary, not a commitment to an independent
  release cadence. Product ownership and release alignment must be confirmed
  with SIG Release before the first release.
- GitHub release notes will be the changelog; there is no separate `CHANGELOG.md`.
- The initial site ships no application dependencies or container images.
  The planned wizard will generate Compose configurations using existing
  Tractus-X images; publishing new images requires a separate decision.

## Security checks

Workflows run on pushes and pull requests to `main`, weekly, and manually:

| Check | Initial scope | Extend when |
|---|---|---|
| CodeQL (TRG 8.01) | GitHub Actions workflows (`actions` language) | Add `javascript-typescript` when browser code is introduced |
| KICS (TRG 8.02) | Repository infrastructure/configuration files | Compose templates must be scanned when added |
| TruffleHog (TRG 8.03) | Git history; full history on scheduled/manual runs | Always required; never commit secrets |
| Trivy (TRG 8.04) | Filesystem vulnerabilities and misconfiguration | Add scheduled image scans for each supported image if publishing our own images |
| Dependabot (TRG 8.05) | GitHub Actions pins, weekly | Add each new package ecosystem with its lockfile |

SARIF results from CodeQL, KICS, and Trivy are uploaded to the repository's
Security tab. High-severity findings must be resolved or dismissed with a
justification. Fork pull requests receive read-only tokens; workflows do not
run untrusted code with deployment credentials.

## GitHub Pages and maintainer activation

The Pages workflow publishes only from `main` (push or manual dispatch).
It copies `docs/` into a staging directory and stamps legal/source links with
the source commit, then publishes to the root of `gh-pages`. The first
successful run creates that branch automatically. Do not edit generated files
on `gh-pages`. Since `GITHUB_TOKEN` pushes do not automatically trigger legacy
Pages builds, the workflow explicitly requests a build through the Pages API.
It then checks the published branch's build status and verifies that the live
page contains the expected source revision.

This preserves the existing Otterdog configuration: **legacy** Pages build,
source branch **gh-pages**, path **/**, and the **github-pages** environment
restricted to **gh-pages**. The publishing job runs on `main` without attaching
that environment; GitHub's subsequent Pages deployment uses `gh-pages`.

After merging the foundation into `main`, a maintainer must:

1. Confirm Actions are enabled and repository/organization policy permits the
   pinned actions, `contents: write` for branch publishing, `pages: write` for
   requesting a legacy Pages build, and `security-events: write` for SARIF uploads.
2. Confirm the default branch remains `main`, private vulnerability reporting
   and Dependabot alerts are enabled, and code scanning accepts workflow uploads.
   If CodeQL default setup is enabled, switch to advanced setup to use this workflow.
3. Run **GitHub Pages** from `main` if the initial push did not run it. Confirm
   `gh-pages` is created and the **pages build and deployment** run succeeds.
4. Open https://eclipse-tractusx.github.io/tractusx-starter-kit/ and check the
   stylesheet, navigation, and legal/source links.
5. Confirm `.tractusx` is discovered by
   [SIG Release quality checks](https://eclipse-tractusx.github.io/sig-release/).
   Ask SIG Release to register the product if it is not included in the dashboard's
   central discovery configuration; a metadata file alone cannot guarantee listing.
   The checker may flag missing `DEPENDENCIES` or Helm charts even before a release
   or where no charts are shipped. Review applicability with SIG Release rather
   than creating placeholder inventories or charts to silence those findings.
6. Confirm the CODEOWNERS team has repository write access and configure required
   reviews/status checks through Otterdog as appropriate.

Repository settings, live deployment, and central dashboard registration cannot
be verified by a local preview or by an unmerged pull request.

## Release prerequisites

Before the first release:

- Confirm product ownership, versioning, support policy, and release cadence with
  SIG Release; update `.tractusx` if the Starter Kit belongs to another product.
- Generate and review `DEPENDENCIES` with the
  [Eclipse Dash license tool](https://github.com/eclipse/dash-licenses)
  ([TRG 7.04](https://eclipse-tractusx.github.io/docs/release/trg-7/trg-7-04)).
  Publish the inventory and an SBOM for shipped dependencies as applicable;
  include third-party content and notices. No placeholder inventory is supplied.
- Publish GitHub release notes and tag the release. Release deliveries must link
  legal notices and source to that tag rather than the development branch.
- Add wizard/Compose generation tests and smoke-test the supported image combinations.
- If publishing container images, implement the applicable TRG 4 requirements
  and scheduled Trivy scans of the supported published image versions.

## NOTICE

This work is licensed under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode).

- SPDX-License-Identifier: CC-BY-4.0
- SPDX-FileCopyrightText: 2026 Contributors to the Eclipse Foundation
- Source URL: https://github.com/eclipse-tractusx/tractusx-starter-kit/blob/main/INSTALL.md
