#!/usr/bin/env python3
"""
normalize_airlines.py — Airline name normalizer

Reads airline_codes from flights.json and audits/fixes the Airline (and
Airline_OID) columns in a flight tracker CSV.

For each row it:
  1. Extracts the flight-number prefix (ICAO 3-letter first, then IATA 2-char)
  2. Looks the prefix up in airline_codes
  3. Reports any mismatch between the stored Airline name and the canonical one
  4. With --fix: writes a corrected copy (timestamped suffix, original untouched)

Usage:
    python normalize_airlines.py <flight_tracker.csv>            # audit only
    python normalize_airlines.py --fix <flight_tracker.csv>      # audit + fix
"""

import csv
import json
import os
import re
import sys
from datetime import datetime


# ---------------------------------------------------------------------------
# Load config
# ---------------------------------------------------------------------------

def load_config():
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'flights.json')
    if not os.path.exists(config_path):
        sys.exit(f'Error: flights.json not found at {config_path}')
    with open(config_path, encoding='utf-8') as f:
        cfg = json.load(f)
    codes = cfg.get('airline_codes')
    if not codes:
        sys.exit('Error: flights.json missing "airline_codes" key')
    return codes


# ---------------------------------------------------------------------------
# Prefix extraction
# ---------------------------------------------------------------------------

def extract_prefix(flight_number):
    """
    Extract the airline prefix from a flight number.

    Priority:
      1. 3-letter all-alpha ICAO prefix  (e.g. EJU from EJU8628)
      2. 2-char IATA prefix — alpha+alpha, alpha+digit, digit+alpha
         (e.g. LH from LH434, 6E from 6E95, U2 from U2 8217)
      3. Single leading alpha (fallback, rarely needed)

    Spaces in the flight number are ignored.
    """
    fn = flight_number.replace(' ', '').strip()
    # ICAO: 3 uppercase letters followed by digits
    m = re.match(r'^([A-Z]{3})\d', fn)
    if m:
        return m.group(1)
    # IATA: 2 chars (alpha+alpha, alpha+digit, digit+alpha) followed by digits
    m = re.match(r'^([A-Z][A-Z0-9]|[0-9][A-Z])\d', fn)
    if m:
        return m.group(1)
    # Fallback: single letter
    m = re.match(r'^([A-Z])\d', fn)
    if m:
        return m.group(1)
    return None


# ---------------------------------------------------------------------------
# Audit + fix
# ---------------------------------------------------------------------------

def normalize(csv_path, fix=False):
    airline_codes = load_config()

    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    mismatches = []

    for i, row in enumerate(rows):
        prefix = extract_prefix(row['Flight_Number'])
        if not prefix or prefix not in airline_codes:
            continue

        canonical = airline_codes[prefix]
        stored_name = row['Airline'].strip()
        stored_oid  = row['Airline_OID'].strip()

        name_ok = stored_name.lower() == canonical['name'].lower()
        oid_ok  = stored_oid == canonical['oid']

        if not name_ok or not oid_ok:
            mismatches.append({
                'row':    i + 2,  # 1-based + header
                'date':   row['Date'].split()[0],
                'flight': row['Flight_Number'].strip(),
                'prefix': prefix,
                'stored_name': stored_name,
                'stored_oid':  stored_oid,
                'canon_name':  canonical['name'],
                'canon_oid':   canonical['oid'],
            })
            if fix:
                row['Airline']     = canonical['name']
                row['Airline_OID'] = canonical['oid']

    # Report
    if not mismatches:
        print('No mismatches found — all airline names match the airline_codes table.')
    else:
        print(f'{"Row":>4}  {"Date":>10}  {"Flight":>10}  {"Prefix":>5}  {"Stored name":<30}  {"Canonical name":<30}  {"OID fix"}')
        print('-' * 115)
        for m in mismatches:
            oid_change = '' if m['stored_oid'] == m['canon_oid'] else f'{m["stored_oid"]} → {m["canon_oid"]}'
            print(f'{m["row"]:>4}  {m["date"]:>10}  {m["flight"]:>10}  {m["prefix"]:>5}  '
                  f'{m["stored_name"]:<30}  {m["canon_name"]:<30}  {oid_change}')
        print(f'\nTotal mismatches: {len(mismatches)}')

    # Prefixes with no entry in airline_codes (just informational)
    unknown = set()
    for row in rows:
        p = extract_prefix(row['Flight_Number'])
        if p and p not in airline_codes:
            unknown.add((p, row['Airline'].strip()))
    if unknown:
        print(f'\nPrefixes not in airline_codes (add them if you fly these again):')
        for p, name in sorted(unknown):
            print(f'  {p:6s} → {name}')

    # Write fixed file
    if fix and mismatches:
        base, ext = os.path.splitext(csv_path)
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        out_path = f'{base}_{ts}{ext}'
        with open(out_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f'\nFixed file written → {out_path}')
    elif fix:
        print('\nNothing to fix.')


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    args = sys.argv[1:]
    fix = '--fix' in args
    paths = [a for a in args if not a.startswith('--')]

    if not paths:
        print(f'Usage: python {os.path.basename(sys.argv[0])} [--fix] <flight_tracker.csv>')
        sys.exit(1)

    normalize(paths[0], fix=fix)
