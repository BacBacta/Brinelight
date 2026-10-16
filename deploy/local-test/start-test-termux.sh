#!/usr/bin/env bash
# Brinelight - sign-in test with a real wallet (Phantom), entirely on an Android phone, in Termux.
# Starts two temporary Cloudflare tunnels, the server (in-memory database) and the game, then opens
# the game in Phantom's browser. Nothing is installed except git, Node.js and cloudflared (with pkg).
#   bash deploy/local-test/start-test-termux.sh       real time
#   bash deploy/local-test/start-test-termux.sh 1000  the account's city runs 1000 times faster (DEV_SPEED=1000)
# Ctrl+C (in Termux: Volume down + C) stops everything. Also works on Linux and macOS, without the Termux parts.
set -uo pipefail

speed="${1:-1}"
if ! [[ "$speed" =~ ^[0-9]+$ ]] || ((speed < 1 || speed > 3600)); then
  echo "The speed must be a whole number from 1 to 3600 (1000: 1000 times faster)." >&2
  exit 1
fi

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
logs="$here/logs"
in_termux=false
[[ "${PREFIX:-}" == *com.termux* ]] && in_termux=true

step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
fail() {
  printf '\n\033[31mERROR: %s\033[0m\n' "$1" >&2
  exit 1
}

stop_all() {
  trap - EXIT INT TERM
  printf '\nStopping everything...\n'
  if $in_termux && command -v termux-wake-unlock >/dev/null; then termux-wake-unlock; fi
  printf 'Done. The test logs are in %s\n' "$logs"
  # Everything this script started (npm, node, cloudflared) is in its process group.
  if ! kill -- -$$ 2>/dev/null; then
    mapfile -t pids < <(jobs -p)
    ((${#pids[@]})) && kill "${pids[@]}" 2>/dev/null
  fi
}
trap stop_all EXIT INT TERM

# The address a tunnel prints in its log (up to 1 minute).
wait_url() {
  local url
  for _ in $(seq 1 60); do
    sleep 1
    url="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$1" 2>/dev/null | grep -v '^https://api\.trycloudflare\.com$' | head -n 1)"
    if [[ -n "$url" ]]; then
      printf '%s' "$url"
      return 0
    fi
  done
  return 1
}

# True once "$1/health" answers ok, trying "$2" times, 2 seconds apart.
wait_health() {
  for _ in $(seq 1 "$2"); do
    if curl -fsS --max-time 5 "$1/health" 2>/dev/null | grep -q '"ok":true'; then return 0; fi
    sleep 2
  done
  return 1
}

# True once the game's page answers on this phone, trying "$1" times, 2 seconds apart.
wait_game() {
  for _ in $(seq 1 "$1"); do
    if curl -fsS --max-time 5 -o /dev/null "http://127.0.0.1:4173/"; then return 0; fi
    sleep 2
  done
  return 1
}

mkdir -p "$logs"
rm -f "$logs"/*.log

if ((speed == 1)); then
  printf '\033[32mGame speed: real time (DEV_SPEED=1)\033[0m\n'
else
  printf '\033[35mGame speed: %s times faster than real time (DEV_SPEED=%s). For testing only.\033[0m\n' "$speed" "$speed"
fi

step "Checking the tools"
missing=()
for t in git node npm cloudflared curl; do command -v "$t" >/dev/null || missing+=("$t"); done
if ((${#missing[@]})); then
  $in_termux || fail "Missing: ${missing[*]}. Install them, then run again."
  step "Installing what is missing (once): ${missing[*]}"
  pkgs=()
  for t in "${missing[@]}"; do
    case "$t" in
      node | npm) pkgs+=(nodejs-lts) ;;
      *) pkgs+=("$t") ;;
    esac
  done
  mapfile -t pkgs < <(printf '%s\n' "${pkgs[@]}" | sort -u)
  pkg install -y "${pkgs[@]}" || fail "pkg install failed (see above)."
fi
major="$(node -p 'process.versions.node.split(".")[0]')"
((major >= 22)) || fail "Node.js $(node -v) is too old: version 22 or later is needed (pkg upgrade nodejs)."
echo "Node $(node -v)"

# Keeps the test running while you are in Phantom.
if $in_termux && command -v termux-wake-lock >/dev/null; then termux-wake-lock; fi

step "Installing the game (the first time takes a few minutes)"
cd "$repo" || fail "Cannot open $repo"
npm install --no-audit --no-fund || fail "npm install failed (see above)."

step "Opening the two tunnels"
cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8787 >"$logs/tunnel-api.log" 2>&1 &
cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4173 >"$logs/tunnel-game.log" 2>&1 &
api="$(wait_url "$logs/tunnel-api.log")" || fail "The tunnel gave no address. See $logs/tunnel-api.log"
game="$(wait_url "$logs/tunnel-game.log")" || fail "The tunnel gave no address. See $logs/tunnel-game.log"
echo "API address: $api"
echo "Game address: $game"

step "Building the game with the API address (a minute or two on a phone)"
if ! VITE_API_URL="$api" npm run build >"$logs/build.log" 2>&1; then
  tail -n 30 "$logs/build.log"
  fail "The game build failed. See $logs/build.log"
fi

step "Starting the server and the game"
ALLOWED_ORIGINS="$game" TRUSTED_PROXY=127.0.0.1 DEV_SPEED="$speed" npm run start -w server >"$logs/server.log" 2>&1 &
npm run preview -w client -- --host 127.0.0.1 --port 4173 --strictPort >"$logs/game.log" 2>&1 &

step "Checking the server and the game (up to 1 minute), then the server through its tunnel"
if ! wait_health "http://127.0.0.1:8787" 30; then
  tail -n 30 "$logs/server.log"
  fail "The server did not start. See $logs/server.log"
fi
if ! wait_game 30; then
  tail -n 30 "$logs/game.log"
  fail "The game did not start. See $logs/game.log"
fi
wait_health "$api" 30 || fail "The server does not answer through the tunnel. See $logs/tunnel-api.log"
printf '\033[32mThe server answers.\033[0m\n'

encode() { node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$1"; }
phantom="https://phantom.app/ul/browse/$(encode "$game")?ref=$(encode "$game")"

printf '\n\033[33m=================================================================\033[0m\n'
printf ' READY. Game address:\n   %s\n' "$game"
if ((speed != 1)); then printf ' Signed in, the city runs %s times faster than real time.\n' "$speed"; fi
cat <<'EOF'

 Phantom opens on the game. If not: Phantom > browser tab > type this address.
 Tap the Power card > Sign in with your wallet > approve in Phantom.
 The message must say: Sign in to Brinelight. This does not send a
 transaction and costs nothing. If Phantom asks for a TRANSACTION: refuse.

 Do not share this address. Come back here and press Ctrl+C
 (in Termux: Volume down + C) to STOP EVERYTHING.
EOF
printf '\033[33m=================================================================\033[0m\n'
if $in_termux && command -v termux-open-url >/dev/null; then termux-open-url "$phantom"; fi

# Waits until you stop it, or until one of the programs stops by itself.
wait -n
echo "A part of the test stopped by itself (the phone may have closed it). See the logs in $logs"
