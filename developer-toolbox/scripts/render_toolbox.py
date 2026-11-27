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

"""Turn a developer toolbox configuration into what the action deploys.

The configuration (toolbox.yaml, or the caller's own file merged over it) says
which participants the dataspace has, what each of them runs and which versions
of the software it is built from. This script validates it and writes, into
``--out-dir``:

``plan.json``
    Everything the later steps need, resolved: every participant with its DID,
    BPN, hostnames, API key and credentials; the versions; the stand-ins; the
    applications; the TestLab settings; and what the rendered manifest must
    contain (read by validate_manifest.py).
``participants.values.yaml``
    The Helm values of every participant (one ``decentralized-identity-connector``
    alias each, from values/participant.values.yaml and
    values/participant-dtr.values.yaml), the BPN directory seeding, and the
    images from ``dataspace``.
``vault-secrets.values.yaml``
    Only with ``--signing-key`` / ``--signing-public-key``: the in-memory vault
    seed of every connector.
``hosts.txt``
    Every hostname the dataspace answers on, one per line. The action points
    them at the ingress controller, on the runner and in CoreDNS.
``toolbox.env``
    ``KEY=VALUE`` lines with the resolved versions, for ``GITHUB_ENV``.
"""

from __future__ import annotations

import argparse
import base64
import copy
import json
import pathlib
import re
import string
import sys

import yaml

TOOLBOX_DIR = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = TOOLBOX_DIR / "toolbox.yaml"
PARTICIPANT_TEMPLATE = TOOLBOX_DIR / "values/participant.values.yaml"
DTR_TEMPLATE = TOOLBOX_DIR / "values/participant-dtr.values.yaml"

RELEASE = "umbrella"
ISSUER_HOST = "issuerservice.local"
BDRS_HOST = "bdrs-server.tx.test"
BDRS_URL = f"http://{BDRS_HOST}/api/directory"
STUB_CALLER_HOST = "tck-stub.local"
SUBMODEL_SERVER_HOST = "tck-submodel.local"

NAME = re.compile(r"^[a-z][a-z0-9-]{0,19}$")
BPN = re.compile(r"^BPN[LSA][A-Z0-9]{12}$")
HOSTNAME = re.compile(r"^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$")
DID_WEB = re.compile(r"^did:web:([^:]+)(:[^:]+)*$")
CREDENTIAL_TYPE = re.compile(r"^[A-Z][A-Za-z0-9]*$")

PARTICIPANT_KEYS = {"name", "bpn", "did", "hostname", "connector", "dtr", "credentials", "claims", "external"}
CONNECTOR_KEYS = {"enabled", "api-key"}
EXTERNAL_KEYS = {"dsp-url", "management-url", "api-key"}
APPLICATION_KEYS = {
    "name", "chart", "repository", "version", "namespace", "values", "set",
    "images", "hosts", "wait", "timeout",
}


class ConfigError(ValueError):
    """The configuration cannot be deployed."""


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------


def deep_merge(base, override):
    """Merge ``override`` over ``base``. Mappings merge; anything else replaces."""
    if isinstance(base, dict) and isinstance(override, dict):
        merged = dict(base)
        for key, value in override.items():
            merged[key] = deep_merge(base[key], value) if key in base else copy.deepcopy(value)
        return merged
    return copy.deepcopy(override)


def load_config(path: pathlib.Path | None, overrides: dict) -> dict:
    config = yaml.safe_load(DEFAULT_CONFIG.read_text())
    if path is not None:
        user = yaml.safe_load(path.read_text()) or {}
        if not isinstance(user, dict):
            raise ConfigError(f"{path}: the configuration must be a mapping")
        unknown = sorted(set(user) - set(config))
        if unknown:
            raise ConfigError(f"{path}: unknown top-level keys {unknown}; known: {sorted(config)}")
        config = deep_merge(config, user)
    for dotted, value in overrides.items():
        if value in (None, ""):
            continue
        if value == "none":
            value = ""
        node = config
        *parents, leaf = dotted.split(".")
        for parent in parents:
            node = node.setdefault(parent, {})
        node[leaf] = value
    return config


# ---------------------------------------------------------------------------
# Validation and resolution
# ---------------------------------------------------------------------------


def _lower_first(text: str) -> str:
    return text[:1].lower() + text[1:]


def resolve_credentials(config: dict) -> list[dict]:
    definitions = config.get("credentials") or {}
    if not isinstance(definitions, dict) or not definitions:
        raise ConfigError("credentials: define at least one credential type")
    resolved = []
    for credential_type, definition in definitions.items():
        if not CREDENTIAL_TYPE.match(str(credential_type)):
            raise ConfigError(f"credentials: '{credential_type}' is not a credential type name")
        definition = definition or {}
        mappings = definition.get("mappings") or {}
        if not isinstance(mappings, dict):
            raise ConfigError(f"credentials.{credential_type}.mappings: must map <claim>: <credential path>")
        resolved.append(
            {
                "id": definition.get("id") or f"{_lower_first(credential_type)}-id",
                "type": credential_type,
                "mappings": [
                    {"input": claim, "output": output, "required": True}
                    for claim, output in mappings.items()
                ],
            }
        )
    return resolved


def _connector_settings(entry: dict, where: str) -> tuple[bool, str]:
    connector = entry.get("connector", True)
    if isinstance(connector, bool):
        return connector, "password"
    if isinstance(connector, dict):
        unknown = sorted(set(connector) - CONNECTOR_KEYS)
        if unknown:
            raise ConfigError(f"{where}.connector: unknown keys {unknown}; known: {sorted(CONNECTOR_KEYS)}")
        return bool(connector.get("enabled", True)), str(connector.get("api-key") or "password")
    raise ConfigError(f"{where}.connector: true, false, or a mapping with {sorted(CONNECTOR_KEYS)}")


def resolve_participants(
    config: dict, credential_claims: dict[str, list[str]], issuer_did: str, dsp_version: str
) -> list[dict]:
    """Resolve every participant. ``credential_claims`` maps each credential type to the claims it maps."""
    entries = config.get("participants") or []
    if not isinstance(entries, list) or not entries:
        raise ConfigError("participants: list at least one participant")

    common_claims = config.get("claims") or {}
    participants: list[dict] = []
    seen: dict[str, dict[str, str]] = {"name": {}, "bpn": {}, "did": {}}
    hosts_seen: dict[str, str] = {}
    deployed_index = 0

    for index, entry in enumerate(entries):
        where = f"participants[{index}]"
        if not isinstance(entry, dict):
            raise ConfigError(f"{where}: must be a mapping")
        unknown = sorted(set(entry) - PARTICIPANT_KEYS)
        if unknown:
            raise ConfigError(f"{where}: unknown keys {unknown}; known: {sorted(PARTICIPANT_KEYS)}")

        name = str(entry.get("name", ""))
        if not NAME.match(name):
            raise ConfigError(
                f"{where}.name: '{name}' must be lower case letters, digits and '-', "
                "start with a letter and be at most 20 characters (it names Kubernetes objects)"
            )
        where = f"participants.{name}"
        bpn = str(entry.get("bpn", ""))
        if not BPN.match(bpn):
            raise ConfigError(f"{where}.bpn: '{bpn}' is not a BPN (BPNL followed by 12 capitals or digits)")

        external = entry.get("external")
        hostname = entry.get("hostname")
        did = entry.get("did")
        if did:
            match = DID_WEB.match(str(did))
            if not match:
                raise ConfigError(f"{where}.did: '{did}' must be a did:web DID")
            did_host = match.group(1)
            if hostname and hostname != did_host:
                raise ConfigError(
                    f"{where}: hostname '{hostname}' and the DID's host '{did_host}' differ; "
                    "a did:web DID is resolved at its host, so they must be the same"
                )
            hostname = did_host
        hostname = str(hostname or f"{name}.local")
        if not external and not HOSTNAME.match(hostname):
            raise ConfigError(f"{where}.hostname: '{hostname}' is not a hostname")
        did = str(did or f"did:web:{hostname}:identityhub:{bpn}")

        for key, value in (("name", name), ("bpn", bpn), ("did", did)):
            if value in seen[key]:
                raise ConfigError(f"{where}.{key}: '{value}' is already used by {seen[key][value]}")
            seen[key][value] = where

        claims = entry.get("claims") or {}
        if not isinstance(claims, dict):
            raise ConfigError(f"{where}.claims: must be a mapping of claim names to values")
        all_claims = {"holder_id": did, "holder_identifier": did, "bpn": bpn, **common_claims, **claims}

        def unmet(credential_type: str) -> list[str]:
            return sorted(set(credential_claims[credential_type]) - set(all_claims))

        if "credentials" in entry:
            wanted = entry["credentials"]
            if not isinstance(wanted, list):
                raise ConfigError(f"{where}.credentials: must be a list of credential types")
            undefined = sorted(set(wanted) - set(credential_claims))
            if undefined:
                raise ConfigError(f"{where}.credentials: {undefined} are not defined under `credentials`")
            for credential_type in wanted:
                if unmet(credential_type):
                    raise ConfigError(
                        f"{where}.credentials: {credential_type} maps the claims {unmet(credential_type)}, "
                        "which this participant does not carry; add them to its `claims`"
                    )
        else:
            # By default, every credential the participant has the claims for.
            wanted = [credential_type for credential_type in credential_claims if not unmet(credential_type)]

        participant = {
            "name": name,
            "bpn": bpn,
            "did": did,
            "host": hostname,
            "claims": all_claims,
            "credentials": list(wanted),
        }

        if external:
            if not isinstance(external, dict):
                raise ConfigError(f"{where}.external: must be a mapping with {sorted(EXTERNAL_KEYS)}")
            unknown = sorted(set(external) - EXTERNAL_KEYS)
            if unknown:
                raise ConfigError(f"{where}.external: unknown keys {unknown}; known: {sorted(EXTERNAL_KEYS)}")
            if entry.get("dtr"):
                raise ConfigError(f"{where}: an external participant runs nothing here, so it cannot have `dtr`")
            has_connector = bool(external.get("dsp-url") and external.get("management-url"))
            participant.update(
                {
                    "alias": None,
                    "deployed": False,
                    "external": True,
                    "connector": has_connector,
                    "dtr": False,
                    # Its wallet is not ours: nothing here can issue to it.
                    "credentials": [],
                    "api_key": str(external.get("api-key") or ""),
                    "management_url": str(external.get("management-url") or ""),
                    "dsp_url": str(external.get("dsp-url") or ""),
                }
            )
            participants.append(participant)
            continue

        connector, api_key = _connector_settings(entry, where)
        dtr = bool(entry.get("dtr", False))
        if dtr and not connector:
            raise ConfigError(f"{where}: a Digital Twin Registry sits behind a connector; set `connector: true`")
        intranet_host = f"{name}.intranet"
        dsp_host = f"{name}-dsp.local"
        management_host = f"{name}-management.local"
        dtr_host = f"{name}-dtr.local"
        own_hosts = [hostname, intranet_host]
        if connector:
            own_hosts += [dsp_host, management_host]
        if dtr:
            own_hosts.append(dtr_host)
        for host in own_hosts:
            if host in hosts_seen:
                raise ConfigError(f"{where}: hostname '{host}' is already used by {hosts_seen[host]}")
            hosts_seen[host] = where

        participant.update(
            {
                "alias": f"edc-{name}",
                "deployed": True,
                "external": False,
                "connector": connector,
                "dtr": dtr,
                "intranet_host": intranet_host,
                "dsp_host": dsp_host if connector else None,
                "management_host": management_host if connector else None,
                "dtr_host": dtr_host if dtr else None,
                "hosts": own_hosts,
                "api_key": api_key if connector else "",
                "management_url": f"http://{management_host}/management" if connector else "",
                "dsp_url": f"http://{dsp_host}/api/v1/dsp/{dsp_version}" if connector else "",
                "secret_alias": f"{name}-secret",
                "secret_value": name,
                # The IdentityHub's API key: base64(participant context id) + a suffix.
                "x_api_key": base64.b64encode(did.encode()).decode() + ".randomChars",
                "context_id": f"00000000-0000-0000-0000-{4 + deployed_index:012d}",
                "identity_api": f"http://{intranet_host}/identityhub/api/identity/v1alpha",
            }
        )
        deployed_index += 1
        participants.append(participant)

    if not any(participant["deployed"] for participant in participants):
        raise ConfigError("participants: at least one participant must be deployed (not `external`)")
    if issuer_did in seen["did"]:
        raise ConfigError(f"The issuer's DID {issuer_did} is also a participant's DID")
    return participants


def resolve_applications(config: dict, workspace: pathlib.Path, namespace: str) -> list[dict]:
    applications = config.get("applications") or []
    if not isinstance(applications, list):
        raise ConfigError("applications: must be a list")
    resolved = []
    names = set()
    for index, application in enumerate(applications):
        where = f"applications[{index}]"
        if not isinstance(application, dict):
            raise ConfigError(f"{where}: must be a mapping")
        unknown = sorted(set(application) - APPLICATION_KEYS)
        if unknown:
            raise ConfigError(f"{where}: unknown keys {unknown}; known: {sorted(APPLICATION_KEYS)}")
        name = str(application.get("name", ""))
        if not re.match(r"^[a-z0-9]([a-z0-9-]{0,51}[a-z0-9])?$", name):
            raise ConfigError(f"{where}.name: '{name}' is not a Helm release name")
        if name in names or name == RELEASE:
            raise ConfigError(f"{where}.name: '{name}' is already taken")
        names.add(name)
        chart = str(application.get("chart", ""))
        if not chart:
            raise ConfigError(f"applications.{name}.chart: name the chart (a path, a chart name or an oci:// reference)")
        repository = str(application.get("repository") or "")
        local = not repository and not chart.startswith("oci://") and (
            chart.startswith((".", "/")) or (workspace / chart).exists()
        )
        values = application.get("values") or []
        if isinstance(values, str):
            values = [values]
        settings = application.get("set") or {}
        if not isinstance(settings, dict):
            raise ConfigError(f"applications.{name}.set: must map Helm value paths to values")
        hosts = [str(host) for host in application.get("hosts") or []]
        for host in hosts:
            if not HOSTNAME.match(host):
                raise ConfigError(f"applications.{name}.hosts: '{host}' is not a hostname")
        resolved.append(
            {
                "name": name,
                "chart": str((workspace / chart).resolve()) if local else chart,
                "repository": repository,
                "version": str(application.get("version") or ""),
                "namespace": str(application.get("namespace") or namespace),
                "values": [str((workspace / value).resolve()) for value in values],
                "set": {str(key): str(value) for key, value in settings.items()},
                "images": [str(image) for image in application.get("images") or []],
                "hosts": hosts,
                "wait": bool(application.get("wait", True)),
                "timeout": str(application.get("timeout") or "10m"),
            }
        )
    return resolved


def resolve_testlab(config: dict, participants: list[dict]) -> dict:
    testlab = config.get("testlab") or {}
    with_connector = [participant["name"] for participant in participants if participant["connector"]]
    by_name = {participant["name"]: participant for participant in participants}

    def role(key: str, fallback: str | None) -> str | None:
        name = testlab.get(key, fallback)
        if name in (None, ""):
            return None
        if name not in by_name:
            raise ConfigError(f"testlab.{key}: '{name}' is not a participant")
        if not by_name[name]["connector"]:
            raise ConfigError(f"testlab.{key}: '{name}' has no connector for TestLab to address")
        return name

    sut = role("sut", with_connector[0] if with_connector else None)
    engine = role("engine", next((name for name in with_connector if name != sut), None))
    if sut and sut == engine:
        raise ConfigError("testlab: `sut` and `engine` must be different participants")
    return {"version": str(testlab.get("version") or ""), "sut": sut, "engine": engine}


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------


def _fill(template: pathlib.Path, fields: dict) -> dict:
    text = string.Template(template.read_text()).safe_substitute(
        {key: "" if value is None else str(value) for key, value in fields.items()}
    )
    leftover = sorted(set(re.findall(r"\$\{(\w+)\}", text)))
    if leftover:
        raise SystemExit(f"{template}: no value for {leftover}")
    return yaml.safe_load(text)


def _image(settings: dict | None) -> dict:
    """A config image block (`repository`, `tag`, `pull-policy`) as Helm values."""
    image = {}
    for source, target in (("repository", "repository"), ("tag", "tag"), ("pull-policy", "pullPolicy")):
        value = (settings or {}).get(source)
        if value not in (None, ""):
            image[target] = str(value)
    return image


def render_participant(participant: dict, issuer_did: str, dataspace: dict) -> dict:
    fields = {**participant, "issuer_did": issuer_did, "bdrs_url": BDRS_URL}
    values = _fill(PARTICIPANT_TEMPLATE, fields)
    if participant["dtr"]:
        values = deep_merge(values, _fill(DTR_TEMPLATE, fields))
    if not participant["connector"]:
        # A wallet only: an identity in the dataspace, with credentials, and
        # nothing that negotiates.
        values["tx-data-provider"] = {"enabled": False}
    else:
        connector_image = _image((dataspace.get("connector") or {}).get("image"))
        connector = values["tx-data-provider"]["dataspace-connector-bundle"]["tractusx-connector"]
        for plane in ("controlplane", "dataplane"):
            connector[plane]["image"] = {**connector[plane].get("image", {}), **connector_image}
    identityhub_image = _image((dataspace.get("identityhub") or {}).get("image"))
    if identityhub_image:
        values["tractusx-identityhub"]["identityhub"]["image"] = identityhub_image
    return values


def render_values(plan: dict, dataspace: dict) -> dict:
    issuer = plan["issuer"]
    values: dict = {
        participant["alias"]: render_participant(participant, issuer["did"], dataspace)
        for participant in plan["participants"]
        if participant["deployed"]
    }
    # The BPN directory: every participant, external ones included, and the issuer.
    values["bdrs-server-memory"] = {
        "seeding": {
            "bpnList": [
                {"bpn": participant["bpn"], "did": participant["did"]}
                for participant in plan["participants"]
            ]
            + [{"bpn": issuer["bpn"], "did": issuer["did"]}]
        },
        "server": {"trustedIssuers": [issuer["did"]]},
    }
    issuer_image = _image((dataspace.get("issuerservice") or {}).get("image"))
    if issuer_image:
        values["tractusx-issuerservice"] = {"issuerservice": {"image": issuer_image}}
    return values


def render_vault_secrets(plan: dict, key: str, public_key: str) -> dict:
    """Seed every connector's in-memory vault.

    `edc-runtime-memory` has no HashiCorp Vault client. Its vault is in-process
    and seeded once, from `tx.edc.vault.secrets` — an `alias:value;alias:value`
    string. Two things have to be in it: the EDR signing keypair (the data plane
    signs the token the consumer presents at the public API and verifies it when
    the token comes back, so both runtimes of one participant hold the same
    pair), and the STS client secret, under the alias the connector is
    configured with and with the value its IdentityHub seeds its own context
    with.
    """
    values = {}
    for participant in plan["participants"]:
        if not (participant["deployed"] and participant["connector"]):
            continue
        seed = ";".join(
            (
                f"tokenSignerPrivateKey:{key}",
                f"tokenSignerPublicKey:{public_key}",
                f"{participant['secret_alias']}:{participant['secret_value']}",
            )
        )
        runtime = {"env": {"TX_EDC_VAULT_SECRETS": seed}}
        values[participant["alias"]] = {
            "tx-data-provider": {
                "dataspace-connector-bundle": {
                    "tractusx-connector": {"controlplane": dict(runtime), "dataplane": dict(runtime)}
                }
            }
        }
    return values


def expectations(plan: dict) -> dict:
    """What the rendered manifest has to contain for this plan."""
    deployments = {f"{RELEASE}-issuerservice"}
    hooks = {f"{RELEASE}-post-install-bdrs-setup"}
    routes: dict[str, list[str]] = {}
    callbacks: dict[str, str] = {}
    public_hosts: list[str] = []
    for participant in plan["participants"]:
        if not participant["deployed"]:
            continue
        name = participant["name"]
        deployments.add(f"{RELEASE}-{name}-identityhub")
        if participant["dtr"]:
            deployments.add(f"{name}-dtr")
        if not participant["connector"]:
            continue
        deployments.update({f"{RELEASE}-{name}-connector-controlplane", f"{RELEASE}-{name}-connector-dataplane"})
        # The vault-setup hook is what puts tokenSignerPrivateKey /
        # tokenSignerPublicKey / tokenEncryptionAesKey into the participant's
        # vault. It only renders while the connector bundle owns the vault.
        hooks.add(f"{RELEASE}-{name}-edc-post-install-vault-setup")
        routes[participant["dsp_host"]] = ["/api/v1/dsp"]
        routes[participant["management_host"]] = ["/catalog", "/control", "/management"]
        callbacks[f"{RELEASE}-{name}-connector-controlplane"] = f"http://{participant['dsp_host']}/api/v1/dsp"
        public_hosts.append(participant["host"])
    return {
        "deployments": sorted(deployments),
        "hooks": sorted(hooks),
        "routes": routes,
        "callbacks": callbacks,
        "public_hosts": public_hosts,
    }


def build_plan(config: dict, workspace: pathlib.Path, namespace: str) -> dict:
    dataspace = config.get("dataspace") or {}
    umbrella = dataspace.get("umbrella") or {}
    identityhub = dataspace.get("identityhub") or {}
    connector = dataspace.get("connector") or {}
    issuer_bpn = str((dataspace.get("issuer") or {}).get("bpn") or "")
    if not BPN.match(issuer_bpn):
        raise ConfigError(f"dataspace.issuer.bpn: '{issuer_bpn}' is not a BPN")
    issuer = {
        "bpn": issuer_bpn,
        "did": f"did:web:{ISSUER_HOST}:{issuer_bpn}",
        "url": f"http://{ISSUER_HOST}",
    }
    dsp_version = str(connector.get("dsp-version") or "").strip("/")

    definitions = resolve_credentials(config)
    participants = resolve_participants(
        config,
        {
            definition["type"]: [mapping["input"] for mapping in definition["mappings"]]
            for definition in definitions
        },
        issuer["did"],
        dsp_version,
    )
    stand_ins = config.get("stand-ins") or {}
    stand_ins = {
        "echo": bool(stand_ins.get("echo", False)),
        "stub_caller": bool(stand_ins.get("stub-caller", False)),
        "submodel_server": bool(stand_ins.get("submodel-server", False)),
    }
    applications = resolve_applications(config, workspace, namespace)

    hosts = [ISSUER_HOST, BDRS_HOST]
    for participant in participants:
        hosts += participant.get("hosts", [])
    if stand_ins["stub_caller"]:
        hosts.append(STUB_CALLER_HOST)
    if stand_ins["submodel_server"]:
        hosts.append(SUBMODEL_SERVER_HOST)
    for application in applications:
        hosts += application["hosts"]
    duplicates = sorted({host for host in hosts if hosts.count(host) > 1})
    if duplicates:
        raise ConfigError(f"These hostnames are used twice: {duplicates}")

    plan = {
        "release": RELEASE,
        "namespace": namespace,
        "versions": {
            "umbrella_chart": str(umbrella.get("chart-version") or ""),
            "umbrella_profile_ref": str(umbrella.get("profile-ref") or ""),
            "identityhub_chart": str(identityhub.get("chart-version") or ""),
            "dsp": dsp_version,
            "testlab": "",
        },
        "issuer": issuer,
        "credential_definitions": definitions,
        "participants": participants,
        "stand_ins": stand_ins,
        "stand_in_urls": {
            "stub_caller": f"http://{STUB_CALLER_HOST}" if stand_ins["stub_caller"] else "",
            "submodel_server": f"http://{SUBMODEL_SERVER_HOST}" if stand_ins["submodel_server"] else "",
            "echo": f"http://tck-echo.{namespace}.svc.cluster.local" if stand_ins["echo"] else "",
        },
        "applications": applications,
        "testlab": resolve_testlab(config, participants),
        "hosts": hosts,
    }
    plan["versions"]["testlab"] = plan["testlab"]["version"]
    for key, value in plan["versions"].items():
        if key != "testlab" and not value:
            raise ConfigError(f"dataspace: no version for {key}")
    plan["expectations"] = expectations(plan)
    return plan


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", type=pathlib.Path, help="The caller's configuration, merged over toolbox.yaml.")
    parser.add_argument("--out-dir", required=True, type=pathlib.Path)
    parser.add_argument("--namespace", default=RELEASE)
    parser.add_argument("--workspace", type=pathlib.Path, default=pathlib.Path.cwd(),
                        help="Folder relative application paths are resolved against.")
    parser.add_argument("--umbrella-chart-version", default="")
    parser.add_argument("--umbrella-values-ref", default="")
    parser.add_argument("--identityhub-chart-version", default="")
    parser.add_argument("--testlab-version", default="", help='"none" installs no TestLab.')
    parser.add_argument("--signing-key", type=pathlib.Path, help="PEM private key for the connectors' EDR tokens.")
    parser.add_argument("--signing-public-key", type=pathlib.Path)
    arguments = parser.parse_args(argv)

    try:
        config = load_config(
            arguments.config,
            {
                "dataspace.umbrella.chart-version": arguments.umbrella_chart_version,
                "dataspace.umbrella.profile-ref": arguments.umbrella_values_ref,
                "dataspace.identityhub.chart-version": arguments.identityhub_chart_version,
                "testlab.version": arguments.testlab_version,
            },
        )
        plan = build_plan(config, arguments.workspace.resolve(), arguments.namespace)
    except (ConfigError, yaml.YAMLError) as error:
        print(f"::error::Developer toolbox configuration: {error}", file=sys.stderr)
        return 1

    out = arguments.out_dir
    out.mkdir(parents=True, exist_ok=True)
    (out / "plan.json").write_text(json.dumps(plan, indent=2) + "\n")
    (out / "participants.values.yaml").write_text(
        yaml.safe_dump(render_values(plan, config.get("dataspace") or {}), sort_keys=False, width=200)
    )
    (out / "hosts.txt").write_text("\n".join(plan["hosts"]) + "\n")
    if arguments.signing_key and arguments.signing_public_key:
        (out / "vault-secrets.values.yaml").write_text(
            yaml.safe_dump(
                render_vault_secrets(
                    plan,
                    arguments.signing_key.read_text().strip(),
                    arguments.signing_public_key.read_text().strip(),
                ),
                width=10_000,
            )
        )
    versions = plan["versions"]
    (out / "toolbox.env").write_text(
        "".join(
            f"{key}={value}\n"
            for key, value in (
                ("UMBRELLA_CHART_VERSION", versions["umbrella_chart"]),
                ("UMBRELLA_VALUES_REF", versions["umbrella_profile_ref"]),
                ("IDENTITYHUB_CHART_VERSION", versions["identityhub_chart"]),
                ("TESTLAB_VERSION", versions["testlab"]),
                ("STUB_CALLER_URL", plan["stand_in_urls"]["stub_caller"]),
                ("SUBMODEL_SERVER_URL", plan["stand_in_urls"]["submodel_server"]),
            )
        )
    )

    for participant in plan["participants"]:
        runs = (
            "external" if participant["external"]
            else ", ".join(
                ["wallet"] + (["connector"] if participant["connector"] else []) + (["DTR"] if participant["dtr"] else [])
            )
        )
        print(f"{participant['name']:<20} {participant['bpn']}  {participant['did']}  ({runs})")
    testlab = plan["testlab"]
    print(f"TestLab {testlab['version'] or '(not installed)'}: sut={testlab['sut']} engine={testlab['engine']}")
    print(f"Umbrella {versions['umbrella_chart']}, IdentityHub {versions['identityhub_chart']}, DSP {versions['dsp']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
