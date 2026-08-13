#!/usr/bin/env bash
# IDStudio self-update agent. Runs on the host (VM) as the deploy user, watching a
# shared control directory that the web app can write to. The app NEVER runs git
# or docker itself — it only drops a one-word `request` file here; this agent (which
# has git + docker access) performs the pull/build/restart and writes status back as
# plain-text files the app reads. Keeping the privileged work out of the web
# container is the whole point (no Docker socket in an internet-facing app).
set -uo pipefail

REPO="${IDSTUDIO_REPO:-/home/idstudio/idstudio}"
CTRL="${IDSTUDIO_CONTROL:-$REPO/update-control}"
BRANCH="${IDSTUDIO_BRANCH:-main}"

mkdir -p "$CTRL"; chmod 777 "$CTRL" 2>/dev/null || true
cd "$REPO" || { echo "no repo at $REPO"; exit 1; }
export GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat

set_field() { printf '%s' "$2" > "$CTRL/$1"; chmod 666 "$CTRL/$1" 2>/dev/null || true; }
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Trim a git error to one useful line for the status field: drop the progress
# chatter, keep the first line that actually says what went wrong.
first_error_line() {
  grep -viE '^(remote:|Receiving|Resolving|Counting|Compressing|From )' \
    | grep -iE 'fatal|error|denied|could not|timed out|unable' \
    | head -1 | cut -c1-200
}

refresh_git() {
  # A failed fetch used to be swallowed (`2>/dev/null || true`), so `behind` silently
  # froze at its last good value and the UI kept showing a stale count forever — the
  # thing that hid a repo-auth breakage for days. Record the failure instead.
  local fetch_err
  if fetch_err="$(git fetch origin 2>&1 >/dev/null)"; then
    set_field fetch_error ""
  else
    set_field fetch_error "$(printf '%s' "$fetch_err" | first_error_line)"
  fi
  set_field current_commit  "$(git rev-parse --short HEAD)"
  set_field current_message "$(git log -1 --format=%s)"
  set_field current_date    "$(git log -1 --format=%cI)"
  set_field behind          "$(git rev-list --count "HEAD..origin/$BRANCH" 2>/dev/null || echo 0)"
  set_field latest_commit   "$(git rev-parse --short "origin/$BRANCH" 2>/dev/null || echo '')"
  set_field latest_message  "$(git log -1 --format=%s "origin/$BRANCH" 2>/dev/null || echo '')"
  set_field last_checked    "$(now)"
  # list of pending commits (newest first): hash <US> subject <US> isoDate <US> author, one per line
  git log --format="%h%x1f%s%x1f%cI%x1f%an" "HEAD..origin/$BRANCH" > "$CTRL/pending" 2>/dev/null || : > "$CTRL/pending"
  chmod 666 "$CTRL/pending" 2>/dev/null || true
}

run_deploy() { # $1 = human label for last_result on success
  set_field state updating
  set_field stage building
  : > "$CTRL/log"
  # Bakes the commit being deployed into the app's build so Next.js can detect a
  # client still running a previous deploy's JS and force a full reload for it
  # (see next.config.ts's `deploymentId`) instead of leaving it stuck mid-navigation.
  export DEPLOYMENT_ID="$(git rev-parse --short HEAD)"
  if docker compose build >>"$CTRL/log" 2>&1; then
    set_field stage starting
    if docker compose up -d >>"$CTRL/log" 2>&1; then
      refresh_git; set_field state idle; set_field stage ""; set_field last_result "$1 $(git rev-parse --short HEAD)"
      # Exit so systemd (Restart=always) relaunches us running the freshly-pulled
      # version of THIS script — keeps the agent itself up to date after an update.
      exit 0
    fi
  fi
  refresh_git; set_field state error; set_field stage ""; set_field last_result "Failed — see update-control/log"
}

do_update() {
  set_field state updating
  set_field stage pulling
  # Only *tracked* modifications should block an update — untracked files (e.g. the
  # runtime update-control/ dir, or a local docker-compose.override.yml) don't
  # conflict with a fast-forward pull.
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    set_field state error; set_field stage ""; set_field last_result "Server has local changes to tracked files — aborted"; return
  fi
  set_field previous_commit "$(git rev-parse --short HEAD)"
  git fetch origin --quiet 2>/dev/null || true
  # Report what git actually said. This used to be a blanket "not a fast-forward?"
  # for every failure mode, which sent a repo-auth outage down the wrong path.
  local pull_out
  if ! pull_out="$(git pull --ff-only origin "$BRANCH" 2>&1)"; then
    printf '%s\n' "$pull_out" >>"$CTRL/log"
    local reason; reason="$(printf '%s' "$pull_out" | first_error_line)"
    [ -z "$reason" ] && reason="git pull failed — see update-control/log"
    set_field state error; set_field stage ""; set_field last_result "$reason"; return
  fi
  printf '%s\n' "$pull_out" >>"$CTRL/log"
  run_deploy "Updated to"
}

do_rollback() {
  set_field state updating
  set_field stage pulling
  local prev; prev="$(cat "$CTRL/previous_commit" 2>/dev/null)"
  [ -z "$prev" ] && { set_field state error; set_field stage ""; set_field last_result "No previous version recorded"; return; }
  git reset --hard "$prev" >>"$CTRL/log" 2>&1 || { set_field state error; set_field stage ""; set_field last_result "git reset failed"; return; }
  run_deploy "Rolled back to"
}

set_field state idle
refresh_git
LAST_FETCH=$(date +%s)

while true; do
  if [ -f "$CTRL/request" ]; then
    cmd="$(cat "$CTRL/request" 2>/dev/null)"; rm -f "$CTRL/request"
    case "$cmd" in
      check)    set_field state checking; refresh_git; set_field state idle; set_field last_result "Checked for updates";;
      update)   do_update;;
      rollback) do_rollback;;
    esac
  fi
  nows=$(date +%s)
  if [ $((nows - LAST_FETCH)) -ge 900 ]; then refresh_git; LAST_FETCH=$nows; fi
  sleep 4
done
