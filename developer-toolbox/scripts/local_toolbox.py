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

"""Run the developer toolbox on your own machine, in Docker.

The dataspace the GitHub action brings up, from the same configuration, in a
kind cluster on your Docker:

  ./developer-toolbox/toolbox up [--config my-toolbox.yaml]
  ./developer-toolbox/toolbox info
  ./developer-toolbox/toolbox kubectl get pods -A
  ./developer-toolbox/toolbox down

Everything it creates is in one place: the kind cluster, a kubeconfig of its
own (your current kubectl context is never used or changed), a block in
/etc/hosts between markers, and a state folder under ~/.tractusx-developer-toolbox.
`down` removes all of it.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import http.server
import io
import json
import os
import pathlib
import platform
import re
import shlex
import shutil
import socket
import socketserver
import stat
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
from collections.abc import Iterator

import httpx
import yaml

SCRIPTS = pathlib.Path(__file__).resolve().parent
TOOLBOX_DIR = SCRIPTS.parent
HOME = pathlib.Path(os.environ.get("TOOLBOX_HOME", pathlib.Path.home() / ".tractusx-developer-toolbox"))
DEFAULT_NAME = os.environ.get("TOOLBOX_NAME", "tractusx-toolbox")
HOSTS_FILE = pathlib.Path("/etc/hosts")
HELM_REPO = "https://eclipse-tractusx.github.io/charts/dev"
IDENTITYHUB_RELEASES = "https://github.com/eclipse-tractusx/tractusx-identityhub/releases/download"
PROFILE_URL = (
    "https://raw.githubusercontent.com/eclipse-tractusx/tractus-x-umbrella/{ref}"
    "/charts/umbrella/values-adopter-decentralized-identityhub.yaml"
)
INGRESS_MANIFEST = (
    "https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml"
)
SUPER_USER_KEY = re.compile(r"Please take note of the API Key: *([A-Za-z0-9+/=.]*)")

sys.path.insert(0, str(SCRIPTS))


class ToolboxError(Exception):
    """A failure the user can act on; printed without a traceback."""


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

_COLOUR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def _paint(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _COLOUR else text


def step(text: str) -> None:
    print(f"\n{_paint('1;36', '==>')} {_paint('1', text)}", flush=True)


def note(text: str) -> None:
    print(f"    {text}", flush=True)


def warn(text: str) -> None:
    print(f"{_paint('33', 'warning:')} {text}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# Settings: the action's own defaults, so local and CI pin the same tools
# ---------------------------------------------------------------------------


def action_defaults() -> dict[str, str]:
    inputs = yaml.safe_load((TOOLBOX_DIR / "action.yml").read_text())["inputs"]
    return {name: str(spec.get("default", "")) for name, spec in inputs.items()}


class Toolbox:
    """One local dataspace: its cluster, its kubeconfig and its state folder."""

    def __init__(self, name: str, namespace: str | None = None) -> None:
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,30}", name):
            raise ToolboxError(f"'{name}' is not a usable name: lower case letters, digits and '-'.")
        self.name = name
        self.state = HOME / "dataspaces" / name
        self.kubeconfig = self.state / "kubeconfig"
        self.bin = HOME / "bin"
        self.defaults = action_defaults()
        settings = self._settings()
        self.namespace = namespace or settings.get("namespace") or self.defaults["namespace"]

    # --- state ---------------------------------------------------------------

    def _settings(self) -> dict:
        path = self.state / "toolbox.json"
        return json.loads(path.read_text()) if path.exists() else {}

    def save_settings(self, **settings: str) -> None:
        self.state.mkdir(parents=True, exist_ok=True)
        (self.state / "toolbox.json").write_text(json.dumps({**self._settings(), **settings}, indent=2) + "\n")

    @property
    def plan(self) -> dict:
        path = self.state / "plan.json"
        if not path.exists():
            raise ToolboxError(f"No dataspace '{self.name}' here. Start one with `toolbox up`.")
        return json.loads(path.read_text())

    @property
    def hosts(self) -> list[str]:
        return (self.state / "hosts.txt").read_text().split()

    @property
    def node(self) -> str:
        return f"{self.name}-control-plane"

    # --- processes -----------------------------------------------------------

    def env(self) -> dict[str, str]:
        """The environment every child process runs in: the toolbox's own
        kubeconfig, the downloaded tools first on PATH."""
        env = dict(os.environ)
        env["KUBECONFIG"] = str(self.kubeconfig)
        env["PATH"] = os.pathsep.join((str(self.bin), str(pathlib.Path(sys.executable).parent), env.get("PATH", "")))
        return env

    def run(self, *command: str, capture: bool = False, check: bool = True, quiet: bool = False,
            stdin: str | None = None) -> subprocess.CompletedProcess:
        if not quiet:
            note(_paint("2", "+ " + self.shown(command)))
        result = subprocess.run(
            list(command), env=self.env(), text=True, input=stdin,
            stdout=subprocess.PIPE if capture else None,
            stderr=subprocess.PIPE if capture else None,
        )
        if check and result.returncode != 0:
            detail = (result.stderr or "").strip() if capture else ""
            raise ToolboxError(f"`{shlex.join(command[:3])} …` failed (exit {result.returncode}). {detail}".strip())
        return result

    def shown(self, command: tuple[str, ...]) -> str:
        """The command as it is printed: the long paths shortened."""
        text = shlex.join(command)
        for path, short in ((sys.executable, "python"), (str(SCRIPTS) + "/", ""),
                            (str(self.state), "$STATE"), (str(TOOLBOX_DIR) + "/", "")):
            text = text.replace(path, short)
        return text

    def kubectl(self, *arguments: str, **options) -> subprocess.CompletedProcess:
        return self.run("kubectl", *arguments, **options)

    def python(self, script: str, *arguments: str, **options) -> subprocess.CompletedProcess:
        return self.run(sys.executable, str(SCRIPTS / script), *arguments, **options)

    def cluster_exists(self) -> bool:
        if not shutil.which("kind", path=self.env()["PATH"]):
            return False
        clusters = self.run("kind", "get", "clusters", capture=True, check=False, quiet=True).stdout.split()
        return self.name in clusters


# ---------------------------------------------------------------------------
# Tools: the ones on PATH, or the action's pinned versions, downloaded once
# ---------------------------------------------------------------------------


def _platform() -> tuple[str, str]:
    system = platform.system().lower()
    if system not in ("linux", "darwin"):
        raise ToolboxError(f"{platform.system()} is not supported; on Windows, run the toolbox in WSL 2.")
    machine = platform.machine().lower()
    arch = {"x86_64": "amd64", "amd64": "amd64", "arm64": "arm64", "aarch64": "arm64"}.get(machine)
    if arch is None:
        raise ToolboxError(f"No downloads for the {machine} architecture.")
    return system, arch


def _download(url: str) -> bytes:
    response = httpx.get(url, follow_redirects=True, timeout=300)
    response.raise_for_status()
    return response.content


def _verified(url: str, checksum_url: str) -> bytes:
    payload = _download(url)
    expected = _download(checksum_url).decode().split()[0].strip().lower()
    actual = hashlib.sha256(payload).hexdigest()
    if actual != expected:
        raise ToolboxError(f"Checksum mismatch for {url}: expected {expected}, got {actual}.")
    return payload


def ensure_tools(toolbox: Toolbox, needed: tuple[str, ...]) -> None:
    """Every tool in `needed` is on the toolbox's PATH afterwards."""
    path = toolbox.env()["PATH"]
    if "docker" in needed and not shutil.which("docker", path=path):
        raise ToolboxError("Docker is not installed. Install Docker Desktop, Rancher Desktop, Colima or Docker Engine.")
    if "openssl" in needed and not shutil.which("openssl", path=path):
        raise ToolboxError("openssl is not installed.")
    system, arch = _platform()
    versions = toolbox.defaults
    sources = {
        "kind": lambda: _verified(
            f"https://github.com/kubernetes-sigs/kind/releases/download/{versions['kind-version']}/kind-{system}-{arch}",
            f"https://github.com/kubernetes-sigs/kind/releases/download/{versions['kind-version']}/kind-{system}-{arch}.sha256sum",
        ),
        "kubectl": lambda: _verified(
            f"https://dl.k8s.io/release/{versions['kubectl-version']}/bin/{system}/{arch}/kubectl",
            f"https://dl.k8s.io/release/{versions['kubectl-version']}/bin/{system}/{arch}/kubectl.sha256",
        ),
        "helm": lambda: _helm_binary(versions["helm-version"], system, arch),
    }
    for tool in needed:
        if tool not in sources or shutil.which(tool, path=path):
            continue
        step(f"Downloading {tool} (not on your PATH)")
        toolbox.bin.mkdir(parents=True, exist_ok=True)
        target = toolbox.bin / tool
        target.write_bytes(sources[tool]())
        target.chmod(target.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        note(f"{target}")


def _helm_binary(version: str, system: str, arch: str) -> bytes:
    archive = f"https://get.helm.sh/helm-v{version.lstrip('v')}-{system}-{arch}.tar.gz"
    payload = _verified(archive, archive + ".sha256sum")
    with tarfile.open(fileobj=io.BytesIO(payload)) as tar:
        member = tar.extractfile(f"{system}-{arch}/helm")
        if member is None:
            raise ToolboxError(f"No helm binary in {archive}.")
        return member.read()


def memory_wanted(plan: dict) -> float:
    """About how many GB the dataspace needs. Measured on Docker Desktop:
    two connectors without a registry run in 2.6 GB and fit a 4.2 GB cap; with
    a registry and the stand-ins they do not fit 4.2 GB."""
    deployed = [participant for participant in plan["participants"] if participant["deployed"]]
    connectors = sum(1 for participant in deployed if participant["connector"])
    registries = sum(1 for participant in deployed if participant["dtr"])
    return 1.5 + 1.25 * connectors + 1.5 * registries + 0.25 * len(plan["applications"])


def _gigabytes(size: str) -> float | None:
    match = re.fullmatch(r"(\d+(?:\.\d+)?)([kmg]?)b?", size.strip().lower())
    if not match:
        return None
    return float(match[1]) / {"": 2**30, "k": 2**20, "m": 2**10, "g": 1}[match[2]]


def oom_kills(toolbox: Toolbox) -> int:
    """How often the kernel stopped a process in the cluster for lack of memory."""
    result = toolbox.run("docker", "exec", toolbox.node, "cat", "/sys/fs/cgroup/memory.events",
                         capture=True, check=False, quiet=True)
    for line in result.stdout.splitlines():
        key, _, value = line.partition(" ")
        if key == "oom_kill":
            return int(value)
    return 0


def require_docker(toolbox: Toolbox, cap: str) -> None:
    result = toolbox.run("docker", "info", "--format", "{{.MemTotal}} {{.NCPU}}", capture=True, check=False, quiet=True)
    if result.returncode != 0:
        raise ToolboxError("Docker is not running. Start it (Docker Desktop: `open -a Docker`) and try again.")
    memory, cpus = (int(value) for value in result.stdout.split())
    note(f"Docker: {cpus} CPUs, {memory / 2**30:.1f} GB memory.")
    gigabytes = memory / 2**30
    limit = "Docker"
    if cap:
        capped = _gigabytes(cap)
        if capped is None:
            raise ToolboxError(f"--memory {cap}: give it as Docker takes it, for example 6g or 4500m.")
        gigabytes, limit = min(gigabytes, capped), "the --memory cap"
    wanted = memory_wanted(toolbox.plan)
    if gigabytes < wanted:
        warn(f"This dataspace wants about {wanted:.1f} GB and {limit} allows {gigabytes:.1f} GB. "
             "Allow more, stop other containers, or start fewer participants "
             "(examples/minimal.yaml is the smallest).")


# ---------------------------------------------------------------------------
# Host names: /etc/hosts for you, an in-process override for this command
# ---------------------------------------------------------------------------


def _markers(name: str) -> tuple[str, str]:
    return (f"# >>> tractusx-developer-toolbox {name} >>>", f"# <<< tractusx-developer-toolbox {name} <<<")


def hosts_block(name: str, hosts: list[str]) -> str:
    begin, end = _markers(name)
    return "\n".join([begin, *(f"127.0.0.1 {host}" for host in hosts), end]) + "\n"


def without_block(text: str, name: str) -> str:
    begin, end = _markers(name)
    pattern = re.compile(rf"\n?{re.escape(begin)}\n.*?{re.escape(end)}\n?", re.DOTALL)
    return pattern.sub("\n", text).rstrip("\n") + "\n"


def _write_hosts(content: str) -> bool:
    """Replace /etc/hosts with `content` through sudo. False when sudo is not
    possible here (no terminal to ask for the password in, or declined)."""
    if shutil.which("sudo") is None:
        return False
    if subprocess.run(["sudo", "-n", "true"], capture_output=True).returncode != 0 and not sys.stdin.isatty():
        return False
    with tempfile.NamedTemporaryFile("w", delete=False, prefix="hosts.") as staged:
        staged.write(content)
    try:
        note("sudo is asked to update /etc/hosts.")
        # `cat >` keeps the file's inode, owner and mode, which some resolvers watch.
        result = subprocess.run(["sudo", "sh", "-c", f'cat "{staged.name}" > /etc/hosts'])
        return result.returncode == 0
    finally:
        os.unlink(staged.name)


def add_hosts(toolbox: Toolbox) -> bool:
    current = HOSTS_FILE.read_text()
    wanted = without_block(current, toolbox.name) + hosts_block(toolbox.name, toolbox.hosts)
    if wanted == current:
        note("/etc/hosts already has the dataspace hostnames.")
        return True
    if _write_hosts(wanted):
        note(f"Added {len(toolbox.hosts)} hostnames to /etc/hosts.")
        return True
    return False


def remove_hosts(toolbox_name: str) -> None:
    current = HOSTS_FILE.read_text()
    if _markers(toolbox_name)[0] not in current:
        return
    if _write_hosts(without_block(current, toolbox_name)):
        note("Removed the dataspace hostnames from /etc/hosts.")
    else:
        warn(f"Could not edit /etc/hosts; remove the '{_markers(toolbox_name)[0]}' block yourself.")


def resolves_locally(host: str) -> bool:
    with contextlib.suppress(OSError):
        return all(info[4][0] in ("127.0.0.1", "::1") for info in socket.getaddrinfo(host, 80))
    return False


@contextlib.contextmanager
def pinned_hosts(hosts: list[str]) -> Iterator[None]:
    """Resolve the dataspace hostnames to the loopback in this process only,
    so the bring-up works before (or without) /etc/hosts."""
    original = socket.getaddrinfo
    names = set(hosts)

    def getaddrinfo(host, *arguments, **keywords):
        if isinstance(host, str) and host in names:
            host = "127.0.0.1"
        return original(host, *arguments, **keywords)

    socket.getaddrinfo = getaddrinfo
    try:
        yield
    finally:
        socket.getaddrinfo = original


# ---------------------------------------------------------------------------
# up
# ---------------------------------------------------------------------------


def render(toolbox: Toolbox, arguments: argparse.Namespace) -> dict:
    """Read the configuration, render and validate the Umbrella release."""
    out = toolbox.state
    out.mkdir(parents=True, exist_ok=True)
    step("Reading the configuration")
    config = ["--config", str(arguments.config.resolve())] if arguments.config else []
    toolbox.run("openssl", "genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048",
                "-out", str(out / "signing.key"), quiet=True, capture=True)
    toolbox.run("openssl", "pkey", "-in", str(out / "signing.key"), "-pubout", "-out", str(out / "signing.pub"),
                quiet=True, capture=True)
    try:
        toolbox.python(
            "render_toolbox.py", *config,
            "--out-dir", str(out), "--namespace", toolbox.namespace,
            "--workspace", str(arguments.workspace.resolve()),
            "--umbrella-chart-version", arguments.umbrella_chart_version,
            "--umbrella-values-ref", arguments.umbrella_values_ref,
            "--identityhub-chart-version", arguments.identityhub_chart_version,
            "--testlab-version", arguments.testlab_version,
            "--signing-key", str(out / "signing.key"), "--signing-public-key", str(out / "signing.pub"),
        )
    finally:
        (out / "signing.key").unlink(missing_ok=True)
    plan = toolbox.plan
    versions = plan["versions"]
    for participant in plan["participants"]:
        parts = [part for part, on in (("connector", participant["connector"]), ("dtr", participant["dtr"])) if on]
        where = "external" if not participant["deployed"] else ", ".join(["wallet", *parts])
        note(f"{participant['name']:<12} {participant['bpn']}  {where}")

    step(f"Rendering Umbrella {versions['umbrella_chart']} with IdentityHub {versions['identityhub_chart']}")
    chart_dir = out / "umbrella"
    shutil.rmtree(chart_dir, ignore_errors=True)
    toolbox.run("helm", "pull", "umbrella", "--repo", HELM_REPO, "--version", versions["umbrella_chart"],
                "--untar", "--untardir", str(out))
    identity_charts = out / "identityhub-charts"
    shutil.rmtree(identity_charts, ignore_errors=True)
    identity_charts.mkdir()
    for chart in ("tractusx-identityhub-memory", "tractusx-issuerservice"):
        release = f"{chart}-{versions['identityhub_chart']}"
        payload = _download(f"{IDENTITYHUB_RELEASES}/{release}/{release}.tgz")
        with tarfile.open(fileobj=io.BytesIO(payload)) as tar:
            try:
                tar.extractall(identity_charts, filter="data")
            except TypeError:  # Python < 3.10.12 has no extraction filters
                tar.extractall(identity_charts)  # noqa: S202 - a release asset of a pinned version
    toolbox.python(
        "prepare_chart.py", "--chart-dir", str(chart_dir), "--identity-charts", str(identity_charts),
        "--identityhub-version", versions["identityhub_chart"], "--plan", str(out / "plan.json"),
        "--disabled-values", str(out / "disabled.values.yaml"),
    )
    values = release_values(toolbox, plan, arguments.extra_values)
    rendered = toolbox.run("helm", "template", "umbrella", str(chart_dir), "--namespace", toolbox.namespace,
                           *values, capture=True).stdout
    (out / "umbrella-rendered.yaml").write_text(rendered)
    toolbox.python("validate_manifest.py", "--plan", str(out / "plan.json"),
                   "--manifest", str(out / "umbrella-rendered.yaml"))
    toolbox.save_settings(namespace=toolbox.namespace, extra_values=str(arguments.extra_values or ""))
    return plan


def release_values(toolbox: Toolbox, plan: dict, extra: pathlib.Path | None) -> list[str]:
    out = toolbox.state
    files = [
        PROFILE_URL.format(ref=plan["versions"]["umbrella_profile_ref"]),
        str(TOOLBOX_DIR / "values" / "umbrella.values.yaml"),
        str(out / "disabled.values.yaml"),
        str(out / "participants.values.yaml"),
        str(out / "vault-secrets.values.yaml"),
    ]
    if extra:
        files.append(str(extra.resolve()))
    return [argument for file in files for argument in ("-f", file)]


def install_testlab(version: str) -> None:
    if not version:
        return
    step(f"Installing TestLab {version}")
    installed = subprocess.run([sys.executable, "-m", "pip", "show", "tractusx-testlab"],
                               capture_output=True, text=True).stdout
    if f"Version: {version}\n" in installed:
        note("Already installed.")
        return
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", f"tractusx-testlab=={version}"], check=True)


def create_cluster(toolbox: Toolbox, node_image: str, memory: str) -> None:
    step(f"Creating the kind cluster '{toolbox.name}'")
    for port in (80, 443):
        with contextlib.suppress(OSError), socket.create_connection(("127.0.0.1", port), timeout=1):
            raise ToolboxError(
                f"Something on this machine already listens on port {port}, which the dataspace's ingress needs. "
                "Stop it (another toolbox: `toolbox down`), then try again."
            )
    toolbox.run("kind", "create", "cluster", "--name", toolbox.name, "--image", node_image,
                "--config", str(TOOLBOX_DIR / "values" / "kind-config.yaml"),
                "--kubeconfig", str(toolbox.kubeconfig), "--wait", "5m")
    if memory:
        # The whole cluster is one container: a cap here keeps the dataspace
        # from taking memory your other containers use. Past it, the kernel
        # stops pods inside the node, not containers outside it.
        toolbox.run("docker", "update", "--memory", memory, "--memory-swap", memory, toolbox.node, capture=True)
        note(f"The cluster may use at most {memory} of memory.")

    step("Installing ingress-nginx")
    toolbox.kubectl("apply", "-f", INGRESS_MANIFEST, capture=True)
    toolbox.kubectl("wait", "--namespace", "ingress-nginx", "--for=condition=ready", "pod",
                    "--selector=app.kubernetes.io/component=controller", "--timeout=300s")
    # The IdentityHub, data-plane and IssuerService ingresses name no class.
    toolbox.kubectl("patch", "ingressclass", "nginx", "-p",
                    '{"metadata":{"annotations":{"ingressclass.kubernetes.io/is-default-class":"true"}}}')

    step("Resolving the dataspace hostnames inside the cluster")
    toolbox.python("patch_coredns.py", "--hosts-file", str(toolbox.state / "hosts.txt"), capture=True)


def preload_images(toolbox: Toolbox) -> None:
    """Pull the release's images inside the node, four at a time; best effort
    (a miss is pulled by the kubelet). See action.yml for why not `kind load`."""
    step("Pulling the release's images into the node")
    rendered = (toolbox.state / "umbrella-rendered.yaml").read_text()
    images = sorted({match.strip().strip('"') for match in re.findall(r"^\s*-?\s*image:\s*(\S+)\s*$", rendered, re.M)})
    lock = threading.Lock()
    queue = list(images)

    def worker() -> None:
        while True:
            with lock:
                if not queue:
                    return
                image = queue.pop()
            result = subprocess.run(
                ["docker", "exec", toolbox.node, "crictl", "--runtime-endpoint",
                 "unix:///run/containerd/containerd.sock", "pull", image],
                capture_output=True, env=toolbox.env(),
            )
            note(("pulled   " if result.returncode == 0 else "skipped  ") + image)

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()


def install_release(toolbox: Toolbox, plan: dict, timeout: str) -> None:
    step(f"Installing the dataspace (helm, waits up to {timeout})")
    done = threading.Event()

    def watch() -> None:
        # What is still outstanding, every 30 s, and the IdentityHub /
        # IssuerService wedge the action also cures (restart_wedged_runtimes.py).
        while not done.wait(30):
            pods = toolbox.kubectl("get", "pods", "-n", toolbox.namespace, "-o", "json",
                                   capture=True, check=False, quiet=True)
            with contextlib.suppress(ValueError):
                waiting = [
                    pod["metadata"]["name"] for pod in json.loads(pods.stdout)["items"]
                    if pod["status"].get("phase") != "Succeeded"
                    and not all(c.get("ready") for c in pod["status"].get("containerStatuses", []) or [{}])
                ]
                note(f"{time.strftime('%H:%M:%S')} waiting on {len(waiting)} pods: {', '.join(sorted(waiting)[:6])}"
                     + (" …" if len(waiting) > 6 else ""))
            toolbox.python("restart_wedged_runtimes.py", "--namespace", toolbox.namespace,
                           "--state-dir", str(toolbox.state / "wedged-runtimes"),
                           "--grace-seconds", "120", "--max-restarts", "2", check=False, quiet=True, capture=True)

    watcher = threading.Thread(target=watch, daemon=True)
    watcher.start()
    try:
        extra = toolbox._settings().get("extra_values") or None
        toolbox.run(
            "helm", "install", "umbrella", str(toolbox.state / "umbrella"),
            "--namespace", toolbox.namespace, "--create-namespace",
            *release_values(toolbox, plan, pathlib.Path(extra) if extra else None),
            "--burst-limit", "400", "--qps", "200", "--timeout", timeout, "--wait",
        )
    except ToolboxError as error:
        kills = oom_kills(toolbox)
        if kills:
            raise ToolboxError(
                f"{error} The cluster ran out of memory: the kernel stopped {kills} processes in it. "
                f"This dataspace wants about {memory_wanted(plan):.1f} GB; give Docker (or --memory) more, "
                "or start fewer participants. `toolbox down` removes this one."
            ) from error
        raise
    finally:
        done.set()


def deploy_stand_ins(toolbox: Toolbox, plan: dict) -> None:
    stand_ins = plan["stand_ins"]
    ns = toolbox.namespace
    if stand_ins["echo"]:
        step("Deploying the echo backend")
        toolbox.kubectl("run", "tck-echo", "--image=traefik/whoami:v1.10", "--namespace", ns, "--port=80")
        toolbox.kubectl("expose", "pod/tck-echo", "--namespace", ns, "--port=80", "--name=tck-echo")
        toolbox.kubectl("wait", "--namespace", ns, "--for=condition=ready", "pod/tck-echo", "--timeout=120s")
    for key, name, script, manifest in (
        ("stub_caller", "tck-stub", "stub_caller.py", "stub-caller"),
        ("submodel_server", "tck-submodel", "submodel_server.py", "submodel-server"),
    ):
        if not stand_ins[key]:
            continue
        step(f"Deploying the {manifest.replace('-', ' ')}")
        toolbox.kubectl("create", "configmap", name, "--namespace", ns, f"--from-file={script}={SCRIPTS / script}")
        documents = (TOOLBOX_DIR / "values" / "stand-ins" / f"{manifest}.yaml").read_text()
        documents = re.sub(r"(?m)^  namespace: umbrella$", f"  namespace: {ns}", documents)
        toolbox.kubectl("apply", "-f", "-", stdin=documents)
        toolbox.kubectl("wait", "--namespace", ns, "--for=condition=ready", f"pod/{name}", "--timeout=180s")


def issue_credentials(toolbox: Toolbox) -> None:
    step("Issuing the participants' credentials")
    key = ""
    for _ in range(30):
        logs = toolbox.kubectl("logs", "-n", toolbox.namespace, "deployment/umbrella-issuerservice", "--tail=-1",
                               capture=True, check=False, quiet=True).stdout
        found = SUPER_USER_KEY.findall(logs)
        if found and found[-1]:
            key = found[-1]
            break
        time.sleep(5)
    if not key:
        raise ToolboxError("Could not find the IssuerService super-user API key in its log.")
    import issue_credentials as issuing  # noqa: PLC0415 - needs the pinned hosts

    status = issuing.main(["--plan", str(toolbox.state / "plan.json"),
                           "--issuer-url", "http://issuerservice.local", "--super-user-key", key])
    if status:
        raise ToolboxError("Credential issuance failed; see above.")


def host_address(toolbox: Toolbox) -> str:
    """The address pods reach this machine on: Docker Desktop's
    host.docker.internal where there is one, else the node's bridge gateway."""
    lookup = toolbox.run("docker", "exec", toolbox.node, "getent", "ahostsv4", "host.docker.internal",
                         capture=True, check=False, quiet=True)
    if lookup.returncode == 0 and lookup.stdout.split():
        return lookup.stdout.split()[0]
    gateway = toolbox.run("docker", "inspect", toolbox.node, "-f",
                          "{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}", capture=True, quiet=True)
    return gateway.stdout.strip()


def write_outputs(toolbox: Toolbox, mock_port: str) -> str:
    step("Writing the variables file")
    mock_url = f"http://{host_address(toolbox)}:{mock_port}"
    toolbox.python("toolbox_outputs.py", "--plan", str(toolbox.state / "plan.json"),
                   "--out-dir", str(toolbox.state), "--mock-server-url", mock_url, capture=True)
    toolbox.save_settings(mock_server_url=mock_url)
    return mock_url


def preflight(toolbox: Toolbox, plan: dict, mock_url: str) -> None:
    step("Checking that everything answers")
    query = {"@context": {"edc": "https://w3id.org/edc/v0.0.1/ns/"}, "@type": "QuerySpec", "offset": 0, "limit": 1}
    with httpx.Client(timeout=30) as client:
        for record in json.loads((toolbox.state / "participants.json").read_text()):
            if record["external"]:
                continue
            connector = record["connector"] or {}
            if connector:
                response = client.post(f"{connector['management_url']}/v3/assets/request", json=query,
                                       headers={"X-Api-Key": connector["api_key"]})
                if response.status_code != 200:
                    raise ToolboxError(f"{record['name']}'s management API answered {response.status_code}.")
                note(f"{record['name']:<12} connector answers")
            dtr = record["dtr"] or {}
            if dtr:
                response = client.get(f"{dtr['base_url']}/api/v3/shell-descriptors", follow_redirects=True)
                if response.status_code != 200:
                    raise ToolboxError(f"{record['name']}'s registry answered {response.status_code}: "
                                       f"{response.text[:300]}")
                note(f"{record['name']:<12} registry answers")
        for name, key in (("stub caller", "stub_caller"), ("submodel server", "submodel_server")):
            url = plan["stand_in_urls"].get(key)
            if url and plan["stand_ins"][key]:
                if client.get(f"{url}/health").status_code != 200:
                    raise ToolboxError(f"The {name} does not answer at {url}.")
                note(f"{name:<12} answers")

    # Pods reach this machine where TestLab's mock server listens. Only tests
    # with inbound calls need it, so a miss is a warning here, not a failure.
    port = int(mock_url.rsplit(":", 1)[1])
    try:
        server = socketserver.TCPServer(("0.0.0.0", port), _Empty)  # noqa: S104 - where TestLab listens
    except OSError:
        note(f"Port {port} is in use here; skipped the check that pods reach it.")
        return
    with server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            status = toolbox.run("bash", str(SCRIPTS / "probe_from_pod.sh"), "tck-reach", toolbox.namespace,
                                 f"{mock_url}/", capture=True, check=False, quiet=True).stdout.strip()
        finally:
            server.shutdown()
    if status == "200":
        note(f"pods reach this machine at {mock_url}")
    else:
        warn(f"Pods could not reach this machine at {mock_url} (got '{status}'). Tests whose system under test "
             "calls TestLab's mock server will fail; a firewall is the usual cause.")


class _Empty(http.server.BaseHTTPRequestHandler):
    """Answers 200 with no body: a stand-in for the mock server that serves no files."""

    def do_GET(self) -> None:  # noqa: N802 - the http.server hook name
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, *arguments) -> None:
        pass


def command_up(arguments: argparse.Namespace) -> int:
    toolbox = Toolbox(arguments.name, arguments.namespace)
    ensure_tools(toolbox, ("docker", "openssl", "kind", "kubectl", "helm"))
    if toolbox.cluster_exists():
        raise ToolboxError(f"The dataspace '{toolbox.name}' is already up. `toolbox info` shows it; "
                           "`toolbox down` removes it.")
    shutil.rmtree(toolbox.state, ignore_errors=True)
    started = time.monotonic()
    plan = render(toolbox, arguments)
    require_docker(toolbox, arguments.memory)
    install_testlab(plan["versions"]["testlab"])

    create_cluster(toolbox, arguments.kind_node_image or toolbox.defaults["kind-node-image"], arguments.memory)
    step("Pointing the dataspace hostnames at this machine")
    hosts_ok = arguments.no_hosts is False and add_hosts(toolbox)
    if not hosts_ok:
        if not arguments.no_hosts:
            warn("Could not update /etc/hosts (sudo needs a terminal). The bring-up goes on; "
                 "`toolbox hosts` adds them later.")
        else:
            note("Skipped (--no-hosts). `toolbox hosts` adds them later.")
    toolbox.save_settings(hosts=str(hosts_ok).lower())

    with pinned_hosts(toolbox.hosts):
        preload_images(toolbox)
        install_release(toolbox, plan, arguments.helm_timeout or toolbox.defaults["helm-timeout"])
        deploy_stand_ins(toolbox, plan)
        if plan["applications"]:
            step("Deploying the applications")
            toolbox.python("deploy_applications.py", "--plan", str(toolbox.state / "plan.json"),
                           "--cluster", toolbox.name)
        issue_credentials(toolbox)
        mock_url = write_outputs(toolbox, arguments.mock_server_port or toolbox.defaults["mock-server-port"])
        preflight(toolbox, plan, mock_url)

    minutes, seconds = divmod(int(time.monotonic() - started), 60)
    step(f"The dataspace '{toolbox.name}' is up ({minutes}m{seconds:02d}s)")
    print_info(toolbox)
    return 0


# ---------------------------------------------------------------------------
# The other commands
# ---------------------------------------------------------------------------


def print_info(toolbox: Toolbox) -> None:
    participants = json.loads((toolbox.state / "participants.json").read_text())
    for record in participants:
        print(f"\n  {_paint('1', record['name'])}  {record['bpn']}{'  (external)' if record['external'] else ''}")
        print(f"    DID         {record['did']}")
        connector = record["connector"] or {}
        if connector:
            print(f"    management  {connector['management_url']}   X-Api-Key: {connector['api_key']}")
            print(f"    DSP         {connector['dsp_url']}")
        dtr = record["dtr"] or {}
        if dtr:
            print(f"    DTR         {dtr['base_url']}")
    settings = toolbox._settings()
    testlab = toolbox.plan["versions"]["testlab"]
    print()
    print(f"  variables   {toolbox.state / 'developer-toolbox.vars.yaml'}")
    print(f"  kubeconfig  {toolbox.kubeconfig}")
    if testlab:
        print(f"  TestLab     {testlab}: toolbox testlab run <tck> (adds --config with the variables file)")
    if settings.get("hosts") != "true":
        print(f"\n  {_paint('33', 'The hostnames are not in /etc/hosts yet:')} run `toolbox hosts`.")


def command_info(arguments: argparse.Namespace) -> int:
    toolbox = Toolbox(arguments.name)
    if arguments.variables_file:
        print(toolbox.state / "developer-toolbox.vars.yaml")
        return 0
    if arguments.json:
        print((toolbox.state / "participants.json").read_text())
        return 0
    if not (toolbox.state / "participants.json").exists():
        raise ToolboxError(f"The dataspace '{toolbox.name}' is not up. `toolbox up` starts it.")
    print_info(toolbox)
    return 0


def command_hosts(arguments: argparse.Namespace) -> int:
    toolbox = Toolbox(arguments.name)
    if arguments.print:
        print(hosts_block(toolbox.name, toolbox.hosts), end="")
        return 0
    if not add_hosts(toolbox):
        raise ToolboxError("Could not update /etc/hosts. Run this in a terminal (sudo asks for your password), "
                           "or add the lines `toolbox hosts --print` prints yourself.")
    toolbox.save_settings(hosts="true")
    return 0


def command_down(arguments: argparse.Namespace) -> int:
    toolbox = Toolbox(arguments.name)
    ensure_tools(toolbox, ("kind",))
    if toolbox.cluster_exists():
        step(f"Deleting the kind cluster '{toolbox.name}'")
        toolbox.run("kind", "delete", "cluster", "--name", toolbox.name, "--kubeconfig", str(toolbox.kubeconfig))
    else:
        note(f"No kind cluster '{toolbox.name}'.")
    remove_hosts(toolbox.name)
    shutil.rmtree(toolbox.state, ignore_errors=True)
    note("Done.")
    return 0


def command_status(arguments: argparse.Namespace) -> int:
    toolbox = Toolbox(arguments.name)
    if not toolbox.cluster_exists():
        raise ToolboxError(f"The dataspace '{toolbox.name}' is not up.")
    return toolbox.kubectl("get", "pods", "-n", toolbox.namespace, "-o", "wide", check=False, quiet=True).returncode


def command_passthrough(arguments: argparse.Namespace) -> int:
    toolbox = Toolbox(arguments.name)
    tool = arguments.command
    rest = list(arguments.arguments)
    if tool == "testlab":
        executable = pathlib.Path(sys.executable).parent / "testlab"
        if not executable.exists():
            raise ToolboxError("TestLab is not installed: set `testlab.version` in the configuration.")
        if rest[:1] == ["run"] and "--config" not in rest:
            rest += ["--config", str(toolbox.state / "developer-toolbox.vars.yaml")]
        tool = str(executable)
    else:
        ensure_tools(toolbox, (tool,))
    return subprocess.run([tool, *rest], env=toolbox.env()).returncode


def command_render(arguments: argparse.Namespace) -> int:
    toolbox = Toolbox(arguments.name, arguments.namespace)
    toolbox.state = HOME / "renders" / arguments.name
    ensure_tools(toolbox, ("openssl", "helm"))
    shutil.rmtree(toolbox.state, ignore_errors=True)
    render(toolbox, arguments)
    step("The configuration renders and validates")
    note(f"{toolbox.state}")
    return 0


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(
        prog="toolbox", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    commands = root.add_subparsers(dest="command", required=True, metavar="command")

    def add(name: str, help_text: str) -> argparse.ArgumentParser:
        command = commands.add_parser(name, help=help_text, description=help_text)
        command.add_argument("--name", default=DEFAULT_NAME, help=f"The dataspace's name (default: {DEFAULT_NAME}).")
        return command

    for name, help_text in (("up", "Start the dataspace."),
                            ("render", "Only read the configuration and render and validate the release.")):
        command = add(name, help_text)
        command.add_argument("--config", type=pathlib.Path, help="Your configuration, merged over toolbox.yaml.")
        command.add_argument("--workspace", type=pathlib.Path, default=pathlib.Path.cwd(),
                             help="The folder chart and values paths in the configuration are relative to "
                                  "(default: this one).")
        command.add_argument("--namespace", help="The Umbrella release's namespace (default: umbrella).")
        command.add_argument("--umbrella-chart-version", default="")
        command.add_argument("--umbrella-values-ref", default="")
        command.add_argument("--identityhub-chart-version", default="")
        command.add_argument("--testlab-version", default="", help='"none" installs no TestLab.')
        command.add_argument("--extra-values", type=pathlib.Path,
                             help="A Helm values file for the release, applied last.")
        if name == "up":
            command.add_argument("--no-hosts", action="store_true", help="Leave /etc/hosts alone.")
            command.add_argument("--helm-timeout", default="")
            command.add_argument("--mock-server-port", default="")
            command.add_argument("--kind-node-image", default="")
            command.add_argument("--memory", default="",
                                 help="Cap the cluster's memory, as Docker takes it (for example 6g).")
        command.set_defaults(handler=command_up if name == "up" else command_render)

    command = add("info", "Show the participants, their URLs and keys, and the files the toolbox wrote.")
    command.add_argument("--json", action="store_true", help="Print participants.json.")
    command.add_argument("--variables-file", action="store_true", help="Print only the variables file's path.")
    command.set_defaults(handler=command_info)

    command = add("hosts", "Add the dataspace hostnames to /etc/hosts (asks sudo).")
    command.add_argument("--print", action="store_true", help="Only print the lines.")
    command.set_defaults(handler=command_hosts)

    add("status", "Show the dataspace's pods.").set_defaults(handler=command_status)
    add("down", "Delete the cluster, the /etc/hosts lines and the state.").set_defaults(handler=command_down)

    for tool in PASSTHROUGH:
        commands.add_parser(tool, help=f"Run {tool} against the dataspace (its own kubeconfig). "
                                       "Every argument goes to it; TOOLBOX_NAME picks the dataspace.")
    return root


PASSTHROUGH = ("kubectl", "helm", "testlab")


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] and argv[0] in PASSTHROUGH:
        # Not through argparse: `toolbox kubectl -n umbrella get pods` must
        # reach kubectl as typed.
        arguments = argparse.Namespace(name=DEFAULT_NAME, command=argv[0], arguments=argv[1:],
                                       handler=command_passthrough)
    else:
        arguments = parser().parse_args(argv)
    try:
        return arguments.handler(arguments)
    except ToolboxError as error:
        print(f"{_paint('31', 'error:')} {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nInterrupted. `toolbox down` removes what was created.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
