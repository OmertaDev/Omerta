#!/usr/bin/env bash
# Run the OMERTÀ Foundry suite on any machine with open internet.
# The native-toolchain run for the scoped agent-led review. The sandboxed build
# environment has its own runner — ./run-forge-test-sandboxed.sh (npm forge + solc-js shim),
# first green 2026-07-23: 73/73 incl. two 512-run fuzzes.
#
#   chmod +x run-forge-test.sh && ./run-forge-test.sh
#
# Pins: solc 0.8.26 (foundry.toml), OpenZeppelin v5.6.1 (the API the contracts target),
# forge-std v1.9.6 (Test.sol), and the exact v4 periphery/Permit2 revisions below.
set -euo pipefail
cd "$(dirname "$0")"

# 1. Foundry toolchain (installs to ~/.foundry/bin) ---------------------------------
if ! command -v forge >/dev/null 2>&1; then
  echo "▸ installing Foundry…"
  curl -L https://foundry.paradigm.xyz | bash
  export PATH="$HOME/.foundry/bin:$PATH"
  foundryup
fi
echo "▸ $(forge --version)"

# 2. Dependencies into lib/ (idempotent) --------------------------------------------
# omerta-contracts lives inside the Omerta git repo, so tell forge NOT to touch git
# (submodules/commits) — a plain checkout into lib/ is all the compiler needs.
NOGIT=""; forge install --help 2>&1 | grep -q -- "--no-git" && NOGIT="--no-git"
[ -d lib/forge-std ]             || forge install $NOGIT foundry-rs/forge-std@v1.9.6
[ -d lib/openzeppelin-contracts ] || forge install $NOGIT OpenZeppelin/openzeppelin-contracts@v5.6.1
# Uniswap v4 core, for OmertaHook and its suite. Taken from npm rather than git because the npm
# package ships its own lib/ (forge-std, solmate, OZ) already populated, so the hook tests can deploy
# a REAL PoolManager and route REAL swaps rather than talk to a mock.
[ -d lib/v4-core ] || { npm pack @uniswap/v4-core@1.0.2 >/dev/null && mkdir -p lib/v4-core \
  && tar xzf uniswap-v4-core-1.0.2.tgz -C lib/v4-core --strip-components=1 && rm -f uniswap-v4-core-1.0.2.tgz; }

fetch_pinned() {
  local destination="$1" repository="$2" revision="$3"
  if [ ! -d "$destination" ]; then
    git clone --no-checkout "$repository" "$destination"
    git -C "$destination" checkout --detach "$revision"
  fi
  [ "$(git -C "$destination" rev-parse HEAD)" = "$revision" ] || {
    echo "Dependency revision mismatch: $destination" >&2; exit 1;
  }
  git -C "$destination" diff --quiet HEAD -- || {
    echo "Dependency has modified tracked files: $destination" >&2; exit 1;
  }
}
fetch_pinned lib/v4-periphery https://github.com/Uniswap/v4-periphery ad04c9f24a170accf5ea1b2836bbafd514537ca6
fetch_pinned lib/permit2 https://github.com/Uniswap/permit2 cc56ad0f3439c502c246fc5cfcc3db92bb8b7219

# 3. Build + test -------------------------------------------------------------------
echo "▸ forge build" && forge build
echo "▸ forge test" && forge test -vvv --fuzz-runs 512
echo "✅ done — retain this run with the exact source manifest in the scoped security review."
