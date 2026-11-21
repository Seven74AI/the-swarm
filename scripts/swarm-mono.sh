#!/usr/bin/env bash
# Rebuilds "Swarm Mono" (Story 8.1, ADR 0041): public/fonts/SwarmMono-{Regular,Bold}.woff2.
#
# Source: JetBrains Mono NL 2.242 (no ligatures), SIL Open Font License 1.1,
# taken from the npm package jetbrains-mono@1.0.6 (a repack of the upstream
# webfonts; checked below by its sha256). Subset with fontTools' pyftsubset:
# ASCII, Latin-1, the typographic marks and arrows the copy uses, box drawing,
# block elements and geometric shapes; no hinting, no OpenType features (a
# terminal grid needs neither). tests/unit/ui/swarmMono.test.ts checks the result.
#
# Needs: npm, python3 with `pip install fonttools brotli` (a venv is fine).
# Usage: scripts/swarm-mono.sh [python]   (default python3)
set -euo pipefail

PY="${1:-python3}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/fonts"
SHA256=6c94284d9b510f302b429cb44b72e05d73f2e6023d793fd1ede267c64740242c
UNICODES="U+0020-007E,U+00A0-00FF,U+2013,U+2014,U+2022,U+2026,U+2190-2193,U+2212,U+221E,U+2248,U+2264,U+2265,U+2500-259F,U+25A0-25FF,U+2713,U+2717"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
(cd "$WORK" && npm pack jetbrains-mono@1.0.6 --silent >/dev/null)
echo "$SHA256  $WORK/jetbrains-mono-1.0.6.tgz" | sha256sum -c --quiet
mkdir "$WORK/src" && tar xzf "$WORK/jetbrains-mono-1.0.6.tgz" -C "$WORK/src"

for weight in Regular Bold; do
  "$PY" -I -m fontTools.subset "$WORK/src/package/fonts/webfonts/JetBrainsMonoNL-$weight.woff2" \
    --unicodes="$UNICODES" --flavor=woff2 --no-hinting --layout-features='' \
    --output-file="$OUT/SwarmMono-$weight.woff2"
done
ls -l "$OUT"/SwarmMono-*.woff2
