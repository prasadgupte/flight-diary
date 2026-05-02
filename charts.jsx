/* charts.jsx — StatsChart: area chart for sidebar stats panel */
const { useMemo: useMemoC, useState: useStateC, useRef: useRefC } = React;

const CHART_H = 180;
const PAD = { top: 8, right: 10, bottom: 22, left: 8 };

function linScale(domainMin, domainMax, rangeMin, rangeMax) {
  return v => domainMax === domainMin
    ? rangeMin
    : rangeMin + (v - domainMin) / (domainMax - domainMin) * (rangeMax - rangeMin);
}

function svgArea(points, yZero) {
  if (!points.length) return "";
  const top = points.map(([x, y]) => `${x},${y}`).join(" L ");
  return `M ${points[0][0]},${yZero} L ${top} L ${points[points.length - 1][0]},${yZero} Z`;
}

function svgLine(points) {
  if (!points.length) return "";
  return "M " + points.map(([x, y]) => `${x},${y}`).join(" L ");
}

function StatsChart({ mode, allFlights, countriesData, activeMembers, width = 320, activeYear, onYearClick }) {
  const chartW = width;
  const INNER_W = chartW - PAD.left - PAD.right;
  const INNER_H = CHART_H - PAD.top - PAD.bottom;

  const [hoverIdx, setHoverIdx] = useStateC(null);
  const svgRef = useRefC(null);

  const data = useMemoC(() => {
    if (mode === "flights") {
      const sorted = [...allFlights].sort((a, b) => a.dateObj - b.dateObj);
      const byYear = {};
      const seenAirports = new Set();
      const seenCountries = new Set();

      const COUNTRY_NAME_TO_ISO = window.COUNTRY_NAME_TO_ISO_CHART || {};

      sorted.forEach(f => {
        const y = f.year;
        if (!byYear[y]) byYear[y] = { flights: 0, newAirports: 0, newCountries: 0 };
        byYear[y].flights++;
        [f.From, f.To].forEach(iata => {
          if (!seenAirports.has(iata)) {
            seenAirports.add(iata);
            byYear[y].newAirports++;
            const ap = window.AIRPORTS?.[iata];
            if (ap?.country) {
              const iso = COUNTRY_NAME_TO_ISO[ap.country] || ap.country;
              if (!seenCountries.has(iso)) {
                seenCountries.add(iso);
                byYear[y].newCountries++;
              }
            }
          }
        });
      });

      const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
      let cumCountries = 0;
      return years.map(y => {
        cumCountries += byYear[y].newCountries;
        return { year: y, flights: byYear[y].flights, newAirports: byYear[y].newAirports, newCountries: byYear[y].newCountries, cumCountries };
      });
    }

    if (mode === "countries") {
      const cd = countriesData;
      if (!cd?.countries) return [];
      const byYear = {};
      cd.countries.forEach(c => {
        activeMembers.forEach(id => {
          const yr = c.visits?.[id];
          if (!yr) return;
          if (!byYear[yr]) byYear[yr] = { newCountries: 0 };
          byYear[yr].newCountries++;
        });
      });
      const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
      let cumCountries = 0;
      return years.map(y => {
        cumCountries += byYear[y].newCountries;
        return { year: y, newCountries: byYear[y].newCountries, cumCountries };
      });
    }
    return [];
  }, [mode, allFlights, countriesData, activeMembers]);

  if (!data.length) return null;

  const years = data.map(d => d.year);
  const minYear = years[0];
  const maxYear = years[years.length - 1];

  const xZero = PAD.left;
  const xEnd  = PAD.left + INNER_W;
  const yZero = PAD.top + INNER_H;
  const yTop  = PAD.top;

  const xScale = linScale(minYear, maxYear, xZero, xEnd);

  const maxFlights  = mode === "flights" ? Math.max(...data.map(d => d.flights), 1) : 0;
  const maxAirports = mode === "flights" ? Math.max(...data.map(d => d.newAirports), 1) : 0;
  const maxNewC     = Math.max(...data.map(d => d.newCountries), 1);
  const maxCum      = Math.max(...data.map(d => d.cumCountries), 1);

  const primaryMax = mode === "flights" ? Math.max(maxFlights, maxAirports, maxNewC) : maxNewC;

  const yPrimary = linScale(0, primaryMax, yZero, yTop);
  const yCum     = linScale(0, maxCum, yZero, yTop);

  const pts = (key, scale) => data.map(d => [xScale(d.year), scale(d[key])]);

  const flightPts  = mode === "flights" ? pts("flights", yPrimary) : [];
  const airportPts = mode === "flights" ? pts("newAirports", yPrimary) : [];
  const newCPts    = pts("newCountries", yPrimary);
  const cumCPts    = pts("cumCountries", yCum);

  const tickStep = maxYear - minYear <= 10 ? 1 : maxYear - minYear <= 20 ? 2 : 5;
  const ticks = years.filter(y => (y - minYear) % tickStep === 0 || y === maxYear);

  const handleMouseMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width * chartW;
    let lo = 0, hi = data.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xScale(data[mid].year) < mouseX) lo = mid + 1; else hi = mid;
    }
    const best = (lo > 0 && Math.abs(xScale(data[lo - 1].year) - mouseX) < Math.abs(xScale(data[lo].year) - mouseX)) ? lo - 1 : lo;
    setHoverIdx(prev => prev === best ? prev : best);
  };

  // Active data point: hovered or latest
  const activeD = hoverIdx !== null ? data[hoverIdx] : data[data.length - 1];
  const isHovering = hoverIdx !== null;

  // Crosshair + dots (no tooltip box — legend header shows all values)
  let hoverEl = null;
  if (hoverIdx !== null && hoverIdx < data.length) {
    const d = data[hoverIdx];
    const hx = xScale(d.year);
    hoverEl = (
      <g pointerEvents="none">
        <line x1={hx} x2={hx} y1={yTop} y2={yZero}
          style={{ stroke: "var(--t-over-25)" }} strokeWidth="1" strokeDasharray="3 2" />
        {mode === "flights" && flightPts[hoverIdx] && (
          <circle cx={flightPts[hoverIdx][0]} cy={flightPts[hoverIdx][1]} r="3" fill="#6C5CE7" stroke="var(--t-tooltip)" strokeWidth="1.5" />
        )}
        {mode === "flights" && airportPts[hoverIdx] && (
          <circle cx={airportPts[hoverIdx][0]} cy={airportPts[hoverIdx][1]} r="3" fill="#00D2A0" stroke="var(--t-tooltip)" strokeWidth="1.5" />
        )}
        {newCPts[hoverIdx] && (
          <circle cx={newCPts[hoverIdx][0]} cy={newCPts[hoverIdx][1]} r="3" fill="#55EFC4" stroke="var(--t-tooltip)" strokeWidth="1.5" />
        )}
        {cumCPts[hoverIdx] && (
          <circle cx={cumCPts[hoverIdx][0]} cy={cumCPts[hoverIdx][1]} r="3" fill="var(--t-fg)" stroke="var(--t-tooltip)" strokeWidth="1.5" />
        )}
      </g>
    );
  }

  // Legend rows for each mode
  const legendItems = mode === "flights" ? [
    { label: "flights",      color: "#6C5CE7", dash: false, val: activeD?.flights },
    { label: "airports",     color: "#00D2A0", dash: false, val: activeD?.newAirports },
    { label: "countries",    color: "#55EFC4", dash: false, val: activeD?.newCountries },
    { label: "cumulative",   color: null,      dash: true,  val: activeD?.cumCountries },
  ] : [
    { label: "new/yr",       color: "#55EFC4", dash: false, val: activeD?.newCountries },
    { label: "cumulative",   color: null,      dash: true,  val: activeD?.cumCountries },
  ];

  return (
    <div>
      {/* Legend header — HTML, always readable, values update on hover */}
      <div style={{
        display: "flex", alignItems: "center", flexWrap: "wrap",
        gap: "4px 14px", marginBottom: 6, paddingLeft: PAD.left,
      }}>
        {isHovering && (
          <span style={{
            fontFamily: "Space Grotesk, sans-serif", fontSize: 13, fontWeight: 700,
            color: "var(--t-accent)", marginRight: 4, letterSpacing: -0.3,
          }}>{activeD.year}</span>
        )}
        {legendItems.map(item => (
          <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            {item.dash ? (
              <svg width="14" height="6" style={{ flexShrink: 0 }}>
                <line x1="0" y1="3" x2="14" y2="3"
                  stroke="var(--t-fg)" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.7" />
              </svg>
            ) : (
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
            )}
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--t-fg3)" }}>
              {item.label}
            </span>
            {isHovering && (
              <span style={{
                fontFamily: "JetBrains Mono, monospace", fontSize: 11, fontWeight: 700,
                color: item.color || "var(--t-fg)",
              }}>{item.val}</span>
            )}
          </span>
        ))}
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${chartW} ${CHART_H}`}
        style={{ width: "100%", height: CHART_H, display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="cg-flights" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6C5CE7" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#6C5CE7" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="cg-airports" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#00D2A0" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#00D2A0" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="cg-countries" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#55EFC4" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#55EFC4" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(t => {
          const y = yZero - t * INNER_H;
          return <line key={t} x1={xZero} x2={xEnd} y1={y} y2={y} style={{ stroke: "var(--t-over-05)" }} strokeWidth="1" />;
        })}

        {/* Area fills */}
        {mode === "flights" && flightPts.length > 0 && (
          <path d={svgArea(flightPts, yZero)} fill="url(#cg-flights)" />
        )}
        {mode === "flights" && airportPts.length > 0 && (
          <path d={svgArea(airportPts, yZero)} fill="url(#cg-airports)" />
        )}
        {newCPts.length > 0 && (
          <path d={svgArea(newCPts, yZero)} fill="url(#cg-countries)" />
        )}

        {/* Area strokes */}
        {mode === "flights" && flightPts.length > 0 && (
          <path d={svgLine(flightPts)} fill="none" stroke="#6C5CE7" strokeWidth="1.5" opacity="0.8" />
        )}
        {mode === "flights" && airportPts.length > 0 && (
          <path d={svgLine(airportPts)} fill="none" stroke="#00D2A0" strokeWidth="1.2" opacity="0.7" />
        )}
        {newCPts.length > 0 && (
          <path d={svgLine(newCPts)} fill="none" stroke="#55EFC4" strokeWidth="1.2" opacity="0.7" />
        )}

        {/* Cumulative line */}
        {cumCPts.length > 0 && (
          <path d={svgLine(cumCPts)} fill="none" style={{ stroke: "var(--t-fg)" }} strokeWidth="1.5" opacity="0.6" strokeDasharray="4 2" />
        )}

        {/* Hover overlay */}
        <rect x={xZero} y={yTop} width={INNER_W} height={INNER_H}
          fill="none" pointerEvents="all" style={{ cursor: "crosshair" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
          onClick={() => { if (hoverIdx !== null && onYearClick) onYearClick(data[hoverIdx].year); }}
        />

        {/* X axis ticks + labels */}
        {ticks.map(y => {
          const x = xScale(y);
          const isActive = activeYear === y;
          return (
            <g key={y} style={{ cursor: onYearClick ? "pointer" : "default" }}
              onClick={(e) => { e.stopPropagation(); onYearClick && onYearClick(y); }}>
              <line x1={x} x2={x} y1={yZero} y2={yZero + 3} style={{ stroke: "var(--t-over-25)" }} strokeWidth="1" />
              <text x={x} y={yZero + 10} textAnchor="middle"
                fontFamily="JetBrains Mono, monospace" fontSize="7"
                style={{ fill: isActive ? "var(--t-accent)" : "var(--t-fg3)" }}
                fontWeight={isActive ? "700" : "400"}>{y}</text>
              {isActive && (
                <line x1={x} x2={x} y1={yZero + 12} y2={yZero + 14}
                  style={{ stroke: "var(--t-accent)" }} strokeWidth="2" strokeLinecap="round" />
              )}
            </g>
          );
        })}

        {/* Hover elements */}
        {hoverEl}
      </svg>
    </div>
  );
}

window.StatsChart = StatsChart;
