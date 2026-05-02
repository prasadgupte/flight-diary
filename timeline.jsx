/* timeline.jsx — TimelineBar component */
const { useRef, useCallback, useMemo } = React;

function TimelineBar({ groups, currentGroupIndex, playing, speed, onPlayPause, onSpeedChange, onScrub, onExit }) {
  const trackRef = useRef(null);
  const isDraggingRef = useRef(false);

  const { minDate, totalMs, yearTicks } = useMemo(() => {
    if (!groups.length) return { minDate: 0, totalMs: 1, yearTicks: [] };
    const minDate = groups[0].date.getTime();
    const maxDate = groups[groups.length - 1].date.getTime();
    const totalMs = maxDate - minDate || 1;

    // One tick per unique year, x-pos proportional to actual date (not evenly spaced)
    const seen = new Set();
    const yearTicks = [];
    groups.forEach(g => {
      const yr = g.date.getFullYear();
      if (seen.has(yr)) return;
      seen.add(yr);
      const d = new Date(yr, 0, 1).getTime();
      const pct = Math.max(0, Math.min(1, (d - minDate) / totalMs));
      yearTicks.push({ yr, pct });
    });
    return { minDate, totalMs, yearTicks };
  }, [groups]);

  const currentDate = (groups[Math.min(currentGroupIndex, groups.length - 1)]?.date.getTime()) || minDate;
  const playheadPct = Math.max(0, Math.min(1, (currentDate - minDate) / totalMs));

  const scrubFromX = useCallback((clientX) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetMs = minDate + pct * totalMs;
    let closest = 0, minDiff = Infinity;
    groups.forEach((g, i) => {
      const diff = Math.abs(g.date.getTime() - targetMs);
      if (diff < minDiff) { minDiff = diff; closest = i; }
    });
    onScrub(closest);
  }, [groups, minDate, totalMs, onScrub]);

  const onTrackPointerDown = useCallback((e) => {
    isDraggingRef.current = true;
    trackRef.current.setPointerCapture(e.pointerId);
    scrubFromX(e.clientX);
  }, [scrubFromX]);

  const onTrackPointerMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    scrubFromX(e.clientX);
  }, [scrubFromX]);

  const onTrackPointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const speedBtnStyle = (active) => ({
    padding: "4px 9px", borderRadius: 6, border: "none",
    background: active ? "var(--t-acc-45)" : "var(--t-over-06)",
    color: active ? "var(--t-accent)" : "var(--t-fg3)",
    fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
    cursor: "pointer", transition: "background 0.15s",
  });

  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      height: 72, zIndex: 20,
      background: "var(--t-timeline)",
      borderTop: "1px solid var(--t-over-07)",
      backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center",
      padding: "0 18px", gap: 12,
      userSelect: "none",
    }}>

      {/* Play / Pause */}
      <button onClick={onPlayPause} title={playing ? "Pause" : "Play"} style={{
        width: 34, height: 34, borderRadius: 999, border: "none",
        background: playing ? "var(--t-acc-55)" : "var(--t-acc-22)",
        color: "var(--t-accent)", fontSize: 13, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, transition: "background 0.15s",
      }}>{playing ? "❚❚" : "▶"}</button>

      {/* Speed selector */}
      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        {[1, 2, 4].map(s => (
          <button key={s} onClick={() => onSpeedChange(s)} style={speedBtnStyle(speed === s)}>
            {s}×
          </button>
        ))}
      </div>

      {/* Timeline track */}
      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        style={{
          flex: 1, position: "relative", height: 44,
          cursor: "pointer", minWidth: 0,
        }}
      >
        {/* Background track */}
        <div style={{
          position: "absolute", left: 0, right: 0,
          top: "50%", height: 2,
          background: "var(--t-over-08)", borderRadius: 2,
          transform: "translateY(-50%)",
        }} />

        {/* Progress fill */}
        <div style={{
          position: "absolute", left: 0,
          width: `${playheadPct * 100}%`,
          top: "50%", height: 2,
          background: "linear-gradient(90deg, #6C5CE7, #A29BFE)",
          borderRadius: 2, transform: "translateY(-50%)",
        }} />

        {/* Year ticks + labels */}
        {yearTicks.map(({ yr, pct }) => (
          <div key={yr} style={{
            position: "absolute",
            left: `${pct * 100}%`,
            top: 0, bottom: 0,
            pointerEvents: "none",
          }}>
            <div style={{
              position: "absolute",
              top: "calc(50% - 7px)", left: 0,
              width: 1, height: 7,
              background: "var(--t-over-18)",
            }} />
            <div style={{
              position: "absolute",
              top: "calc(50% + 3px)",
              left: "50%", transform: "translateX(-50%)",
              fontFamily: "var(--font-mono)",
              fontSize: 9, color: "var(--t-fg3)",
              whiteSpace: "nowrap",
            }}>{yr}</div>
          </div>
        ))}

        {/* Playhead dot */}
        <div style={{
          position: "absolute",
          top: "50%", left: `${playheadPct * 100}%`,
          width: 12, height: 12, borderRadius: 999,
          background: "var(--t-accent)",
          boxShadow: "0 0 8px rgba(162,155,254,0.65)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }} />
      </div>

      {/* Exit */}
      <button onClick={onExit} title="Exit autoplay" style={{
        padding: "5px 12px", borderRadius: 8,
        border: "1px solid var(--t-over-10)",
        background: "transparent", color: "var(--t-fg3)",
        fontFamily: "var(--font-mono)", fontSize: 11,
        cursor: "pointer", flexShrink: 0,
        transition: "color 0.15s",
      }}
        onMouseEnter={e => e.currentTarget.style.color = "var(--t-fg)"}
        onMouseLeave={e => e.currentTarget.style.color = "var(--t-fg3)"}
      >✕ exit</button>
    </div>
  );
}

window.TimelineBar = TimelineBar;
