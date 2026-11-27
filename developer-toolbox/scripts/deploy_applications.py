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

"""Deploy the caller's own Helm charts next to the dataspace.

Each entry of ``applications`` in the toolbox configuration is one Helm
release: a chart from the caller's checkout (the chart of the pull request
under test), from a Helm repository, or from an OCI registry. Images the job
built are loaded into the kind node first, so a chart can run them without a
registry. The hostnames an application lists are already in the runner's
/etc/hosts and in CoreDNS, like every dataspace hostname.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys


def _run(command: list[str]) -> None:
    print("+ " + " ".join(command), flush=True)
    subprocess.run(command, check=True)


def deploy(application: dict, cluster: str) -> None:
    for image in application["images"]:
        # `kind load` cannot carry a digest (`name@sha256:…`); a tag built in
        # this job is what it is for.
        _run(["kind", "load", "docker-image", image, "--name", cluster])

    command = [
        "helm", "upgrade", "--install", application["name"], application["chart"],
        "--namespace", application["namespace"], "--create-namespace",
    ]
    if application["repository"]:
        command += ["--repo", application["repository"]]
    if application["version"]:
        command += ["--version", application["version"]]
    for values in application["values"]:
        command += ["-f", values]
    for key, value in application["set"].items():
        command += ["--set", f"{key}={value}"]
    if application["wait"]:
        command += ["--wait", "--timeout", application["timeout"]]
    _run(command)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", required=True, type=pathlib.Path)
    parser.add_argument("--cluster", required=True)
    arguments = parser.parse_args(argv)

    applications = json.loads(arguments.plan.read_text())["applications"]
    if not applications:
        print("No applications to deploy.")
        return 0
    for application in applications:
        try:
            deploy(application, arguments.cluster)
        except subprocess.CalledProcessError as error:
            print(f"::error::Application '{application['name']}' did not deploy: {error}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
