// TripSummary — Trip overview with sub-tabs: Overview, Costs, Activity Map
// Replaces the simple TripSummary in trip-hourly.jsx

// ── Activity Taxonomy (N:N group → type mapping) ──────────────────────
const ACTIVITY_TAXONOMY = [
  { id: "heritage", label: "Heritage",  icon: "landmark",       color: "#FF6B6B",
    types: ["castle","palace","temple","shrine","museum","memorial","landmark","art"] },
  { id: "nature",   label: "Nature",    icon: "leaf",           color: "#00D2A0",
    types: ["park","garden","nature","hiking","onsen","observation"] },
  { id: "play",     label: "Play",      icon: "ferris-wheel",   color: "#FDCB6E",
    types: ["theme park","experience","cruise","festival","adventure"] },
  { id: "urban",    label: "Urban",     icon: "building",       color: "#74B9FF",
    types: ["neighbourhood","market","shopping"] },
  { id: "food",     label: "Food",      icon: "utensils-crossed", color: "#E17055",
    types: ["breakfast","lunch","dinner","restaurant","street food","food hall","bento","local specialty"] },
  { id: "transport",label: "Transport", icon: "plane",          color: "#6C5CE7",
    types: ["flight","train","ferry","car","taxi","bus","metro"] },
  { id: "stay",     label: "Stay",      icon: "hotel",          color: "#9B97B0",
    types: ["hotel","apartment","ryokan","airbnb","onsen hotel"] },
  { id: "admin",    label: "Admin",     icon: "shield",         color: "#8B8B8B",
    types: ["immigration","logistics","departure","arrival"] },
];

// Indoor types for the activity map
const INDOOR_TYPES = new Set([
  "museum","art","restaurant","food hall","shopping","onsen","immigration",
  "logistics","hotel","apartment","ryokan","airbnb","onsen hotel","bento",
]);

// Build reverse map: type → group ids
const TYPE_TO_GROUPS = {};
ACTIVITY_TAXONOMY.forEach(g => {
  g.types.forEach(t => {
    if (!TYPE_TO_GROUPS[t]) TYPE_TO_GROUPS[t] = [];
    TYPE_TO_GROUPS[t].push(g.id);
  });
});

window.ACTIVITY_TAXONOMY = ACTIVITY_TAXONOMY;
window.TYPE_TO_GROUPS = TYPE_TO_GROUPS;
window.INDOOR_TYPES = INDOOR_TYPES;

// ── Helpers ────────────────────────────────────────────────────────────

function parseDuration(timeStr) {
  // "15:00–20:00" → 5, "10:00" → 0 (point-in-time), null → 0
  if (!timeStr) return 0;
  const parts = timeStr.split(/[–\-]/);
  if (parts.length < 2) return 0;
  const t1 = parts[0].trim().match(/(\d{1,2}):(\d{2})/);
  const t2 = parts[1].trim().match(/(\d{1,2}):(\d{2})/);
  if (!t1 || !t2) return 0;
  const h1 = parseInt(t1[1]) + parseInt(t1[2]) / 60;
  const h2 = parseInt(t2[1]) + parseInt(t2[2]) / 60;
  return Math.max(0, h2 - h1);
}

function convertToBase(cost, currency) {
  if (!cost || !cost.amount) return 0;
  const rate = currency[cost.currency] || 1;
  return cost.amount * rate;
}

// ── Cost aggregation ──────────────────────────────────────────────────

function buildCostTable(trip) {
  const currency = trip.currency || {};
  const rows = []; // one per day
  const totals = { transport: 0, accommodation: 0, meals: 0, activities: 0 };

  // Pre-compute accommodation cost per night
  const accomPerNight = {};
  (trip.accommodation || []).forEach(a => {
    if (!a.cost || !a.cost.amount) return;
    const inDate = new Date(a.dates.in);
    const outDate = new Date(a.dates.out);
    const nights = Math.max(1, Math.round((outDate - inDate) / 86400000));
    accomPerNight[a.id] = convertToBase(a.cost, currency) / nights;
  });

  // Pre-index transport by id
  const transportById = {};
  (trip.transport || []).forEach(t => { transportById[t.id] = t; });

  trip.days.forEach(day => {
    const row = { dayNum: day.dayNum, date: day.date, city: day.city, transport: 0, accommodation: 0, meals: 0, activities: 0 };

    // Transport for this day
    (day.transport || []).forEach(tId => {
      const t = transportById[tId];
      if (t && t.cost) row.transport += convertToBase(t.cost, currency);
    });

    // Accommodation (pro-rated per night)
    if (day.accommodation && accomPerNight[day.accommodation] != null) {
      row.accommodation = accomPerNight[day.accommodation];
    }

    // Activities
    (day.activities || []).forEach(a => {
      if (a.cost && a.cost.amount) row.activities += convertToBase(a.cost, currency);
    });

    // Meals
    (day.meals || []).forEach(m => {
      if (m.cost && m.cost.amount) row.meals += convertToBase(m.cost, currency);
    });

    row.total = row.transport + row.accommodation + row.meals + row.activities;
    totals.transport += row.transport;
    totals.accommodation += row.accommodation;
    totals.meals += row.meals;
    totals.activities += row.activities;
    rows.push(row);
  });

  totals.total = totals.transport + totals.accommodation + totals.meals + totals.activities;
  return { rows, totals };
}

// ── Time allocation per day ───────────────────────────────────────────

function buildTimeAllocation(trip) {
  const transportById = {};
  (trip.transport || []).forEach(t => { transportById[t.id] = t; });

  const dayBars = trip.days.map(day => {
    let transportH = 0, indoorH = 0, outdoorH = 0, mealsH = 0;

    // Transport
    (day.transport || []).forEach(tId => {
      const t = transportById[tId];
      if (!t || !t.depart || !t.arrive) return;
      const dep = t.depart.slice(11, 16);
      const arr = t.arrive.slice(11, 16);
      const dur = parseDuration(`${dep}–${arr}`);
      transportH += dur > 0 ? dur : 1; // minimum 1h for transport with no valid time
    });

    // Activities
    (day.activities || []).forEach(a => {
      let dur = parseDuration(a.time);
      if (dur === 0) dur = 1; // default 1h for point activities
      if (INDOOR_TYPES.has(a.type)) indoorH += dur;
      else outdoorH += dur;
    });

    // Meals — default 1h each
    (day.meals || []).forEach(() => { mealsH += 1; });

    const activeH = transportH + indoorH + outdoorH + mealsH;
    const restH = Math.max(0, 24 - activeH);

    return {
      dayNum: day.dayNum, date: day.date, city: day.city,
      transport: transportH, indoor: indoorH, outdoor: outdoorH,
      meals: mealsH, rest: restH, total: 24,
    };
  });

  // Trip-wide totals
  const tripBar = dayBars.reduce((acc, d) => ({
    transport: acc.transport + d.transport,
    indoor: acc.indoor + d.indoor,
    outdoor: acc.outdoor + d.outdoor,
    meals: acc.meals + d.meals,
    rest: acc.rest + d.rest,
    total: acc.total + 24,
  }), { transport: 0, indoor: 0, outdoor: 0, meals: 0, rest: 0, total: 0 });

  return { dayBars, tripBar };
}

// ── Components ────────────────────────────────────────────────────────

function TripSummary({ trip, onActivityGroupFilter }) {
  const [tab, setTab] = React.useState("overview");
  if (!trip) return null;

  const flights = trip.transport ? trip.transport.filter(t => t.type === "flight").length : 0;
  const trains = trip.transport ? trip.transport.filter(t => t.type === "train").length : 0;
  const cities = trip.route ? trip.route.length : 0;
  const countries = trip.phases ? [...new Set(trip.phases.map(p => p.country))].length : 0;

  // Count entries per taxonomy group
  const groupCounts = React.useMemo(() => {
    if (!window.buildTimelineEntries) return {};
    const counts = {};
    ACTIVITY_TAXONOMY.forEach(g => { counts[g.id] = { total: 0, byType: {} }; });
    trip.days.forEach(d => {
      window.buildTimelineEntries(d, trip).forEach(e => {
        const groups = TYPE_TO_GROUPS[e.type] || [];
        groups.forEach(gId => {
          counts[gId].total++;
          counts[gId].byType[e.type] = (counts[gId].byType[e.type] || 0) + 1;
        });
      });
    });
    return counts;
  }, [trip]);

  // Cost table
  const costData = React.useMemo(() => buildCostTable(trip), [trip]);

  // Time allocation
  const timeData = React.useMemo(() => buildTimeAllocation(trip), [trip]);

  const fmtEur = (v) => v ? `€${Math.round(v).toLocaleString()}` : "—";

  return (
    <div className="td-summary">
      <div className="td-summary__title">Trip Overview</div>

      {/* Sub-tabs */}
      <div className="td-summary__tabs">
        {[
          { id: "overview", label: "Overview", icon: "compass" },
          { id: "costs", label: "Costs", icon: "credit-card" },
          { id: "activity-map", label: "Activity Map", icon: "bar-chart-2" },
        ].map(t => (
          <button key={t.id}
            className={`td-group-tab ${tab === t.id ? "td-group-tab--active" : ""}`}
            onClick={() => setTab(t.id)}>
            <LucideIcon name={t.icon} size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === "overview" && (
        <div className="td-summary__overview">
          <div className="td-summary__stats">
            <div className="td-summary__stat"><span className="td-summary__stat-num">{trip.days.length}</span><span className="td-summary__stat-label">days</span></div>
            <div className="td-summary__stat"><span className="td-summary__stat-num">{cities}</span><span className="td-summary__stat-label">cities</span></div>
            <div className="td-summary__stat"><span className="td-summary__stat-num">{countries}</span><span className="td-summary__stat-label">countries</span></div>
            <div className="td-summary__stat"><span className="td-summary__stat-num">{flights}</span><span className="td-summary__stat-label">flights</span></div>
            <div className="td-summary__stat"><span className="td-summary__stat-num">{trains}</span><span className="td-summary__stat-label">trains</span></div>
          </div>

          {/* Activity group chips — clickable to filter */}
          <div className="td-summary__groups-label">Activities by category</div>
          <div className="td-summary__group-chips">
            {ACTIVITY_TAXONOMY.filter(g => groupCounts[g.id] && groupCounts[g.id].total > 0).map(g => {
              const gc = groupCounts[g.id];
              return (
                <button key={g.id} className="td-summary__group-chip"
                  style={{ "--chip-color": g.color }}
                  onClick={() => onActivityGroupFilter && onActivityGroupFilter(g)}
                  title={Object.entries(gc.byType).map(([t,c]) => `${t}: ${c}`).join("\n")}>
                  <LucideIcon name={g.icon} size={13} />
                  <span className="td-summary__group-chip-label">{g.label}</span>
                  <span className="td-summary__group-chip-count">{gc.total}</span>
                </button>
              );
            })}
          </div>

          {/* Type breakdown (expanded) */}
          <div className="td-summary__type-breakdown">
            {ACTIVITY_TAXONOMY.filter(g => groupCounts[g.id] && groupCounts[g.id].total > 0).map(g => {
              const gc = groupCounts[g.id];
              const sorted = Object.entries(gc.byType).sort((a,b) => b[1] - a[1]);
              return (
                <div key={g.id} className="td-summary__type-group">
                  <div className="td-summary__type-group-header" style={{ color: g.color }}>
                    <LucideIcon name={g.icon} size={12} /> {g.label}
                  </div>
                  <div className="td-summary__type-tags">
                    {sorted.map(([type, count]) => (
                      <span key={type} className="td-summary__type-tag"
                        onClick={() => onActivityGroupFilter && onActivityGroupFilter(null, type)}>
                        {type} <span className="td-summary__type-tag-count">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="td-summary__phases">
            {trip.phases.map(phase => (
              <div key={phase.id} className="td-summary__phase" style={{ "--phase-color": phase.color }}>
                <div className="td-summary__phase-name">{phase.name}</div>
                <div className="td-summary__phase-days">{phase.days.length} {phase.days.length === 1 ? "day" : "days"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Costs tab ── */}
      {tab === "costs" && (
        <div className="td-summary__costs">
          {/* Grand total */}
          <div className="td-cost__grand">
            <span className="td-cost__grand-label">Estimated total</span>
            <span className="td-cost__grand-value">{fmtEur(costData.totals.total)}</span>
          </div>

          {/* Category totals row */}
          <div className="td-cost__cat-row">
            {[
              { key: "transport", label: "Transport", icon: "plane", color: "#6C5CE7" },
              { key: "accommodation", label: "Stay", icon: "hotel", color: "#9B97B0" },
              { key: "meals", label: "Meals", icon: "utensils-crossed", color: "#E17055" },
              { key: "activities", label: "Activities", icon: "sparkles", color: "#FDCB6E" },
            ].map(c => (
              <div key={c.key} className="td-cost__cat-card" style={{ "--cat-color": c.color }}>
                <LucideIcon name={c.icon} size={14} />
                <span className="td-cost__cat-label">{c.label}</span>
                <span className="td-cost__cat-value">{fmtEur(costData.totals[c.key])}</span>
              </div>
            ))}
          </div>

          {/* Day-by-day table */}
          <div className="td-cost__table-wrap">
            <table className="td-cost__table">
              <thead>
                <tr>
                  <th className="td-cost__th td-cost__th--day">Day</th>
                  <th className="td-cost__th td-cost__th--city">City</th>
                  <th className="td-cost__th td-cost__th--num" style={{ "--cat-color": "#6C5CE7" }}><LucideIcon name="plane" size={11} /> Transport</th>
                  <th className="td-cost__th td-cost__th--num" style={{ "--cat-color": "#9B97B0" }}><LucideIcon name="hotel" size={11} /> Stay</th>
                  <th className="td-cost__th td-cost__th--num" style={{ "--cat-color": "#E17055" }}><LucideIcon name="utensils-crossed" size={11} /> Meals</th>
                  <th className="td-cost__th td-cost__th--num" style={{ "--cat-color": "#FDCB6E" }}><LucideIcon name="sparkles" size={11} /> Activities</th>
                  <th className="td-cost__th td-cost__th--num td-cost__th--total">Total</th>
                </tr>
              </thead>
              <tbody>
                {costData.rows.map(r => (
                  <tr key={r.dayNum} className="td-cost__tr">
                    <td className="td-cost__td td-cost__td--day">{r.dayNum}</td>
                    <td className="td-cost__td td-cost__td--city">{r.city}</td>
                    <td className="td-cost__td td-cost__td--num">{r.transport ? fmtEur(r.transport) : ""}</td>
                    <td className="td-cost__td td-cost__td--num">{r.accommodation ? fmtEur(r.accommodation) : ""}</td>
                    <td className="td-cost__td td-cost__td--num">{r.meals ? fmtEur(r.meals) : ""}</td>
                    <td className="td-cost__td td-cost__td--num">{r.activities ? fmtEur(r.activities) : ""}</td>
                    <td className="td-cost__td td-cost__td--num td-cost__td--total">{fmtEur(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="td-cost__tr td-cost__tr--foot">
                  <td className="td-cost__td" colSpan="2">Total</td>
                  <td className="td-cost__td td-cost__td--num">{fmtEur(costData.totals.transport)}</td>
                  <td className="td-cost__td td-cost__td--num">{fmtEur(costData.totals.accommodation)}</td>
                  <td className="td-cost__td td-cost__td--num">{fmtEur(costData.totals.meals)}</td>
                  <td className="td-cost__td td-cost__td--num">{fmtEur(costData.totals.activities)}</td>
                  <td className="td-cost__td td-cost__td--num td-cost__td--total">{fmtEur(costData.totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Activity Map tab ── */}
      {tab === "activity-map" && (
        <div className="td-summary__actmap">
          {/* Legend */}
          <div className="td-actmap__legend">
            {[
              { label: "Transport", color: "#6C5CE7" },
              { label: "Indoor", color: "#FF6B6B" },
              { label: "Outdoor", color: "#00D2A0" },
              { label: "Meals", color: "#E17055" },
              { label: "Rest", color: "rgba(155,151,176,0.25)" },
            ].map(l => (
              <span key={l.label} className="td-actmap__legend-item">
                <span className="td-actmap__legend-dot" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>

          {/* Trip total bar */}
          <div className="td-actmap__row td-actmap__row--trip">
            <div className="td-actmap__label">Entire trip</div>
            <StackedBar data={timeData.tripBar} total={timeData.tripBar.total} showHours />
          </div>

          {/* Per-day bars */}
          <div className="td-actmap__days">
            {timeData.dayBars.map(d => (
              <div key={d.dayNum} className="td-actmap__row">
                <div className="td-actmap__label">
                  <span className="td-actmap__day-num">D{d.dayNum}</span>
                  <span className="td-actmap__day-city">{d.city}</span>
                </div>
                <StackedBar data={d} total={24} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StackedBar({ data, total, showHours }) {
  const segments = [
    { key: "transport", color: "#6C5CE7", value: data.transport },
    { key: "indoor",    color: "#FF6B6B", value: data.indoor },
    { key: "outdoor",   color: "#00D2A0", value: data.outdoor },
    { key: "meals",     color: "#E17055", value: data.meals },
    { key: "rest",      color: "rgba(155,151,176,0.25)", value: data.rest },
  ];

  return (
    <div className="td-actmap__bar-wrap">
      <div className="td-actmap__bar">
        {segments.filter(s => s.value > 0).map(s => {
          const pct = (s.value / total) * 100;
          return (
            <div key={s.key} className="td-actmap__seg"
              style={{ width: `${pct}%`, background: s.color }}
              title={`${s.key}: ${s.value.toFixed(1)}h (${pct.toFixed(0)}%)`}>
              {pct > 8 && showHours && (
                <span className="td-actmap__seg-label">{Math.round(s.value)}h</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.TripSummary = TripSummary;
