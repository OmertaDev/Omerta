#!/usr/bin/env bash
# Official v1.7.1 Linux amd64 release only. Verify before extraction or execution.
set +x
set -euo pipefail
umask 077

verify_only=false
if [[ $# == 1 && $1 == --verify-only ]]; then
  verify_only=true
elif [[ $# != 0 ]]; then
  printf 'Usage: %s [--verify-only]\n' "$0" >&2
  exit 1
fi
if [[ "$verify_only" == false ]]; then
  [[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || { printf 'Linux amd64 is required\n' >&2; exit 1; }
  : "${GITHUB_PATH:?GitHub Actions PATH file is required for installation}"
fi
[[ -n "${GH_TOKEN:-}" ]] || { printf 'Supply GH_TOKEN through the environment\n' >&2; exit 1; }
export GH_HOST=github.com
unset GH_DEBUG
for dependency in gh timeout sha256sum mktemp; do command -v "$dependency" >/dev/null; done

readonly archive_name=foundry_v1.7.1_linux_amd64.tar.gz
readonly archive_sha256=cf7e688ed0c4c48adffca788b496076e31060b67ac5afe1e43dbb5499c20c88b
readonly asset_route=repos/foundry-rs/foundry/releases/assets/415095756
temporary_root=$(cd "${TMPDIR:-/tmp}" && pwd -P)
[[ "$temporary_root" == /* ]]
temporary=$(mktemp -d "$temporary_root/omerta-foundry.XXXXXX")
[[ -d "$temporary" && ! -L "$temporary" ]]
temporary=$(cd "$temporary" && pwd -P)
[[ "$temporary" == /* && "${temporary%/*}" == "$temporary_root" && "${temporary##*/}" == omerta-foundry.* ]]
trap 'rm -rf -- "$temporary"' EXIT
archive="$temporary/$archive_name"

for attempt in 1 2 3; do
  if timeout 120s gh api --hostname github.com -H 'Accept: application/octet-stream' "$asset_route" > "$archive"; then
    break
  fi
  if [[ $attempt == 3 ]]; then printf 'Official Foundry asset download failed\n' >&2; exit 1; fi
  sleep "$((attempt * 2))"
done
printf '%s  %s\n' "$archive_sha256" "$archive" | sha256sum --check --status
timeout 180s gh attestation verify "$archive" --repo foundry-rs/foundry \
  --signer-workflow foundry-rs/foundry/.github/workflows/release.yml
printf 'Verified Foundry v1.7.1 archive SHA-256: %s\n' "$archive_sha256"
if [[ "$verify_only" == true ]]; then exit 0; fi

staging="$temporary/bin"
mkdir "$staging"
tar --extract --gzip --file "$archive" --directory "$staging" \
  --no-same-owner --no-same-permissions forge cast anvil chisel
destination="$HOME/.foundry/bin"
mkdir -p "$destination"
for tool in forge cast anvil chisel; do
  [[ -f "$staging/$tool" && ! -L "$staging/$tool" ]]
  install -m 0755 "$staging/$tool" "$destination/$tool"
done
printf '%s\n' "$destination" >> "$GITHUB_PATH"
printf 'Installed the verified Foundry v1.7.1 release\n'
