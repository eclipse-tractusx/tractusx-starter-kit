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

"""Prepare the pulled Umbrella chart for the developer toolbox.

Three changes, all to the unpacked chart in place:

1. Umbrella 26.03.00 packages the complete ``tx-data-provider`` bundles at the
   root but omits them from ``decentralized-identity-connector``'s nested
   ``tx-data-provider``. The same pinned dependencies are copied in.
2. IdentityHub and IssuerService are replaced with the released charts of
   ``--identityhub-version`` (the in-memory IdentityHub, renamed to the
   dependency's own name so Umbrella's ``tractusx-identityhub`` values keep
   addressing it), and the dependency declarations naming them are bumped to
   match. Helm resolves an aliased dependency by name *and* version: left at the
   old version, the second alias of ``decentralized-identity-connector`` renders
   no IdentityHub at all -- no error, just a missing participant.
3. One ``decentralized-identity-connector`` alias per participant in the
   toolbox configuration. Umbrella declares two (``edc-provider`` and
   ``edc-consumer``); every further participant gets ``edc-<name>``, pointing at
   the same packaged subchart. Each alias is an independent participant: its
   own connector, IdentityHub and, optionally, Digital Twin Registry.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import shutil
import sys

IDENTITYHUB_SLOT = "charts/decentralized-identity-connector/charts/tractusx-identityhub"
PARTICIPANT_CHART = "decentralized-identity-connector"


def _substitute(path: pathlib.Path, pattern: str, replacement: str) -> None:
    text = path.read_text()
    patched, count = re.subn(pattern, replacement, text)
    if count != 1:
        raise SystemExit(f"{path}: expected one match for {pattern!r}, found {count}")
    path.write_text(patched)


def restore_nested_bundles(chart_dir: pathlib.Path) -> None:
    source = chart_dir / "charts/tx-data-provider/charts"
    nested = chart_dir / "charts/decentralized-identity-connector/charts/tx-data-provider"
    if not source.is_dir() or not nested.is_dir():
        raise SystemExit(f"Unexpected Umbrella layout: {source} or {nested} is missing")
    (nested / "charts").mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, nested / "charts", dirs_exist_ok=True)


def swap_identity_charts(chart_dir: pathlib.Path, charts: pathlib.Path, version: str) -> None:
    slot = chart_dir / IDENTITYHUB_SLOT
    shutil.rmtree(slot, ignore_errors=True)
    shutil.rmtree(chart_dir / "charts/tractusx-issuerservice", ignore_errors=True)
    shutil.copytree(charts / "tractusx-identityhub-memory", slot)
    shutil.copytree(charts / "tractusx-issuerservice", chart_dir / "charts/tractusx-issuerservice")

    _substitute(
        slot / "Chart.yaml",
        r"(?m)^name: tractusx-identityhub-memory$",
        "name: tractusx-identityhub",
    )
    declarations = {
        chart_dir / "charts/decentralized-identity-connector/Chart.yaml": "tractusx-identityhub",
        chart_dir / "Chart.yaml": "tractusx-issuerservice",
    }
    for path, name in declarations.items():
        _substitute(
            path,
            rf"(name: {name}\n  repository: [^\n]+\n  version: )\S+",
            rf"\g<1>{version}",
        )


def add_participant_aliases(chart_dir: pathlib.Path, aliases: list[str]) -> list[str]:
    """Declare one participant alias per entry that Umbrella does not already have.

    Chart.yaml is edited as text rather than re-dumped, so the file keeps its
    layout and the declarations helm already validated stay byte-identical.
    """
    chart_yaml = chart_dir / "Chart.yaml"
    text = chart_yaml.read_text()
    declared = re.findall(
        rf"(?m)^- alias: (\S+)\n  condition: \S+\n  name: {PARTICIPANT_CHART}\n", text
    )
    template = re.search(
        rf"(?m)^- alias: \S+\n  condition: \S+\n  name: {PARTICIPANT_CHART}\n"
        r"  repository: (\S+)\n  version: (\S+)\n",
        text,
    )
    if not template:
        raise SystemExit(f"{chart_yaml}: no {PARTICIPANT_CHART} dependency to copy")
    repository, version = template.group(1), template.group(2)

    added = [alias for alias in aliases if alias not in declared]
    if added:
        block = "".join(
            f"- alias: {alias}\n"
            f"  condition: {alias}.enabled\n"
            f"  name: {PARTICIPANT_CHART}\n"
            f"  repository: {repository}\n"
            f"  version: {version}\n"
            for alias in added
        )
        # Insert right after the last participant declaration.
        last = list(
            re.finditer(
                rf"(?m)^- alias: \S+\n  condition: \S+\n  name: {PARTICIPANT_CHART}\n"
                r"  repository: \S+\n  version: \S+\n",
                text,
            )
        )[-1]
        text = text[: last.end()] + block + text[last.end() :]
        chart_yaml.write_text(text)
    return declared


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chart-dir", required=True, type=pathlib.Path)
    parser.add_argument(
        "--identity-charts",
        required=True,
        type=pathlib.Path,
        help="Folder with the unpacked tractusx-identityhub-memory and tractusx-issuerservice charts.",
    )
    parser.add_argument("--identityhub-version", required=True)
    parser.add_argument(
        "--plan",
        required=True,
        type=pathlib.Path,
        help="plan.json written by render_toolbox.py; its participant aliases are declared.",
    )
    parser.add_argument(
        "--disabled-values",
        required=True,
        type=pathlib.Path,
        help="Values file written here that switches off the aliases Umbrella declares and the plan does not use.",
    )
    arguments = parser.parse_args(argv)

    plan = json.loads(arguments.plan.read_text())
    aliases = [participant["alias"] for participant in plan["participants"] if participant["deployed"]]

    restore_nested_bundles(arguments.chart_dir)
    swap_identity_charts(arguments.chart_dir, arguments.identity_charts, arguments.identityhub_version)
    declared = add_participant_aliases(arguments.chart_dir, aliases)

    added = [alias for alias in aliases if alias not in declared]
    unused = [alias for alias in declared if alias not in aliases]
    # The profile enables both of Umbrella's own participants; one the
    # configuration does not name must not come up anyway.
    arguments.disabled_values.write_text(
        "".join(f"{alias}:\n  enabled: false\n" for alias in unused) or "{}\n"
    )
    print(
        f"Umbrella declares {', '.join(declared)}; added {', '.join(added) or 'nothing'}; "
        f"switched off {', '.join(unused) or 'nothing'}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
