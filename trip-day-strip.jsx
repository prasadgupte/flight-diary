// TripDayStrip — horizontal scrollable day tiles (level 1 timeline)

const INTENSITY_COLORS = {
  rest: "#00D2A0",
  travel: "#FDCB6E",
  moderate: "#74B9FF",
  high: "#FF6B6B",
};

const TRANSPORT_ICONS = {
  flight: "✈️",
  train: "🚆",
  ferry: "⛴️",
  car: "🚗",
  taxi: "🚕",
  walk: "🚶",
};

function TripDayStrip({ days, phases, transport, accommodation, selectedDay, onDayClick, travelerColors }) {
  const stripRef = React.useRef(null);

  // Scroll selected day into view
  React.useEffect(() => {
    if (selectedDay == null || !stripRef.current) return;
    const el = stripRef.current.querySelector(`[data-day-tile="${selectedDay}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedDay]);

  return (
    <div className="td-day-strip" ref={stripRef}>
      {days.map(day => {
        const phase = phases.find(p => p.id === day.phase) || { color: "#9B97B0" };
        const isActive = selectedDay === day.dayNum;
        const accom = day.accommodation
          ? (accommodation || []).find(a => a.id === day.accommodation)
          : null;
        const dayTransports = (day.transport || [])
          .map(id => (transport || []).find(t => t.id === id))
          .filter(Boolean);

        return (
          <div
            key={day.dayNum}
            data-day-tile={day.dayNum}
            className={`td-day-tile ${isActive ? "td-day-tile--active" : ""}`}
            style={{ "--tile-accent": phase.color }}
            onClick={() => onDayClick(day.dayNum)}
          >
            <div className="td-day-tile__top">
              <span className="td-day-tile__num">D{day.dayNum}</span>
              <span
                className="td-day-tile__intensity"
                style={{ background: INTENSITY_COLORS[day.intensity] || "#9B97B0" }}
                title={day.intensity}
              />
            </div>
            <div className="td-day-tile__city">{day.city}</div>
            <div className="td-day-tile__headline">{day.headline}</div>

            {/* Transport badges */}
            {dayTransports.length > 0 && (
              <div className="td-day-tile__badges">
                {dayTransports.map(t => (
                  <span key={t.id} className="td-day-tile__badge">
                    {TRANSPORT_ICONS[t.type] || "🚗"} {t.number || t.subtype || t.type}
                  </span>
                ))}
              </div>
            )}

            {/* Accommodation */}
            {accom && (
              <div className="td-day-tile__accom">
                🏨 {accom.name.length > 18 ? accom.name.slice(0, 18) + "…" : accom.name}
              </div>
            )}

            {/* Traveler dots */}
            <div className="td-day-tile__travelers">
              {day.travelers.map(code => (
                <span
                  key={code}
                  className="td-day-tile__dot"
                  style={{ background: (travelerColors || {})[code] || "#9B97B0" }}
                  title={code}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

window.TripDayStrip = TripDayStrip;
