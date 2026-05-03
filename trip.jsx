// Trip mode — Two-level timeline with multi-lane navigator
// Layout: Header → Main area (list|map toggle) → Timeline (bottom, collapsible)
// Orchestrates: TripTimeline, TripHourlyTimeline, TripSummary, TripActivityDrawer

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

function TripView({ trips, lightMode }) {
  const [activeSlug, setActiveSlug] = React.useState(trips.length === 1 ? trips[0].slug : null);
  const [selectedDay, setSelectedDay] = React.useState(null);
  const [selectedActivity, setSelectedActivity] = React.useState(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState("list"); // "list" | "map"
  const [timelineCollapsed, setTimelineCollapsed] = React.useState(false);

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

  // Phase info for selected day
  const selectedPhase = selectedDayObj
    ? trip.phases.find(p => p.id === selectedDayObj.phase)
    : null;

  return (
    <div className="trip-view">
      {/* Header */}
      <div className="trip-header">
        <div className="trip-header__left">
          {trips.length > 1 && (
            <button className="trip-header__back" onClick={() => { setActiveSlug(null); setSelectedDay(null); setDrawerOpen(false); setSelectedActivity(null); }}>
              {"←"}
            </button>
          )}
          <span className="trip-header__title">{trip.name}</span>
          <span className="trip-header__meta">
            {trip.dates.start} {"→"} {trip.dates.end} {"·"} {trip.days.length} days
          </span>
        </div>
        <div className="trip-header__right">
          {/* List / Map toggle */}
          <div className="trip-view-toggle">
            <button
              className={`trip-view-toggle__btn ${viewMode === "list" ? "trip-view-toggle__btn--active" : ""}`}
              onClick={() => setViewMode("list")}
            >List</button>
            <button
              className={`trip-view-toggle__btn ${viewMode === "map" ? "trip-view-toggle__btn--active" : ""}`}
              onClick={() => setViewMode("map")}
            >Map</button>
          </div>
          <span className="trip-header__travelers">
            {trip.travelers.map(t => (
              <span key={t.code} className="trip-header__dot"
                style={{ background: TRAVELER_COLORS[t.code] || "#9B97B0" }}
                title={`${t.name} — ${t.role}`}
              />
            ))}
          </span>
        </div>
      </div>

      {/* Main content area (full width) */}
      <div className="trip-main">
        {viewMode === "list" ? (
          <div className="trip-content-panel">
            {selectedDayObj ? (
              /* Day selected: show daily view header + hourly timeline */
              <div className="trip-day-view">
                <div className="trip-day-view__header">
                  <div className="trip-day-view__day-badge" style={selectedPhase ? { "--badge-accent": selectedPhase.color } : {}}>
                    Day {selectedDayObj.dayNum}
                  </div>
                  <div className="trip-day-view__info">
                    <span className="trip-day-view__city">{selectedDayObj.city}</span>
                    <span className="trip-day-view__date">
                      {new Date(selectedDayObj.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <div className="trip-day-view__headline">{selectedDayObj.headline}</div>
                </div>
                {window.TripHourlyTimeline && (
                  <window.TripHourlyTimeline
                    day={selectedDayObj}
                    trip={trip}
                    onActivityClick={handleActivityClick}
                  />
                )}
              </div>
            ) : (
              /* No day selected: trip overview */
              window.TripSummary ? (
                <window.TripSummary trip={trip} />
              ) : (
                <div style={{ color: "var(--t-fg3)", fontFamily: "var(--font-body)", fontSize: 14, textAlign: "center", paddingTop: 40 }}>
                  Select a day to see the schedule
                </div>
              )
            )}
          </div>
        ) : (
          /* Map view */
          <div className="trip-map-panel trip-map-panel--full">
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
                  <div className="td-map-fallback__title">Map view</div>
                  <div className="td-map-fallback__hint">
                    Map integration coming soon.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Multi-lane timeline (bottom) */}
      {window.TripTimeline && (
        <window.TripTimeline
          trip={trip}
          selectedDay={selectedDay}
          onDayClick={handleDayClick}
          collapsed={timelineCollapsed}
          onToggleCollapse={() => setTimelineCollapsed(!timelineCollapsed)}
        />
      )}

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
