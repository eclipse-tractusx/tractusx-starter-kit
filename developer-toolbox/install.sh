#!/usr/bin/env bash
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

# Install the `tx-toolbox` command: the Eclipse Tractus-X Developer Toolbox
# from any folder.
#
#   curl -fsSL https://raw.githubusercontent.com/eclipse-tractusx/tractusx-starter-kit/main/developer-toolbox/install.sh | bash
#   ./developer-toolbox/install.sh          # from a clone: the command runs this clone
#
# Options (or the environment variable in brackets):
#   --ref REF        the branch, tag or commit to download (TX_TOOLBOX_REF, default main)
#   --repo OWNER/REPO                                       (TX_TOOLBOX_REPO)
#   --bin DIR        where the command goes (TX_TOOLBOX_BIN, default ~/.local/bin)
#   --download       download even when run from a clone
#
# The toolbox itself goes into ${TOOLBOX_HOME:-~/.tractusx-developer-toolbox}/cli.
# `tx-toolbox update` installs the newest version of the same ref,
# `tx-toolbox uninstall` removes the command again.
set -euo pipefail

repo="${TX_TOOLBOX_REPO:-eclipse-tractusx/tractusx-starter-kit}"
ref="${TX_TOOLBOX_REF:-main}"
bin_dir="${TX_TOOLBOX_BIN:-${HOME}/.local/bin}"
home="${TOOLBOX_HOME:-${HOME}/.tractusx-developer-toolbox}"
download=""

usage() {
  if [ -f "${BASH_SOURCE[0]:-}" ]; then sed -n '/^# Install the/,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d; s/^# \{0,1\}//'
  else echo "Options: --ref REF, --repo OWNER/REPO, --bin DIR, --download"; fi
}
fail() { echo "error: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --ref) [ $# -ge 2 ] || fail "--ref needs a value"; ref="$2"; download=1; shift 2 ;;
    --repo) [ $# -ge 2 ] || fail "--repo needs a value"; repo="$2"; download=1; shift 2 ;;
    --bin) [ $# -ge 2 ] || fail "--bin needs a value"; bin_dir="$2"; shift 2 ;;
    --download) download=1; shift ;;
    -h | --help) usage; exit 0 ;;
    *) fail "unknown option '$1' (see --help)" ;;
  esac
done

[[ "${repo}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail "'${repo}' is not OWNER/REPO."
[[ "${ref}" =~ ^[A-Za-z0-9_./-]+$ ]] || fail "'${ref}' is not a usable branch, tag or commit."

# Run from a clone (not piped into bash), the command runs that clone, so
# your own changes to the toolbox take effect at once.
here=""
if [ -z "${download}" ] && [ -f "${BASH_SOURCE[0]:-}" ]; then
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  [ -x "${here}/toolbox" ] && [ -f "${here}/scripts/local_toolbox.py" ] || here=""
fi

cli_home="${home}/cli"
mkdir -p "${cli_home}" "${bin_dir}"

if [ -n "${here}" ]; then
  kit="${here}"
  commit="$(git -C "${here}" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  source_text="the clone in ${here%/developer-toolbox}"
else
  command -v curl >/dev/null 2>&1 || fail "curl is needed to download the toolbox."
  command -v tar >/dev/null 2>&1 || fail "tar is needed to unpack the toolbox."
  work="$(mktemp -d "${cli_home}/.download.XXXXXX")"
  trap 'rm -rf "${work}"' EXIT
  echo "Downloading the Developer Toolbox (${repo}@${ref}) …" >&2
  curl -fsSL --retry 3 "https://github.com/${repo}/archive/${ref}.tar.gz" -o "${work}/kit.tar.gz" \
    || fail "could not download ${repo}@${ref}."
  commit="$( (gzip -dc "${work}/kit.tar.gz" | git get-tar-commit-id) 2>/dev/null | cut -c1-7 || true)"
  tar -xzf "${work}/kit.tar.gz" -C "${work}"
  unpacked="$(find "${work}" -mindepth 2 -maxdepth 2 -type d -name developer-toolbox | head -n 1)"
  [ -n "${unpacked}" ] && [ -x "${unpacked}/toolbox" ] || fail "${repo}@${ref} has no developer-toolbox/toolbox."
  rm -rf "${cli_home}/kit.old"
  [ ! -e "${cli_home}/kit" ] || mv "${cli_home}/kit" "${cli_home}/kit.old"
  mv "${unpacked}" "${cli_home}/kit"
  rm -rf "${cli_home}/kit.old"
  kit="${cli_home}/kit"
  source_text="${repo}@${ref}"
fi

# What the command was installed from: `tx-toolbox version` prints it,
# `tx-toolbox update` installs from it again.
{
  printf 'kit=%q\n' "${kit}"
  printf 'linked=%q\n' "${here:+1}"
  printf 'repo=%q\n' "${repo}"
  printf 'ref=%q\n' "${ref}"
  printf 'commit=%q\n' "${commit:-unknown}"
  printf 'bin_dir=%q\n' "${bin_dir}"
  printf 'home=%q\n' "${home}"
} > "${cli_home}/installed.env"

command_path="${bin_dir}/tx-toolbox"
cat > "${command_path}.new" <<'LAUNCHER'
#!/usr/bin/env bash
# tx-toolbox: the Eclipse Tractus-X Developer Toolbox, installed by
# developer-toolbox/install.sh from the Eclipse Tractus-X Starter Kit.
set -euo pipefail
LAUNCHER
printf 'installed=%q\n' "${cli_home}/installed.env" >> "${command_path}.new"
cat >> "${command_path}.new" <<'LAUNCHER'
[ -f "${installed}" ] || { echo "error: tx-toolbox is not installed any more (${installed} is missing)." >&2; exit 1; }
# shellcheck disable=SC1090
. "${installed}"
export TOOLBOX_HOME="${TOOLBOX_HOME:-${home}}"
case "${1:-}" in
  version | --version)
    if [ -n "${linked}" ]; then echo "tx-toolbox from ${kit} ($(git -C "${kit}" rev-parse --short HEAD 2>/dev/null || echo "${commit}"))"
    else echo "tx-toolbox from ${repo}@${ref} (${commit})"; fi
    exit 0 ;;
  update)
    if [ -n "${linked}" ]; then
      echo "tx-toolbox runs the clone in ${kit%/developer-toolbox}: update it with git pull." >&2
      exit 0
    fi
    exec bash "${kit}/install.sh" --repo "${repo}" --ref "${ref}" --bin "${bin_dir}" ;;
  uninstall)
    if [ -d "${TOOLBOX_HOME}/dataspaces" ] && [ -n "$(ls -A "${TOOLBOX_HOME}/dataspaces" 2>/dev/null)" ] \
      && [ "${2:-}" != "--force" ]; then
      echo "error: a dataspace is still up ($(ls "${TOOLBOX_HOME}/dataspaces" | tr '\n' ' ')). Remove it with" >&2
      echo "       tx-toolbox down [--name NAME] first, or run tx-toolbox uninstall --force." >&2
      exit 1
    fi
    rm -f "${bin_dir}/tx-toolbox"
    rm -rf "${TOOLBOX_HOME}/cli"
    echo "tx-toolbox is uninstalled. Its Python environment and tools stay in ${TOOLBOX_HOME}; delete that folder to remove them too."
    exit 0 ;;
esac
[ -x "${kit}/toolbox" ] || { echo "error: no toolbox in ${kit}. Install tx-toolbox again." >&2; exit 1; }
export TOOLBOX_PROG=tx-toolbox
exec "${kit}/toolbox" "$@"
LAUNCHER
chmod 0755 "${command_path}.new"
mv "${command_path}.new" "${command_path}"

echo "Installed tx-toolbox ${commit:+(${commit}) }from ${source_text} as ${command_path}."
case ":${PATH}:" in
  *":${bin_dir}:"*) ;;
  *)
    echo
    echo "${bin_dir} is not on your PATH yet. Add it, for example in ~/.zshrc or ~/.bashrc:"
    echo "  export PATH=\"${bin_dir}:\$PATH\""
    ;;
esac
echo
echo "Start a dataspace:  tx-toolbox up --config minimal"
echo "All commands:       tx-toolbox --help"
