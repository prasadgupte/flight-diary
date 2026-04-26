// Flight diary data — loads CSVs via config or falls back to sample.
//
// Config: place a flights.json next to this file:
//   { "users": { "Alice": "path/to/tracker.csv", "Bob": "other.csv" } }
//
// Without flights.json the app loads sample_tracker.csv with a single "Sample" user.

const AIRPORTS = {
  AAR: { city: "Aarhus", country: "Denmark", lat: 56.3, lon: 10.619 },
  ADB: { city: "Izmir", country: "Turkey", lat: 38.2924, lon: 27.157 },
  ADL: { city: "Adelaide", country: "Australia", lat: -34.945, lon: 138.531 },
  AGP: { city: "Malaga", country: "Spain", lat: 36.6749, lon: -4.4991 },
  AMD: { city: "Ahmedabad", country: "India", lat: 23.0772, lon: 72.6347 },
  AMS: { city: "Amsterdam", country: "Netherlands", lat: 52.3086, lon: 4.7639 },
  ASR: { city: "Kayseri", country: "Turkey", lat: 38.7704, lon: 35.4954 },
  AUH: { city: "Abu Dhabi", country: "United Arab Emirates", lat: 24.433, lon: 54.6511 },
  AUS: { city: "Austin", country: "United States", lat: 30.1945, lon: -97.6699 },
  BCN: { city: "Barcelona", country: "Spain", lat: 41.2971, lon: 2.0785 },
  BEG: { city: "Belgrade", country: "Serbia", lat: 44.8184, lon: 20.3091 },
  BER: { city: "Berlin", country: "Germany", lat: 52.3667, lon: 13.5033 },
  BKK: { city: "Bangkok", country: "Thailand", lat: 13.6811, lon: 100.747 },
  BLL: { city: "Billund", country: "Denmark", lat: 55.7403, lon: 9.1518 },
  BLR: { city: "Bangalore", country: "India", lat: 13.1979, lon: 77.7063 },
  BNE: { city: "Brisbane", country: "Australia", lat: -27.3842, lon: 153.117 },
  BOM: { city: "Mumbai", country: "India", lat: 19.0887, lon: 72.8679 },
  BOS: { city: "Boston", country: "United States", lat: 42.3643, lon: -71.0052 },
  BPM: { city: "Hyderabad", country: "India", lat: 17.4531, lon: 78.4676 },
  BRU: { city: "Brussels", country: "Belgium", lat: 50.9014, lon: 4.4844 },
  BSL: { city: "Mulhouse", country: "France", lat: 47.59, lon: 7.5292 },
  BUD: { city: "Budapest", country: "Hungary", lat: 47.4298, lon: 19.2611 },
  CAI: { city: "Cairo", country: "Egypt", lat: 30.1219, lon: 31.4056 },
  CCU: { city: "Kolkata", country: "India", lat: 22.6547, lon: 88.4467 },
  CDG: { city: "Paris", country: "France", lat: 49.0128, lon: 2.55 },
  CIA: { city: "Rome", country: "Italy", lat: 41.7994, lon: 12.5949 },
  CLE: { city: "Cleveland", country: "United States", lat: 41.4117, lon: -81.8498 },
  CMB: { city: "Colombo", country: "Sri Lanka", lat: 7.1808, lon: 79.8841 },
  COK: { city: "Kochi", country: "India", lat: 10.152, lon: 76.4019 },
  CPH: { city: "Copenhagen", country: "Denmark", lat: 55.6179, lon: 12.656 },
  DBV: { city: "Dubrovnik", country: "Croatia", lat: 42.5614, lon: 18.2682 },
  DEL: { city: "Delhi", country: "India", lat: 28.5665, lon: 77.1031 },
  DFW: { city: "Dallas-Fort Worth", country: "United States", lat: 32.8968, lon: -97.038 },
  DPS: { city: "Denpasar", country: "Indonesia", lat: -8.7482, lon: 115.167 },
  DUS: { city: "Duesseldorf", country: "Germany", lat: 51.2895, lon: 6.7668 },
  DXB: { city: "Dubai", country: "United Arab Emirates", lat: 25.2528, lon: 55.3644 },
  EDI: { city: "Edinburgh", country: "United Kingdom", lat: 55.95, lon: -3.3725 },
  EWR: { city: "Newark", country: "United States", lat: 40.6925, lon: -74.1687 },
  FAO: { city: "Faro", country: "Portugal", lat: 37.0144, lon: -7.9659 },
  FCO: { city: "Rome", country: "Italy", lat: 41.8003, lon: 12.2389 },
  FRA: { city: "Frankfurt", country: "Germany", lat: 50.0333, lon: 8.5706 },
  GAU: { city: "Guwahati", country: "India", lat: 26.1061, lon: 91.5859 },
  GOI: { city: "Goa", country: "India", lat: 15.3808, lon: 73.8314 },
  HEL: { city: "Helsinki", country: "Finland", lat: 60.3172, lon: 24.9633 },
  HKG: { city: "Hong Kong", country: "Hong Kong", lat: 22.3089, lon: 113.915 },
  HND: { city: "Tokyo", country: "Japan", lat: 35.5523, lon: 139.78 },
  IST: { city: "Istanbul", country: "Turkey", lat: 41.2753, lon: 28.7519 },
  IXZ: { city: "Port Blair", country: "India", lat: 11.6412, lon: 92.7297 },
  JFK: { city: "New York", country: "United States", lat: 40.6398, lon: -73.7789 },
  KBP: { city: "Kiev", country: "Ukraine", lat: 50.345, lon: 30.8947 },
  KEF: { city: "Keflavik", country: "Iceland", lat: 63.985, lon: -22.6056 },
  KGS: { city: "Kos", country: "Greece", lat: 36.7933, lon: 27.0917 },
  KTM: { city: "Kathmandu", country: "Nepal", lat: 27.6966, lon: 85.3591 },
  KUL: { city: "Kuala Lumpur", country: "Malaysia", lat: 2.7456, lon: 101.71 },
  LAS: { city: "Las Vegas", country: "United States", lat: 36.0801, lon: -115.152 },
  LAX: { city: "Los Angeles", country: "United States", lat: 33.9425, lon: -118.408 },
  LCY: { city: "London", country: "United Kingdom", lat: 51.5053, lon: 0.0553 },
  LGA: { city: "New York", country: "United States", lat: 40.7772, lon: -73.8726 },
  LGW: { city: "London", country: "United Kingdom", lat: 51.1481, lon: -0.1903 },
  LHR: { city: "London", country: "United Kingdom", lat: 51.4706, lon: -0.4619 },
  LIS: { city: "Lisbon", country: "Portugal", lat: 38.7813, lon: -9.1359 },
  LTN: { city: "London", country: "United Kingdom", lat: 51.8747, lon: -0.3683 },
  MAA: { city: "Chennai", country: "India", lat: 12.99, lon: 80.1693 },
  MEL: { city: "Melbourne", country: "Australia", lat: -37.6733, lon: 144.843 },
  MLA: { city: "Malta", country: "Malta", lat: 35.8575, lon: 14.4775 },
  MSP: { city: "Minneapolis", country: "United States", lat: 44.882, lon: -93.2218 },
  MUC: { city: "Munich", country: "Germany", lat: 48.3538, lon: 11.7861 },
  NRT: { city: "Tokyo", country: "Japan", lat: 35.7647, lon: 140.386 },
  ORD: { city: "Chicago", country: "United States", lat: 41.9786, lon: -87.9048 },
  ORY: { city: "Paris", country: "France", lat: 48.7233, lon: 2.3794 },
  OSL: { city: "Oslo", country: "Norway", lat: 60.121, lon: 11.0502 },
  PBH: { city: "Thimphu", country: "Bhutan", lat: 27.4032, lon: 89.4246 },
  PDX: { city: "Portland", country: "United States", lat: 45.5887, lon: -122.598 },
  PER: { city: "Perth", country: "Australia", lat: -31.9403, lon: 115.967 },
  PFO: { city: "Paphos", country: "Cyprus", lat: 34.718, lon: 32.4857 },
  PVG: { city: "Shanghai", country: "China", lat: 31.1434, lon: 121.805 },
  RUH: { city: "Riyadh", country: "Saudi Arabia", lat: 24.9576, lon: 46.6988 },
  SAW: { city: "Istanbul", country: "Turkey", lat: 40.8986, lon: 29.3092 },
  SFO: { city: "San Francisco", country: "United States", lat: 37.619, lon: -122.375 },
  SGD: { city: "Soenderborg", country: "Denmark", lat: 54.9644, lon: 9.7917 },
  SIN: { city: "Singapore", country: "Singapore", lat: 1.3502, lon: 103.994 },
  SJC: { city: "San Jose", country: "United States", lat: 37.3626, lon: -121.929 },
  SLC: { city: "Salt Lake City", country: "United States", lat: 40.7884, lon: -111.978 },
  STN: { city: "London", country: "United Kingdom", lat: 51.885, lon: 0.235 },
  SXF: { city: "Berlin", country: "Germany", lat: 52.38, lon: 13.5225 },
  SYD: { city: "Sydney", country: "Australia", lat: -33.9461, lon: 151.177 },
  SZG: { city: "Salzburg", country: "Austria", lat: 47.7933, lon: 13.0043 },
  TIA: { city: "Tirana", country: "Albania", lat: 41.4147, lon: 19.7206 },
  TRV: { city: "Trivandrum", country: "India", lat: 8.4821, lon: 76.9201 },
  TSF: { city: "Treviso", country: "Italy", lat: 45.6484, lon: 12.1944 },
  TXL: { city: "Berlin", country: "Germany", lat: 52.5597, lon: 13.2877 },
  VIE: { city: "Vienna", country: "Austria", lat: 48.1103, lon: 16.5697 },
  WAW: { city: "Warsaw", country: "Poland", lat: 52.1657, lon: 20.9671 },
  YYZ: { city: "Toronto", country: "Canada", lat: 43.6772, lon: -79.6306 },
  ZAG: { city: "Zagreb", country: "Croatia", lat: 45.7429, lon: 16.0688 },
  ZRH: { city: "Zurich", country: "Switzerland", lat: 47.4647, lon: 8.5492 },
};

const COLS = ["Date","From","To","Flight_Number","Airline","Distance","Duration","Seat","Seat_Type","Class","Reason","Plane","Registration","Trip","Note"];

function rowToFlight(row, idx) {
  const o = {};
  COLS.forEach((c, i) => (o[c] = (row[i] || "").trim()));
  o.id = idx;
  const d = o.Date.length === 10 ? o.Date : o.Date.replace(" ", "T");
  o.dateObj = new Date(d);
  o.year = o.dateObj.getFullYear();
  o.distanceKm = +o.Distance || 0;
  return o;
}

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const lines = text.trim().split(/\r?\n/);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const fields = [];
    let field = "", inQuote = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (inQuote) {
        if (ch === '"' && line[j + 1] === '"') { field += '"'; j++; }
        else if (ch === '"') { inQuote = false; }
        else { field += ch; }
      } else {
        if (ch === '"') { inQuote = true; }
        else if (ch === ',') { fields.push(field); field = ""; }
        else { field += ch; }
      }
    }
    fields.push(field);
    rows.push(fields);
  }
  return rows;
}

async function loadCSV(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${resp.status} ${url}`);
  const text = await resp.text();
  return parseCSV(text).map(rowToFlight).sort((a, b) => b.dateObj - a.dateObj);
}

// FLIGHTS keyed by lowercase slug (used internally)
// USER_LIST ordered array of { key, name } for the UI
const FLIGHTS = {};
const USER_LIST = [];

async function loadAllFlights() {
  let config = null;
  try {
    const resp = await fetch("flights.json");
    if (resp.ok) config = await resp.json();
  } catch { /* no config — use sample */ }

  if (config && config.users && Object.keys(config.users).length > 0) {
    const entries = Object.entries(config.users);
    await Promise.allSettled(entries.map(async ([name, path]) => {
      const key = name.toLowerCase().replace(/\s+/g, "_");
      try {
        FLIGHTS[key] = await loadCSV(path);
        USER_LIST.push({ key, name });
        console.log(`Loaded ${FLIGHTS[key].length} flights for ${name}`);
      } catch (e) {
        console.warn(`Failed to load ${name} (${path}):`, e);
      }
    }));
  } else {
    // Fallback: load sample
    try {
      FLIGHTS["sample"] = await loadCSV("sample_tracker.csv");
      USER_LIST.push({ key: "sample", name: "Sample" });
      console.log(`Loaded ${FLIGHTS["sample"].length} sample flights`);
    } catch (e) {
      console.warn("Failed to load sample_tracker.csv:", e);
    }
  }

  window.dispatchEvent(new Event("flights-loaded"));
}

window.AIRPORTS = AIRPORTS;
window.FLIGHTS = FLIGHTS;
window.USER_LIST = USER_LIST;
window.loadAllFlights = loadAllFlights;
