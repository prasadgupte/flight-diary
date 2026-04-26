/* Map2D.jsx — D3-geo equirectangular world map with country highlighting */
const { useRef: useRef2, useEffect: useEffect2, useMemo: useMemo2, useState: useState2 } = React;

const SCHEMES_2D = {
  ink:    { bg: "#1E1B2E", landBase: "#2D2A3E", landStroke: "#3D3A4E", visitedStroke: "#00D2A0", visitedFill: "#6C5CE7" },
  aurora: { bg: "#0D2440", landBase: "#1F3050", landStroke: "#2D4870", visitedStroke: "#00D2A0", visitedFill: "#74B9FF" },
  mesh:   { bg: "#1A0F2E", landBase: "#3A2E55", landStroke: "#4D3D70", visitedStroke: "#00D2A0", visitedFill: "#FD79A8" },
};

function Map2D({ flights, airports, focusedAirport, onAirportClick, scheme, countries, visitedCounts, onCountryClick, onCountryHover }) {
  const W = 1000, H = 500;
  const sc = SCHEMES_2D[scheme] || SCHEMES_2D.ink;

  const proj = (lat, lon) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];

  const maxVisit = useMemo2(() => {
    let m = 0;
    Object.values(visitedCounts || {}).forEach((v) => { if (v > m) m = v; });
    return m;
  }, [visitedCounts]);

  // Build SVG paths for countries via D3-geo equirectangular
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
      const count = (visitedCounts || {})[iso] || 0;
      return { d, iso, name, count, key: i };
    });
  }, [countries, visitedCounts]);

  const counts = {};
  flights.forEach((f) => {
    counts[f.From] = (counts[f.From] || 0) + 1;
    counts[f.To] = (counts[f.To] || 0) + 1;
  });

  const arcs = flights.map((f, i) => {
    const A = airports[f.From], B = airports[f.To];
    if (!A || !B) return null;
    const [x1, y1] = proj(A.lat, A.lon);
    const [x2, y2] = proj(B.lat, B.lon);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.35;
    const isLeisure = f.Reason === "L";
    const stroke = `url(#${isLeisure ? "arc-leisure-2d" : "arc-work-2d"})`;
    const dimmed = focusedAirport && f.From !== focusedAirport && f.To !== focusedAirport;
    return (
      <path key={i} d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
            fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round"
            opacity={dimmed ? 0.06 : 0.85} />
    );
  });

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", maxHeight: "100%", borderRadius: 16, background: sc.bg }}>
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

        {/* Countries */}
        {countryPaths.map((c) => {
          const visited = c.count > 0;
          let fill = sc.landBase;
          if (visited && maxVisit > 0) {
            const t = Math.min(1, Math.log(c.count + 1) / Math.log(maxVisit + 1));
            const alpha = 0.18 + t * 0.55;
            const hex = sc.visitedFill.replace("#", "");
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            fill = `rgba(${r},${g},${b},${alpha})`;
          }
          return (
            <path
              key={c.key}
              d={c.d}
              fill={fill}
              stroke={visited ? sc.visitedStroke : sc.landStroke}
              strokeWidth={visited ? 0.7 : 0.4}
              style={{ cursor: "pointer", transition: "fill 0.3s, stroke 0.3s" }}
              onClick={(e) => { e.stopPropagation(); onCountryClick && onCountryClick(c.iso); }}
              onMouseMove={(e) => onCountryHover && onCountryHover({ name: c.name, iso: c.iso, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => onCountryHover && onCountryHover(null)}
            />
          );
        })}

        {/* Arcs */}
        {arcs}

        {/* Airport dots */}
        {Object.entries(counts).map(([iata, count]) => {
          const A = airports[iata];
          if (!A) return null;
          const [x, y] = proj(A.lat, A.lon);
          const r = Math.max(2.5, Math.min(6, 2 + Math.log(count + 1)));
          const dim = focusedAirport && focusedAirport !== iata ? 0.35 : 1;
          return (
            <g key={iata} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onAirportClick(iata); }} opacity={dim}>
              <circle cx={x} cy={y} r={r * 2.2} fill="#00D2A0" opacity="0.18">
                <animate attributeName="r" values={`${r * 2};${r * 2.6};${r * 2}`} dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={x} cy={y} r={r} fill="#00D2A0" />
              <text x={x} y={y - r - 4} fill="#FAFAFA" fontSize="10" fontFamily="JetBrains Mono, monospace" textAnchor="middle">{iata}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

window.Map2D = Map2D;
