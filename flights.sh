#!/usr/bin/env bash
# flights.sh — Flight Viewer management console
# Usage: ./flights.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

FLIGHTS_JSON="$SCRIPT_DIR/flights.json"
PYTHON="${PYTHON:-python3}"

# ── Colours ───────────────────────────────────────────────────────────────────
bold=$'\033[1m'; reset=$'\033[0m'; teal=$'\033[0;36m'; yellow=$'\033[0;33m'
red=$'\033[0;31m'; green=$'\033[0;32m'; dim=$'\033[2m'

# ── Helpers ───────────────────────────────────────────────────────────────────

check_deps() {
    if ! command -v "$PYTHON" &>/dev/null; then
        echo "${red}❌ python3 not found.${reset}" >&2; exit 1
    fi
}

check_anthropic() {
    if ! "$PYTHON" -c "import anthropic" 2>/dev/null; then
        echo "${yellow}⚠  anthropic package not installed.${reset}"
        echo "   Run: pip3 install anthropic"
        echo ""
        return 1
    fi
    return 0
}

check_api_key() {
    if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
        echo "${red}❌ ANTHROPIC_API_KEY is not set.${reset}"
        echo "   Export it before running: export ANTHROPIC_API_KEY=sk-ant-..."
        return 1
    fi
    return 0
}

# Read users from flights.json → parallel arrays: names[], paths[]
load_users() {
    local json
    json=$("$PYTHON" - <<'PYEOF'
import json, sys
with open("flights.json") as f:
    cfg = json.load(f)
users = cfg.get("users", {})
for name, path in users.items():
    print(f"{name}\t{path}")
PYEOF
)
    user_names=(); user_paths=()
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        user_names+=("$(cut -f1 <<< "$line")")
        user_paths+=("$(cut -f2 <<< "$line")")
    done <<< "$json"
}

# Resolve actual CSV path: exact match, then glob for newest timestamped variant
resolve_csv() {
    local name="$1" path="$2"
    local full="$SCRIPT_DIR/$path"
    if [[ -f "$full" ]]; then
        echo "$full"; return
    fi
    # Glob for newest timestamped variant
    local base dir stem
    dir="$(dirname "$full")"
    stem="$(basename "$full" .csv)"
    local newest
    newest=$(ls -t "$dir/${stem}_"*.csv 2>/dev/null | head -1)
    if [[ -n "$newest" ]]; then
        echo "$newest"; return
    fi
    echo "$full"   # return original even if missing (update_tracker.py will create it)
}

print_header() {
    echo ""
    echo "${bold}${teal}  ✈  Flight Viewer — Management Console${reset}"
    echo "${dim}  ─────────────────────────────────────${reset}"
    echo ""
}

# ── Option 1: Add flights ─────────────────────────────────────────────────────

add_flights() {
    echo ""
    # anthropic package and API key are optional — cli backend works without them
    local has_anthropic=false has_key=false
    "$PYTHON" -c "import anthropic" 2>/dev/null && has_anthropic=true
    [[ -n "${ANTHROPIC_API_KEY:-}" ]] && has_key=true
    if ! $has_anthropic || ! $has_key; then
        if ! command -v claude &>/dev/null; then
            echo "${red}❌ No LLM backend available.${reset}"
            echo "   Either: set ANTHROPIC_API_KEY + install anthropic package"
            echo "   Or:     install Claude Code CLI (claude command in PATH)"
            return 1
        fi
    fi

    load_users

    # User selection
    echo "${bold}  Select user:${reset}"
    for i in "${!user_names[@]}"; do
        printf "  %d) %-12s  ${dim}%s${reset}\n" $((i+1)) "${user_names[$i]}" "${user_paths[$i]}"
    done
    echo ""
    read -r -p "  User [1]: " user_choice
    user_choice="${user_choice:-1}"
    local idx=$(( user_choice - 1 ))
    if (( idx < 0 || idx >= ${#user_names[@]} )); then
        echo "${red}  Invalid selection.${reset}"; return 1
    fi
    local user_name="${user_names[$idx]}"
    local csv_path
    csv_path=$(resolve_csv "$user_name" "${user_paths[$idx]}")
    echo "  → ${dim}$csv_path${reset}"
    echo ""

    # Reason
    echo "${bold}  Flight reason?${reset}"
    echo "  L) Leisure   B) Business   O) Other"
    read -r -p "  Reason [L]: " reason_input
    reason_input="${reason_input:-L}"
    local reason
    reason="$(printf '%s' "${reason_input:-L}" | tr 'a-z' 'A-Z')"
    case "$reason" in
        L|B|O) ;;
        *) echo "${yellow}  Unknown reason '$reason', defaulting to L.${reset}"; reason="L" ;;
    esac

    # Note
    read -r -p "  Note or Enter to skip: " note
    note="${note:-}"

    # Itinerary input
    echo ""
    echo "${bold}  Paste itinerary text below. Press ${teal}Ctrl+D${reset}${bold} on a new line when done:${reset}"
    echo "${dim}  ─────────────────────────────────────────────────────────────${reset}"
    local raw_text
    raw_text=$(cat)

    if [[ -z "$raw_text" ]]; then
        echo "${red}  No text provided.${reset}"; return 1
    fi

    echo ""
    echo "  ${dim}Extracting…${reset}"
    echo ""

    # Extract without trip tag first (summary → stderr; JSON → stdout captured)
    local pending
    pending=$(
        "$PYTHON" extract_flight.py \
            --reason "$reason" \
            --note "$note" \
            --flights-json "$FLIGHTS_JSON" \
            --backend auto \
            <<< "$raw_text"
    )

    if [[ -z "$pending" ]]; then
        echo "${red}  ❌ No rows extracted.${reset}"; return 1
    fi

    # Auto-generate trip tag from extracted data
    local reason_letter
    case "$reason" in
        B) reason_letter="b" ;;
        O) reason_letter="o" ;;
        *) reason_letter="f" ;;
    esac

    local auto_tag
    auto_tag=$(echo "$pending" | "$PYTHON" -c '
import json, sys
reason_letter = sys.argv[1]
rows = json.loads(sys.stdin.read())
if rows:
    date = (rows[0].get("Date") or "")[:7]
    dest = rows[-1].get("To") or rows[0].get("To") or ""
    yymm = date[2:4] + date[5:7] if len(date) == 7 else ""
    if yymm and dest:
        print(f"{yymm}-{dest}-{reason_letter}")
' "$reason_letter")

    echo ""
    if [[ -n "$auto_tag" ]]; then
        read -r -p "  Trip tag [${auto_tag}]: " trip_input
        trip="${trip_input:-$auto_tag}"
    else
        read -r -p "  Trip tag (e.g. 2510-BOM-f) or Enter to skip: " trip_input
        trip="${trip_input:-}"
    fi

    # Patch trip tag into the already-extracted JSON (no second LLM call)
    if [[ -n "$trip" ]]; then
        pending=$(echo "$pending" | "$PYTHON" -c '
import json, sys
trip = sys.argv[1]
rows = json.loads(sys.stdin.read())
for r in rows:
    r["Trip"] = trip
print(json.dumps(rows, indent=2))
' "$trip")
    fi

    # Interactive fill for missing mandatory fields (Enter = accept default)
    local fill_output
    fill_output=$(echo "$pending" | "$PYTHON" -c '
import json, sys

CLASS_NAMES = {"C": "Business", "F": "First", "Y": "Economy", "W": "Prem. Eco", "Q": "Basic"}
MANDATORY = [
    ("Class",    "Y", "Class (Y=Economy C=Business F=First W=PremEco Q=Basic)"),
    ("Seat",     "",  "Seat (e.g. 12A, Enter to skip)"),
    ("Duration", "",  "Duration HH:MM (Enter to skip)"),
]

rows = json.loads(sys.stdin.read())
needs_fill = [
    (i, row, field, default, prompt)
    for i, row in enumerate(rows)
    for field, default, prompt in MANDATORY
    if not (row.get(field) or "").strip()
]
if not needs_fill:
    print(json.dumps(rows))
    sys.exit(0)

tty = open("/dev/tty", "r")
last_leg = -1
for i, row, field, default, prompt in needs_fill:
    if i != last_leg:
        fn = row.get("Flight_Number", "?")
        fr = row.get("From", "?")
        to = row.get("To", "?")
        sys.stderr.write(f"\n  Leg {i+1}: {fn}  {fr} -> {to}\n")
        last_leg = i
    display = CLASS_NAMES.get(default, default) if field == "Class" else (default or "skip")
    sys.stderr.write(f"  {prompt} [{display}]: ")
    sys.stderr.flush()
    answer = tty.readline().rstrip("\n")
    if answer == "":
        if default:
            row[field] = default
    else:
        row[field] = answer.strip().upper() if field == "Class" else answer.strip()
tty.close()
print(json.dumps(rows))
')
    if [[ -n "$fill_output" ]]; then
        pending="$fill_output"
    fi

    # Confirm
    read -r -p "  Save these legs? [y/N]: " confirm
    if [[ "$confirm" == [yY] ]]; then
        local result
        result=$(echo "$pending" | "$PYTHON" update_tracker.py --csv "$csv_path")
        echo ""
        echo "  ${green}${result}${reset}"
    else
        echo "  ${dim}Discarded.${reset}"
    fi
    echo ""
}

# ── Option 2: Check / install setup ──────────────────────────────────────────

check_setup() {
    echo ""
    echo "${bold}  Setup check${reset}"
    echo "${dim}  ────────────────────────────────────────────────────────${reset}"
    local ok=true

    # Python version
    local pyver
    pyver=$("$PYTHON" --version 2>&1)
    echo "  ${green}✓${reset}  $pyver  ($(command -v "$PYTHON"))"

    # pip3
    if command -v pip3 &>/dev/null; then
        echo "  ${green}✓${reset}  pip3 available"
    else
        echo "  ${yellow}⚠${reset}  pip3 not found — install via your package manager"
        ok=false
    fi

    # requirements.txt packages
    local req_file="$SCRIPT_DIR/requirements.txt"
    if [[ -f "$req_file" ]]; then
        echo ""
        echo "  ${bold}  Installing from requirements.txt…${reset}"
        if pip3 install -q --break-system-packages -r "$req_file"; then
            echo "  ${green}✓${reset}  All packages installed"
        else
            echo "  ${red}❌  pip3 install failed — check output above${reset}"
            ok=false
        fi
        # Report per-package status
        echo ""
        echo "  ${bold}  Package status:${reset}"
        while IFS= read -r pkg || [[ -n "$pkg" ]]; do
            [[ -z "$pkg" || "$pkg" == \#* ]] && continue
            local pkg_name="${pkg%%[>=<!]*}"   # strip version specifiers
            pkg_name="${pkg_name%% *}"
            if "$PYTHON" -c "import ${pkg_name//-/_}" 2>/dev/null || \
               "$PYTHON" -c "import ${pkg_name}" 2>/dev/null; then
                echo "  ${green}✓${reset}  $pkg_name"
            else
                echo "  ${red}❌${reset}  $pkg_name  (import failed after install)"
                ok=false
            fi
        done < "$req_file"
    else
        echo "  ${yellow}⚠${reset}  requirements.txt not found at $req_file"
        ok=false
    fi

    # LLM backend
    echo ""
    echo "  ${bold}  LLM backend:${reset}"
    local backend_ok=false
    if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
        local masked="${ANTHROPIC_API_KEY:0:10}…${ANTHROPIC_API_KEY: -4}"
        echo "  ${green}✓${reset}  ANTHROPIC_API_KEY set  ($masked)  → api backend"
        backend_ok=true
    else
        echo "  ${dim}–${reset}  ANTHROPIC_API_KEY not set"
        echo "       (to enable api backend: export ANTHROPIC_API_KEY=sk-ant-...)"
    fi
    if command -v claude &>/dev/null; then
        local claude_ver
        claude_ver=$(claude --version 2>/dev/null | head -1 || echo "unknown version")
        echo "  ${green}✓${reset}  claude CLI found  ($claude_ver)  → cli backend"
        backend_ok=true
    else
        echo "  ${dim}–${reset}  claude CLI not found in PATH"
        echo "       (to enable cli backend: install Claude Code)"
    fi
    if ! $backend_ok; then
        echo "  ${red}❌${reset}  No LLM backend available — at least one required"
        ok=false
    fi

    # Master data cache
    echo ""
    echo "  ${bold}  Master data cache:${reset}"
    local cache_status
    cache_status=$("$PYTHON" fetch_master.py --status 2>&1)
    while IFS= read -r line; do
        echo "  $line"
    done <<< "$cache_status"
    if echo "$cache_status" | grep -q "✗"; then
        echo ""
        echo "  ${yellow}  ⚠  Run option 3 (Refresh master data) to download.${reset}"
        ok=false
    fi

    echo ""
    if $ok; then
        echo "  ${green}${bold}  All checks passed — ready to use.${reset}"
    else
        echo "  ${yellow}  Some items need attention (see above).${reset}"
    fi
    echo ""
}

# ── Option 4: Copy flights between users ─────────────────────────────────────

copy_flights() {
    echo ""
    load_users

    if (( ${#user_names[@]} < 2 )); then
        echo "${red}  Need at least 2 users to copy flights.${reset}"; return 1
    fi

    # Source user
    echo "${bold}  Copy FROM:${reset}"
    for i in "${!user_names[@]}"; do
        printf "  %d) %s\n" $((i+1)) "${user_names[$i]}"
    done
    echo ""
    read -r -p "  Source user [1]: " src_choice
    src_choice="${src_choice:-1}"
    local src_idx=$(( src_choice - 1 ))
    if (( src_idx < 0 || src_idx >= ${#user_names[@]} )); then
        echo "${red}  Invalid selection.${reset}"; return 1
    fi
    local src_name="${user_names[$src_idx]}"
    local src_csv
    src_csv=$(resolve_csv "$src_name" "${user_paths[$src_idx]}")

    if [[ ! -f "$src_csv" ]]; then
        echo "${red}  File not found: $src_csv${reset}"; return 1
    fi

    # Destination user
    echo ""
    echo "${bold}  Copy TO:${reset}"
    for i in "${!user_names[@]}"; do
        (( i == src_idx )) && continue
        printf "  %d) %s\n" $((i+1)) "${user_names[$i]}"
    done
    echo ""
    read -r -p "  Destination user: " dst_choice
    local dst_idx=$(( dst_choice - 1 ))
    if (( dst_idx < 0 || dst_idx >= ${#user_names[@]} || dst_idx == src_idx )); then
        echo "${red}  Invalid selection.${reset}"; return 1
    fi
    local dst_name="${user_names[$dst_idx]}"
    local dst_csv
    dst_csv=$(resolve_csv "$dst_name" "${user_paths[$dst_idx]}")

    # Filter mode
    echo ""
    echo "${bold}  Filter by:${reset}"
    echo "  1) Trip tag"
    echo "  2) Date  (YYYY-MM-DD, or range YYYY-MM-DD:YYYY-MM-DD)"
    echo ""
    read -r -p "  Filter mode [1]: " filter_choice
    filter_choice="${filter_choice:-1}"

    local filter_json
    if [[ "$filter_choice" == "2" ]]; then
        # List available dates
        echo ""
        echo "${dim}  Available dates in $src_name:${reset}"
        "$PYTHON" -c '
import csv, sys
with open(sys.argv[1]) as f:
    rows = list(csv.DictReader(f))
dates = sorted({(r.get("Date") or "")[:10] for r in rows if r.get("Date","")[:4].isdigit()})
for d in dates:
    print(f"  {d}")
' "$src_csv"
        echo ""
        read -r -p "  Date or range (YYYY-MM-DD or YYYY-MM-DD:YYYY-MM-DD): " date_input
        if [[ -z "$date_input" ]]; then echo "${red}  No date entered.${reset}"; return 1; fi

        filter_json=$(echo "$date_input" | "$PYTHON" -c '
import csv, json, sys
date_input = sys.stdin.read().strip()
if ":" in date_input:
    d_from, d_to = date_input.split(":", 1)
else:
    d_from = d_to = date_input
with open(sys.argv[1]) as f:
    rows = list(csv.DictReader(f))
matched = [dict(r) for r in rows if d_from <= (r.get("Date") or "")[:10] <= d_to]
print(json.dumps(matched))
' "$src_csv")
    else
        # List available trips
        echo ""
        echo "${dim}  Available trips in $src_name:${reset}"
        "$PYTHON" -c '
import csv, sys
with open(sys.argv[1]) as f:
    rows = list(csv.DictReader(f))
trips = sorted({r.get("Trip","") for r in rows if r.get("Trip","")})
for t in trips:
    count = sum(1 for r in rows if r.get("Trip","") == t)
    print(f"  {t}  ({count} legs)")
' "$src_csv"
        echo ""
        read -r -p "  Trip tag: " trip_input
        if [[ -z "$trip_input" ]]; then echo "${red}  No trip entered.${reset}"; return 1; fi

        filter_json=$(echo "$trip_input" | "$PYTHON" -c '
import csv, json, sys
trip = sys.stdin.read().strip()
with open(sys.argv[1]) as f:
    rows = list(csv.DictReader(f))
matched = [dict(r) for r in rows if r.get("Trip","") == trip]
print(json.dumps(matched))
' "$src_csv")
    fi

    # Preview
    local count
    count=$(echo "$filter_json" | "$PYTHON" -c 'import json,sys; print(len(json.loads(sys.stdin.read())))')
    if [[ "$count" == "0" ]]; then
        echo "${red}  No matching flights found.${reset}"; return 1
    fi

    echo ""
    echo "${bold}  $count leg(s) to copy  $src_name → $dst_name:${reset}"
    echo "$filter_json" | "$PYTHON" -c '
import json, sys
rows = json.loads(sys.stdin.read())
for r in rows:
    date = (r.get("Date") or "")[:10]
    fn   = r.get("Flight_Number", "?")
    fr   = r.get("From", "?")
    to   = r.get("To", "?")
    trip = r.get("Trip", "")
    print(f"  {date}  {fn}  {fr} -> {to}  {trip}")
'
    # Seat numbers
    echo "  Seats (space or comma separated, blanks ok — e.g. \"12A , 14B\" or just Enter to skip):"
    read -r -p "  Seats [$count blank]: " seats_input

    if [[ -n "$seats_input" ]]; then
        filter_json=$(echo "$filter_json" | "$PYTHON" -c '
import json, re, sys
rows  = json.loads(sys.stdin.read())
raw   = sys.argv[1]
# Split on comma or whitespace, preserve empty slots from consecutive separators
tokens = re.split(r"[,\s]+", raw.strip()) if raw.strip() else []
SEAT_TYPE_MAP = {"A":"A","B":"M","C":"A","D":"A","E":"M","F":"W","K":"W"}
for i, row in enumerate(rows):
    seat = tokens[i].strip().upper() if i < len(tokens) else ""
    row["Seat"] = seat
    last = seat[-1] if seat else ""
    row["Seat_Type"] = SEAT_TYPE_MAP.get(last, "")
print(json.dumps(rows))
' "$seats_input")
    fi

    echo ""
    read -r -p "  Copy these legs to $dst_name? [y/N]: " confirm
    if [[ "$confirm" == [yY] ]]; then
        local result
        result=$(echo "$filter_json" | "$PYTHON" update_tracker.py --csv "$dst_csv")
        echo ""
        echo "  ${green}${result}${reset}"
    else
        echo "  ${dim}Cancelled.${reset}"
    fi
    echo ""
}

# ── Option 5: Refresh master data ────────────────────────────────────────────

refresh_master() {
    echo ""
    echo "  Refreshing OpenFlights master data…"
    echo ""
    local force=""
    read -r -p "  Force re-download even if fresh? [y/N]: " force_input
    [[ "$force_input" == [yY] ]] && force="--refresh"
    echo ""
    "$PYTHON" fetch_master.py $force
    echo ""
}

# ── Main menu ─────────────────────────────────────────────────────────────────

check_deps

while true; do
    print_header
    echo "  1) Add flights"
    echo "  2) Copy flights between users"
    echo "  3) Check / install setup"
    echo "  4) Refresh master data"
    echo "  5) Exit"
    echo ""
    read -r -p "  Select option: " choice
    case "$choice" in
        1) add_flights   ;;
        2) copy_flights  ;;
        3) check_setup   ;;
        4) refresh_master;;
        5|q|Q|"") echo ""; echo "  ${dim}Bye.${reset}"; echo ""; exit 0 ;;
        *) echo "  ${yellow}Invalid option.${reset}" ;;
    esac
done
