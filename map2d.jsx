/* Map2D.jsx — D3-geo equirectangular world map with country highlighting */
const { useRef: useRef2, useEffect: useEffect2, useMemo: useMemo2, useState: useState2, useCallback: useCallback2 } = React;

function hexToRGBA2D(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const SCHEMES_2D = {
  ink:    { bg: "#1E1B2E", landBase: "#2D2A3E", landStroke: "#3D3A4E", visitedStroke: "#7B6FD0", visitedFill: "#6C5CE7" },
  aurora: { bg: "#0D2440", landBase: "#1F3050", landStroke: "#2D4870", visitedStroke: "#5A8FC7", visitedFill: "#74B9FF" },
  mesh:   { bg: "#1A0F2E", landBase: "#3A2E55", landStroke: "#4D3D70", visitedStroke: "#C06090", visitedFill: "#FD79A8" },
  day:    { bg: "#DDD9F5", landBase: "#C6C0E4", landStroke: "#A99FCE", visitedStroke: "#6C5CE7", visitedFill: "#6C5CE7" },
};

function getAircraftMfr2D(plane) {
  if (!plane) return null;
  const p = plane.toUpperCase();
  if (/^B[0-9]/.test(p) || /^B7[0-9X]/.test(p)) return 'Boeing';
  if (/^A[0-9]/.test(p) || /^BCS/.test(p))       return 'Airbus';
  if (/^E[0-9]/.test(p) || /^ERJ/.test(p))        return 'Embraer';
  if (/^CRJ/.test(p) || /^DH8/.test(p))           return 'Bombardier';
  if (/^AT[0-9]/.test(p))                          return 'ATR';
  return null;
}
const ARC_CLASS_COLORS_2D    = { Y:'#6C5CE7', Q:'#6C5CE7', C:'#FDCB6E', F:'#FF6B6B', P:'#00D2A0', W:'#00D2A0' };
const ARC_SEAT_COLORS_2D     = { W:'#74B9FF', A:'#55EFC4', M:'#FDCB6E' };
const ARC_MFR_COLORS_2D      = { Boeing:'#74B9FF', Airbus:'#FF6B6B', Embraer:'#00D2A0', Bombardier:'#FDCB6E', ATR:'#A29BFE' };
const ARC_REASON_COLORS_2D   = { L:'#FF6B6B', B:'#FDCB6E', O:'#A29BFE' };
const ARC_ALLIANCE_COLORS_2D = { Star:'#74B9FF', Oneworld:'#FF6B6B', SkyTeam:'#00D2A0', Others:'#95A5B3' };
const ARC_AIRLINE_ALLIANCES_2D = {
  "Air Canada":"Star","Lufthansa":"Star","Singapore Airlines":"Star","United Airlines":"Star",
  "Air India":"Star","Air India Limited":"Star","Swiss International Air Lines":"Star",
  "Austrian Airlines":"Star","Brussels Airlines":"Star","TAP Portugal":"Star",
  "Scandinavian Airlines System":"Star","Turkish Airlines":"Star","Finnair":"Star",
  "LOT Polish Airlines":"Star","Egyptair":"Star","Ethiopian Airlines":"Star",
  "British Airways":"Oneworld","American Airlines":"Oneworld","Malaysia Airlines":"Oneworld",
  "Alaska Airlines":"Oneworld","Iberia":"Oneworld","Qatar Airways":"Oneworld",
  "Air France":"SkyTeam","Delta Air Lines":"SkyTeam","KLM Royal Dutch Airlines":"SkyTeam",
  "Korean Air":"SkyTeam","Air Serbia":"SkyTeam",
};

function Map2D({ flights, airports, focusedAirport, onAirportClick, onAirportHover, scheme, countries, visitedCounts, flownCounts, livedSet, mapColorTheme, appMode, focusedCountry, onCountryClick, onCountryHover, showLabels, arcColorMode, airlineColorMap, memberColorMap, highlightedFlight, focusedRoute, onRouteClick, onArcHover, lightMode }) {
  const W = 1000, H = 500;
  const sc = SCHEMES_2D[scheme] || SCHEMES_2D.ink;
  const svgRef = useRef2(null);

  // Zoom/pan state
  const [vb, setVb] = useState2({ x: 0, y: 0, w: W, h: H });
  const panRef = useRef2({ active: false, startX: 0, startY: 0, startVb: null });

  // Reset viewBox only on initial mount (not on every flight/filter change)
  useEffect2(() => {
    setVb({ x: 0, y: 0, w: W, h: H });
  }, []);

  const proj = (lat, lon) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];

  const zoomAt = useCallback2((cx, cy, factor) => {
    setVb(prev => {
      const nw = Math.max(100, Math.min(W, prev.w * factor));
      const nh = Math.max(50, Math.min(H, prev.h * factor));
      // Zoom centered on (cx, cy) in viewBox coords
      const nx = cx - (cx - prev.x) * (nw / prev.w);
      const ny = cy - (cy - prev.y) * (nh / prev.h);
      return { x: Math.max(0, Math.min(W - nw, nx)), y: Math.max(0, Math.min(H - nh, ny)), w: nw, h: nh };
    });
  }, []);

  const handleWheel = useCallback2((e) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Convert screen coords to viewBox coords
    const sx = (e.clientX - rect.left) / rect.width;
    const sy = (e.clientY - rect.top) / rect.height;
    const vbX = vb.x + sx * vb.w;
    const vbY = vb.y + sy * vb.h;
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    zoomAt(vbX, vbY, factor);
  }, [vb, zoomAt]);

  // Attach wheel handler (non-passive)
  useEffect2(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Pan handlers
  const handlePointerDown = useCallback2((e) => {
    if (vb.w >= W && vb.h >= H) return; // No pan at full zoom
    // Don't setPointerCapture here — doing so immediately swallows child clicks.
    // Capture is deferred until the drag threshold is exceeded in handlePointerMove.
    panRef.current = { active: true, dragging: false, startX: e.clientX, startY: e.clientY, startVb: { ...vb } };
  }, [vb]);

  const handlePointerMove = useCallback2((e) => {
    const p = panRef.current;
    if (!p.active) return;
    const svg = svgRef.current;
    if (!svg) return;
    const dxScreen = e.clientX - p.startX;
    const dyScreen = e.clientY - p.startY;
    // Only commit to a drag once the pointer has moved at least 4px
    if (!p.dragging) {
      if (Math.hypot(dxScreen, dyScreen) < 4) return;
      p.dragging = true;
      svg.style.cursor = "grabbing";
      svg.setPointerCapture(e.pointerId); // capture only after threshold — clicks unaffected
    }
    const rect = svg.getBoundingClientRect();
    setVb({
      x: Math.max(0, Math.min(W - p.startVb.w, p.startVb.x - dxScreen / rect.width  * p.startVb.w)),
      y: Math.max(0, Math.min(H - p.startVb.h, p.startVb.y - dyScreen / rect.height * p.startVb.h)),
      w: p.startVb.w,
      h: p.startVb.h,
    });
  }, []);

  const handlePointerUp = useCallback2((e) => {
    const p = panRef.current;
    p.active = false;
    p.dragging = false;
    e.currentTarget.style.cursor = vb.w < W ? "grab" : "default";
  }, [vb]);

  // Expose zoom for parent
  useEffect2(() => {
    window.__map2dZoom = {
      zoomIn: () => zoomAt(vb.x + vb.w / 2, vb.y + vb.h / 2, 0.75),
      zoomOut: () => zoomAt(vb.x + vb.w / 2, vb.y + vb.h / 2, 1 / 0.75),
    };
  }, [vb, zoomAt]);

  // Pan to highlighted flight (F2)
  useEffect2(() => {
    if (!highlightedFlight) return;
    const A = airports[highlightedFlight.From], B = airports[highlightedFlight.To];
    if (!A || !B) return;
    const x1 = ((A.lon + 180) / 360) * W;
    const y1 = ((90 - A.lat) / 180) * H;
    const x2 = ((B.lon + 180) / 360) * W;
    const y2 = ((90 - B.lat) / 180) * H;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const span = Math.max(80, Math.hypot(x2 - x1, y2 - y1) * 1.6);
    const nw = Math.min(W, span);
    const nh = nw / 2;
    setVb({
      x: Math.max(0, Math.min(W - nw, midX - nw / 2)),
      y: Math.max(0, Math.min(H - nh, midY - nh / 2)),
      w: nw, h: nh,
    });
  }, [highlightedFlight]);

  // Zoom ratio: 1 = not zoomed, <1 = zoomed in. Multiply SVG values by this to keep them screen-constant.
  const zoomRatio = vb.w / W;
  const labelSize = 10 * zoomRatio;  // scale down as viewBox shrinks so text stays the same screen size

  const maxVisit = useMemo2(() => {
    let m = 0;
    Object.values(visitedCounts || {}).forEach((v) => { if (v > m) m = v; });
    return m;
  }, [visitedCounts]);

  const countryPaths = useMemo2(() => {
    if (!countries || !countries.features || !window.d3) return [];
    const projection = window.d3.geoEquirectangular()
      .scale(W / (2 * Math.PI))
      .translate([W / 2, H / 2]);
    const pathGen = window.d3.geoPath(projection);
    return countries.features.map((feat, i) => {
      const d = pathGen(feat);
      const iso = feat.properties.ISO_A2 || feat.properties.iso_a2;
      const name = feat.properties.NAME || feat.properties.ADMIN || feat.properties.name;
      return { d, iso, name, key: i };
    });
  }, [countries]);

  const counts = {};
  flights.forEach((f) => {
    counts[f.From] = (counts[f.From] || 0) + 1;
    counts[f.To] = (counts[f.To] || 0) + 1;
  });

  // Determine highlighted airports
  const hlAirports = new Set();
  if (highlightedFlight) {
    hlAirports.add(highlightedFlight.From);
    hlAirports.add(highlightedFlight.To);
  }
  if (focusedRoute) {
    hlAirports.add(focusedRoute.from);
    hlAirports.add(focusedRoute.to);
  }

  const arcs = flights.map((f, i) => {
    const A = airports[f.From], B = airports[f.To];
    if (!A || !B) return null;
    const [x1, y1] = proj(A.lat, A.lon);
    const [x2, y2] = proj(B.lat, B.lon);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.35;
    const isLeisure = f.Reason === "L";

    const dimmedByAirport = focusedAirport && f.From !== focusedAirport && f.To !== focusedAirport;
    const dimmedByRoute = focusedRoute && !(
      (f.From === focusedRoute.from && f.To === focusedRoute.to) ||
      (f.From === focusedRoute.to && f.To === focusedRoute.from)
    );
    const dimmedByHighlight = highlightedFlight && f.id !== highlightedFlight.id;
    const dimmed = dimmedByAirport || dimmedByRoute || dimmedByHighlight;
    const isHighlighted = highlightedFlight && f.id === highlightedFlight.id;

    let stroke = null;
    if (arcColorMode === "person" && memberColorMap) {
      stroke = memberColorMap[f._member] || null;
    } else if (arcColorMode === "airline" && airlineColorMap) {
      stroke = airlineColorMap[f.Airline] || null;
    } else if (arcColorMode === "class") {
      stroke = ARC_CLASS_COLORS_2D[f.Class] || null;
    } else if (arcColorMode === "seat_type") {
      stroke = ARC_SEAT_COLORS_2D[f.Seat_Type] || null;
    } else if (arcColorMode === "aircraft_mfr") {
      const mfr = getAircraftMfr2D(f.Plane);
      stroke = mfr ? ARC_MFR_COLORS_2D[mfr] : null;
    } else if (arcColorMode === "alliance") {
      const al = ARC_AIRLINE_ALLIANCES_2D[f.Airline];
      stroke = ARC_ALLIANCE_COLORS_2D[al || 'Others'];
    } else {
      stroke = ARC_REASON_COLORS_2D[f.Reason] || null;
    }
    const noData = !stroke;
    const resolvedStroke = stroke || "rgba(255,255,255,0.22)";

    const arcPath = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
    const handleArcClick = (e) => { e.stopPropagation(); onRouteClick && onRouteClick({ from: f.From, to: f.To }); };
    const handleArcEnter = (e) => { onArcHover && onArcHover({ flight: f, x: e.clientX, y: e.clientY }); };
    const handleArcLeave = () => { onArcHover && onArcHover(null); };
    const handleArcMove = (e) => { onArcHover && onArcHover({ flight: f, x: e.clientX, y: e.clientY }); };
    return (
      <g key={i}>
        {/* Fat invisible hit-area so thin arcs are easy to click/hover */}
        <path d={arcPath} fill="none" stroke="rgba(0,0,0,0)"
              strokeWidth={12 * zoomRatio}
              pointerEvents="stroke"
              style={{ cursor: "pointer" }}
              onClick={handleArcClick}
              onMouseEnter={handleArcEnter}
              onMouseMove={handleArcMove}
              onMouseLeave={handleArcLeave} />
        <path d={arcPath}
              fill="none"
              stroke={dimmed ? "rgba(255,255,255,0.06)" : resolvedStroke}
              strokeWidth={(isHighlighted ? 3 : noData ? 0.8 : 1.6) * zoomRatio} strokeLinecap="round"
              opacity={dimmed ? 0.06 : noData ? 0.25 : 0.85}
              pointerEvents="none"
        />
      </g>
    );
  });

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
           style={{ width: "100%", height: "auto", maxHeight: "100%", borderRadius: 16, background: sc.bg, cursor: vb.w < W ? "grab" : "default" }}
           onPointerDown={handlePointerDown}
           onPointerMove={handlePointerMove}
           onPointerUp={handlePointerUp}
      >
        <defs>
          <linearGradient id="arc-leisure-2d" x1="0" x2="1">
            <stop offset="0" stopColor="#6C5CE7" />
            <stop offset="1" stopColor="#FF6B6B" />
          </linearGradient>
          <linearGradient id="arc-work-2d" x1="0" x2="1">
            <stop offset="0" stopColor="#6C5CE7" />
            <stop offset="1" stopColor="#FDCB6E" />
          </linearGradient>
        </defs>

        {/* Countries — semantic: lived / visited / flown / focus */}
        {(() => {
          // Derive endpoint countries from highlighted flight or focused route for dimming
          let hlCountries = null;
          const hlFrom = highlightedFlight?.From || focusedRoute?.from;
          const hlTo   = highlightedFlight?.To   || focusedRoute?.to;
          if (hlFrom || hlTo) {
            hlCountries = new Set();
            const cmap = window.COUNTRY_NAME_TO_ISO_CHART || {};
            [hlFrom, hlTo].forEach(iata => {
              if (!iata) return;
              const ap = airports[iata];
              if (ap?.country) { const iso = cmap[ap.country]; if (iso) hlCountries.add(iso); }
            });
          }
          return countryPaths.map((c) => {
          const getCC = window.getCountryColors;
          const isFocused = focusedCountry === c.iso;
          const col = getCC
            ? getCC(c.iso, { livedSet, visitedCounts, flownCounts, appMode, focusedCountry, mapColorTheme, scheme, maxVisitCount: maxVisit, highlightedCountries: hlCountries })
            : { fill: sc.landBase, stroke: sc.landStroke, strokeA: 0.6 };
          const strokeW = (isFocused ? 2 : (livedSet?.has(c.iso) ? 1.5 : ((visitedCounts || {})[c.iso] > 0 ? 0.5 : 0.3))) * zoomRatio;
          return (
            <path
              key={c.key}
              d={c.d}
              fill={col.fill}
              stroke={col.stroke}
              strokeOpacity={col.strokeA}
              strokeWidth={strokeW}
              style={{ cursor: "pointer", transition: "fill 0.3s, stroke 0.3s" }}
              onClick={(e) => { e.stopPropagation(); onCountryClick && onCountryClick(c.iso); }}
              onMouseMove={(e) => onCountryHover && onCountryHover({ name: c.name, iso: c.iso, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => onCountryHover && onCountryHover(null)}
            />
          );
        });
        })()}

        {/* Arcs */}
        {arcs}

        {/* Airport dots */}
        {Object.entries(counts).map(([iata, count]) => {
          const A = airports[iata];
          if (!A) return null;
          const [x, y] = proj(A.lat, A.lon);
          const r = Math.max(2.5, Math.min(6, 2 + Math.log(count + 1))) * zoomRatio;
          const highlighted = hlAirports.has(iata);
          const dim = highlighted ? 1
            : focusedAirport ? (focusedAirport !== iata ? 0.35 : 1)
            : (highlightedFlight || focusedRoute) ? 0.35 : 1;
          const dotColor = "#00D2A0";
          const dotR = highlighted ? r * 1.4 : r;
          return (
            <g key={iata} style={{ cursor: "pointer" }} pointerEvents="all"
               onClick={(e) => { e.stopPropagation(); onAirportClick(iata); }}
               onMouseEnter={(e) => onAirportHover && onAirportHover({ iata, x: e.clientX, y: e.clientY })}
               onMouseMove={(e) => onAirportHover && onAirportHover({ iata, x: e.clientX, y: e.clientY })}
               onMouseLeave={() => onAirportHover && onAirportHover(null)}
               opacity={dim}>
              {(focusedAirport === iata || highlighted) && (
                <circle cx={x} cy={y} r={dotR * 3.2} fill="none" stroke="#00D2A0" strokeWidth={zoomRatio * 1.5} opacity="0.7" />
              )}
              <circle cx={x} cy={y} r={dotR * 2.2} fill={dotColor} opacity="0.18">
                <animate attributeName="r" values={`${dotR * 2};${dotR * 2.6};${dotR * 2}`} dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={x} cy={y} r={dotR} fill={dotColor} />
              {(showLabels || highlighted || focusedAirport === iata) && (
                <text x={x} y={y - dotR - labelSize * 0.4} fill={lightMode ? "#1E1B2E" : "#FAFAFA"} fontSize={labelSize} fontFamily="JetBrains Mono, monospace" textAnchor="middle" fontWeight={(highlighted || focusedAirport === iata) ? "700" : "400"}>{iata}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

window.Map2D = Map2D;
