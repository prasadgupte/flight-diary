// TripTimeline — Multi-lane compact timeline (video-editor style)
// Three lanes: dates, cities (colored segments), movement/hotel icons
// Sits at the bottom of the screen, collapsible

const TL_TRANSPORT_ICONS = {
  flight: "✈️",
  train: "🚆",
  ferry: "⛴️",
  car: "🚗",
  taxi: "🚕",
};

function TripTimeline({ trip, selectedDay, onDayClick, collapsed, onToggleCollapse }) {
  const scrollRef = React.useRef(null);
  const DAY_W = 56; // px per day column

  const days = trip.days;
  const totalW = days.length * DAY_W;

  // Scroll selected day into view
  React.useEffect(() => {
    if (selectedDay == null || !scrollRef.current) return;
    const idx = days.findIndex(d => d.dayNum === selectedDay);
    if (idx < 0) return;
    const target = idx * DAY_W + DAY_W / 2;
    const container = scrollRef.current;
    const half = container.clientWidth / 2;
    container.scrollTo({ left: target - half, behavior: "smooth" });
  }, [selectedDay]);

  // Build city segments: contiguous spans of same city
  const citySegments = React.useMemo(() => {
    const segs = [];
    let cur = null;
    days.forEach((d, i) => {
      const city = d.city.split(" → ")[0]; // take first city for multi-city days
      const phase = trip.phases.find(p => p.id === d.phase) || { color: "#9B97B0" };
      if (cur && cur.city === city && cur.phase === d.phase) {
        cur.span++;
        cur.dayNums.push(d.dayNum);
      } else {
        cur = { city, phase: d.phase, color: phase.color, startIdx: i, span: 1, dayNums: [d.dayNum] };
        segs.push(cur);
      }
    });
    return segs;
  }, [trip]);

  // Build icon lane: intercity transport + new hotel check-in per day
  const iconLane = React.useMemo(() => {
    return days.map(d => {
      const icons = [];
      // Intercity transport
      (d.transport || []).forEach(tId => {
        const t = (trip.transport || []).find(x => x.id === tId);
        if (t && t.from && t.to) {
          icons.push({ icon: TL_TRANSPORT_ICONS[t.type] || "🚗", type: t.type, label: `${t.from.name} → ${t.to.name}` });
        }
      });
      // New hotel check-in (accommodation changes from previous day)
      if (d.accommodation) {
        const prevDay = days.find(x => x.dayNum === d.dayNum - 1);
        if (!prevDay || prevDay.accommodation !== d.accommodation) {
          icons.push({ icon: "🏨", type: "hotel", label: (trip.accommodation || []).find(a => a.id === d.accommodation)?.name || "" });
        }
      }
      return icons;
    });
  }, [trip]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  const formatWeekday = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2);
  };

  return (
    <div className={`tl-root ${collapsed ? "tl-root--collapsed" : ""}`}>
      {/* Collapse toggle */}
      <button className="tl-toggle" onClick={onToggleCollapse} title={collapsed ? "Expand timeline" : "Collapse timeline"}>
        <span className="tl-toggle__label">Timeline</span>
        <span className={`tl-toggle__arrow ${collapsed ? "tl-toggle__arrow--up" : ""}`}>{"▾"}</span>
      </button>

      {!collapsed && (
        <div className="tl-scroll" ref={scrollRef}>
          <div className="tl-lanes" style={{ width: totalW }}>

            {/* Lane 1: Date markers */}
            <div className="tl-lane tl-lane--dates">
              {days.map((d, i) => {
                const isActive = selectedDay === d.dayNum;
                const isWeekend = [0, 6].includes(new Date(d.date).getDay());
                return (
                  <div
                    key={d.dayNum}
                    className={`tl-cell tl-cell--date ${isActive ? "tl-cell--active" : ""} ${isWeekend ? "tl-cell--weekend" : ""}`}
                    style={{ width: DAY_W }}
                    onClick={() => onDayClick(d.dayNum)}
                    title={`Day ${d.dayNum}: ${d.date}`}
                  >
                    <span className="tl-cell__weekday">{formatWeekday(d.date)}</span>
                    <span className="tl-cell__date">{formatDate(d.date)}</span>
                  </div>
                );
              })}
            </div>

            {/* Lane 2: City segments (colored) */}
            <div className="tl-lane tl-lane--cities">
              {citySegments.map((seg, i) => (
                <div
                  key={i}
                  className={`tl-city-seg ${selectedDay != null && seg.dayNums.includes(selectedDay) ? "tl-city-seg--active" : ""}`}
                  style={{
                    width: seg.span * DAY_W,
                    left: seg.startIdx * DAY_W,
                    "--seg-color": seg.color,
                  }}
                  onClick={() => onDayClick(seg.dayNums[0])}
                  title={seg.city}
                >
                  <span className="tl-city-seg__label">{seg.city}</span>
                </div>
              ))}
            </div>

            {/* Lane 3: Movement + hotel icons */}
            <div className="tl-lane tl-lane--icons">
              {days.map((d, i) => (
                <div
                  key={d.dayNum}
                  className="tl-cell tl-cell--icon"
                  style={{ width: DAY_W }}
                  onClick={() => onDayClick(d.dayNum)}
                >
                  {iconLane[i].map((ic, j) => (
                    <span key={j} className="tl-icon" title={ic.label}>{ic.icon}</span>
                  ))}
                </div>
              ))}
            </div>

            {/* Selection indicator line */}
            {selectedDay != null && (() => {
              const idx = days.findIndex(d => d.dayNum === selectedDay);
              if (idx < 0) return null;
              return (
                <div
                  className="tl-selection-line"
                  style={{ left: idx * DAY_W + DAY_W / 2, height: "100%" }}
                />
              );
            })()}

          </div>
        </div>
      )}
    </div>
  );
}

window.TripTimeline = TripTimeline;
