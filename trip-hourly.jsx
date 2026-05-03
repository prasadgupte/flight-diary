// TripHourlyTimeline — vertical chronological schedule with time markers

const HOURLY_TYPE_ICONS = {
  flight: "✈️", train: "🚆", ferry: "⛴️", car: "🚗", taxi: "🚕",
  temple: "⛩️", shrine: "⛩️", castle: "🏰", museum: "🏛️",
  park: "🌳", garden: "🌸", nature: "🌿", "theme park": "🎢",
  neighbourhood: "🏘️", market: "🛒", observation: "🔭", memorial: "🕊️",
  landmark: "🗼", experience: "✨", restaurant: "🍽️",
  "street food": "🍢", "food hall": "🍱", art: "🎨", palace: "🏯",
  hotel: "🏨", apartment: "🏠", ryokan: "🏯",
  breakfast: "☕", lunch: "🍜", dinner: "🍽️",
};

function parseTime(timeStr) {
  if (!timeStr) return 99;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 99;
  return parseInt(match[1]) + parseInt(match[2]) / 60;
}

function formatHHMM(decimalTime) {
  if (decimalTime == null || decimalTime >= 99) return null;
  const h = Math.floor(decimalTime);
  const m = Math.round((decimalTime - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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

  // --- Hotel bookend: checkout (start of day) ---
  // If yesterday had a DIFFERENT accommodation, show checkout
  const prevDay = trip.days.find(d => d.dayNum === day.dayNum - 1);
  if (prevDay && prevDay.accommodation && prevDay.accommodation !== day.accommodation) {
    const prevAccom = (trip.accommodation || []).find(a => a.id === prevDay.accommodation);
    if (prevAccom) {
      entries.push({
        sortTime: 0, kind: "checkout", type: "checkout",
        icon: "🚪", title: `Checkout: ${prevAccom.name}`,
        time: prevAccom.dates.out === day.date ? "checkout" : "",
        timeLabel: "TBD", timeLabelRed: true,
        subtitle: prevAccom.type, color: "#9B97B0", coords: prevAccom.coords, data: prevAccom,
      });
    }
  }

  // --- Today's accommodation (at start) ---
  if (day.accommodation) {
    const accom = (trip.accommodation || []).find(a => a.id === day.accommodation);
    if (accom) {
      const isCheckin = accom.dates.in === day.date;
      entries.push({
        sortTime: isCheckin ? 0.5 : 0.1, kind: "accommodation", type: accom.type || "hotel",
        icon: HOURLY_TYPE_ICONS[accom.type] || "🏨", title: accom.name,
        time: `${accom.dates.in} → ${accom.dates.out}`,
        timeLabel: isCheckin ? "Check-in" : null,
        subtitle: [accom.status, accom.ref ? `ref ${accom.ref}` : null].filter(Boolean).join(" · "),
        cost: formatCost(accom.cost), color: "#9B97B0", coords: accom.coords, data: accom,
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
      sortTime: parseTime(depTime), kind: "transport", type: t.type,
      icon: HOURLY_TYPE_ICONS[t.type] || "🚗",
      title: `${t.airline || t.subtype || t.type}${t.number ? " " + t.number : ""}`,
      time: depTime && arrTime ? `${depTime} → ${arrTime}` : t.type,
      subtitle: `${t.from.name} → ${t.to.name}`,
      status: t.status, jrPass: t.jrPass,
      color: "#9B97B0", coords: t.to.coords, data: t,
      fromCoords: t.from.coords, toCoords: t.to.coords,
    });
  });

  // Activities
  (day.activities || []).forEach((a, idx) => {
    const startTime = a.time ? a.time.split("–")[0].split("-")[0].trim() : null;
    entries.push({
      sortTime: parseTime(startTime), kind: "activity", type: a.type || "experience",
      icon: HOURLY_TYPE_ICONS[a.type] || "✨", title: a.name,
      time: a.time || "", cost: formatCost(a.cost),
      color: "#9B97B0", coords: a.coords, data: a, activityIndex: idx,
    });
  });

  // Meals
  (day.meals || []).forEach((m) => {
    const mealTimes = { breakfast: 8, lunch: 12.5, dinner: 19 };
    entries.push({
      sortTime: mealTimes[m.slot] || 12, kind: "meal", type: m.type || m.slot,
      icon: HOURLY_TYPE_ICONS[m.slot] || "🍽️", title: m.name,
      time: m.slot, color: "#9B97B0", data: m,
    });
  });

  // --- Hotel bookend: check-in at end of day ---
  // If tomorrow has a DIFFERENT accommodation, show tonight's check-in at bottom
  const nextDay = trip.days.find(d => d.dayNum === day.dayNum + 1);
  if (nextDay && nextDay.accommodation && nextDay.accommodation !== day.accommodation) {
    const nextAccom = (trip.accommodation || []).find(a => a.id === nextDay.accommodation);
    if (nextAccom) {
      const isCheckin = nextAccom.dates.in === day.date;
      entries.push({
        sortTime: 22, kind: "checkin-tonight", type: "checkin",
        icon: "🏨", title: `Tonight: ${nextAccom.name}`,
        timeLabel: isCheckin ? "Check-in" : "TBD", timeLabelRed: !isCheckin,
        subtitle: nextAccom.type, color: "#9B97B0", coords: nextAccom.coords, data: nextAccom,
      });
    }
  }

  entries.sort((a, b) => a.sortTime - b.sortTime);
  return entries;
}

// Build group labels for sub-tabs
function buildGroupTabs(day, trip) {
  if (!day.groups || day.groups.length <= 1) return null;
  const travelerNames = {};
  (trip.travelers || []).forEach(t => { travelerNames[t.code] = t.name; });
  return day.groups.map(g => {
    // Label: if all travelers except one, show "{name} | Everyone else" style
    const names = g.travelers.map(c => travelerNames[c] || c);
    return { travelers: g.travelers, label: g.label, tabName: names.join(", ") };
  });
}

function TripHourlyTimeline({ day, trip, onActivityClick, focusedEntry, activeGroupIdx, onGroupChange }) {
  if (!day) return null;

  const entries = buildTimelineEntries(day, trip);
  const groupTabs = buildGroupTabs(day, trip);

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

      {/* Group sub-tabs */}
      {groupTabs && (
        <div className="td-group-tabs">
          <button
            className={`td-group-tab ${activeGroupIdx == null ? "td-group-tab--active" : ""}`}
            onClick={(e) => { e.stopPropagation(); onGroupChange && onGroupChange(null); }}>
            All
          </button>
          {groupTabs.map((g, i) => (
            <button key={i}
              className={`td-group-tab ${activeGroupIdx === i ? "td-group-tab--active" : ""}`}
              onClick={(e) => { e.stopPropagation(); onGroupChange && onGroupChange(i); }}>
              {g.tabName}
            </button>
          ))}
          {/* Show active group's plan */}
          {activeGroupIdx != null && groupTabs[activeGroupIdx] && groupTabs[activeGroupIdx].label && (
            <span className="td-group-tabs__plan">{groupTabs[activeGroupIdx].label}</span>
          )}
        </div>
      )}

      <div className="td-hourly__timeline">
        {entries.map((entry, i) => {
          const isFocused = focusedEntry && entry.title === focusedEntry.title && entry.kind === focusedEntry.kind;
          const timeStr = formatHHMM(entry.sortTime);
          return (
            <div
              key={i}
              ref={isFocused ? focusRef : null}
              className={`td-hourly__entry td-hourly__entry--clickable ${isFocused ? "td-hourly__entry--focused" : ""}`}
              onClick={() => { if (onActivityClick) onActivityClick(entry); }}
            >
              {/* Time marker column */}
              <div className="td-hourly__time-col">
                {entry.timeLabelRed ? (
                  <span className="td-hourly__time-label td-hourly__time-label--red">{entry.timeLabel || "TBD"}</span>
                ) : entry.timeLabel ? (
                  <span className="td-hourly__time-label">{entry.timeLabel}</span>
                ) : timeStr ? (
                  <span className="td-hourly__time-marker">{timeStr}</span>
                ) : null}
                <div className="td-hourly__entry-dot" />
              </div>

              {/* Content */}
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

      {day.notes && (
        <div className="td-hourly__notes">💡 {day.notes}</div>
      )}
    </div>
  );
}

function TripSummary({ trip }) {
  if (!trip) return null;
  const flights = trip.transport ? trip.transport.filter(t => t.type === "flight").length : 0;
  const trains = trip.transport ? trip.transport.filter(t => t.type === "train").length : 0;
  const cities = trip.route ? trip.route.length : 0;
  const countries = trip.phases ? [...new Set(trip.phases.map(p => p.country))].length : 0;

  return (
    <div className="td-summary">
      <div className="td-summary__title">Trip Overview</div>
      <div className="td-summary__stats">
        <div className="td-summary__stat"><span className="td-summary__stat-num">{trip.days.length}</span><span className="td-summary__stat-label">days</span></div>
        <div className="td-summary__stat"><span className="td-summary__stat-num">{cities}</span><span className="td-summary__stat-label">cities</span></div>
        <div className="td-summary__stat"><span className="td-summary__stat-num">{countries}</span><span className="td-summary__stat-label">countries</span></div>
        <div className="td-summary__stat"><span className="td-summary__stat-num">{flights}</span><span className="td-summary__stat-label">flights</span></div>
        <div className="td-summary__stat"><span className="td-summary__stat-num">{trains}</span><span className="td-summary__stat-label">trains</span></div>
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
  );
}

window.TripHourlyTimeline = TripHourlyTimeline;
window.TripSummary = TripSummary;
window.buildTimelineEntries = buildTimelineEntries;
