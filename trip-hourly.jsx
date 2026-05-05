// TripHourlyTimeline — vertical chronological schedule with time markers

const HOURLY_TYPE_ICONS = {
  flight: "plane", train: "train-front", ferry: "ship", car: "car", taxi: "taxi",
  bus: "bus", metro: "train-front",
  temple: "landmark", shrine: "landmark", castle: "castle", museum: "building-2",
  park: "tree-pine", garden: "flower-2", nature: "leaf", "theme park": "ferris-wheel",
  neighbourhood: "building", market: "shopping-bag", observation: "telescope", memorial: "heart",
  landmark: "landmark", experience: "sparkles", restaurant: "utensils-crossed",
  "street food": "utensils", "food hall": "utensils", art: "palette", palace: "building-2",
  hotel: "hotel", apartment: "house", ryokan: "building-2",
  breakfast: "coffee", lunch: "soup", dinner: "utensils-crossed",
  immigration: "shield", festival: "party-popper", onsen: "waves",
  hiking: "mountain", cruise: "ship", shopping: "shopping-bag",
};

// 4 transit colors from the gradient signature (violet, coral, mint, sun)
const TRANSIT_PALETTE = ["#6C5CE7", "#FF6B6B", "#00D2A0", "#FDCB6E"];

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
  const formatCost = (cost, priceConfirmed, freeReason) => {
    if (!cost) return null;
    if (cost.amount === 0) {
      if (freeReason === "free_admission") return "Free";
      if (freeReason === "included_in_jr_pass") return "JR Pass";
      if (freeReason === "included_in_hotel") return "Incl.";
      if (freeReason === "included_in_park_entry") return "Incl.";
      if (freeReason === "public_space") return null;
      return null;
    }
    const rate = currency[cost.currency] || 1;
    const eur = Math.round(cost.amount * rate);
    const sym = cost.currency === "JPY" ? "¥" : cost.currency === "KRW" ? "₩" : cost.currency === "CNY" ? "¥" : "€";
    const prefix = priceConfirmed === false ? "~" : "";
    return `${prefix}${sym}${cost.amount.toLocaleString()} (~€${eur})`;
  };


  // --- Hotel logic ---
  // Accommodation represents where you SLEEP tonight
  // accom.dates.in = check-in date, accom.dates.out = check-out date
  const prevDay = trip.days.find(d => d.dayNum === day.dayNum - 1);
  const accom = day.accommodation ? (trip.accommodation || []).find(a => a.id === day.accommodation) : null;
  const prevAccom = prevDay && prevDay.accommodation ? (trip.accommodation || []).find(a => a.id === prevDay.accommodation) : null;

  // Morning checkout: if previous day had a different hotel, show checkout at start
  if (prevAccom && (!accom || prevAccom.id !== accom.id)) {
    entries.push({
      sortTime: 0, kind: "checkout", type: "checkout",
      icon: "door-open", title: `Checkout: ${prevAccom.name}`,
      timeLabel: prevAccom.dates.out === day.date ? "Checkout" : "TBD",
      timeLabelRed: prevAccom.dates.out !== day.date,
      subtitle: prevAccom.type, color: "#9B97B0", coords: prevAccom.coords, data: prevAccom,
    });
  }

  // Staying at (waking up here — hotel from previous night, same as today)
  if (accom && accom.dates.in < day.date) {
    entries.push({
      sortTime: 0.1, kind: "accommodation", type: accom.type || "hotel",
      icon: HOURLY_TYPE_ICONS[accom.type] || "hotel", title: accom.name,
      timeLabel: "Staying",
      subtitle: [accom.status, accom.ref ? `ref ${accom.ref}` : null].filter(Boolean).join(" · "),
      color: "#9B97B0", coords: accom.coords, data: accom,
    });
  }

  // Check-in tonight (new hotel, dates.in === today) — goes at END of day
  if (accom && accom.dates.in === day.date) {
    entries.push({
      sortTime: 22, kind: "checkin", type: accom.type || "hotel",
      icon: "hotel", title: `Check-in: ${accom.name}`,
      timeLabel: "Check-in",
      time: `${accom.dates.in} → ${accom.dates.out}`,
      subtitle: [accom.status, accom.ref ? `ref ${accom.ref}` : null].filter(Boolean).join(" · "),
      cost: formatCost(accom.cost, accom.price_confirmed), color: "#9B97B0", coords: accom.coords, data: accom,
    });
  }

  // Transport — assign rotating transit colors from palette
  let transitIdx = 0;
  (day.transport || []).forEach(tId => {
    const t = (trip.transport || []).find(x => x.id === tId);
    if (!t) return;
    const depTime = t.depart ? t.depart.slice(11, 16) : null;
    const arrTime = t.arrive ? t.arrive.slice(11, 16) : null;
    const transitColor = TRANSIT_PALETTE[transitIdx % TRANSIT_PALETTE.length];
    transitIdx++;
    entries.push({
      sortTime: parseTime(depTime), kind: "transport", type: t.type,
      icon: HOURLY_TYPE_ICONS[t.type] || "car",
      title: `${t.airline || t.subtype || t.type}${t.number ? " " + t.number : ""}`,
      time: depTime && arrTime ? `${depTime} → ${arrTime}` : t.type,
      subtitle: `${t.from.name} → ${t.to.name}`,
      status: t.status, jrPass: t.jrPass,
      color: transitColor, coords: t.to.coords, data: t,
      fromCoords: t.from.coords, toCoords: t.to.coords,
      transitColor,
    });
  });

  // Activities — include travelers from trip JSON
  (day.activities || []).forEach((a, idx) => {
    const startTime = a.time ? a.time.split("–")[0].split("-")[0].trim() : null;
    entries.push({
      sortTime: parseTime(startTime), kind: "activity", type: a.type || "experience",
      icon: HOURLY_TYPE_ICONS[a.type] || "sparkles", title: a.name,
      time: a.time || "", cost: formatCost(a.cost, a.price_confirmed, a.free_reason),
      color: "#9B97B0", coords: a.coords, data: a, activityIndex: idx,
      travelers: a.travelers || null,
      bookingRequired: a.booking_required || false,
      bookingUrgency: a.booking_urgency || null,
      bookingType: a.booking_type || null,
      priceConfirmed: a.price_confirmed,
      freeReason: a.free_reason,
    });
  });

  // Meals
  (day.meals || []).forEach((m) => {
    const mealTimes = { breakfast: 8, lunch: 12.5, dinner: 19 };
    entries.push({
      sortTime: mealTimes[m.slot] || 12, kind: "meal", type: m.type || m.slot,
      icon: HOURLY_TYPE_ICONS[m.slot] || "utensils-crossed", title: m.name,
      time: m.slot, cost: formatCost(m.cost, m.price_confirmed, m.free_reason),
      color: "#9B97B0", data: m,
      bookingRequired: m.booking_required || false,
      bookingUrgency: m.booking_urgency || null,
    });
  });

  entries.sort((a, b) => a.sortTime - b.sortTime);
  return entries;
}

// Build group tabs
function buildGroupTabs(day, trip) {
  if (!day.groups || day.groups.length <= 1) return null;
  const travelerNames = {};
  (trip.travelers || []).forEach(t => { travelerNames[t.code] = t.name; });
  return day.groups.map(g => ({
    travelers: g.travelers, label: g.label,
    tabName: g.travelers.map(c => travelerNames[c] || c).join(", "),
  }));
}

function TripHourlyTimeline({ day, trip, onActivityClick, focusedEntry, activeGroupIdx, onGroupChange, activeMemberFilter, activityTypeFilter, activityGroupFilter, bookingFilter }) {
  if (!day) return null;

  const entries = buildTimelineEntries(day, trip);
  const groupTabs = buildGroupTabs(day, trip);
  const travelerNames = {};
  (trip.travelers || []).forEach(t => { travelerNames[t.code] = t.name; });

  // Resolve group filter to a set of types
  const groupFilterTypes = React.useMemo(() => {
    if (!activityGroupFilter || !window.ACTIVITY_TAXONOMY) return null;
    const grp = window.ACTIVITY_TAXONOMY.find(g => g.id === activityGroupFilter);
    return grp ? new Set(grp.types) : null;
  }, [activityGroupFilter]);

  // Filter entries using entry.travelers (from trip JSON)
  const filtered = entries.filter(entry => {
    const et = entry.travelers || day.travelers; // fallback: everyone on this day

    // Member filter from header
    if (activeMemberFilter && activeMemberFilter.size > 0 && activeMemberFilter.size < (trip.travelers || []).length) {
      if (entry.kind === "activity" && !et.some(c => activeMemberFilter.has(c))) return false;
    }

    // Group tab filter
    if (activeGroupIdx != null && groupTabs && groupTabs[activeGroupIdx]) {
      const gMembers = groupTabs[activeGroupIdx].travelers;
      if (entry.kind === "activity" && !et.some(c => gMembers.includes(c))) return false;
    }

    // Activity type filter from header
    if (activityTypeFilter && entry.type !== activityTypeFilter) return false;

    // Activity group filter (taxonomy group → set of types)
    if (groupFilterTypes && !groupFilterTypes.has(entry.type)) return false;

    // Booking urgency filter
    if (bookingFilter && (!entry.bookingRequired || entry.bookingUrgency !== bookingFilter)) return false;

    return true;
  });

  // Group pills: show traveler names if activity is NOT shared (subset of day travelers)
  const getGroupPills = (entry) => {
    if (!day.groups || day.groups.length <= 1) return null;
    if (entry.kind !== "activity") return null;
    const et = entry.travelers;
    if (!et) return null;
    // If same as day travelers → shared, no pill
    if (et.length === day.travelers.length && et.every(c => day.travelers.includes(c))) return null;
    // Show the traveler names as a pill
    return [{ label: et.map(c => travelerNames[c] || c).join(", ") }];
  };

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

      {/* Group sub-tabs (above timeline line) */}
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
              onClick={(e) => { e.stopPropagation(); onGroupChange && onGroupChange(activeGroupIdx === i ? null : i); }}>
              {g.tabName}
            </button>
          ))}
        </div>
      )}

      <div className="td-hourly__timeline">
        {filtered.map((entry, i) => {
          const isFocused = focusedEntry && entry.title === focusedEntry.title && entry.kind === focusedEntry.kind;
          const timeStr = formatHHMM(entry.sortTime);
          const pills = getGroupPills(entry);
          return (
            <div
              key={entry.title + "-" + i}
              ref={isFocused ? focusRef : null}
              className={`td-hourly__entry td-hourly__entry--clickable ${isFocused ? "td-hourly__entry--focused" : ""}`}
              style={entry.transitColor ? { "--dot-color": entry.transitColor, "--line-color": entry.transitColor } : {}}
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
                  <span className="td-hourly__entry-icon"><LucideIcon name={entry.icon} size={14} /></span>
                  <span className="td-hourly__entry-title">{entry.title}</span>
                  {/* Group pills inline */}
                  {pills && pills.map(p => (
                    <span key={p.idx} className="td-hourly__group-pill">{p.label}</span>
                  ))}
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
                  {entry.jrPass && <span className="td-hourly__entry-jr"><LucideIcon name="ticket" size={12} /> JR Pass</span>}
                  {entry.bookingRequired && entry.bookingUrgency && (
                    <span className={`td-hourly__entry-booking td-hourly__entry-booking--${entry.bookingUrgency}`}>
                      {entry.bookingUrgency === "immediate" ? "Book now" : entry.bookingUrgency === "ASAP" ? "Book soon" : "Book"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {day.notes && (
        <div className="td-hourly__notes"><LucideIcon name="lightbulb" size={13} /> {day.notes}</div>
      )}
    </div>
  );
}

window.TripHourlyTimeline = TripHourlyTimeline;
window.buildTimelineEntries = buildTimelineEntries;
