/* autoplay.jsx — AutoplayController + overlay components */
const { useEffect, useRef } = React;

// ── Route chaining ──────────────────────────────────────────────────────────

// Chain same-day flights into multi-leg routes.
// e.g. [A→B, B→C, C→D] → [["A","B","C","D"]]
function chainRoutes(dayFlights) {
  const sorted = dayFlights.slice().sort((a, b) => a.Date.localeCompare(b.Date));
  const used = new Set();
  const chains = [];
  for (const start of sorted) {
    if (used.has(start.id)) continue;
    const chain = [start.From, start.To];
    used.add(start.id);
    let tip = start.To;
    let extended = true;
    while (extended) {
      extended = false;
      for (const f of sorted) {
        if (!used.has(f.id) && f.From === tip) {
          chain.push(f.To);
          tip = f.To;
          used.add(f.id);
          extended = true;
          break;
        }
      }
    }
    chains.push(chain);
  }
  return chains;
}

// ── Camera pan helper ────────────────────────────────────────────────────────

// Pan the 3D globe to show the given flights' route.
// Computes centroid + angular spread → Z distance.
function panGlobeToGroup(groupFlights) {
  const g = window.__globe;
  if (!g || !g.panTo) return;
  const iatas = new Set();
  groupFlights.forEach(f => { iatas.add(f.From); iatas.add(f.To); });
  const coords = [...iatas].map(i => window.AIRPORTS[i]).filter(Boolean);
  if (!coords.length) return;
  const lats = coords.map(a => a.lat);
  const lons = coords.map(a => a.lon);
  const avgLat = lats.reduce((s, v) => s + v, 0) / lats.length;
  const avgLon = lons.reduce((s, v) => s + v, 0) / lons.length;
  const span = Math.max(
    Math.max(...lats) - Math.min(...lats),
    Math.max(...lons) - Math.min(...lons)
  );
  // Z: ~240 for local routes, ~500 for global routes
  const targetZ = 240 + (span / 180) * 260;
  g.panTo(avgLat, avgLon, targetZ);
}

// ── AutoplayController ────────────────────────────────────────────────────────

// Generic playback controller — renders nothing.
// Manages the timer, advances currentGroupIndex, calls onReveal for each group.
function AutoplayController({ groups, autoplayState, setAutoplayState, onReveal, onEnd }) {
  const timerRef = useRef(null);
  // Keep a ref always pointing to latest state to avoid stale closures in the timer
  const stateRef = useRef(autoplayState);
  useEffect(() => { stateRef.current = autoplayState; }, [autoplayState]);

  useEffect(() => {
    if (!autoplayState?.playing) {
      clearTimeout(timerRef.current);
      return;
    }

    const SPEED_DELAYS = { 1: 2200, 2: 1100, 4: 550 };

    const advance = () => {
      const s = stateRef.current;
      if (!s || !s.playing) return;

      const idx = s.currentGroupIndex;
      if (idx >= groups.length) {
        onEnd();
        return;
      }

      const group = groups[idx];

      // Increment index first, then call reveal (both batched by React 18)
      setAutoplayState(prev => prev ? { ...prev, currentGroupIndex: idx + 1 } : prev);
      onReveal(group, idx);

      // Schedule next tick — extra pause at year boundaries
      const baseDelay = SPEED_DELAYS[s.speed] || 2200;
      const prevGroup = groups[idx - 1];
      const yearBoundary = prevGroup &&
        group.date.getFullYear() !== prevGroup.date.getFullYear();
      timerRef.current = setTimeout(advance, baseDelay + (yearBoundary ? 800 : 0));
    };

    timerRef.current = setTimeout(advance, 100);
    return () => clearTimeout(timerRef.current);
  }, [autoplayState?.playing]); // re-runs only when play/pause toggles

  return null;
}

// ── AutoplayOverlay (flights mode) ───────────────────────────────────────────

// Top-left HUD: big year, month, route string (e.g. "BER › FRA › ORD › MSP")
function AutoplayOverlay({ autoplayState, groups, lightMode }) {
  if (!autoplayState || !groups?.length) return null;
  const idx = Math.max(0, (autoplayState.currentGroupIndex || 1) - 1);
  const group = groups[Math.min(idx, groups.length - 1)];
  if (!group) return null;

  const year = group.date.getFullYear();
  const month = group.date.toLocaleDateString("en-US", { month: "long" });
  const chains = chainRoutes(group.payload || []);
  const routeStr = chains.map(c => c.join(" › ")).join(" · ");

  return (
    <div style={{
      position: "absolute", top: 20, left: 20, zIndex: 15,
      pointerEvents: "none",
    }}>
      <div style={{
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: 76, fontWeight: 700, letterSpacing: -3,
        color: lightMode ? "#1E1B2E" : "#F0F0F0", lineHeight: 1,
        textShadow: lightMode ? "0 2px 12px rgba(255,255,255,0.6)" : "0 2px 30px rgba(0,0,0,0.7)",
      }}>{year}</div>
      <div style={{
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: 26, fontWeight: 500,
        color: lightMode ? "#3D3A4E" : "#8A87A0", marginTop: -2,
        textShadow: lightMode ? "0 1px 8px rgba(255,255,255,0.5)" : "0 2px 12px rgba(0,0,0,0.5)",
      }}>{month}</div>
      {routeStr && (
        <div style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 13, color: lightMode ? "#008C6B" : "#00D2A0",
          marginTop: 8, letterSpacing: 0.3,
          textShadow: lightMode ? "none" : "0 0 12px rgba(0,210,160,0.4)",
        }}>{routeStr}</div>
      )}
    </div>
  );
}

// ── CountriesAutoplayOverlay ─────────────────────────────────────────────────

// Top-left HUD for countries mode: big year + newly-added countries
function CountriesAutoplayOverlay({ autoplayState, groups, lightMode }) {
  if (!autoplayState || !groups?.length) return null;
  const idx = Math.max(0, (autoplayState.currentGroupIndex || 1) - 1);
  const group = groups[Math.min(idx, groups.length - 1)];
  if (!group) return null;

  const year = group.date.getFullYear();
  const countryNames = [...new Set((group.payload || []).map(p => p.country))];

  return (
    <div style={{
      position: "absolute", top: 20, left: 20, zIndex: 15,
      pointerEvents: "none",
    }}>
      <div style={{
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: 76, fontWeight: 700, letterSpacing: -3,
        color: lightMode ? "#1E1B2E" : "#F0F0F0", lineHeight: 1,
        textShadow: lightMode ? "0 2px 12px rgba(255,255,255,0.6)" : "0 2px 30px rgba(0,0,0,0.7)",
      }}>{year}</div>
      {countryNames.length > 0 && (
        <>
          <div style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 24, fontWeight: 500,
            color: lightMode ? "#3D3A4E" : "#8A87A0", marginTop: -2,
            textShadow: lightMode ? "0 1px 8px rgba(255,255,255,0.5)" : "0 2px 12px rgba(0,0,0,0.5)",
          }}>
            {countryNames.length} {countryNames.length === 1 ? "country" : "countries"} added
          </div>
          <div style={{
            fontFamily: "Plus Jakarta Sans, sans-serif",
            fontSize: 14, color: lightMode ? "#0369A1" : "#74B9FF",
            marginTop: 6, letterSpacing: 0.2,
            textShadow: lightMode ? "none" : "0 0 12px rgba(116,185,255,0.35)",
            maxWidth: 300,
            lineHeight: 1.5,
          }}>{countryNames.join(" · ")}</div>
        </>
      )}
    </div>
  );
}

// ── Exports ──────────────────────────────────────────────────────────────────

window.AutoplayController = AutoplayController;
window.AutoplayOverlay = AutoplayOverlay;
window.CountriesAutoplayOverlay = CountriesAutoplayOverlay;
window.panGlobeToGroup = panGlobeToGroup;
