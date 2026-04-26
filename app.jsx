/* App.jsx — Flight Diary main shell */
const { useState, useEffect, useMemo } = React;

const SCHEME_OPTIONS = [
  { value: "ink", label: "Ink" },
  { value: "aurora", label: "Aurora" },
  { value: "mesh", label: "Mesh" },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "scheme": "ink",
  "showLabels": false,
  "compactSidebar": false
}/*EDITMODE-END*/;

function fmtNum(n) { return n.toLocaleString("en-US"); }
function fmtDate(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StatCard({ label, value, sub, color, mono }) {
  return (
    <div style={{
      background: "rgba(30,27,46,0.65)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14,
      padding: "18px 18px",
      backdropFilter: "blur(12px)",
    }}>
      <div style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 10,
        fontWeight: 500,
        color: "#A29BFE",
        letterSpacing: 0.5,
        textTransform: "uppercase",
        marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: 36,
        fontWeight: 700,
        letterSpacing: -1,
        color: color || "#FAFAFA",
        lineHeight: 1,
      }}>{value}</div>
      {sub && <div style={{
        marginTop: 6,
        fontFamily: mono ? "JetBrains Mono, monospace" : "Plus Jakarta Sans, sans-serif",
        fontSize: 11,
        color: "#A9A6BB",
      }}>{sub}</div>}
    </div>
  );
}

function PersonPill({ name, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 18px",
      borderRadius: 999,
      border: "1px solid " + (active ? "transparent" : "rgba(255,255,255,0.10)"),
      background: active
        ? "linear-gradient(135deg, #6C5CE7 0%, #3D35A0 100%)"
        : "rgba(30,27,46,0.5)",
      color: active ? "#fff" : "#A9A6BB",
      fontFamily: "Space Grotesk, sans-serif",
      fontWeight: 600,
      fontSize: 14,
      cursor: "pointer",
      transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
      boxShadow: active ? "0 4px 18px rgba(108,92,231,0.35)" : "none",
    }}>{name}</button>
  );
}

function YearPill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 12px",
      borderRadius: 999,
      border: "1px solid " + (active ? "rgba(108,92,231,0.5)" : "rgba(255,255,255,0.08)"),
      background: active ? "rgba(108,92,231,0.18)" : "transparent",
      color: active ? "#A29BFE" : "#A9A6BB",
      fontFamily: "JetBrains Mono, monospace",
      fontWeight: 500,
      fontSize: 11,
      cursor: "pointer",
      whiteSpace: "nowrap",
      transition: "all 0.15s",
    }}>{label}</button>
  );
}

function App() {
  const [person, setPerson] = useState(null);
  const [year, setYear] = useState("all");
  const [mode, setMode] = useState("3d");
  const [focusedAirport, setFocusedAirport] = useState(null);
  const [focusedCountry, setFocusedCountry] = useState(null);
  const [focusedAirline, setFocusedAirline] = useState(null);
  const [hoverCountry, setHoverCountry] = useState(null);
  const [countries, setCountries] = useState(null);
  const [dataReady, setDataReady] = useState(false);
  const clearFocus = () => { setFocusedAirport(null); setFocusedCountry(null); setFocusedAirline(null); };
  const [tweaks, setTweaks] = window.useTweaks
    ? window.useTweaks(TWEAK_DEFAULTS)
    : [TWEAK_DEFAULTS, () => {}];

  const userList = dataReady ? (window.USER_LIST || []) : [];

  // Auto-select first user when data loads
  useEffect(() => {
    if (dataReady && userList.length > 0 && !person) {
      setPerson(userList[0].key);
    }
  }, [dataReady, userList]);

  // Load flight CSVs
  useEffect(() => {
    const onLoaded = () => setDataReady(true);
    window.addEventListener("flights-loaded", onLoaded);
    if (window.loadAllFlights) {
      window.loadAllFlights();
    } else {
      setDataReady(true);
    }
    return () => window.removeEventListener("flights-loaded", onLoaded);
  }, []);

  // Load Natural Earth 110m countries once
  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then((topo) => {
        const geo = window.topojson.feature(topo, topo.objects.countries);
        // Attach ISO_A2 from numeric id via lookup
        geo.features.forEach((f) => {
          const iso = window.NUMERIC_TO_ISO2[String(f.id).padStart(3, "0")];
          if (iso) {
            f.properties.ISO_A2 = iso;
          }
        });
        setCountries(geo);
      })
      .catch((e) => console.error("countries load failed", e));
  }, []);

  // ISO2 -> full country name lookup, derived from loaded data
  const isoToName = useMemo(() => {
    const m = {};
    if (countries && countries.features) {
      countries.features.forEach((f) => {
        const iso = f.properties.ISO_A2;
        const name = f.properties.NAME || f.properties.ADMIN || f.properties.name;
        if (iso) m[iso] = name;
      });
    }
    return m;
  }, [countries]);

  // Map airport country names to ISO_A2
  const COUNTRY_NAME_TO_ISO = {
    "Albania": "AL", "Australia": "AU", "Austria": "AT",
    "Belgium": "BE", "Bhutan": "BT", "Canada": "CA",
    "China": "CN", "Croatia": "HR", "Cyprus": "CY",
    "Denmark": "DK", "Egypt": "EG", "Finland": "FI",
    "France": "FR", "Germany": "DE", "Greece": "GR",
    "Hong Kong": "HK", "Hungary": "HU", "Iceland": "IS",
    "India": "IN", "Indonesia": "ID", "Italy": "IT",
    "Japan": "JP", "Malaysia": "MY", "Malta": "MT",
    "Nepal": "NP", "Netherlands": "NL", "Norway": "NO",
    "Poland": "PL", "Portugal": "PT", "Saudi Arabia": "SA",
    "Serbia": "RS", "Singapore": "SG", "Spain": "ES",
    "Sri Lanka": "LK", "Switzerland": "CH", "Thailand": "TH",
    "Turkey": "TR", "Ukraine": "UA",
    "United Arab Emirates": "AE", "United Kingdom": "GB",
    "United States": "US",
  };

  const allFlights = useMemo(() => window.FLIGHTS[person] || [], [person, dataReady]);
  const years = useMemo(() => {
    const ys = Array.from(new Set(allFlights.map((f) => f.year))).sort((a, b) => b - a);
    return ys;
  }, [allFlights]);

  const filtered = useMemo(() => {
    let f = allFlights;
    if (year !== "all") f = f.filter((x) => x.year === +year);
    if (focusedAirport) f = f.filter((x) => x.From === focusedAirport || x.To === focusedAirport);
    if (focusedAirline) f = f.filter((x) => x.Airline === focusedAirline);
    if (focusedCountry) {
      f = f.filter((x) => {
        const A = window.AIRPORTS[x.From], B = window.AIRPORTS[x.To];
        return (A && COUNTRY_NAME_TO_ISO[A.country] === focusedCountry) ||
               (B && COUNTRY_NAME_TO_ISO[B.country] === focusedCountry);
      });
    }
    return f;
  }, [allFlights, year, focusedAirport, focusedCountry, focusedAirline]);

  // Compute visited country counts (across ALL flights for the person, ignores year/focus filters)
  const visitedCounts = useMemo(() => {
    const counts = {};
    const yearFiltered = year === "all" ? allFlights : allFlights.filter((x) => x.year === +year);
    yearFiltered.forEach((f) => {
      const A = window.AIRPORTS[f.From], B = window.AIRPORTS[f.To];
      if (A) {
        const iso = COUNTRY_NAME_TO_ISO[A.country];
        if (iso) counts[iso] = (counts[iso] || 0) + 1;
      }
      if (B) {
        const iso = COUNTRY_NAME_TO_ISO[B.country];
        if (iso) counts[iso] = (counts[iso] || 0) + 1;
      }
    });
    return counts;
  }, [allFlights, year]);

  // Stats
  const stats = useMemo(() => {
    const flights = filtered;
    const countries = new Set();
    const airports = new Set();
    const aircraft = new Set();
    let dist = 0;
    const airlines = new Set();
    const airportCounts = new Map();
    const airlineCounts = new Map();
    let leisure = 0, biz = 0, other = 0;
    flights.forEach((f) => {
      const A = window.AIRPORTS[f.From], B = window.AIRPORTS[f.To];
      if (A) countries.add(A.country);
      if (B) countries.add(B.country);
      airports.add(f.From); airports.add(f.To);
      if (f.Plane) aircraft.add(f.Plane);
      dist += f.distanceKm;
      if (f.Airline) airlines.add(f.Airline);
      airlineCounts.set(f.Airline, (airlineCounts.get(f.Airline) || 0) + 1);
      airportCounts.set(f.From, (airportCounts.get(f.From) || 0) + 1);
      airportCounts.set(f.To, (airportCounts.get(f.To) || 0) + 1);
      if (f.Reason === "L") leisure++;
      else if (f.Reason === "B") biz++;
      else other++;
    });
    const sorted = flights.slice().sort((a, b) => a.dateObj - b.dateObj);
    return {
      count: flights.length,
      countries: countries.size,
      airports: airports.size,
      aircraft: aircraft.size,
      distance: dist,
      airlines: airlines.size,
      first: sorted[0],
      last: sorted[sorted.length - 1],
      topAirlines: [...airlineCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
      topAirports: [...airportCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
      leisure, biz, other,
    };
  }, [filtered]);

  const earthLaps = (stats.distance / 40075).toFixed(1);

  return (
    <div style={{
      height: "100vh",
      maxHeight: "100vh",
      overflow: "hidden",
      background: "radial-gradient(ellipse at 30% 0%, #2A2347 0%, #1E1B2E 60%, #0F0D1A 100%)",
      color: "#FAFAFA",
      fontFamily: "Plus Jakarta Sans, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Top bar */}
      <header style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "20px 32px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        flexWrap: "wrap",
      }}>
        {/* Wordmark */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: -0.5,
          }}>Flight Diary</div>
          <div style={{ height: 3, width: 60, background: "linear-gradient(90deg, #6C5CE7, #FF6B6B, #00D2A0, #FDCB6E)", borderRadius: 2 }} />
        </div>

        {/* Person switcher */}
        <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
          {userList.map((u) => (
            <PersonPill key={u.key} name={u.name} active={person === u.key}
              onClick={() => { setPerson(u.key); setYear("all"); clearFocus(); }} />
          ))}
        </div>

        {/* Year filter */}
        <div style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          flex: 1,
          minWidth: 0,
          overflowX: "auto",
          padding: "4px 0",
        }}>
          <span style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
            color: "#6E6A82",
            marginRight: 4,
            whiteSpace: "nowrap",
          }}>// year</span>
          <YearPill label="All" active={year === "all"} onClick={() => setYear("all")} />
          {years.map((y) => (
            <YearPill key={y} label={y} active={year === y} onClick={() => setYear(y)} />
          ))}
        </div>

        {/* Mode toggle */}
        <div style={{
          display: "flex",
          background: "rgba(30,27,46,0.6)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 999,
          padding: 3,
        }}>
          {["3d", "2d"].map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "none",
              background: mode === m ? "rgba(108,92,231,0.25)" : "transparent",
              color: mode === m ? "#A29BFE" : "#6E6A82",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              textTransform: "uppercase",
            }}>{m}</button>
          ))}
        </div>
      </header>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, minWidth: 0, position: "relative", width: "100%" }}>
        {/* Globe / Map */}
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          {mode === "3d" ? (
            <window.Globe
              flights={filtered}
              airports={window.AIRPORTS}
              scheme={tweaks.scheme}
              showLabels={tweaks.showLabels}
              focusedAirport={focusedAirport}
              countries={countries}
              visitedCounts={visitedCounts}
              onAirportClick={(iata) => { setFocusedAirport((prev) => (prev === iata ? null : iata)); setFocusedCountry(null); }}
              onCountryClick={(iso) => { setFocusedCountry((prev) => (prev === iso ? null : iso)); setFocusedAirport(null); }}
              onCountryHover={setHoverCountry}
            />
          ) : (
            <window.Map2D
              flights={filtered}
              airports={window.AIRPORTS}
              focusedAirport={focusedAirport}
              countries={countries}
              visitedCounts={visitedCounts}
              scheme={tweaks.scheme}
              onAirportClick={(iata) => { setFocusedAirport((prev) => (prev === iata ? null : iata)); setFocusedCountry(null); }}
              onCountryClick={(iso) => { setFocusedCountry((prev) => (prev === iso ? null : iso)); setFocusedAirport(null); }}
              onCountryHover={setHoverCountry}
            />
          )}

          {/* Country tooltip */}
          {hoverCountry && (
            <div style={{
              position: "fixed",
              left: hoverCountry.x + 14,
              top: hoverCountry.y + 14,
              padding: "6px 10px",
              background: "rgba(30,27,46,0.95)",
              border: "1px solid rgba(108,92,231,0.35)",
              borderRadius: 8,
              fontFamily: "Plus Jakarta Sans, sans-serif",
              fontSize: 12,
              color: "#FAFAFA",
              pointerEvents: "none",
              zIndex: 1000,
              backdropFilter: "blur(8px)",
            }}>
              <div style={{ fontWeight: 600 }}>{hoverCountry.name}</div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#A29BFE" }}>
                {visitedCounts[hoverCountry.iso]
                  ? `${visitedCounts[hoverCountry.iso]} flight${visitedCounts[hoverCountry.iso] === 1 ? "" : "s"}`
                  : "not visited"}
              </div>
            </div>
          )}

          {/* Focused country badge */}
          {focusedCountry && (
            <div style={{
              position: "absolute",
              top: 20,
              left: 20,
              padding: "8px 14px 8px 16px",
              background: "rgba(30,27,46,0.85)",
              border: "1px solid rgba(108,92,231,0.4)",
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              gap: 10,
              backdropFilter: "blur(12px)",
              zIndex: 5,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 999, background: "#A29BFE",
                boxShadow: "0 0 10px #A29BFE",
              }} />
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "#A29BFE" }}>
                {focusedCountry}
              </span>
              <span style={{ color: "#A9A6BB", fontSize: 12 }}>
                {isoToName[focusedCountry] || ""}
              </span>
              <button onClick={() => setFocusedCountry(null)} style={{
                background: "transparent", border: "none", color: "#6E6A82",
                cursor: "pointer", padding: 0, marginLeft: 4, fontSize: 16, lineHeight: 1,
              }}>×</button>
            </div>
          )}

          {/* Focused airline badge */}
          {focusedAirline && (
            <div style={{
              position: "absolute",
              top: 20,
              left: 20,
              padding: "8px 14px 8px 16px",
              background: "rgba(30,27,46,0.85)",
              border: "1px solid rgba(253,203,110,0.4)",
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              gap: 10,
              backdropFilter: "blur(12px)",
              zIndex: 5,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 999, background: "#FDCB6E",
                boxShadow: "0 0 10px #FDCB6E",
              }} />
              <span style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 12, color: "#FDCB6E", fontWeight: 600 }}>
                {focusedAirline}
              </span>
              <button onClick={() => setFocusedAirline(null)} style={{
                background: "transparent", border: "none", color: "#6E6A82",
                cursor: "pointer", padding: 0, marginLeft: 4, fontSize: 16, lineHeight: 1,
              }}>×</button>
            </div>
          )}

          {/* Focused airport badge */}
          {focusedAirport && (
            <div style={{
              position: "absolute",
              top: 20,
              left: 20,
              padding: "8px 14px 8px 16px",
              background: "rgba(30,27,46,0.85)",
              border: "1px solid rgba(0,210,160,0.4)",
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              gap: 10,
              backdropFilter: "blur(12px)",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 999, background: "#00D2A0",
                boxShadow: "0 0 10px #00D2A0",
              }} />
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "#00D2A0" }}>
                {focusedAirport}
              </span>
              <span style={{ color: "#A9A6BB", fontSize: 12 }}>
                {window.AIRPORTS[focusedAirport]?.city}
              </span>
              <button onClick={() => setFocusedAirport(null)} style={{
                background: "transparent", border: "none", color: "#6E6A82",
                cursor: "pointer", padding: 0, marginLeft: 4, fontSize: 16, lineHeight: 1,
              }}>×</button>
            </div>
          )}

          {/* Legend */}
          <div style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            display: "flex",
            gap: 14,
            padding: "10px 14px",
            background: "rgba(30,27,46,0.7)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            backdropFilter: "blur(10px)",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
            color: "#A9A6BB",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 22, height: 2, background: "linear-gradient(90deg, #6C5CE7, #FF6B6B)" }} />
              leisure
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 22, height: 2, background: "linear-gradient(90deg, #6C5CE7, #FDCB6E)" }} />
              business
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#00D2A0", boxShadow: "0 0 8px #00D2A0" }} />
              airport
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside style={{
          width: tweaks.compactSidebar ? 320 : 400,
          flexShrink: 0,
          padding: tweaks.compactSidebar ? "20px 20px" : "28px 28px",
          borderLeft: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(15,13,26,0.4)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}>
          {/* Section label */}
          <div style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
            color: "#6E6A82",
            letterSpacing: 0.5,
          }}>
            // {person || "loading"}
            {year !== "all" ? ` · ${year}` : ""}
            {focusedAirport ? ` · ${focusedAirport}` : ""}
            {focusedCountry ? ` · ${focusedCountry}` : ""}
            {focusedAirline ? ` · ${focusedAirline}` : ""}
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <StatCard label="Flights" value={stats.count} sub={stats.count === 1 ? "flight" : "flights"} />
            <StatCard label="Countries" value={stats.countries} color="#55EFC4" sub="visited" />
            <StatCard label="Airports" value={stats.airports} sub="touched" />
            <StatCard label="Distance" value={fmtNum(stats.distance)} sub={`${earthLaps}× Earth · km`} />
            <StatCard label="Airlines" value={stats.airlines} sub="carriers" />
            <StatCard label="Aircraft" value={stats.aircraft} color="#FDCB6E" sub="types" />
          </div>

          {/* Lifetime callout */}
          {stats.first && stats.last && (
            <div style={{
              padding: "16px 18px",
              borderRadius: 14,
              background: "linear-gradient(135deg, rgba(108,92,231,0.15) 0%, rgba(255,107,107,0.10) 100%)",
              border: "1px solid rgba(108,92,231,0.25)",
            }}>
              <div style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10,
                color: "#A29BFE",
                marginBottom: 10,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}>// {focusedAirport || focusedCountry || focusedAirline ? "the arc, focused" : "a life in arcs"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#A9A6BB" }}>
                    {stats.first.From} → {stats.first.To}
                  </div>
                  <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 16 }}>
                    {fmtDate(stats.first.dateObj)}
                  </div>
                </div>
                <div style={{ flex: 2, position: "relative", height: 24 }}>
                  <div style={{
                    position: "absolute", left: 0, right: 0, top: "50%",
                    height: 2, background: "linear-gradient(90deg, #6C5CE7, #FF6B6B, #00D2A0, #FDCB6E)",
                    borderRadius: 2, transform: "translateY(-50%)",
                  }} />
                  <div style={{ position: "absolute", left: 0, top: "50%", width: 8, height: 8, borderRadius: 999, background: "#6C5CE7", transform: "translate(-50%, -50%)" }} />
                  <div style={{ position: "absolute", right: 0, top: "50%", width: 8, height: 8, borderRadius: 999, background: "#FDCB6E", transform: "translate(50%, -50%)" }} />
                </div>
                <div style={{ flex: 1, textAlign: "right" }}>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#A9A6BB" }}>
                    {stats.last.From} → {stats.last.To}
                  </div>
                  <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 16 }}>
                    {fmtDate(stats.last.dateObj)}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#A9A6BB", lineHeight: 1.5 }}>
                {(() => {
                  const yearsSpan = stats.last.dateObj.getFullYear() - stats.first.dateObj.getFullYear();
                  const ctx = focusedAirport ? `via ${focusedAirport}` :
                              focusedCountry ? `in ${isoToName[focusedCountry] || focusedCountry}` :
                              focusedAirline ? `on ${focusedAirline}` : null;
                  if (yearsSpan === 0) {
                    return <><span style={{ color: "#FAFAFA", fontWeight: 500 }}>{stats.first.dateObj.getFullYear()}</span> — {ctx ? <>{stats.count} flight{stats.count === 1 ? "" : "s"} {ctx}.</> : <span style={{ fontStyle: "italic" }}>a single chapter.</span>}</>;
                  }
                  return <><span style={{ color: "#FAFAFA", fontWeight: 500 }}>{yearsSpan} year{yearsSpan === 1 ? "" : "s"}</span> {ctx ? <>{ctx} — {stats.count} flights.</> : <>between first and latest — <span style={{ fontStyle: "italic" }}>the long arc.</span></>}</>;
                })()}
              </div>
            </div>
          )}

          {/* Bottom stats: top airlines / airports / B-vs-L */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10,
                color: "#6E6A82",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}>// top airlines</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {stats.topAirlines.map(([name, n]) => (
                  <button key={name} onClick={() => { setFocusedAirline((p) => p === name ? null : name); setFocusedAirport(null); setFocusedCountry(null); }} style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    background: focusedAirline === name ? "rgba(253,203,110,0.25)" : "rgba(108,92,231,0.12)",
                    border: focusedAirline === name ? "1px solid rgba(253,203,110,0.5)" : "1px solid rgba(108,92,231,0.25)",
                    color: focusedAirline === name ? "#FDCB6E" : "#A29BFE",
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}>{name} <span style={{ color: "#6E6A82", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>×{n}</span></button>
                ))}
              </div>
            </div>

            <div>
              <div style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10,
                color: "#6E6A82",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}>// top airports</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {stats.topAirports.map(([iata, n]) => (
                  <button key={iata} onClick={() => { setFocusedAirport((p) => p === iata ? null : iata); setFocusedAirline(null); setFocusedCountry(null); }} style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    background: focusedAirport === iata ? "rgba(0,210,160,0.25)" : "rgba(0,210,160,0.10)",
                    border: focusedAirport === iata ? "1px solid rgba(0,210,160,0.6)" : "1px solid rgba(0,210,160,0.25)",
                    color: "#55EFC4",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}>{iata} <span style={{ color: "#6E6A82", fontSize: 10 }}>×{n}</span></button>
                ))}
              </div>
            </div>

            {/* Business vs Leisure bar */}
            <div>
              <div style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10,
                color: "#6E6A82",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}>// reason split</div>
              <div style={{
                display: "flex",
                height: 8,
                borderRadius: 4,
                overflow: "hidden",
                background: "rgba(255,255,255,0.04)",
              }}>
                {stats.leisure > 0 && (
                  <div style={{ flex: stats.leisure, background: "linear-gradient(90deg, #6C5CE7, #FF6B6B)" }} />
                )}
                {stats.biz > 0 && (
                  <div style={{ flex: stats.biz, background: "linear-gradient(90deg, #FDCB6E, #FFEAA7)" }} />
                )}
                {stats.other > 0 && (
                  <div style={{ flex: stats.other, background: "#A29BFE" }} />
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#A9A6BB" }}>
                <span><span style={{ color: "#FF8E8E" }}>●</span> leisure {stats.leisure}</span>
                <span><span style={{ color: "#FDCB6E" }}>●</span> business {stats.biz}</span>
                {stats.other > 0 && <span><span style={{ color: "#A29BFE" }}>●</span> other {stats.other}</span>}
              </div>
            </div>
          </div>

          {/* Backlog hint */}
          <div style={{
            marginTop: "auto",
            paddingTop: 16,
            borderTop: "1px dashed rgba(255,255,255,0.06)",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 9,
            color: "#4A4658",
            lineHeight: 1.6,
          }}>
            // backlog: flight log list, airport search,<br />
            hover-link arcs ↔ log, full csv loader
          </div>
        </aside>
      </div>

      {/* Tweaks panel */}
      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Globe">
            <window.TweakRadio
              label="Color scheme"
              value={tweaks.scheme}
              onChange={(v) => setTweaks("scheme", v)}
              options={SCHEME_OPTIONS}
            />
            <window.TweakToggle
              label="Airport labels"
              value={tweaks.showLabels}
              onChange={(v) => setTweaks("showLabels", v)}
            />
          </window.TweakSection>
          <window.TweakSection label="Layout">
            <window.TweakToggle
              label="Compact sidebar"
              value={tweaks.compactSidebar}
              onChange={(v) => setTweaks("compactSidebar", v)}
            />
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
