// TripHourlyTimeline — vertical chronological schedule for a selected day

const HOURLY_TYPE_COLORS = {
  // Transport
  flight: "#0EA5E9",
  train: "#6C5CE7",
  ferry: "#00D2A0",
  car: "#FDCB6E",
  taxi: "#FDCB6E",
  // Activities
  temple: "#FF6B6B",
  shrine: "#FF6B6B",
  castle: "#6C5CE7",
  museum: "#6C5CE7",
  park: "#00D2A0",
  garden: "#00D2A0",
  nature: "#00D2A0",
  "theme park": "#FF8E8E",
  neighbourhood: "#0EA5E9",
  market: "#FDCB6E",
  observation: "#74B9FF",
  memorial: "#9B97B0",
  landmark: "#6C5CE7",
  experience: "#FF8E8E",
  restaurant: "#FF6B6B",
  "street food": "#FF6B6B",
  "food hall": "#FF6B6B",
  art: "#A29BFE",
  palace: "#6C5CE7",
  // Accommodation
  hotel: "#0EA5E9",
  apartment: "#0EA5E9",
  ryokan: "#FF6B6B",
  // Meals
  breakfast: "#FDCB6E",
  lunch: "#FF6B6B",
  dinner: "#6C5CE7",
  // Default
  default: "#9B97B0",
};

const HOURLY_TYPE_ICONS = {
  flight: "✈️",
  train: "🚆",
  ferry: "⛴️",
  car: "🚗",
  taxi: "🚕",
  temple: "⛩️",
  shrine: "⛩️",
  castle: "🏰",
  museum: "🏛️",
  park: "🌳",
  garden: "🌸",
  nature: "🌿",
  "theme park": "🎢",
  neighbourhood: "🏘️",
  market: "🛒",
  observation: "🔭",
  memorial: "🕊️",
  landmark: "🗼",
  experience: "✨",
  restaurant: "🍽️",
  "street food": "🍢",
  "food hall": "🍱",
  art: "🎨",
  palace: "🏯",
  hotel: "🏨",
  apartment: "🏠",
  ryokan: "🏯",
  breakfast: "☕",
  lunch: "🍜",
  dinner: "🍽️",
};

function parseTime(timeStr) {
  if (!timeStr) return 99;
  // Handle "05:30-09:00" or "05:30" or ISO datetime "2026-07-28T13:55"
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 99;
  return parseInt(match[1]) + parseInt(match[2]) / 60;
}

function buildTimelineEntries(day, trip) {
  const entries = [];
  const currency = trip.currency || {};

  const formatCost = (cost) => {
    if (!cost) return null;
    const rate = currency[cost.currency] || 1;
    const eur = Math.round(cost.amount * rate);
    const sym = cost.currency === "JPY" ? "¥" : cost.currency === "KRW" ? "₩" : cost.currency === "CNY" ? "¥" : "€";
    return `${sym}${cost.amount.toLocaleString()} (~€${eur})`;
  };

  // Accommodation (show at start of day)
  if (day.accommodation) {
    const accom = (trip.accommodation || []).find(a => a.id === day.accommodation);
    if (accom) {
      entries.push({
        sortTime: 0,
        kind: "accommodation",
        type: accom.type || "hotel",
        icon: HOURLY_TYPE_ICONS[accom.type] || "🏨",
        title: accom.name,
        time: `${accom.dates.in} → ${accom.dates.out}`,
        subtitle: [accom.status, accom.ref ? `ref ${accom.ref}` : null].filter(Boolean).join(" · "),
        cost: formatCost(accom.cost),
        color: HOURLY_TYPE_COLORS.hotel,
        coords: accom.coords,
        data: accom,
      });
    }
  }

  // Transport
  (day.transport || []).forEach(tId => {
    const t = (trip.transport || []).find(x => x.id === tId);
    if (!t) return;
    const depTime = t.depart ? t.depart.slice(11, 16) : null;
    const arrTime = t.arrive ? t.arrive.slice(11, 16) : null;
    entries.push({
      sortTime: parseTime(depTime),
      kind: "transport",
      type: t.type,
      icon: HOURLY_TYPE_ICONS[t.type] || "🚗",
      title: `${t.airline || t.subtype || t.type}${t.number ? " " + t.number : ""}`,
      time: depTime && arrTime ? `${depTime} → ${arrTime}` : t.type,
      subtitle: `${t.from.name} → ${t.to.name}`,
      status: t.status,
      jrPass: t.jrPass,
      color: HOURLY_TYPE_COLORS[t.type] || HOURLY_TYPE_COLORS.default,
      coords: t.to.coords,
      data: t,
    });
  });

  // Activities
  (day.activities || []).forEach((a, idx) => {
    const startTime = a.time ? a.time.split("–")[0].split("-")[0].trim() : null;
    entries.push({
      sortTime: parseTime(startTime),
      kind: "activity",
      type: a.type || "experience",
      icon: HOURLY_TYPE_ICONS[a.type] || "✨",
      title: a.name,
      time: a.time || "",
      cost: formatCost(a.cost),
      color: HOURLY_TYPE_COLORS[a.type] || HOURLY_TYPE_COLORS.default,
      coords: a.coords,
      data: a,
      activityIndex: idx,
    });
  });

  // Meals
  (day.meals || []).forEach((m, idx) => {
    const mealTimes = { breakfast: 8, lunch: 12.5, dinner: 19 };
    entries.push({
      sortTime: mealTimes[m.slot] || 12,
      kind: "meal",
      type: m.type || m.slot,
      icon: HOURLY_TYPE_ICONS[m.slot] || "🍽️",
      title: m.name,
      time: m.slot,
      color: HOURLY_TYPE_COLORS[m.slot] || HOURLY_TYPE_COLORS.default,
      data: m,
    });
  });

  entries.sort((a, b) => a.sortTime - b.sortTime);
  return entries;
}

function TripHourlyTimeline({ day, trip, onActivityClick, focusedEntry }) {
  if (!day) return null;

  const entries = buildTimelineEntries(day, trip);

  // Scroll focused entry into view
  const focusRef = React.useRef(null);
  React.useEffect(() => {
    if (focusRef.current) focusRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedEntry]);

  return (
    <div className="td-hourly">
      <div className="td-hourly__header">
        <span className="td-hourly__day-label">Day {day.dayNum}</span>
        <span className="td-hourly__date">{new Date(day.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</span>
        <span className="td-hourly__city">{day.city}</span>
      </div>

      {/* Groups / splits */}
      {day.groups && day.groups.length > 1 && (
        <div className="td-hourly__groups">
          {day.groups.map((g, i) => (
            <div key={i} className="td-hourly__group">
              <span className="td-hourly__group-travelers">
                {g.travelers.join(", ")}
              </span>
              {g.label && <span className="td-hourly__group-label">{g.label}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="td-hourly__timeline">
        {entries.map((entry, i) => {
          const isFocused = focusedEntry && entry.title === focusedEntry.title && entry.kind === focusedEntry.kind;
          return (
          <div
            key={i}
            ref={isFocused ? focusRef : null}
            className={`td-hourly__entry ${entry.kind === "activity" ? "td-hourly__entry--clickable" : ""} ${isFocused ? "td-hourly__entry--focused" : ""}`}
            style={{ "--entry-color": entry.color }}
            onClick={() => {
              if (onActivityClick) onActivityClick(entry);
            }}
          >
            <div className="td-hourly__entry-dot" />
            <div className="td-hourly__entry-content">
              <div className="td-hourly__entry-top">
                <span className="td-hourly__entry-icon">{entry.icon}</span>
                <span className="td-hourly__entry-title">{entry.title}</span>
                <span className="td-hourly__entry-badge">{entry.type}</span>
              </div>
              <div className="td-hourly__entry-meta">
                {entry.time && <span className="td-hourly__entry-time">{entry.time}</span>}
                {entry.subtitle && <span className="td-hourly__entry-subtitle">{entry.subtitle}</span>}
                {entry.cost && <span className="td-hourly__entry-cost">{entry.cost}</span>}
                {entry.status && (
                  <span className={`td-hourly__entry-status td-hourly__entry-status--${entry.status}`}>
                    {entry.status}
                  </span>
                )}
                {entry.jrPass && <span className="td-hourly__entry-jr">🎫 JR Pass</span>}
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Day notes */}
      {day.notes && (
        <div className="td-hourly__notes">
          💡 {day.notes}
        </div>
      )}
    </div>
  );
}

function TripSummary({ trip }) {
  if (!trip) return null;

  const totalTransport = trip.transport ? trip.transport.length : 0;
  const flights = trip.transport ? trip.transport.filter(t => t.type === "flight").length : 0;
  const trains = trip.transport ? trip.transport.filter(t => t.type === "train").length : 0;
  const cities = trip.route ? trip.route.length : 0;
  const countries = trip.phases ? [...new Set(trip.phases.map(p => p.country))].length : 0;

  return (
    <div className="td-summary">
      <div className="td-summary__title">Trip Overview</div>
      <div className="td-summary__stats">
        <div className="td-summary__stat">
          <span className="td-summary__stat-num">{trip.days.length}</span>
          <span className="td-summary__stat-label">days</span>
        </div>
        <div className="td-summary__stat">
          <span className="td-summary__stat-num">{cities}</span>
          <span className="td-summary__stat-label">cities</span>
        </div>
        <div className="td-summary__stat">
          <span className="td-summary__stat-num">{countries}</span>
          <span className="td-summary__stat-label">countries</span>
        </div>
        <div className="td-summary__stat">
          <span className="td-summary__stat-num">{flights}</span>
          <span className="td-summary__stat-label">flights</span>
        </div>
        <div className="td-summary__stat">
          <span className="td-summary__stat-num">{trains}</span>
          <span className="td-summary__stat-label">trains</span>
        </div>
      </div>

      {/* Phase cards */}
      <div className="td-summary__phases">
        {trip.phases.map(phase => (
          <div key={phase.id} className="td-summary__phase" style={{ "--phase-color": phase.color }}>
            <div className="td-summary__phase-name">{phase.name}</div>
            <div className="td-summary__phase-days">{phase.days.length} {phase.days.length === 1 ? "day" : "days"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.TripHourlyTimeline = TripHourlyTimeline;
window.TripSummary = TripSummary;
window.buildTimelineEntries = buildTimelineEntries;
