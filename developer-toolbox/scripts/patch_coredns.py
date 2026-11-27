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

"""Resolve the dataspace hostnames to the ingress controller inside the cluster.

Pods resolve their peers through CoreDNS, which knows nothing about the ingress
hostnames the participants are configured with. Without this, did:web
resolution, STS token exchange, the DSP handshake and the credential-service
callbacks all fail with UnknownHostException while every pod still reports
itself healthy.

    patch_coredns.py --hosts-file hosts.txt

It adds a ``hosts`` block, pointing every hostname at the ingress controller's
ClusterIP, ahead of ``forward`` in the Corefile, then restarts CoreDNS and
waits for it. kubectl talks to whatever cluster KUBECONFIG names.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys

MARKER = "dataspace-hosts"


def _kubectl(*arguments: str) -> str:
    return subprocess.run(["kubectl", *arguments], check=True, capture_output=True, text=True).stdout


def patched_corefile(corefile: str, ingress_ip: str, hosts: list[str]) -> str | None:
    """The Corefile with the hosts block, or None when it already has one."""
    if MARKER in corefile:
        return None
    block = [f"    # {MARKER}", "    hosts {"]
    block += [f"        {ingress_ip} {host}" for host in hosts]
    block += ["        fallthrough", "    }", ""]
    # CoreDNS fixes its plugin order at build time, so `hosts` is consulted
    # ahead of `forward` wherever it sits; it goes above `forward` anyway so the
    # file reads the way it behaves.
    lines = corefile.splitlines()
    for index, line in enumerate(lines):
        if line.strip().startswith("forward "):
            return "\n".join([*lines[:index], *block, *lines[index:]]) + "\n"
    raise ValueError("No 'forward' directive found in the CoreDNS Corefile.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--hosts-file", required=True, type=pathlib.Path)
    arguments = parser.parse_args(argv)
    hosts = arguments.hosts_file.read_text().split()

    ingress_ip = _kubectl(
        "-n", "ingress-nginx", "get", "svc", "ingress-nginx-controller", "-o", "jsonpath={.spec.clusterIP}"
    ).strip()
    if not ingress_ip:
        print("::error::ingress-nginx-controller has no ClusterIP.", file=sys.stderr)
        return 1
    print(f"Resolving the dataspace hostnames to {ingress_ip} inside the cluster.")

    configmap = json.loads(_kubectl("-n", "kube-system", "get", "configmap", "coredns", "-o", "json"))
    try:
        corefile = patched_corefile(configmap["data"]["Corefile"], ingress_ip, hosts)
    except ValueError as error:
        print(f"::error::{error}", file=sys.stderr)
        return 1
    if corefile is None:
        print("CoreDNS already carries the dataspace hosts block.")
        return 0
    _kubectl(
        "-n", "kube-system", "patch", "configmap", "coredns",
        "--type", "merge", "-p", json.dumps({"data": {"Corefile": corefile}}),
    )
    print(corefile)
    _kubectl("-n", "kube-system", "rollout", "restart", "deployment/coredns")
    _kubectl("-n", "kube-system", "rollout", "status", "deployment/coredns", "--timeout=120s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
