// TripMapView — MapLibre GL JS + OpenFreeMap (bright/positron)
// Day view: shows only that day's activity pins + transport routes, clickable

const flip = (c) => [c[1], c[0]]; // trip [lat,lng] → MapLibre [lng,lat]

function addOverviewLayers(map, trip, markersRef) {
  (markersRef.current || []).forEach(m => m.remove());
  markersRef.current = [];
  if (!trip.route || trip.route.length === 0) return;

  // Route line
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

function addDayLayers(map, day, trip, markersRef, onPinClick) {
  (markersRef.current || []).forEach(m => m.remove());
  markersRef.current = [];

  const bounds = new maplibregl.LngLatBounds();
  const entries = window.buildTimelineEntries ? window.buildTimelineEntries(day, trip) : [];

  // Activity/accommodation pins
  entries.forEach((entry, idx) => {
    if (!entry.coords) return;
    const lngLat = flip(entry.coords);
    bounds.extend(lngLat);

    const el = document.createElement("div");
    el.style.cssText = `width:14px;height:14px;border-radius:50%;background:#6C5CE7;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.25);cursor:pointer;transition:transform 150ms;`;
    el.title = entry.title;
    el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.3)"; });
    el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
    el.addEventListener("click", (e) => { e.stopPropagation(); if (onPinClick) onPinClick(entry); });

    markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map));
  });

  // Transport routes for this day
  (day.transport || []).forEach((tId, i) => {
    const t = (trip.transport || []).find(x => x.id === tId);
    if (!t || !t.from || !t.to) return;
    const from = flip(t.from.coords), to = flip(t.to.coords);
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
      const paint = { "line-color": "#6C5CE7", "line-opacity": 0.6, "line-width": 2 };
      if (isDashed) paint["line-dasharray"] = [4, 3];
      map.addLayer({ id: srcId + "-line", type: "line", source: srcId, paint });
    }
  });

  // Fit bounds to all day pins + routes
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 60, duration: 600, maxZoom: 14 });
  }
}

function TripMapView({ trip, selectedDay, focusedEntry, lightMode, onPinClick }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const markersRef = React.useRef([]);
  const highlightRef = React.useRef(null);
  const initDone = React.useRef(false);
  const prevDayRef = React.useRef(null);

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
      prevDayRef.current = null; // force re-add
      if (selectedDay != null) {
        const day = trip.days.find(d => d.dayNum === selectedDay);
        if (day) addDayLayers(map, day, trip, markersRef, onPinClick);
      } else {
        addOverviewLayers(map, trip, markersRef);
      }
    });
  }, [lightMode]);

  // Day / focus change
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !initDone.current) return;

    if (highlightRef.current) { highlightRef.current.remove(); highlightRef.current = null; }

    if (selectedDay != null) {
      const day = trip.days.find(d => d.dayNum === selectedDay);
      if (day && prevDayRef.current !== selectedDay) {
        // Clear overview layers, add day-specific
        clearSources(map, "route");
        clearSources(map, "flight-");
        clearSources(map, "day-route-");
        addDayLayers(map, day, trip, markersRef, onPinClick);
        prevDayRef.current = selectedDay;
      }

      // Focused entry highlight
      if (focusedEntry && focusedEntry.coords) {
        map.flyTo({ center: flip(focusedEntry.coords), zoom: 15, duration: 600 });
        const el = document.createElement("div");
        el.className = "trip-map-pulse";
        el.style.cssText = `width:20px;height:20px;border-radius:50%;background:#6C5CE7;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);`;
        highlightRef.current = new maplibregl.Marker({ element: el }).setLngLat(flip(focusedEntry.coords)).addTo(map);
      }
    } else {
      // Overview mode
      if (prevDayRef.current !== null) {
        clearSources(map, "day-route-");
        addOverviewLayers(map, trip, markersRef);
        if (trip.route && trip.route.length > 0) {
          const bounds = new maplibregl.LngLatBounds();
          trip.route.forEach(r => bounds.extend(flip(r.coords)));
          map.fitBounds(bounds, { padding: 60, duration: 600 });
        }
        prevDayRef.current = null;
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
