#!/usr/bin/env bash
# Kaban Plus Ultra — self-host installer.
#
# Usage (one-liner):
#
#   curl -fsSL https://raw.githubusercontent.com/dfladagermccullugh-bot/kaban-plus-ultra/main/scripts/install-kaban.sh \
#     | KABAN_HOST=kaban.example.com sh
#
# Or after cloning:
#
#   ./scripts/install-kaban.sh
#
# What this script does, in order:
#   1. Sanity-check the host (docker, docker compose v2.20+, curl, openssl, tar).
#   2. Clone (or `git pull` in place) this repo into $KABAN_DIR
#      (default: $HOME/kaban-plus-ultra). Skipped if already inside a checkout.
#   3. DNS pre-flight: resolve $KABAN_HOST; warn if it doesn't point at us.
#      Skipped when $KABAN_HOST == localhost.
#   4. Generate $KABAN_DIR/docker/.env from .env.example, filling in fresh
#      random POSTGRES_PASSWORD / JWT_SECRET / DASHBOARD_PASSWORD on first
#      run. Existing .env values are preserved.
#   5. Fetch the upstream Supabase compose at the pinned tag.
#   6. `docker compose -f kaban-stack.yml pull` to grab every image up front.
#   7. `docker compose -f kaban-stack.yml up -d --build` to start everything.
#   8. `docker/bootstrap.sh` to apply supabase/migrations/*.sql once the
#      Postgres container reports healthy.
#   9. Print the final URL and a "what next" pointer.
#
# Re-running this script on a host that already has Kaban installed is a
# safe upgrade path: env values are preserved, the migrations runner is
# idempotent, and `docker compose up -d` only restarts changed services.

set -euo pipefail

log()  { printf '\033[1;36m[kaban]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[kaban]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[kaban]\033[0m %s\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "missing required tool: $1"; }

rand_b64() {
  # URL-safe-ish base64, ${1} chars worth of entropy.
  openssl rand -base64 "$1" | tr -d '\n=+/' | cut -c -"$1"
}

REPO_URL="${KABAN_REPO_URL:-https://github.com/dfladagermccullugh-bot/kaban-plus-ultra.git}"
REPO_REF="${KABAN_REPO_REF:-main}"
KABAN_DIR="${KABAN_DIR:-$HOME/kaban-plus-ultra}"
KABAN_HOST="${KABAN_HOST:-localhost}"

# ---------- 1. sanity ----------
log "checking prerequisites …"
need docker
need curl
need openssl
need tar

if ! docker compose version >/dev/null 2>&1; then
  die "'docker compose' (v2) plugin not found. Install Docker Engine ≥ 24."
fi
compose_v="$(docker compose version --short 2>/dev/null || echo 0)"
# Compose v2.20+ ships `include:`. Older versions silently ignore it, so the
# upstream Supabase services never start — warn loudly.
case "$compose_v" in
  v2.2[0-9].*|v2.[3-9][0-9].*|v[3-9].*) ;;
  2.2[0-9].*|2.[3-9][0-9].*|[3-9].*) ;;
  *) warn "docker compose '$compose_v' — kaban-stack.yml needs v2.20+ for include:. Trying anyway." ;;
esac

# ---------- 2. checkout ----------
if [ -f "$(pwd)/docker/kaban-stack.yml" ]; then
  KABAN_DIR="$(pwd)"
  log "using existing checkout at $KABAN_DIR"
elif [ -d "$KABAN_DIR/.git" ]; then
  log "updating existing checkout at $KABAN_DIR …"
  need git
  git -C "$KABAN_DIR" fetch --depth 1 origin "$REPO_REF"
  git -C "$KABAN_DIR" checkout "$REPO_REF"
  git -C "$KABAN_DIR" reset --hard "origin/$REPO_REF"
else
  need git
  log "cloning $REPO_URL @ $REPO_REF -> $KABAN_DIR …"
  git clone --depth 1 --branch "$REPO_REF" "$REPO_URL" "$KABAN_DIR"
fi
cd "$KABAN_DIR"

# ---------- 3. DNS pre-flight ----------
if [ "$KABAN_HOST" != "localhost" ] && [ "$KABAN_HOST" != "127.0.0.1" ]; then
  log "DNS pre-flight for $KABAN_HOST …"
  host_ip=""
  if command -v getent >/dev/null 2>&1; then
    host_ip=$(getent hosts "$KABAN_HOST" 2>/dev/null | awk '{print $1; exit}' || true)
  fi
  if [ -z "$host_ip" ] && command -v dig >/dev/null 2>&1; then
    host_ip=$(dig +short "$KABAN_HOST" 2>/dev/null | head -n1 || true)
  fi
  if [ -z "$host_ip" ]; then
    warn "could not resolve $KABAN_HOST — Caddy will retry Let's Encrypt until DNS propagates."
  else
    egress_ip=$(curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null \
      || curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null \
      || echo "")
    if [ -n "$egress_ip" ] && [ "$host_ip" != "$egress_ip" ]; then
      warn "$KABAN_HOST resolves to $host_ip but this host's egress IP is $egress_ip."
      warn "Caddy can't issue a Let's Encrypt cert until DNS points at us."
    else
      log "  $KABAN_HOST -> $host_ip (matches this host)"
    fi
  fi
fi

# ---------- 4. env ----------
ENV_FILE="$KABAN_DIR/docker/.env"
ENV_EXAMPLE="$KABAN_DIR/docker/.env.example"

if [ ! -f "$ENV_FILE" ]; then
  log "generating $ENV_FILE …"
  cp "$ENV_EXAMPLE" "$ENV_FILE"

  POSTGRES_PASSWORD="$(rand_b64 32)"
  JWT_SECRET="$(rand_b64 48)"
  DASHBOARD_PASSWORD="$(rand_b64 24)"

  # Sign anon + service_role JWTs from JWT_SECRET, then patch every relevant
  # placeholder in $ENV_FILE. All of this runs inside a single throwaway
  # python:3.12-alpine container — the installer's only language dep is
  # docker itself.
  log "signing JWTs + writing $ENV_FILE (containerised) …"
  docker run --rm -i \
    -e JWT_SECRET="$JWT_SECRET" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -e DASHBOARD_PASSWORD="$DASHBOARD_PASSWORD" \
    -e KABAN_HOST="$KABAN_HOST" \
    -v "$ENV_FILE:/env:rw" \
    python:3.12-alpine python - <<'PY'
import base64, hmac, hashlib, json, os, re, time, pathlib

secret = os.environ["JWT_SECRET"].encode()
def b64u(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
def jwt(role):
    head = b64u(json.dumps({"alg":"HS256","typ":"JWT"}, separators=(",",":")).encode())
    now  = int(time.time())
    body = b64u(json.dumps({"role":role,"iss":"supabase-self-hosted","iat":now,"exp":now+10*365*24*3600}, separators=(",",":")).encode())
    sig  = b64u(hmac.new(secret, f"{head}.{body}".encode(), hashlib.sha256).digest())
    return f"{head}.{body}.{sig}"

anon = jwt("anon")
service = jwt("service_role")
host = os.environ["KABAN_HOST"]
public_url = f"https://{host}" if host not in ("localhost", "127.0.0.1") else f"http://{host}"

patches = {
    "POSTGRES_PASSWORD":            os.environ["POSTGRES_PASSWORD"],
    "JWT_SECRET":                   os.environ["JWT_SECRET"],
    "ANON_KEY":                     anon,
    "SERVICE_ROLE_KEY":             service,
    "DASHBOARD_PASSWORD":           os.environ["DASHBOARD_PASSWORD"],
    "SITE_URL":                     public_url,
    "API_EXTERNAL_URL":             public_url,
    "SUPABASE_PUBLIC_URL":          public_url,
    "KABAN_HOST":                   host,
    "NEXT_PUBLIC_SITE_URL":         public_url,
    "NEXT_PUBLIC_SUPABASE_URL":     public_url,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": anon,
    "SUPABASE_SERVICE_ROLE_KEY":    service,
}

path = pathlib.Path("/env")
lines = path.read_text().splitlines()
seen, out = set(), []
for line in lines:
    m = re.match(r'^([A-Z_][A-Z0-9_]*)=', line)
    if m and m.group(1) in patches:
        k = m.group(1)
        out.append(f"{k}={patches[k]}")
        seen.add(k)
    else:
        out.append(line)
for k, v in patches.items():
    if k not in seen:
        out.append(f"{k}={v}")
path.write_text("\n".join(out) + "\n")
PY

  log "  POSTGRES_PASSWORD / JWT_SECRET / DASHBOARD_PASSWORD generated. Back up $ENV_FILE."
else
  log "$ENV_FILE already exists — keeping it as-is."
fi

# ---------- 5. supabase fetch ----------
log "fetching pinned Supabase upstream …"
bash "$KABAN_DIR/docker/supabase/fetch.sh"

# ---------- 6/7. pull + up ----------
cd "$KABAN_DIR/docker"
log "pulling images (this is the slow step) …"
docker compose --env-file ./.env -f kaban-stack.yml pull

log "starting stack …"
docker compose --env-file ./.env -f kaban-stack.yml up -d --build

# ---------- 8. migrations ----------
log "applying Kaban migrations …"
set -a; . "$ENV_FILE"; set +a
COMPOSE_FILE="$KABAN_DIR/docker/kaban-stack.yml" \
  bash "$KABAN_DIR/docker/bootstrap.sh"

# ---------- 9. done ----------
log "──────────────────────────────────────────────────────────────"
log "  Kaban Plus Ultra is up at: https://$KABAN_HOST/"
log "  Supabase Studio: https://$KABAN_HOST/project/default (user: $(grep ^DASHBOARD_USERNAME= "$ENV_FILE" | cut -d= -f2))"
log ""
log "  Logs:     cd $KABAN_DIR/docker && docker compose -f kaban-stack.yml logs -f"
log "  Update:   cd $KABAN_DIR && ./scripts/install-kaban.sh"
log "  Stop:     cd $KABAN_DIR/docker && docker compose -f kaban-stack.yml down"
log "──────────────────────────────────────────────────────────────"
