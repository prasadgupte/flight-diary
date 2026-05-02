#!/usr/bin/env python3
"""
group_trips.py — Flight tracker trip grouper

Groups flights into trips based on departure from home airports configured in
flights.json (sibling file). Prefixes the Note column with a trip name:

    yymm-CITY-m

  yymm  = year + month of trip departure (e.g. 2501)
  CITY  = IATA code of main destination (airport with longest stay in trip)
  m     = w (work/business) or f (fun/leisure), based on dominant Reason

Trip rules:
  - A trip starts when departing from a home airport.
  - A trip closes when arriving at a home airport.
  - Round-trip: return to the SAME home city within max_trip_days.
  - Open jaw : return to a DIFFERENT home city, OR trip exceeds max_trip_days.
  - If a new home-departure is seen while a trip is open, the previous trip
    is force-closed (missing return flight assumed).

Saves an updated copy alongside the original with a _YYYYMMDD_HHMMSS suffix.

Configuration (flights.json, same directory as this script):
  home_airports  — dict mapping IATA code → canonical city group
  max_trip_days  — integer, trips longer than this are open-jaw (default: 40)

Usage:
    python group_trips.py <flight_tracker.csv>
"""

import csv
import json
import os
import sys
from datetime import datetime, timedelta


# ---------------------------------------------------------------------------
# Load config from flights.json
# ---------------------------------------------------------------------------

def load_config():
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'flights.json')
    if not os.path.exists(config_path):
        sys.exit(f'Error: flights.json not found at {config_path}')
    with open(config_path, encoding='utf-8') as f:
        cfg = json.load(f)
    home_airports = cfg.get('home_airports')
    if not home_airports:
        sys.exit('Error: flights.json missing "home_airports" key')
    max_trip_days = cfg.get('max_trip_days', 40)
    return home_airports, int(max_trip_days)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_date(s):
    s = s.strip()
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    raise ValueError(f'Cannot parse date: {s!r}')


def is_home(airport, home_airports):
    return airport in home_airports


def home_group(airport, home_airports):
    return home_airports.get(airport)


def main_destination(flights):
    """
    Return the IATA code of the main destination of a trip.

    Uses the largest gap between consecutive flights as a proxy for where the
    traveller actually stayed longest. Falls back to the To of the last flight
    if only one flight in the trip.
    """
    if len(flights) == 1:
        return flights[0]['To']

    max_gap = timedelta(seconds=-1)
    best_city = flights[-1]['From']  # safe fallback

    for i in range(len(flights) - 1):
        gap = flights[i + 1]['_date'] - flights[i]['_date']
        if gap > max_gap:
            max_gap = gap
            best_city = flights[i]['To']

    return best_city


def trip_mode(flights):
    """Return 'w' (work) or 'f' (fun) based on dominant Reason code (B vs L)."""
    b = sum(1 for f in flights if f['Reason'] == 'B')
    l = sum(1 for f in flights if f['Reason'] == 'L')
    return 'w' if b >= l else 'f'


def build_trip_name(flights):
    first = flights[0]
    yymm = first['_date'].strftime('%y%m')
    city = main_destination(flights)
    mode = trip_mode(flights)
    return f'{yymm}-{city}-{mode}'


# ---------------------------------------------------------------------------
# Core trip grouping
# ---------------------------------------------------------------------------

def group_trips(sorted_rows, home_airports, max_trip_days):
    """
    sorted_rows   : list of (orig_idx, row_dict), sorted ascending by _date.
    home_airports : dict mapping IATA code → canonical city group (from config).
    max_trip_days : int, trips longer than this are classified as open-jaw.

    Returns a dict mapping orig_idx → trip_name for every flight that could
    be assigned to a trip.
    """
    trip_map = {}       # orig_idx → trip_name
    current = []        # list of (orig_idx, row_dict) for the open trip
    origin_home = None  # home city group where current trip started

    def close_trip(label=''):
        nonlocal current, origin_home
        if not current:
            return
        flights = [r for _, r in current]
        name = build_trip_name(flights)
        for idx, _ in current:
            trip_map[idx] = name
        if label:
            first_date = flights[0]['_date'].date()
            last_date  = flights[-1]['_date'].date()
            print(f'  [{label:12s}] {name}  ({first_date} → {last_date}, {len(flights)} legs)')
        current.clear()
        origin_home = None

    print('Trip detection log:')
    for orig_idx, row in sorted_rows:
        fr = row['From']
        to = row['To']

        if is_home(fr, home_airports):
            if current:
                # New home departure while a trip is still open → force-close
                close_trip('incomplete')
            # Start a new trip
            current.append((orig_idx, row))
            origin_home = home_group(fr, home_airports)

        elif current:
            # Mid-trip flight: accumulate
            current.append((orig_idx, row))

            if is_home(to, home_airports):
                # Trip lands at home — determine type and close
                arrival = home_group(to, home_airports)
                flights = [r for _, r in current]
                duration = flights[-1]['_date'] - flights[0]['_date']
                if arrival == origin_home and duration.days <= max_trip_days:
                    close_trip('round-trip')
                else:
                    close_trip('open-jaw')

        # Flights departing from non-home with no active trip: unassigned

    # Close any remaining open trip (e.g. most recent trip not yet returned)
    close_trip('still-open')

    return trip_map


# ---------------------------------------------------------------------------
# Note column update
# ---------------------------------------------------------------------------

def prefix_note(existing, trip_name):
    """Prepend trip_name to an existing Note value."""
    existing = existing.strip()
    return f'{trip_name} | {existing}' if existing else trip_name


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(csv_path):
    # Load config
    home_airports, max_trip_days = load_config()

    # Read
    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        all_rows = list(reader)

    if 'Note' not in fieldnames:
        sys.exit("Error: expected a 'Note' column in the CSV header.")

    # Parse dates (in-place, using a helper key)
    for row in all_rows:
        row['_date'] = parse_date(row['Date'])

    # Sort ascending for trip detection
    sorted_rows = sorted(enumerate(all_rows), key=lambda x: x[1]['_date'])

    # Group trips
    trip_map = group_trips(sorted_rows, home_airports, max_trip_days)

    # Apply trip names to the Note column
    updated = 0
    for orig_idx, trip_name in trip_map.items():
        row = all_rows[orig_idx]
        row['Note'] = prefix_note(row['Note'], trip_name)
        updated += 1

    # Remove the helper key before writing
    for row in all_rows:
        del row['_date']

    # Build timestamped output path
    base, ext = os.path.splitext(csv_path)
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    out_path = f'{base}_{ts}{ext}'

    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f'\nUpdated {updated} rows → {out_path}')

    # Summary table
    trip_flights = {}
    for idx, name in trip_map.items():
        trip_flights.setdefault(name, []).append(idx)

    print(f'\n{"Trip name":<20}  {"Legs":>4}')
    print('-' * 30)
    for name in sorted(trip_flights):
        print(f'{name:<20}  {len(trip_flights[name]):>4}')
    print(f'\nTotal trips: {len(trip_flights)}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(f'Usage: python {os.path.basename(sys.argv[0])} <flight_tracker.csv>')
        sys.exit(1)
    main(sys.argv[1])
