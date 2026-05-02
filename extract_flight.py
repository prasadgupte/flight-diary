#!/usr/bin/env python3
"""
extract_flight.py — Parse raw itinerary text → structured flight rows via Claude Haiku.

Reads master indexes from ~/.cache/flight_viewer/ (run fetch_master.py first).
Reads airline overrides from flights.json (airline_codes section).

Output:
  stdout — JSON array of CSV-ready row dicts
  stderr — human-readable summary + warnings

CLI:
    python3 extract_flight.py [options]          # reads from stdin
    python3 extract_flight.py [options] "text"   # text as argument

Options:
    --reason L|B|O          Flight reason: L=Leisure, B=Business, O=Other (default: L)
    --trip TAG              Trip tag, e.g. 2510-BOM-f (optional)
    --note TEXT             Note text (optional)
    --flights-json PATH     Path to flights.json (default: flights.json in script dir)
"""

import json, math, os, re, subprocess, sys
from pathlib import Path

CACHE_DIR = Path.home() / ".cache" / "flight_viewer"
SCRIPT_DIR = Path(__file__).resolve().parent

# ── Index loading ─────────────────────────────────────────────────────────────

_indexes: dict = {}


def _load_indexes():
    global _indexes
    if _indexes:
        return
    for name, fname in [
        ("airports", "airports_by_iata.json"),
        ("airlines", "airlines_by_iata.json"),
        ("aircraft", "aircraft_by_iata.json"),
    ]:
        p = CACHE_DIR / fname
        if p.exists():
            _indexes[name] = json.loads(p.read_text())


def _airports() -> dict:
    _load_indexes()
    return _indexes.get("airports", {})


def _airlines() -> dict:
    _load_indexes()
    return _indexes.get("airlines", {})


def _aircraft() -> dict:
    _load_indexes()
    return _indexes.get("aircraft", {})


# ── flights.json helpers ──────────────────────────────────────────────────────

_flights_cfg: dict = {}


def _load_flights_json(path: Path):
    global _flights_cfg
    if _flights_cfg:
        return
    try:
        _flights_cfg = json.loads(path.read_text())
    except Exception as e:
        print(f"⚠  Could not read {path}: {e}", file=sys.stderr)
        _flights_cfg = {}


def _airline_codes() -> dict:
    return _flights_cfg.get("airline_codes", {})


# ── Distance (haversine) ──────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return round(2 * R * math.asin(math.sqrt(a)))


# ── OID cross-reference ───────────────────────────────────────────────────────

def _xref(leg: dict) -> dict:
    """Enrich a leg dict with OIDs, airline name, aircraft name, and distance."""
    airports = _airports()
    airlines = _airlines()
    aircraft = _aircraft()
    codes    = _airline_codes()

    from_iata = leg.get("from_iata", "").upper()
    to_iata   = leg.get("to_iata", "").upper()
    al_iata   = leg.get("airline_iata", "").upper()
    ac_iata   = leg.get("aircraft_iata", "").upper()

    from_info = airports.get(from_iata, {})
    to_info   = airports.get(to_iata, {})
    ac_info   = aircraft.get(ac_iata, {}) if ac_iata else {}

    # Airline: flights.json override first, then OpenFlights
    al_override = codes.get(al_iata, {})
    if al_override:
        al_name = al_override.get("name", al_iata)
        al_oid  = int(al_override.get("oid", 0))
    else:
        al_info = airlines.get(al_iata, {})
        al_name = al_info.get("name", al_iata)
        al_oid  = al_info.get("id", 0)

    # Distance
    distance = ""
    if from_info and to_info:
        try:
            distance = str(_haversine(
                from_info["lat"], from_info["lon"],
                to_info["lat"],   to_info["lon"],
            ))
        except Exception:
            pass

    return {
        **leg,
        "airline_name":  al_name,
        "aircraft_name": ac_info.get("name", ""),
        "From_OID":      from_info.get("id", 0),
        "To_OID":        to_info.get("id", 0),
        "Airline_OID":   al_oid,
        "Plane_OID":     ac_info.get("oid", 0),
        "distance":      distance,
    }


# ── CSV row builder ───────────────────────────────────────────────────────────

_SEAT_TYPE_MAP = {"A": "A", "B": "M", "C": "A", "D": "A", "E": "M", "F": "W", "K": "W"}


def _build_csv_row(leg: dict, reason: str, trip: str, note: str) -> dict:
    seat     = leg.get("seat", "").upper()
    seat_let = seat[-1] if seat else ""
    dep_time = leg.get("dep_time", "")
    date_str = leg.get("date", "")
    dt_str   = f"{date_str} {dep_time}:00" if dep_time and date_str else date_str

    return {
        "Date":          dt_str,
        "From":          leg.get("from_iata", ""),
        "To":            leg.get("to_iata", ""),
        "Flight_Number": leg.get("flight_number", ""),
        "Airline":       leg.get("airline_name", ""),
        "Distance":      leg.get("distance", ""),
        "Duration":      leg.get("duration", ""),
        "Seat":          seat,
        "Seat_Type":     _SEAT_TYPE_MAP.get(seat_let, ""),
        "Class":         leg.get("class_code", "") or "Y",
        "Reason":        reason,
        "Plane":         leg.get("aircraft_name", ""),
        "Registration":  "",
        "Trip":          trip,
        "Note":          note,
        "From_OID":      leg.get("From_OID", 0),
        "To_OID":        leg.get("To_OID", 0),
        "Airline_OID":   leg.get("Airline_OID", 0),
        "Plane_OID":     leg.get("Plane_OID", 0),
        # Display-only — not written to CSV (update_tracker.py uses extrasaction="ignore")
        "arr_time":      leg.get("arr_time", ""),
    }


# ── Summary formatter ─────────────────────────────────────────────────────────

_CLASS_NAMES = {
    "C": "Business", "F": "First", "Y": "Economy",
    "W": "Prem. Eco", "Q": "Basic",
}


def _format_summary(rows: list[dict], warnings: list[str]) -> str:
    n = len(rows)
    lines = [f"\n✈  {n} leg{'s' if n != 1 else ''} extracted\n"]
    for i, row in enumerate(rows):
        date_full = row.get("Date", "") or ""
        date_str  = date_full[:10]
        dep_time  = date_full[11:16] if len(date_full) > 10 else ""
        arr_time  = row.get("arr_time", "") or ""
        fnum      = row.get("Flight_Number", "?")
        frm       = row.get("From", "?")
        to        = row.get("To", "?")
        airline   = row.get("Airline", "")
        plane     = row.get("Plane", "")
        seat      = row.get("Seat", "")
        cls_raw   = row.get("Class", "")
        cls       = _CLASS_NAMES.get(cls_raw, cls_raw)
        dur       = row.get("Duration", "")
        dist      = row.get("Distance", "")
        dist_str  = f"  {dist} km" if dist else ""
        from_oid  = row.get("From_OID", 0)
        to_oid    = row.get("To_OID", 0)

        # Build time bracket
        if dep_time and arr_time:
            time_str = f"  {dep_time} → {arr_time}"
        elif dep_time:
            time_str = f"  {dep_time}"
        else:
            time_str = ""
        bracket = f"[{date_str}{time_str}]" if date_str else ""

        lines.append(f"  Leg {i+1}: {fnum}  {frm} → {to}  {bracket}")

        # Detail line — collect missing fields
        missing = []
        plane_str = plane if plane else None
        seat_str  = f"seat {seat}" if seat else None
        cls_str   = cls if cls else None
        dur_str   = dur if dur else None

        if not plane:    missing.append("aircraft")
        if not seat:     missing.append("seat")
        if not dur:      missing.append("duration")
        if not dep_time: missing.append("dep_time")
        if not arr_time: missing.append("arr_time")

        detail_parts = [
            airline,
            plane_str or "—",
            seat_str or "—",
            cls_str or "—",
            dur_str or "—",
        ]
        lines.append(f"          {'  ·  '.join(detail_parts)}{dist_str}")

        if from_oid or to_oid:
            lines.append(f"          OIDs: {from_oid} → {to_oid}")
        if missing:
            lines.append(f"          ⚠ not found: {', '.join(missing)}")
        lines.append("")

    for w in warnings:
        lines.append(f"  ⚠  {w}")
    if warnings:
        lines.append("")

    return "\n".join(lines)


# ── LLM extraction (Claude Haiku) ─────────────────────────────────────────────

def _build_prompt(text: str) -> str:
    return f"""You are a flight data extractor. Extract all flight legs from the booking text below.

The input may be an email confirmation, GDS/PNR snippet, travel itinerary, or natural language.
Convert any airport or city name to its 3-letter IATA code (e.g. "Berlin Brandenburg Airport" → "BER",
"Dusseldorf" → "DUS", "Heathrow" → "LHR", "Mumbai" → "BOM", "Frankfurt" → "FRA").
For codeshare flights, use the OPERATING carrier — return its 2-letter IATA code in airline_iata
and its flight number in flight_number (e.g. LH8996 operated by United Airlines → flight_number: "UA251", airline_iata: "UA").
Times may be local — return them as-is in HH:MM 24h format.
Dates in DD.MM.YYYY, DD MON YYYY, or any other format → convert to YYYY-MM-DD.
Cabin class → class_code: Economy→"Y"; Business/Club World/Club Europe/Business Flex→"C";
Premium Economy→"W"; First/First Class→"F"; Basic/Light/Basic Q→"Q".
If duration is not stated, compute it from dep_time and arr_time accounting for local time zones
(e.g. BER dep 10:40 CET → FRA arr 11:50 CET = 01:10). Return HH:MM.
For aircraft, return the standard IATA equipment code (e.g. "320"=A320, "321"=A321,
"359"=A350-900, "333"=A330-300, "789"=787-9, "77W"=777-300ER, "738"=737-800, "74H"=747-8).

Return a JSON array (one object per leg) with EXACTLY these fields:
  flight_number  — operating carrier flight number, e.g. "LH402"
  airline_iata   — 2-letter IATA code of operating carrier, e.g. "LH"
  from_iata      — 3-letter IATA code
  to_iata        — 3-letter IATA code
  date           — YYYY-MM-DD
  dep_time       — HH:MM (24h)
  arr_time       — HH:MM (24h)
  seat           — e.g. "12A" or ""
  class_code     — one of: C, F, Y, W, Q
  aircraft_iata  — IATA equipment code, e.g. "320" or ""
  duration       — HH:MM (computed if not stated) or ""

Return ONLY the raw JSON array. No markdown, no explanation.

Text:
{text}"""


def _parse_raw(raw: str) -> list[dict]:
    """Parse raw LLM text → list of leg dicts."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    parsed = json.loads(raw)
    if isinstance(parsed, dict):
        parsed = [parsed]
    result = []
    for item in parsed:
        result.append({
            "flight_number": item.get("flight_number", ""),
            "airline_iata":  item.get("airline_iata", "").upper(),
            "from_iata":     item.get("from_iata", "").upper(),
            "to_iata":       item.get("to_iata", "").upper(),
            "date":          item.get("date", ""),
            "dep_time":      item.get("dep_time", ""),
            "arr_time":      item.get("arr_time", ""),
            "seat":          item.get("seat", ""),
            "class_code":    item.get("class_code", ""),
            "aircraft_iata": item.get("aircraft_iata", ""),
            "duration":      item.get("duration", ""),
        })
    return result


def _call_claude_api(text: str) -> list[dict]:
    """Use anthropic Python package (requires ANTHROPIC_API_KEY)."""
    try:
        import anthropic
    except ImportError:
        raise RuntimeError("anthropic package not installed. Run: pip3 install anthropic")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY environment variable not set")

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[{"role": "user", "content": _build_prompt(text)}],
    )
    return _parse_raw(response.content[0].text)


def _call_claude_cli(text: str) -> list[dict]:
    """Use `claude -p` CLI (Claude Code, no API key needed)."""
    import shutil
    if not shutil.which("claude"):
        raise RuntimeError("`claude` CLI not found in PATH. Install Claude Code or use --backend api.")

    # Strip ANTHROPIC_API_KEY so the CLI uses its OAuth session, not an external key.
    # If ANTHROPIC_API_KEY is present in the environment, the claude CLI treats it as
    # an external API key and bypasses the logged-in account.
    env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}

    result = subprocess.run(
        ["claude", "-p", _build_prompt(text), "--model", "claude-haiku-4-5-20251001"],
        capture_output=True,
        text=True,
        env=env,
    )
    if result.returncode != 0:
        err = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(f"`claude` CLI exited {result.returncode}: {err}")
    return _parse_raw(result.stdout)


def _call_claude(text: str, backend: str = "auto") -> list[dict]:
    """Route to api or cli backend. 'auto' tries api first, falls back to cli."""
    if backend == "api":
        return _call_claude_api(text)
    if backend == "cli":
        return _call_claude_cli(text)
    # auto
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    has_pkg = True
    try:
        import anthropic  # noqa: F401
    except ImportError:
        has_pkg = False
    if api_key and has_pkg:
        return _call_claude_api(text)
    return _call_claude_cli(text)


# ── Main pipeline ─────────────────────────────────────────────────────────────

def extract(text: str, reason: str, trip: str, note: str, flights_json: Path,
            backend: str = "auto") -> list[dict]:
    _load_flights_json(flights_json)
    _load_indexes()

    warnings = []
    if not _indexes.get("airports"):
        warnings.append("Master indexes not found — run: python3 fetch_master.py")

    print("  Calling Claude Haiku…", file=sys.stderr, flush=True)
    try:
        raw_legs = _call_claude(text, backend)
    except Exception as e:
        print(f"❌ LLM extraction failed: {e}", file=sys.stderr)
        sys.exit(1)

    if not raw_legs:
        print("❌ No flight legs found in the text.", file=sys.stderr)
        sys.exit(1)

    csv_rows = []
    for leg in raw_legs:
        enriched = _xref(leg)

        if not enriched.get("From_OID"):
            warnings.append(f"Unknown origin airport: {leg.get('from_iata', '?')}")
        if not enriched.get("To_OID"):
            warnings.append(f"Unknown destination airport: {leg.get('to_iata', '?')}")

        csv_rows.append(_build_csv_row(enriched, reason, trip, note))

    print(_format_summary(csv_rows, warnings), file=sys.stderr)
    return csv_rows


# ── CLI ───────────────────────────────────────────────────────────────────────

def _parse_args(args: list[str]) -> tuple[str, str, str, str, Path, str]:
    reason       = "L"
    trip         = ""
    note         = ""
    text_arg     = ""
    flights_json = SCRIPT_DIR / "flights.json"
    backend      = "auto"

    i = 0
    while i < len(args):
        if args[i] == "--reason" and i + 1 < len(args):
            reason = args[i + 1].upper()
            i += 2
        elif args[i] == "--trip" and i + 1 < len(args):
            trip = args[i + 1]
            i += 2
        elif args[i] == "--note" and i + 1 < len(args):
            note = args[i + 1]
            i += 2
        elif args[i] == "--flights-json" and i + 1 < len(args):
            flights_json = Path(args[i + 1])
            i += 2
        elif args[i] == "--backend" and i + 1 < len(args):
            backend = args[i + 1].lower()
            i += 2
        elif not args[i].startswith("--"):
            text_arg = args[i]
            i += 1
        else:
            i += 1

    return reason, trip, note, text_arg, flights_json, backend


if __name__ == "__main__":
    reason, trip, note, text_arg, flights_json, backend = _parse_args(sys.argv[1:])

    if text_arg:
        raw_text = text_arg
    else:
        raw_text = sys.stdin.read().strip()

    if not raw_text:
        print("Usage: python3 extract_flight.py [--reason L|B|O] [--trip TAG] [--note TEXT]",
              file=sys.stderr)
        print("                                 [--backend auto|api|cli] [text]", file=sys.stderr)
        print("       (or pipe/paste text on stdin)", file=sys.stderr)
        sys.exit(1)

    rows = extract(raw_text, reason, trip, note, flights_json, backend)
    # JSON → stdout (for bash to capture)
    print(json.dumps(rows, indent=2))
