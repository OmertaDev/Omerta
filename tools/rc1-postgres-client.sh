#!/usr/bin/env bash
# Hosted Linux only. pg_dump must support the selected server's major version.
# Package source: https://www.postgresql.org/download/linux/ubuntu/
set -euo pipefail
major="${1%%.*}"
[[ "$major" =~ ^[0-9]+$ ]]
: "${GITHUB_PATH:?Run this setup only in GitHub Actions}"
: "${GITHUB_ENV:?Run this setup only in GitHub Actions}"
sudo apt-get update -qq
if ! apt-cache show "postgresql-client-$major" >/dev/null 2>&1; then
  # Ubuntu's default archive may only provide its original PostgreSQL major.
  sudo install -d /usr/share/postgresql-common/pgdg
  sudo curl --fail --silent --show-error --location \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    https://www.postgresql.org/media/keys/ACCC4CF8.asc
  . /etc/os-release
  printf 'Types: deb\nURIs: https://apt.postgresql.org/pub/repos/apt\nSuites: %s-pgdg\nComponents: main\nSigned-By: /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc\n' "$VERSION_CODENAME" \
    | sudo tee /etc/apt/sources.list.d/rc1-pgdg.sources >/dev/null
  sudo apt-get update -qq
fi
sudo apt-get install --yes --no-install-recommends "postgresql-client-$major"
client_bin="/usr/lib/postgresql/$major/bin"
printf '%s\n' "$client_bin" >> "$GITHUB_PATH"
printf 'RC1_PG_BIN=%s\n' "$client_bin" >> "$GITHUB_ENV"
"$client_bin/pg_dump" --version
"$client_bin/pg_restore" --version
"$client_bin/psql" --version
