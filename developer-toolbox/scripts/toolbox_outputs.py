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

## This code was partially generated using artificial intelligence (AI) (Tool: Claude Code, Model: Claude Opus 5.5).
## It was reviewed and tested by a human committer.

"""Write what the developer toolbox hands back: the variables and the participants.

Run after the release is up. It reads the plan, discovers what the charts did
not pin (each Digital Twin Registry's ingress prefix and Service port), and
writes two files into ``--out-dir``:

``developer-toolbox.vars.yaml``
    ``variables:`` for ``testlab run --config``. The TestLab roles become the
    bindings TestLab knows (``infrastructure.sut.*`` and
    ``infrastructure.engine.*``); every participant is also there under
    ``participants.<name>.*``, for tests that address more than two.
``participants.json``
    Every participant with its identity and the URLs it answers on, for the
    caller's own steps and for the action's preflight checks.

It prints the action's outputs as ``key=value`` lines (for ``GITHUB_OUTPUT``).
"""

from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys

import yaml


def _kubectl(*arguments: str) -> str:
    return subprocess.run(["kubectl", *arguments], check=True, capture_output=True, text=True).stdout.strip()


def discover_dtr(name: str, namespace: str) -> dict:
    """The registry of one participant, from the runner and from a pod."""
    fullname = f"{name}-dtr"
    host = _kubectl("get", "ingress", fullname, "-n", namespace, "-o", "jsonpath={.spec.rules[0].host}")
    path = _kubectl("get", "ingress", fullname, "-n", namespace, "-o", "jsonpath={.spec.rules[0].http.paths[0].path}")
    port = _kubectl("get", "svc", fullname, "-n", namespace, "-o", "jsonpath={.spec.ports[0].port}")
    if not (host and path and port):
        raise SystemExit(f"::error::Could not read the ingress and Service of {fullname} in namespace {namespace}.")
    # The DTR's ingress serves the registry under a rewritten prefix
    # (`/semantics/registry(/|$)(.*)` -> `/$2`), so the API base URL is the host
    # *plus* that prefix — the bare host answers 404. Strip the regex tail.
    prefix = path.split("(", 1)[0].rstrip("/")
    return {
        "host": host,
        "base_url": f"http://{host}{prefix}",
        # The same registry, addressed from inside the cluster. The ingress
        # prefix is a rewrite, so a pod talking to the Service reaches the
        # application at its own root and the AAS API sits under `/api/v3`. The
        # address an EDC data plane dials is not the one the runner uses — and
        # the port is a subchart default, so it is read off the Service.
        "internal_url": f"http://{fullname}.{namespace}.svc.cluster.local:{port}/api/v3",
    }


def participant_record(participant: dict, dtr: dict | None) -> dict:
    record = {
        "name": participant["name"],
        "bpn": participant["bpn"],
        "did": participant["did"],
        "external": participant["external"],
        "credentials": participant["credentials"],
        "connector": None,
        "dtr": dtr,
    }
    if participant["connector"]:
        record["connector"] = {
            "management_url": participant["management_url"],
            "dsp_url": participant["dsp_url"],
            "api_key": participant["api_key"],
            # A Saturn connector speaking DSP 2025-1 identifies itself by its
            # DID: it is what the counter-party sees on a negotiation, and what
            # a provider puts in the catalog's `participantId`. The BPN is what
            # a *caller* holds.
            "participant_id": participant["did"],
        }
    if not participant["external"]:
        record["wallet"] = {
            "identity_api": participant["identity_api"],
            "api_key": participant["x_api_key"],
        }
    return record


def variables(plan: dict, records: dict[str, dict], mock_server_url: str) -> dict:
    values: dict[str, str] = {}
    for name, record in records.items():
        prefix = f"participants.{name}"
        values[f"{prefix}.bpn"] = record["bpn"]
        values[f"{prefix}.did"] = record["did"]
        for key, value in (record["connector"] or {}).items():
            values[f"{prefix}.connector.{key}"] = value
        if record["dtr"]:
            values[f"{prefix}.dtr.base_url"] = record["dtr"]["base_url"]
            values[f"{prefix}.dtr.internal_url"] = record["dtr"]["internal_url"]

    testlab = plan["testlab"]
    registries = [record["dtr"] for record in records.values() if record["dtr"]]
    for side in ("sut", "engine"):
        name = testlab[side]
        if not name:
            continue
        record = records[name]
        for key, value in record["connector"].items():
            values[f"infrastructure.{side}.connector.{key}"] = value
        values[f"{side}_bpnl"] = record["bpn"]
    # The registry under test is the SUT's own, or the first one there is. The
    # engine's is its own if it has one; otherwise it shares the SUT's, which
    # changes nothing at runtime because a bare registry lookup resolves to the
    # SUT's binding first.
    sut_dtr = (records[testlab["sut"]]["dtr"] if testlab["sut"] else None) or (registries[0] if registries else None)
    engine_dtr = (records[testlab["engine"]]["dtr"] if testlab["engine"] else None) or sut_dtr
    if sut_dtr:
        values["infrastructure.sut.dtr.base_url"] = sut_dtr["base_url"]
        values["dtr_internal_url"] = sut_dtr["internal_url"]
    if engine_dtr:
        values["infrastructure.engine.dtr.base_url"] = engine_dtr["base_url"]

    urls = plan["stand_in_urls"]
    if urls["submodel_server"]:
        # The payload store behind the engine's registry entries.
        values["infrastructure.engine.dtr.submodel_base_url"] = urls["submodel_server"]
    if urls["stub_caller"]:
        values["stub_caller_url"] = urls["stub_caller"]
    if urls["echo"]:
        # A stand-in for "a product behind the provider's connector". A project
        # that tests a real product overrides it in its own config file.
        values["product_internal_url"] = urls["echo"]
    # The root of TestLab's own mock server as a pod can reach it.
    values["mock_server_external_url"] = mock_server_url
    return values


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--plan", required=True, type=pathlib.Path)
    parser.add_argument("--out-dir", required=True, type=pathlib.Path)
    parser.add_argument("--mock-server-url", required=True)
    arguments = parser.parse_args(argv)

    plan = json.loads(arguments.plan.read_text())
    namespace = plan["namespace"]
    records = {
        participant["name"]: participant_record(
            participant, discover_dtr(participant["name"], namespace) if participant["dtr"] else None
        )
        for participant in plan["participants"]
    }
    values = variables(plan, records, arguments.mock_server_url)

    out = arguments.out_dir
    out.mkdir(parents=True, exist_ok=True)
    variables_file = out / "developer-toolbox.vars.yaml"
    participants_file = out / "participants.json"
    variables_file.write_text(yaml.safe_dump({"variables": values}, sort_keys=True))
    participants_file.write_text(json.dumps(list(records.values()), indent=2) + "\n")
    print("\n".join(sorted(values)), file=sys.stderr)

    testlab = plan["testlab"]
    sut_dtr = records[testlab["sut"]]["dtr"] if testlab["sut"] else None
    registries = [record["dtr"] for record in records.values() if record["dtr"]]
    dtr = sut_dtr or (registries[0] if registries else {})
    outputs = {
        "variables-file": variables_file,
        "participants-file": participants_file,
        "dtr-base-url": dtr.get("base_url", ""),
        "dtr-internal-url": dtr.get("internal_url", ""),
        "mock-server-external-url": arguments.mock_server_url,
        "stub-caller-url": plan["stand_in_urls"]["stub_caller"],
        "submodel-server-url": plan["stand_in_urls"]["submodel_server"],
        "product-internal-url": plan["stand_in_urls"]["echo"],
    }
    for key, value in outputs.items():
        print(f"{key}={value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
