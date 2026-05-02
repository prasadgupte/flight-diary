#!/usr/bin/env python3
"""
fetch_master.py — Download and cache OpenFlights master data.
Builds fast-lookup JSON indexes in ~/.cache/flight_viewer/.

Cache max age: 24h (use --refresh to force re-download).

CLI:
    python3 fetch_master.py              # fetch if stale
    python3 fetch_master.py --refresh    # force re-download
    python3 fetch_master.py --status     # show cache ages
"""

import csv, json, sys, datetime
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError

PROJECT_DIR = Path(__file__).parent          # project root (same dir as fetch_master.py)
CACHE_DIR   = PROJECT_DIR / "master_data"   # gitignored local cache
MAX_AGE_H   = 24

OPENFLIGHTS_URLS = {
    "airports": "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports-extended.dat",
    "airlines": "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat",
    "aircraft": "https://raw.githubusercontent.com/jpatokal/openflights/master/data/planes.dat",
    "routes":   "https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat",
}

INDEX_NAMES = {
    "airports": "airports_by_iata.json",
    "airlines": "airlines_by_iata.json",
    "aircraft": "aircraft_by_iata.json",
    "routes":   "routes_idx.json",
}


# ── Cache helpers ─────────────────────────────────────────────────────────────

def _load_meta() -> dict:
    p = CACHE_DIR / "meta.json"
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            pass
    return {}


def _save_meta(meta: dict):
    (CACHE_DIR / "meta.json").write_text(json.dumps(meta, indent=2))


def _is_fresh(meta: dict, name: str) -> bool:
    fetched_at = meta.get(name, {}).get("fetched_at")
    if not fetched_at:
        return False
    try:
        ts  = datetime.datetime.fromisoformat(fetched_at)
        age = datetime.datetime.now(datetime.timezone.utc) - ts
        return age.total_seconds() < MAX_AGE_H * 3600
    except Exception:
        return False


# ── Download ──────────────────────────────────────────────────────────────────

def _download(name: str, url: str) -> Path:
    dat_path = CACHE_DIR / f"{name}.dat"
    print(f"  ↓ {name}  {url}", flush=True)
    try:
        with urlopen(url, timeout=30) as resp:
            dat_path.write_bytes(resp.read())
    except URLError as e:
        raise RuntimeError(f"Download failed: {e}") from e
    return dat_path


# ── Index builders ─────────────────────────────────────────────────────────────

def _safe_int(s: str) -> int:
    try:
        return int(s.strip('"'))
    except (ValueError, AttributeError):
        return 0


def _safe_float(s: str) -> float:
    try:
        return float(s.strip('"'))
    except (ValueError, AttributeError):
        return 0.0


def _build_airports_index(dat: Path) -> Path:
    """airports-extended.dat → airports_by_iata.json
    {IATA: {id, name, city, country, iata, lat, lon}}
    Columns: 0=ID, 1=Name, 2=City, 3=Country, 4=IATA, 5=ICAO, 6=Lat, 7=Lon
    """
    idx = {}
    with open(dat, newline="", encoding="utf-8", errors="replace") as f:
        for row in csv.reader(f):
            if len(row) < 8:
                continue
            oid     = _safe_int(row[0])
            name    = row[1].strip('"')
            city    = row[2].strip('"')
            country = row[3].strip('"')
            iata    = row[4].strip('"')
            lat     = _safe_float(row[6])
            lon     = _safe_float(row[7])
            if iata and iata != "\\N" and len(iata) == 3:
                idx[iata] = {
                    "id": oid, "name": name, "city": city,
                    "country": country, "iata": iata,
                    "lat": lat, "lon": lon,
                }
    out = CACHE_DIR / "airports_by_iata.json"
    out.write_text(json.dumps(idx))
    return out


def _build_airlines_index(dat: Path) -> Path:
    """airlines.dat → airlines_by_iata.json  {IATA: {id, name, iata}}
    Columns: 0=ID, 1=Name, 2=Alias, 3=IATA, 4=ICAO, 5=Callsign, 6=Country, 7=Active
    """
    idx = {}
    with open(dat, newline="", encoding="utf-8", errors="replace") as f:
        for row in csv.reader(f):
            if len(row) < 4:
                continue
            oid  = _safe_int(row[0])
            name = row[1].strip('"')
            iata = row[3].strip('"')
            if iata and iata != "\\N" and len(iata) <= 3:
                active = row[7].strip('"').upper() if len(row) > 7 else ""
                if iata not in idx or active == "Y":
                    idx[iata] = {"id": oid, "name": name, "iata": iata}
    out = CACHE_DIR / "airlines_by_iata.json"
    out.write_text(json.dumps(idx))
    return out


def _build_aircraft_index(dat: Path) -> Path:
    """planes.dat → aircraft_by_iata.json  {IATA: {name, iata, icao, oid}}
    Columns: 0=Name, 1=IATA, 2=ICAO   (no ID — use row index as OID)
    """
    idx = {}
    with open(dat, newline="", encoding="utf-8", errors="replace") as f:
        for oid, row in enumerate(csv.reader(f)):
            if len(row) < 3:
                continue
            name = row[0].strip('"')
            iata = row[1].strip('"')
            icao = row[2].strip('"')
            if iata and iata != "\\N":
                idx[iata] = {"name": name, "iata": iata, "icao": icao, "oid": oid}
    out = CACHE_DIR / "aircraft_by_iata.json"
    out.write_text(json.dumps(idx))
    return out


def _build_routes_index(dat: Path) -> Path:
    """routes.dat → routes_idx.json  {airline-src-dst: [equipment_codes]}
    Columns: 0=Airline, 1=AirlineID, 2=Src, 3=SrcID, 4=Dst, 5=DstID, 6=Codeshare, 7=Stops, 8=Equipment
    """
    idx: dict = {}
    with open(dat, newline="", encoding="utf-8", errors="replace") as f:
        for row in csv.reader(f):
            if len(row) < 5:
                continue
            airline = row[0].strip('"')
            src     = row[2].strip('"')
            dst     = row[4].strip('"')
            equip   = row[8].strip('"') if len(row) > 8 else ""
            if not airline or not src or not dst:
                continue
            key   = f"{airline}-{src}-{dst}"
            codes = [c for c in equip.split() if c and c != "\\N"]
            idx.setdefault(key, [])
            for c in codes:
                if c not in idx[key]:
                    idx[key].append(c)
    out = CACHE_DIR / "routes_idx.json"
    out.write_text(json.dumps(idx))
    return out


def _export_web_airports():
    """Write slim airports JSON for the web app to data/airports.json.
    Format: { "MSY": { "city": "...", "country": "...", "lat": ..., "lon": ... } }
    Only the 4 fields the web app reads — no id/name/iata in payload.
    """
    src = CACHE_DIR / "airports_by_iata.json"
    if not src.exists():
        return
    full = json.loads(src.read_text())
    slim = {
        iata: {"city": v["city"], "country": v["country"], "lat": v["lat"], "lon": v["lon"]}
        for iata, v in full.items()
    }
    out = CACHE_DIR / "airports.json"
    out.write_text(json.dumps(slim))
    print(f"  ✓ airports.json written ({len(slim):,} airports → master_data/airports.json)")


BUILDERS = {
    "airports": _build_airports_index,
    "airlines": _build_airlines_index,
    "aircraft": _build_aircraft_index,
    "routes":   _build_routes_index,
}


# ── Public API ─────────────────────────────────────────────────────────────────

def ensure_indexes(refresh: bool = False) -> dict:
    """Ensure all indexes are cached and fresh. Returns {name: Path}."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    meta    = _load_meta()
    results = {}

    for name, url in OPENFLIGHTS_URLS.items():
        dat_path   = CACHE_DIR / f"{name}.dat"
        index_name = INDEX_NAMES[name]
        index_path = CACHE_DIR / index_name

        if not refresh and _is_fresh(meta, name) and index_path.exists():
            results[name] = index_path
            print(f"  ✓ {name} (cached)")
            continue

        try:
            _download(name, url)
        except RuntimeError as e:
            print(f"  ⚠  {name} download failed: {e}", file=sys.stderr)
            if index_path.exists():
                print(f"     Using stale index.", file=sys.stderr)
                results[name] = index_path
            continue

        try:
            out = BUILDERS[name](dat_path)
            results[name] = out
            count = len(json.loads(out.read_text()))
            meta[name] = {
                "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "size": dat_path.stat().st_size,
            }
            print(f"  ✓ {name} index built ({count:,} entries)")
        except Exception as e:
            print(f"  ⚠  {name} index build failed: {e}", file=sys.stderr)

    _save_meta(meta)

    # Export slim web-app copy whenever airport index is fresh
    if "airports" in results:
        _export_web_airports()

    return results


def load_indexes() -> dict:
    """Load existing indexes from cache (no network). Returns {name: dict}."""
    out = {}
    for name, fname in INDEX_NAMES.items():
        p = CACHE_DIR / fname
        if p.exists():
            out[name] = json.loads(p.read_text())
    return out


def show_status():
    meta = _load_meta()
    now  = datetime.datetime.now(datetime.timezone.utc)
    print(f"Cache: {CACHE_DIR}\n")
    for name in OPENFLIGHTS_URLS:
        entry   = meta.get(name, {})
        fetched = entry.get("fetched_at")
        size    = entry.get("size", 0)
        if fetched:
            ts    = datetime.datetime.fromisoformat(fetched)
            age   = now - ts
            h     = int(age.total_seconds() // 3600)
            m     = int((age.total_seconds() % 3600) // 60)
            fresh = "✓" if h < MAX_AGE_H else "⚠ stale"
            print(f"  {fresh:8s}  {name:<12}  {h:3d}h {m:02d}m ago  ({size:,} bytes)")
        else:
            print(f"  ✗         {name:<12}  not cached")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    args = sys.argv[1:]
    if "--status" in args:
        show_status()
    elif "--refresh" in args:
        print("Force-refreshing all OpenFlights master data…")
        ensure_indexes(refresh=True)
        print("\nDone.")
    else:
        print("Fetching OpenFlights master data (skips if fresh)…")
        results = ensure_indexes()
        if results:
            print(f"\nIndexes ready: {', '.join(results)}")
        else:
            print("\nAll indexes already fresh.")
