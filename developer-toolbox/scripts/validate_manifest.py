#!/usr/bin/env python3
#################################################################################
# Copyright (c) 2026 Contributors to the Eclipse Foundation
#
# See the NOTICE file(s) distributed with this work for additional
# information regarding copyright ownership.
#
# This program and the accompanying materials are made available under the
# terms of the Apache License, Version 2.0 which is available at
# https://www.apache.org/licenses/LICENSE-2.0.
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations
# under the License.
#
# SPDX-License-Identifier: Apache-2.0
#################################################################################

## This code was partially generated using artificial intelligence (AI) (Tool: Codex, Model: GPT-5.6 Sol; Tool: Claude Code, Model: Claude Opus 5.5).
## It was reviewed and tested by a human committer.

"""Check a rendered developer toolbox manifest against its plan.

Every failure here is one that ``helm install`` would not report: a missing
participant, a vault without its signing keys, a connector route on the wrong
host, a DSP callback that 404s. Each of them surfaces twenty minutes later as a
negotiation that never reaches AGREED, so they are checked before a cluster is
even created.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
from collections import Counter

import yaml


def _annotations(document: dict) -> dict:
    return document.get("metadata", {}).get("annotations") or {}


def validate(documents: list[dict], expected: dict, namespace: str) -> list[str]:
    problems: list[str] = []

    deployments = {
        document["metadata"]["name"] for document in documents if document.get("kind") == "Deployment"
    }
    missing = sorted(set(expected["deployments"]) - deployments)
    if missing:
        problems.append(f"missing deployments: {', '.join(missing)}")

    # The vault-setup hooks are what put tokenSignerPrivateKey /
    # tokenSignerPublicKey / tokenEncryptionAesKey into each participant's
    # vault. They only render while the connector bundle owns the vault, so a
    # values change that moves the vault elsewhere silently leaves every
    # data-plane transfer unable to sign its EDR.
    hooks = {
        document["metadata"]["name"]
        for document in documents
        if document.get("kind") == "Job" and "helm.sh/hook" in _annotations(document)
    }
    missing_hooks = sorted(set(expected["hooks"]) - hooks)
    if missing_hooks:
        problems.append(f"missing install hooks: {', '.join(missing_hooks)}")

    resources = [
        (
            document.get("kind"),
            document.get("metadata", {}).get("namespace", namespace),
            document.get("metadata", {}).get("name"),
        )
        for document in documents
        if document.get("kind")
        and document.get("metadata", {}).get("name")
        and "helm.sh/hook" not in _annotations(document)
    ]
    duplicates = sorted(key for key, count in Counter(resources).items() if count > 1)
    if duplicates:
        problems.append(f"duplicate resources: {duplicates}")

    routes: dict[str, set[str]] = {}
    for document in documents:
        if document.get("kind") != "Ingress":
            continue
        for rule in document.get("spec", {}).get("rules", []):
            routes.setdefault(rule.get("host"), set()).update(
                path["path"] for path in rule.get("http", {}).get("paths", [])
            )
    wrong = {
        host: sorted(routes.get(host, set()))
        for host, paths in expected["routes"].items()
        if routes.get(host) != set(paths)
    }
    if wrong:
        problems.append(f"incorrect connector routes: {wrong}")

    # The public EDR endpoint lives on <participant host> via the control
    # plane's metrics slot. DSP must NOT share that host: peers must only reach
    # protocol on <name>-dsp.local.
    for host in expected["public_hosts"]:
        paths = routes.get(host, set())
        if "/api/public" not in paths:
            problems.append(f"{host} is missing the control-plane public path")
        if "/api/v1/dsp" in paths:
            problems.append(f"{host} must not expose DSP; keep it on its -dsp host")
    prefixed = sorted((host, path) for host, paths in routes.items() for path in paths if path.startswith("/connector"))
    if prefixed:
        problems.append(f"/connector routes are back: {prefixed}")

    # The tractusx-connector chart derives EDC_DSP_CALLBACK_ADDRESS from
    # controlplane.ingresses[0] unless the env is pinned. A wrong host makes
    # the provider's agreement POST 404 at nginx and leaves the consumer stuck
    # in REQUESTED.
    actual: dict[str, str | None] = {}
    for document in documents:
        if document.get("kind") != "Deployment":
            continue
        name = document.get("metadata", {}).get("name")
        if name not in expected["callbacks"]:
            continue
        for container in document.get("spec", {}).get("template", {}).get("spec", {}).get("containers", []):
            for env in container.get("env", []) or []:
                if env.get("name") == "EDC_DSP_CALLBACK_ADDRESS":
                    actual[name] = env.get("value")
    wrong_callbacks = {
        name: actual.get(name) for name, value in expected["callbacks"].items() if actual.get(name) != value
    }
    if wrong_callbacks:
        problems.append(f"control planes advertise the wrong DSP callback address: {wrong_callbacks}")
    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", required=True, type=pathlib.Path)
    parser.add_argument("--manifest", required=True, type=pathlib.Path)
    arguments = parser.parse_args(argv)

    plan = json.loads(arguments.plan.read_text())
    with arguments.manifest.open(encoding="utf-8") as stream:
        documents = [document for document in yaml.safe_load_all(stream) if document]

    problems = validate(documents, plan["expectations"], plan["namespace"])
    if problems:
        for problem in problems:
            print(f"::error::Developer toolbox manifest: {problem}", file=sys.stderr)
        return 1

    expected = plan["expectations"]
    print(
        f"The manifest holds {len(expected['deployments'])} expected deployments, "
        f"{len(expected['hooks'])} install hooks, isolated routes for "
        f"{len(expected['callbacks'])} connectors and their DSP callbacks."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
