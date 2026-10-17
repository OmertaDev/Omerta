#!/usr/bin/env bash
set -euo pipefail
# Source only: Root must approve/publish/dispatch the separate workflow first.
test "$(uname -s)" = Linux
test "$(uname -m)" = x86_64
test -n "${RUNNER_TEMP:?}"
runtime="$RUNNER_TEMP/rc1-hosted-runtime"
test ! -e "$runtime"
mkdir -m 700 "$runtime"
curl --fail --silent --show-error --proto '=https' --tlsv1.2 --max-time 180 \
  'https://nodejs.org/dist/v22.23.3/node-v22.23.3-linux-x64.tar.gz' -o "$runtime/node.tar.gz"
printf '%s  %s\n' '1084aa36196bba4c3a5e69a1ee388a6e4ff729dad09445fbcd434b28fe3c24af' "$runtime/node.tar.gz" | sha256sum --check --status
tar --extract --gzip --file "$runtime/node.tar.gz" --directory "$runtime"
curl --fail --silent --show-error --proto '=https' --tlsv1.2 --max-time 180 \
  'https://ppa.launchpadcontent.net/git-core/ppa/ubuntu/pool/main/g/git/git_2.55.0-0ppa1~ubuntu24.04.2_amd64.deb' -o "$runtime/git.deb"
printf '%s  %s\n' '6238a37c11c1bd4b18a5194f766ccfcb2f26c116e7d8ecd07bac143863b69498' "$runtime/git.deb" | sha256sum --check --status
mkdir -m 700 "$runtime/git"
dpkg-deb --extract "$runtime/git.deb" "$runtime/git"
printf '%s  %s\n' 'fde6a4bf8d0562f7751d1a2d6cb9b417c4cfe107bbcb0aa3e9a24e125e348f48' "$runtime/node-v22.23.3-linux-x64/bin/node" | sha256sum --check --status
printf '%s  %s\n' '8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7' "$runtime/node-v22.23.3-linux-x64/lib/node_modules/npm/bin/npm-cli.js" | sha256sum --check --status
printf '%s  %s\n' 'd4d2ba562243015206d4248edfec871a74786499292d00ed072dbca2f5ae8073' "$runtime/git/usr/bin/git" | sha256sum --check --status
# No downloaded binary executes before its agreed exact hash has passed.
printf '%s\n' "$runtime/git/usr/bin" "$runtime/node-v22.23.3-linux-x64/bin" >> "$GITHUB_PATH"
