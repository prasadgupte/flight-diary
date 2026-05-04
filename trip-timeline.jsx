// TripTimeline — Multi-lane timeline with draggable scrubber and autoplay

const TL_TRANSPORT_ICONS = {
  flight: "plane", train: "train-front", ferry: "ship", car: "car", taxi: "taxi",
};

function TripTimeline({ trip, selectedDay, onDayClick, collapsed, onToggleCollapse,
  onScrub, onScrubEnd, playing, onPlayToggle }) {

  const scrollRef = React.useRef(null);
  const draggingRef = React.useRef(false);
  const [scrubX, setScrubX] = React.useState(null); // px position during drag
  const DAY_W = 56;
  const days = trip.days;
  const totalW = days.length * DAY_W;

  // Scroll selected day into view
  React.useEffect(() => {
    if (selectedDay == null || !scrollRef.current || draggingRef.current) return;
    const idx = days.findIndex(d => d.dayNum === selectedDay);
    if (idx < 0) return;
    const target = idx * DAY_W + DAY_W / 2;
    const container = scrollRef.current;
    const half = container.clientWidth / 2;
    container.scrollTo({ left: target - half, behavior: "smooth" });
  }, [selectedDay]);

  // City segments
  const citySegments = React.useMemo(() => {
    const segs = [];
    let cur = null;
    days.forEach((d, i) => {
      const city = d.city.split(" \u2192 ")[0];
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

  // Icon lane
  const iconLane = React.useMemo(() => {
    return days.map(d => {
      const icons = [];
      (d.transport || []).forEach(tId => {
        const t = (trip.transport || []).find(x => x.id === tId);
        if (t && t.from && t.to) icons.push({ icon: TL_TRANSPORT_ICONS[t.type] || "car", label: `${t.from.name} \u2192 ${t.to.name}` });
      });
      if (d.accommodation) {
        const prev = days.find(x => x.dayNum === d.dayNum - 1);
        if (!prev || prev.accommodation !== d.accommodation) {
          icons.push({ icon: "hotel", label: (trip.accommodation || []).find(a => a.id === d.accommodation)?.name || "" });
        }
      }
      return icons;
    });
  }, [trip]);

  // Scrubber drag handlers
  const posFromClientX = (clientX) => {
    if (!scrollRef.current) return 0;
    const rect = scrollRef.current.getBoundingClientRect();
    const px = clientX - rect.left + scrollRef.current.scrollLeft;
    return Math.max(0, Math.min(days.length - 0.001, px / DAY_W));
  };

  const handleScrubStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pos = posFromClientX(clientX);
    setScrubX(pos * DAY_W);
    if (onScrub) onScrub(pos);

    const onMove = (ev) => {
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const p = posFromClientX(cx);
      setScrubX(p * DAY_W);
      if (onScrub) onScrub(p);
    };
    const onUp = (ev) => {
      draggingRef.current = false;
      const cx = ev.changedTouches ? ev.changedTouches[0].clientX : ev.clientX;
      const p = posFromClientX(cx);
      setScrubX(null);
      if (onScrubEnd) onScrubEnd(p);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  };

  // Compute scrubber pixel position
  const scrubberLeft = React.useMemo(() => {
    if (scrubX != null) return scrubX;
    if (selectedDay == null) return null;
    const idx = days.findIndex(d => d.dayNum === selectedDay);
    return idx >= 0 ? idx * DAY_W + DAY_W / 2 : null;
  }, [scrubX, selectedDay, days]);

  const formatDate = (s) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const formatWd = (s) => new Date(s).toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2);

  return (
    <div className={`tl-root ${collapsed ? "tl-root--collapsed" : ""}`}>
      <button className="tl-toggle" onClick={onToggleCollapse}>
        {onPlayToggle && (
          <button className="tl-play-btn" onClick={(e) => { e.stopPropagation(); onPlayToggle(); }}
            title={playing ? "Pause" : "Play"}>
            {playing ? "\u23F8" : "\u25B6"}
          </button>
        )}
        <span className="tl-toggle__label">Timeline</span>
        <span className={`tl-toggle__arrow ${collapsed ? "tl-toggle__arrow--up" : ""}`}>{"\u25BE"}</span>
      </button>

      {!collapsed && (
        <div className="tl-scroll" ref={scrollRef}>
          <div className="tl-lanes" style={{ width: totalW }}>

            {/* Dates lane */}
            <div className="tl-lane tl-lane--dates">
              {days.map((d) => {
                const isActive = selectedDay === d.dayNum;
                const isWe = [0, 6].includes(new Date(d.date).getDay());
                return (
                  <div key={d.dayNum}
                    className={`tl-cell tl-cell--date ${isActive ? "tl-cell--active" : ""} ${isWe ? "tl-cell--weekend" : ""}`}
                    style={{ width: DAY_W }}
                    onClick={() => onDayClick(d.dayNum)}>
                    <span className="tl-cell__weekday">{formatWd(d.date)}</span>
                    <span className="tl-cell__date">{formatDate(d.date)}</span>
                  </div>
                );
              })}
            </div>

            {/* Cities lane */}
            <div className="tl-lane tl-lane--cities">
              {citySegments.map((seg, i) => (
                <div key={i}
                  className={`tl-city-seg ${selectedDay != null && seg.dayNums.includes(selectedDay) ? "tl-city-seg--active" : ""}`}
                  style={{ width: seg.span * DAY_W, left: seg.startIdx * DAY_W, "--seg-color": seg.color }}
                  onClick={() => onDayClick(seg.dayNums[0])}
                  title={seg.city}>
                  <span className="tl-city-seg__label">{seg.city}</span>
                </div>
              ))}
            </div>

            {/* Icons lane */}
            <div className="tl-lane tl-lane--icons">
              {days.map((d, i) => (
                <div key={d.dayNum} className="tl-cell tl-cell--icon" style={{ width: DAY_W }}
                  onClick={() => onDayClick(d.dayNum)}>
                  {iconLane[i].map((ic, j) => (
                    <span key={j} className="tl-icon" title={ic.label}><LucideIcon name={ic.icon} size={11} /></span>
                  ))}
                </div>
              ))}
            </div>

            {/* Scrubber / playhead */}
            {scrubberLeft != null && (
              <div
                className={`tl-scrubber ${draggingRef.current ? "tl-scrubber--dragging" : ""}`}
                style={{ left: scrubberLeft }}
                onMouseDown={handleScrubStart}
                onTouchStart={handleScrubStart}
              >
                <div className="tl-scrubber__handle" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

window.TripTimeline = TripTimeline;
