// TripMapView — MapLibre GL JS + OpenFreeMap (bright/positron)
// Day view: activity pins + color-coded transit routes, clickable pins

const flip = (c) => [c[1], c[0]]; // trip [lat,lng] → MapLibre [lng,lat]

function addOverviewLayers(map, trip, markersRef) {
  (markersRef.current || []).forEach(m => m.remove());
  markersRef.current = [];
  if (!trip.route || trip.route.length === 0) return;

  const routeCoords = trip.route.map(r => flip(r.coords));
  if (!map.getSource("route")) {
    map.addSource("route", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: routeCoords } } });
    map.addLayer({ id: "route-line", type: "line", source: "route", paint: { "line-color": "#6C5CE7", "line-opacity": 0.5, "line-width": 2 } });
  }

  // Flight arcs
  (trip.transport || []).filter(t => t.type === "flight" && t.from && t.to).forEach((t, i) => {
    const srcId = "flight-" + i;
    if (map.getSource(srcId)) return;
    const pts = [];
    for (let j = 0; j <= 20; j++) {
      const frac = j / 20;
      const from = flip(t.from.coords), to = flip(t.to.coords);
      pts.push([from[0] + (to[0] - from[0]) * frac, from[1] + (to[1] - from[1]) * frac + Math.sin(frac * Math.PI) * Math.abs(to[0] - from[0]) * 0.15]);
    }
    map.addSource(srcId, { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: pts } } });
    map.addLayer({ id: srcId + "-line", type: "line", source: srcId, paint: { "line-color": "#9B97B0", "line-opacity": 0.5, "line-width": 1.5, "line-dasharray": [4, 3] } });
  });

  // City markers
  trip.route.forEach(r => {
    const phase = trip.phases.find(p => p.days.some(d => r.dayNums.includes(d)));
    const color = phase ? phase.color : "#9B97B0";
    const el = document.createElement("div");
    el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);cursor:pointer;`;
    el.title = r.city;
    markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat(flip(r.coords)).addTo(map));
  });
}

function clearSources(map, prefix) {
  const style = map.getStyle();
  if (!style || !style.layers) return;
  style.layers.forEach(l => { if (l.id.startsWith(prefix)) try { map.removeLayer(l.id); } catch(e){} });
  Object.keys(style.sources || {}).forEach(s => { if (s.startsWith(prefix)) try { map.removeSource(s); } catch(e){} });
}

function addDayLayers(map, day, trip, markersRef, onPinClick, focusedEntry) {
  (markersRef.current || []).forEach(m => m.remove());
  markersRef.current = [];

  const bounds = new maplibregl.LngLatBounds();
  const entries = window.buildTimelineEntries ? window.buildTimelineEntries(day, trip) : [];

  // Activity/accommodation pins — all gray by default, focused one pulses green
  entries.forEach((entry) => {
    if (!entry.coords) return;
    const lngLat = flip(entry.coords);
    bounds.extend(lngLat);

    const isFocused = focusedEntry && entry.title === focusedEntry.title && entry.kind === focusedEntry.kind;
    const el = document.createElement("div");
    if (isFocused) {
      el.className = "trip-map-pulse-green";
      el.style.cssText = `width:18px;height:18px;border-radius:50%;background:#00D2A0;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,210,160,0.4);cursor:pointer;`;
    } else {
      el.style.cssText = `width:12px;height:12px;border-radius:50%;background:#9B97B0;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);cursor:pointer;transition:transform 150ms;`;
      el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.3)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
    }
    el.title = entry.title;
    el.addEventListener("click", (e) => { e.stopPropagation(); if (onPinClick) onPinClick(entry); });
    markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map));
  });

  // Transport routes — color-coded using entry.transitColor
  const transports = entries.filter(e => e.kind === "transport" && e.fromCoords && e.toCoords);
  transports.forEach((t, i) => {
    const from = flip(t.fromCoords), to = flip(t.toCoords);
    bounds.extend(from);
    bounds.extend(to);
    const srcId = "day-route-" + i;
    if (!map.getSource(srcId)) {
      const isDashed = t.type === "flight";
      const pts = isDashed ? (() => {
        const r = [];
        for (let j = 0; j <= 20; j++) {
          const f = j / 20;
          r.push([from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f + Math.sin(f * Math.PI) * Math.abs(to[0] - from[0]) * 0.1]);
        }
        return r;
      })() : [from, to];
      map.addSource(srcId, { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: pts } } });
      const lineColor = t.transitColor || "#6C5CE7";
      const paint = { "line-color": lineColor, "line-opacity": 0.8, "line-width": 3 };
      if (isDashed) paint["line-dasharray"] = [4, 3];
      map.addLayer({ id: srcId + "-line", type: "line", source: srcId, paint });
    }
  });

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 60, duration: 600, maxZoom: 14 });
  }
}

function TripMapView({ trip, selectedDay, focusedEntry, lightMode, onPinClick }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const markersRef = React.useRef([]);
  const initDone = React.useRef(false);
  const prevDayRef = React.useRef(null);
  const prevFocusRef = React.useRef(null);

  const hasMapLibre = typeof maplibregl !== "undefined";
  const styleUrl = lightMode
    ? "https://tiles.openfreemap.org/styles/bright"
    : "https://tiles.openfreemap.org/styles/positron";

  // Init
  React.useEffect(() => {
    if (!hasMapLibre || !containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: containerRef.current, style: styleUrl, center: [135, 35], zoom: 3 });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    map.on("load", () => {
      initDone.current = true;
      addOverviewLayers(map, trip, markersRef);
      if (trip.route && trip.route.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        trip.route.forEach(r => bounds.extend(flip(r.coords)));
        map.fitBounds(bounds, { padding: 60, duration: 0 });
      }
    });
    return () => { map.remove(); mapRef.current = null; initDone.current = false; };
  }, []);

  // Style change
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !initDone.current) return;
    map.setStyle(styleUrl);
    map.once("style.load", () => {
      prevDayRef.current = null;
      if (selectedDay != null) {
        const day = trip.days.find(d => d.dayNum === selectedDay);
        if (day) addDayLayers(map, day, trip, markersRef, onPinClick, focusedEntry);
      } else {
        addOverviewLayers(map, trip, markersRef);
      }
    });
  }, [lightMode]);

  // Day / focus change
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !initDone.current) return;

    if (selectedDay != null) {
      const day = trip.days.find(d => d.dayNum === selectedDay);
      const focusChanged = focusedEntry !== prevFocusRef.current;
      const dayChanged = prevDayRef.current !== selectedDay;

      if (day && (dayChanged || focusChanged)) {
        if (dayChanged) {
          clearSources(map, "route");
          clearSources(map, "flight-");
        }
        clearSources(map, "day-route-");
        addDayLayers(map, day, trip, markersRef, onPinClick, focusedEntry);
        prevDayRef.current = selectedDay;
        prevFocusRef.current = focusedEntry;

        // Fly to focused entry
        if (focusedEntry && focusedEntry.coords) {
          map.flyTo({ center: flip(focusedEntry.coords), zoom: 15, duration: 600 });
        } else if (dayChanged) {
          // Day just changed, fitBounds handled by addDayLayers
        }
      }
    } else {
      if (prevDayRef.current !== null) {
        clearSources(map, "day-route-");
        addOverviewLayers(map, trip, markersRef);
        if (trip.route && trip.route.length > 0) {
          const bounds = new maplibregl.LngLatBounds();
          trip.route.forEach(r => bounds.extend(flip(r.coords)));
          map.fitBounds(bounds, { padding: 60, duration: 600 });
        }
        prevDayRef.current = null;
        prevFocusRef.current = null;
      }
    }
  }, [selectedDay, focusedEntry]);

  if (!hasMapLibre) {
    return (
      <div className="td-map-fallback">
        <div className="td-map-fallback__inner">
          <div className="td-map-fallback__icon">🗺️</div>
          <div className="td-map-fallback__title">Loading map...</div>
          <div className="td-map-fallback__hint">MapLibre GL JS required</div>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

window.TripMapView = TripMapView;
