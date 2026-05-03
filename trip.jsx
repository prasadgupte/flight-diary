// Trip mode — Redesigned two-level timeline
// Level 1: Day strip (horizontal tiles) — Level 2: Hourly timeline (vertical)
// Orchestrates: TripDayStrip, TripHourlyTimeline, TripSummary, TripActivityDrawer, TripGoogleMap

const TRAVELER_COLORS = {
  PG: "#6C5CE7",
  AG: "#00D2A0",
  GG: "#74B9FF",
  SG: "#FDCB6E",
  APG: "#FF6B6B",
};

function TripSelector({ trips, onSelect }) {
  if (!trips || trips.length === 0) {
    return (
      <div className="trip-selector">
        <div style={{ textAlign: "center", color: "var(--t-fg3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>{"🗺"}</div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 14 }}>No trips loaded</div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 12, marginTop: 8, color: "var(--t-fg3)" }}>
            {"Add trips to flights.json → \"trips\" array"}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="trip-selector">
      {trips.map(trip => (
        <div key={trip.slug} className="trip-selector__card" onClick={() => onSelect(trip.slug)}>
          <div className="trip-selector__card-title">{trip.name}</div>
          <div className="trip-selector__card-dates">
            {trip.dates.start} {"→"} {trip.dates.end} {"·"} {trip.days.length} days
          </div>
          <div className="trip-selector__card-travelers">
            {trip.travelers.map(t => (
              <span key={t.code} className="trip-header__dot"
                style={{ width: 10, height: 10, background: TRAVELER_COLORS[t.code] || "#9B97B0" }}
                title={t.name}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TripPhaseStrip({ phases, days, onPhaseClick }) {
  const totalDays = days.length;
  return (
    <div className="trip-phase-strip">
      {phases.map(phase => {
        const width = (phase.days.length / totalDays) * 100;
        return (
          <div key={phase.id}
            className="trip-phase-segment"
            style={{ width: `${width}%`, background: phase.color + "22", borderBottom: `2px solid ${phase.color}` }}
            onClick={() => onPhaseClick(phase)}
            title={`${phase.name} (${phase.days.length} days)`}
          >
            {width > 8 ? phase.name : ""}
          </div>
        );
      })}
    </div>
  );
}

function TripView({ trips, lightMode }) {
  const [activeSlug, setActiveSlug] = React.useState(trips.length === 1 ? trips[0].slug : null);
  const [selectedDay, setSelectedDay] = React.useState(null);
  const [selectedActivity, setSelectedActivity] = React.useState(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const trip = trips.find(t => t.slug === activeSlug);

  if (!trip) {
    return <TripSelector trips={trips} onSelect={setActiveSlug} />;
  }

  const handleDayClick = (dayNum) => {
    if (selectedDay === dayNum) {
      setSelectedDay(null);
    } else {
      setSelectedDay(dayNum);
    }
    setDrawerOpen(false);
    setSelectedActivity(null);
  };

  const handlePhaseClick = (phase) => {
    const firstDay = phase.days[0];
    setSelectedDay(firstDay);
    setDrawerOpen(false);
    setSelectedActivity(null);
  };

  const handleActivityClick = (entry) => {
    setSelectedActivity(entry);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedActivity(null);
  };

  const selectedDayObj = selectedDay != null
    ? trip.days.find(d => d.dayNum === selectedDay)
    : null;

  return (
    <div className="trip-view">
      {/* Header */}
      <div className="trip-header">
        {trips.length > 1 && (
          <button className="trip-header__back" onClick={() => { setActiveSlug(null); setSelectedDay(null); setDrawerOpen(false); setSelectedActivity(null); }}>
            {"← Back"}
          </button>
        )}
        <span className="trip-header__title">{trip.name}</span>
        <span className="trip-header__meta">
          {trip.dates.start} {"→"} {trip.dates.end} {"·"} {trip.days.length} days
        </span>
        <span className="trip-header__travelers">
          {trip.travelers.map(t => (
            <span key={t.code} className="trip-header__dot"
              style={{ background: TRAVELER_COLORS[t.code] || "#9B97B0" }}
              title={`${t.name} — ${t.role}`}
            />
          ))}
        </span>
      </div>

      {/* Phase strip */}
      <TripPhaseStrip
        phases={trip.phases}
        days={trip.days}
        onPhaseClick={handlePhaseClick}
      />

      {/* Day strip (level 1 timeline) */}
      {window.TripDayStrip && (
        <window.TripDayStrip
          days={trip.days}
          phases={trip.phases}
          transport={trip.transport}
          accommodation={trip.accommodation}
          selectedDay={selectedDay}
          onDayClick={handleDayClick}
          travelerColors={TRAVELER_COLORS}
        />
      )}

      {/* Main content: map + timeline/summary */}
      <div className="trip-main">
        {/* Map panel */}
        <div className="trip-map-panel">
          {window.TripGoogleMap ? (
            <window.TripGoogleMap
              trip={trip}
              selectedDay={selectedDay}
              selectedActivity={selectedActivity}
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <div className="td-map-fallback" style={{ width: "100%", height: "100%" }}>
              <div className="td-map-fallback__inner">
                <div className="td-map-fallback__icon">{"🗺️"}</div>
                <div className="td-map-fallback__title">Map loading...</div>
              </div>
            </div>
          )}
        </div>

        {/* Content panel: hourly timeline or summary */}
        <div className="trip-content-panel">
          {selectedDayObj ? (
            window.TripHourlyTimeline ? (
              <window.TripHourlyTimeline
                day={selectedDayObj}
                trip={trip}
                onActivityClick={handleActivityClick}
              />
            ) : (
              <div style={{ color: "var(--t-fg3)", fontFamily: "var(--font-body)", fontSize: 14 }}>
                Timeline loading...
              </div>
            )
          ) : (
            window.TripSummary ? (
              <window.TripSummary trip={trip} />
            ) : (
              <div style={{ color: "var(--t-fg3)", fontFamily: "var(--font-body)", fontSize: 14, textAlign: "center", paddingTop: 40 }}>
                Select a day to see the schedule
              </div>
            )
          )}
        </div>
      </div>

      {/* Activity drawer */}
      {drawerOpen && window.TripActivityDrawer && (
        <window.TripActivityDrawer
          entry={selectedActivity}
          day={selectedDayObj}
          trip={trip}
          onClose={handleDrawerClose}
        />
      )}
    </div>
  );
}

window.TripView = TripView;
