// Trip mode — Split view + scrubber + inline drawer
// Layout: Header → Main (list+map split or toggle) → Focus panel → Timeline

const TRAVELER_COLORS = {
  PG: "#6C5CE7", AG: "#00D2A0", GG: "#74B9FF", SG: "#FDCB6E", APG: "#FF6B6B",
};

function TripSelector({ trips, onSelect }) {
  if (!trips || trips.length === 0) {
    return (
      <div className="trip-selector">
        <div style={{ textAlign: "center", color: "var(--t-fg3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}><LucideIcon name="map" size={32} /></div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 14 }}>No trips loaded</div>
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
            {trip.dates.start} → {trip.dates.end} · {trip.days.length} days
          </div>
          <div className="trip-selector__card-travelers">
            {trip.travelers.map(t => (
              <span key={t.code} className="trip-header__dot"
                style={{ width: 10, height: 10, background: TRAVELER_COLORS[t.code] || "#9B97B0" }}
                title={t.name} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TripView({ trips, lightMode, activeMembers, playing: playingProp, onPlayToggle, activeSlug: activeSlugProp, onSlugChange, tripViewMode, activityTypeFilter, bookingFilter }) {
  const [localSlug, setLocalSlug] = React.useState(trips.length === 1 ? trips[0].slug : null);
  const activeSlug = activeSlugProp != null ? activeSlugProp : localSlug;
  const setActiveSlug = (slug) => { if (onSlugChange) onSlugChange(slug); else setLocalSlug(slug); };
  const [selectedDay, setSelectedDay] = React.useState(null);
  const [focusedEntry, setFocusedEntry] = React.useState(null);
  const [timelineCollapsed, setTimelineCollapsed] = React.useState(false);
  const playing = playingProp != null ? playingProp : false;
  const [prevDay, setPrevDay] = React.useState(null); // for swipe direction
  const [splitRatio, setSplitRatio] = React.useState(0.5); // list:map ratio
  const [activeGroupIdx, setActiveGroupIdx] = React.useState(null); // group tab
  const dividerRef = React.useRef(null);
  const playRef = React.useRef(null);

  // Detect wide screen for split view
  const [isWide, setIsWide] = React.useState(window.innerWidth >= 1024);
  React.useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Reset day/entry selection when trip changes
  const prevSlugRef = React.useRef(activeSlug);
  React.useEffect(() => {
    if (prevSlugRef.current !== activeSlug) {
      setSelectedDay(null);
      setFocusedEntry(null);
      setActiveGroupIdx(null);
      prevSlugRef.current = activeSlug;
    }
  }, [activeSlug]);

  const trip = trips.find(t => t.slug === activeSlug);
  if (!trip) return <TripSelector trips={trips} onSelect={setActiveSlug} />;

  const selectedDayObj = selectedDay != null ? trip.days.find(d => d.dayNum === selectedDay) : null;
  const selectedPhase = selectedDayObj ? trip.phases.find(p => p.id === selectedDayObj.phase) : null;

  // Build entry counts per day (for scrubber sub-positions)
  const dayEntries = React.useMemo(() => {
    if (!window.buildTimelineEntries) return trip.days.map(() => []);
    return trip.days.map(d => window.buildTimelineEntries(d, trip));
  }, [trip]);

  // --- Handlers ---
  const handleDayClick = (dayNum) => {
    setPrevDay(selectedDay);
    if (selectedDay === dayNum) {
      setSelectedDay(null);
      setFocusedEntry(null);
    } else {
      setSelectedDay(dayNum);
      setFocusedEntry(null);
    }
    if (playing && onPlayToggle) onPlayToggle();
    setActiveGroupIdx(null);
  };

  const handleActivityClick = (entry) => {
    // Toggle: clicking same entry closes it, clicking different opens it
    if (focusedEntry && entry.title === focusedEntry.title && entry.kind === focusedEntry.kind) {
      setFocusedEntry(null);
    } else {
      setFocusedEntry(entry);
    }
  };

  const handleFocusClose = () => {
    setFocusedEntry(null);
  };

  // --- Scrubber ---
  const handleScrub = (pos) => {
    const dayIdx = Math.floor(pos);
    const clamped = Math.min(dayIdx, trip.days.length - 1);
    const day = trip.days[clamped];
    if (day && day.dayNum !== selectedDay) {
      setPrevDay(selectedDay);
      setSelectedDay(day.dayNum);
    }
    // Focus entry within day
    const entries = dayEntries[clamped] || [];
    if (entries.length > 0) {
      const frac = pos - dayIdx;
      const entryIdx = Math.min(Math.floor(frac * entries.length), entries.length - 1);
      setFocusedEntry(entries[entryIdx]);
    }
  };

  const handleScrubEnd = (pos) => {
    // Keep current day/entry selection
  };

  // --- Autoplay ---
  React.useEffect(() => {
    if (!playing) { clearInterval(playRef.current); return; }
    let dayIdx = selectedDay != null ? trip.days.findIndex(d => d.dayNum === selectedDay) : 0;
    let entryIdx = focusedEntry ? (dayEntries[dayIdx] || []).indexOf(focusedEntry) : -1;
    if (entryIdx < 0) entryIdx = -1;

    playRef.current = setInterval(() => {
      const entries = dayEntries[dayIdx] || [];
      entryIdx++;
      if (entryIdx >= entries.length) {
        dayIdx++;
        entryIdx = 0;
        if (dayIdx >= trip.days.length) {
          if (onPlayToggle) onPlayToggle();
          return;
        }
        setPrevDay(selectedDay);
        setSelectedDay(trip.days[dayIdx].dayNum);
      }
      const newEntries = dayEntries[dayIdx] || [];
      if (newEntries.length > 0 && entryIdx < newEntries.length) {
        setFocusedEntry(newEntries[entryIdx]);
      }
    }, 1500);
    return () => clearInterval(playRef.current);
  }, [playing, selectedDay]);

  // --- Split divider drag ---
  const handleDividerDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startRatio = splitRatio;
    const mainEl = e.target.parentElement;
    const mainW = mainEl.offsetWidth;
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      setSplitRatio(Math.max(0.2, Math.min(0.8, startRatio + dx / mainW)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Swipe direction for animation
  const swipeDir = prevDay != null && selectedDay != null ? (selectedDay > prevDay ? "left" : "right") : "left";

  return (
    <div className="trip-view">
      {/* Header */}
      <div className="trip-header">
        <div className="trip-header__left">
          {trips.length > 1 && (
            <button className="trip-header__back" onClick={() => { setActiveSlug(null); setSelectedDay(null); setFocusedEntry(null); }}>←</button>
          )}
          <span className="trip-header__title">{trip.name}</span>
          <span className="trip-header__meta">{trip.dates.start} → {trip.dates.end} · {trip.days.length} days</span>
        </div>
        <div className="trip-header__right">
          <span className="trip-header__travelers">
            {trip.travelers.map(t => (
              <span key={t.code} className="trip-header__dot"
                style={{ background: TRAVELER_COLORS[t.code] || "#9B97B0" }}
                title={`${t.name} — ${t.role}`} />
            ))}
          </span>
        </div>
      </div>

      {/* Main content: split on wide, list-only on narrow */}
      <div className={`trip-main ${isWide ? "trip-main--split" : ""}`}>
        {/* List panel */}
        <div className="trip-content-panel" style={isWide ? { flex: `0 0 ${splitRatio * 100}%` } : {}}>
          {tripViewMode === "list" ? (
            /* List view: all days in one scrollable list */
            <div className="trip-list-view">
              {trip.days.map((dayObj, idx) => {
                const entries = dayEntries[idx] || [];
                if (activityTypeFilter && !entries.some(e => e.type === activityTypeFilter)) return null;
                if (bookingFilter && !entries.some(e => e.bookingRequired && e.bookingUrgency === bookingFilter)) return null;
                return (
                  <div key={dayObj.dayNum}>
                    {window.TripHourlyTimeline && (
                      <window.TripHourlyTimeline
                        day={dayObj}
                        trip={trip}
                        onActivityClick={handleActivityClick}
                        focusedEntry={focusedEntry}
                        activeGroupIdx={null}
                        onGroupChange={() => {}}
                        activeMemberFilter={activeMembers}
                        activityTypeFilter={activityTypeFilter}
                        bookingFilter={bookingFilter}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : selectedDayObj ? (
            <div key={selectedDay} className={`trip-day-view trip-day-view--enter-${swipeDir}`}>
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
                  focusedEntry={focusedEntry}
                  activeGroupIdx={activeGroupIdx}
                  onGroupChange={setActiveGroupIdx}
                  activeMemberFilter={activeMembers}
                  activityTypeFilter={activityTypeFilter}
                  bookingFilter={bookingFilter}
                />
              )}
            </div>
          ) : (
            window.TripSummary ? <window.TripSummary trip={trip} /> : null
          )}
        </div>

        {/* Resizable divider (wide only) */}
        {isWide && (
          <div className="trip-split-divider" onMouseDown={handleDividerDown} ref={dividerRef} />
        )}

        {/* Map panel (wide: always visible; narrow: hidden) */}
        {isWide && (
          <div className="trip-map-panel" style={{ flex: `0 0 ${(1 - splitRatio) * 100}%` }}>
            {/* Drawer pushes map down on desktop */}
            {focusedEntry && (
              <div className="trip-drawer-inline">
                <div className="trip-drawer-inline__header" onClick={handleFocusClose} style={{ cursor: "pointer" }}>
                  <span className="trip-drawer-inline__icon"><LucideIcon name={focusedEntry.icon} size={16} /></span>
                  <span className="trip-drawer-inline__title">{focusedEntry.title}</span>
                  <button className="trip-drawer-inline__close" onClick={(e) => { e.stopPropagation(); handleFocusClose(); }}><LucideIcon name="x" size={14} /></button>
                </div>
                <div className="trip-drawer-inline__meta">
                  <span className="trip-drawer-inline__badge">{focusedEntry.type}</span>
                  {focusedEntry.time && <span className="trip-drawer-inline__time">{focusedEntry.time}</span>}
                  {focusedEntry.subtitle && <span className="trip-drawer-inline__subtitle">{focusedEntry.subtitle}</span>}
                </div>
                {focusedEntry.cost && <div className="trip-drawer-inline__cost">{focusedEntry.cost}</div>}
                {focusedEntry.status && <div className="trip-drawer-inline__status">Status: {focusedEntry.status}{focusedEntry.data && focusedEntry.data.ref ? ` · ${focusedEntry.data.ref}` : ""}</div>}
                {focusedEntry.jrPass && <div className="trip-drawer-inline__jr"><LucideIcon name="ticket" size={12} /> JR Pass covered</div>}
                {focusedEntry.coords && (
                  <a className="trip-drawer-inline__maps" href={`https://www.google.com/maps/search/?api=1&query=${focusedEntry.coords[0]},${focusedEntry.coords[1]}`} target="_blank" rel="noopener"><LucideIcon name="map-pin" size={12} /> Open in Maps</a>
                )}
              </div>
            )}
            <div className="trip-map-container">
              {window.TripMapView ? (
                <window.TripMapView trip={trip} selectedDay={selectedDay} focusedEntry={focusedEntry} lightMode={lightMode} onPinClick={handleActivityClick} />
              ) : (
                <div className="td-map-fallback"><div className="td-map-fallback__inner">
                  <div className="td-map-fallback__icon"><LucideIcon name="map" size={32} /></div>
                  <div className="td-map-fallback__title">Map loading...</div>
                </div></div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Inline focus panel (narrow screens, above timeline) */}
      {!isWide && focusedEntry && (
        <div className="trip-focus-bar">
          <span className="trip-focus-bar__icon"><LucideIcon name={focusedEntry.icon} size={14} /></span>
          <span className="trip-focus-bar__title">{focusedEntry.title}</span>
          {focusedEntry.time && <span className="trip-focus-bar__time">{focusedEntry.time}</span>}
          {focusedEntry.cost && <span className="trip-focus-bar__cost">{focusedEntry.cost}</span>}
          <a className="trip-focus-bar__maps" href={focusedEntry.coords ? `https://www.google.com/maps/search/?api=1&query=${focusedEntry.coords[0]},${focusedEntry.coords[1]}` : "#"} target="_blank" rel="noopener"><LucideIcon name="map-pin" size={14} /></a>
          <button className="trip-focus-bar__close" onClick={handleFocusClose}><LucideIcon name="x" size={14} /></button>
        </div>
      )}

      {/* Multi-lane timeline (bottom) */}
      {window.TripTimeline && (
        <window.TripTimeline
          trip={trip}
          selectedDay={selectedDay}
          onDayClick={handleDayClick}
          collapsed={timelineCollapsed}
          onToggleCollapse={() => setTimelineCollapsed(!timelineCollapsed)}
          onScrub={handleScrub}
          onScrubEnd={handleScrubEnd}
          playing={playing}
          onPlayToggle={null}
        />
      )}
    </div>
  );
}

window.TripView = TripView;
