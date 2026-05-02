#!/usr/bin/env python3
"""
update_tracker.py — Append extracted flight rows to a tracker CSV.

Reads JSON from stdin (output of extract_flight.py), appends to the CSV,
sorts all rows by Date ascending, and writes back in-place.

CLI:
    python3 update_tracker.py --csv PATH/TO/tracker.csv
    echo '[{...}]' | python3 update_tracker.py --csv data/openflights_tracker_prasad.csv
"""

import csv, json, sys
from pathlib import Path

CSV_COLUMNS = [
    "Date", "From", "To", "Flight_Number", "Airline", "Distance", "Duration",
    "Seat", "Seat_Type", "Class", "Reason", "Plane", "Registration", "Trip",
    "Note", "From_OID", "To_OID", "Airline_OID", "Plane_OID",
]


def _sort_key(row: dict) -> str:
    """Sort key: Date string (YYYY-MM-DD HH:MM:SS or YYYY-MM-DD)."""
    return (row.get("Date") or "").strip()


def commit(legs: list[dict], csv_path: Path) -> str:
    """Append legs to CSV, sort by Date, write in-place. Returns confirmation."""
    if not legs:
        return "⚠  No flight legs to save."

    # Read existing rows
    existing = []
    if csv_path.exists():
        with open(csv_path, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing.append(row)

    # Normalise new rows to CSV_COLUMNS only
    new_rows = []
    for leg in legs:
        row = {col: str(leg.get(col, "")) for col in CSV_COLUMNS}
        new_rows.append(row)

    # Merge + sort
    all_rows = existing + new_rows
    all_rows.sort(key=_sort_key)

    # Write in-place
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS, extrasaction="ignore",
                                quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(all_rows)

    n   = len(new_rows)
    frm = new_rows[0].get("From", "")
    to  = new_rows[-1].get("To", "")
    return f"✅ {n} flight leg{'s' if n != 1 else ''} saved to {csv_path}  ({frm} → {to})"


if __name__ == "__main__":
    args = sys.argv[1:]

    # Parse --csv
    csv_path = None
    i = 0
    while i < len(args):
        if args[i] == "--csv" and i + 1 < len(args):
            csv_path = Path(args[i + 1])
            i += 2
        else:
            i += 1

    if not csv_path:
        print("Usage: python3 update_tracker.py --csv PATH/TO/tracker.csv", file=sys.stderr)
        print("       (pipe JSON from extract_flight.py on stdin)", file=sys.stderr)
        sys.exit(1)

    raw = sys.stdin.read().strip()
    if not raw:
        print("❌ No JSON input on stdin.", file=sys.stderr)
        sys.exit(1)

    try:
        legs = json.loads(raw)
        if isinstance(legs, dict):
            legs = legs.get("legs", [legs])
    except Exception as e:
        print(f"❌ Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    result = commit(legs, csv_path)
    print(result)
    sys.exit(0 if result.startswith("✅") else 1)
