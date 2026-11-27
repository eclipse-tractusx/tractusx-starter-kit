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

# Publishes the Starter Kit site, or a pull request preview of it, to the gh-pages branch.
#
# Run it from an empty directory:
#
#   update-gh-pages.sh site <build-dir>               the site, at the root of gh-pages
#   update-gh-pages.sh preview <pr-number> <build-dir> a preview, in pr-preview/<pr-number>/
#   update-gh-pages.sh remove <pr-number>             removes the preview of a pull request
#
# gh-pages holds the site and the open pull requests' previews. "site" replaces
# everything except pr-preview/; "preview" and "remove" only touch
# pr-preview/<pr-number>/. If another run pushes to gh-pages meanwhile, the change is
# applied again on top of it and pushed again.
#
# Environment: GITHUB_TOKEN (push access), GITHUB_REPOSITORY (owner/name), optional
# GH_PAGES_REMOTE (another remote URL, for tests) and MAX_ATTEMPTS (default 10).

set -euo pipefail

PREVIEW_DIR="pr-preview"

usage() {
  sed -n '/^# Run it from/,/^# Environment/p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

mode="${1:-}"
case "${mode}" in
  site)
    [ "$#" -eq 2 ] || usage
    source_dir="$(cd "$2" && pwd)"
    message="site: publish ${GITHUB_SHA:-a local build}"
    ;;
  preview)
    [ "$#" -eq 3 ] || usage
    pr_number="$2"
    source_dir="$(cd "$3" && pwd)"
    message="site: publish the preview of pull request ${pr_number}"
    ;;
  remove)
    [ "$#" -eq 2 ] || usage
    pr_number="$2"
    message="site: remove the preview of pull request ${pr_number}"
    ;;
  *)
    usage
    ;;
esac

if [ "${mode}" != "site" ] && ! [[ "${pr_number}" =~ ^[1-9][0-9]{0,9}$ ]]; then
  echo "Invalid pull request number: '${pr_number}'" >&2
  exit 2
fi
if [ "${mode}" = "site" ] && [ -e "${source_dir}/${PREVIEW_DIR}" ]; then
  echo "The build must not contain a ${PREVIEW_DIR}/ folder, it is reserved for previews." >&2
  exit 1
fi
if [ "${mode}" = "preview" ] && [ -n "$(find "${source_dir}" -type l -print -quit)" ]; then
  # Previews are built from pull requests, also from forks: publish plain files only.
  echo "The build contains symbolic links, refusing to publish it." >&2
  exit 1
fi
if [ -n "$(ls -A)" ]; then
  echo "Run this script from an empty directory." >&2
  exit 1
fi

remote_url="${GH_PAGES_REMOTE:-https://github.com/${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set}.git}"
git -c init.defaultBranch=gh-pages init --quiet
git remote add origin "${remote_url}"
if [ -n "${GITHUB_TOKEN:-}" ]; then
  # Same authentication as actions/checkout uses; the clone only lives in the runner's
  # temporary directory, which is discarded after the job.
  git config "http.https://github.com/.extraheader" \
    "AUTHORIZATION: basic $(printf 'x-access-token:%s' "${GITHUB_TOKEN}" | base64 | tr -d '\n')"
fi
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

load_latest_gh_pages() {
  if git fetch --quiet --depth=1 origin gh-pages 2>/dev/null; then
    git checkout --quiet --force -B gh-pages FETCH_HEAD
  else
    # The first publication: an empty branch.
    git checkout --quiet --orphan gh-pages
    git rm -r --quiet --cached . 2>/dev/null || true
  fi
  git clean --quiet -ffdx
}

apply_change() {
  case "${mode}" in
    site)
      # Everything but the previews and Git itself goes: the build is the whole site.
      find . -mindepth 1 -maxdepth 1 ! -name .git ! -name "${PREVIEW_DIR}" -exec rm -rf {} +
      cp -R "${source_dir}/." .
      touch .nojekyll
      ;;
    preview)
      rm -rf "${PREVIEW_DIR:?}/${pr_number}"
      mkdir -p "${PREVIEW_DIR}/${pr_number}"
      cp -R "${source_dir}/." "${PREVIEW_DIR}/${pr_number}/"
      ;;
    remove)
      rm -rf "${PREVIEW_DIR:?}/${pr_number}"
      ;;
  esac
}

max_attempts="${MAX_ATTEMPTS:-10}"
for attempt in $(seq 1 "${max_attempts}"); do
  load_latest_gh_pages
  apply_change
  git add --all
  if git diff --cached --quiet; then
    echo "Nothing to publish, gh-pages is already up to date."
    exit 0
  fi
  git commit --quiet --message "${message}"
  if git push --quiet origin HEAD:gh-pages; then
    echo "Published to gh-pages (attempt ${attempt}): ${message}"
    exit 0
  fi
  delay=$(( attempt * 3 + RANDOM % 5 ))
  echo "Push rejected, gh-pages has moved. Retrying in ${delay}s (attempt ${attempt} of ${max_attempts})."
  sleep "${delay}"
done

echo "Could not push to gh-pages after ${max_attempts} attempts." >&2
exit 1
