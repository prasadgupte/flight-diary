// TripMapView — MapLibre GL JS + OpenFreeMap (bright/positron)

const flip = (c) => [c[1], c[0]]; // trip [lat,lng] → MapLibre [lng,lat]

function interpolateArc(from, to, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const lng = from[0] + (to[0] - from[0]) * t;
    const lat = from[1] + (to[1] - from[1]) * t;
    // Arc offset: parabolic curve peaking at midpoint
    const offset = Math.sin(t * Math.PI) * Math.abs(to[0] - from[0]) * 0.15;
    pts.push([lng, lat + offset]);
  }
  return pts;
}

function addRouteAndMarkers(map, trip, markersRef) {
  // Clear old markers
  (markersRef.current || []).forEach(m => m.remove());
  markersRef.current = [];

  if (!trip.route || trip.route.length === 0) return;

  // Route line
  const routeCoords = trip.route.map(r => flip(r.coords));
  if (!map.getSource("route")) {
    map.addSource("route", {
      type: "geojson",
      data: { type: "Feature", geometry: { type: "LineString", coordinates: routeCoords } },
    });
    map.addLayer({
      id: "route-line", type: "line", source: "route",
      paint: { "line-color": "#6C5CE7", "line-opacity": 0.5, "line-width": 2 },
    });
  }

  // Flight arcs
  (trip.transport || []).filter(t => t.type === "flight" && t.from && t.to).forEach((t, i) => {
    const srcId = "flight-" + i;
    const pts = interpolateArc(flip(t.from.coords), flip(t.to.coords), 20);
    if (!map.getSource(srcId)) {
      map.addSource(srcId, {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: pts } },
      });
      map.addLayer({
        id: srcId + "-line", type: "line", source: srcId,
        paint: { "line-color": "#9B97B0", "line-opacity": 0.5, "line-width": 1.5, "line-dasharray": [4, 3] },
      });
    }
  });

  // City markers
  trip.route.forEach(r => {
    const phase = trip.phases.find(p => p.days.some(d => r.dayNums.includes(d)));
    const color = phase ? phase.color : "#9B97B0";
    const el = document.createElement("div");
    el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);cursor:pointer;`;
    el.title = r.city;
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(flip(r.coords))
      .addTo(map);
    markersRef.current.push(marker);
  });
}

function TripMapView({ trip, selectedDay, focusedEntry, lightMode }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const markersRef = React.useRef([]);
  const highlightRef = React.useRef(null);
  const initDone = React.useRef(false);

  const hasMapLibre = typeof maplibregl !== "undefined";
  const styleUrl = lightMode
    ? "https://tiles.openfreemap.org/styles/bright"
    : "https://tiles.openfreemap.org/styles/positron";

  // Init map
  React.useEffect(() => {
    if (!hasMapLibre || !containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [135, 35],
      zoom: 3,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      initDone.current = true;
      addRouteAndMarkers(map, trip, markersRef);
      if (trip.route && trip.route.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        trip.route.forEach(r => bounds.extend(flip(r.coords)));
        map.fitBounds(bounds, { padding: 60, duration: 0 });
      }
    });

    return () => { map.remove(); mapRef.current = null; initDone.current = false; };
  }, []);

  // Style change on lightMode toggle
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !initDone.current) return;
    map.setStyle(styleUrl);
    map.once("style.load", () => {
      addRouteAndMarkers(map, trip, markersRef);
    });
  }, [lightMode]);

  // Zoom to selection
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !initDone.current) return;

    // Remove old highlight
    if (highlightRef.current) { highlightRef.current.remove(); highlightRef.current = null; }

    if (focusedEntry && focusedEntry.coords) {
      map.flyTo({ center: flip(focusedEntry.coords), zoom: 15, duration: 600 });
      // Pulsing highlight marker
      const el = document.createElement("div");
      el.className = "trip-map-pulse";
      el.style.cssText = `width:20px;height:20px;border-radius:50%;background:${focusedEntry.color || "#FF6B6B"};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);`;
      highlightRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(flip(focusedEntry.coords))
        .addTo(map);
    } else if (selectedDay != null) {
      const day = trip.days.find(d => d.dayNum === selectedDay);
      if (day && day.coords) {
        map.flyTo({ center: flip(day.coords), zoom: 12, duration: 600 });
      }
    } else if (trip.route && trip.route.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      trip.route.forEach(r => bounds.extend(flip(r.coords)));
      map.fitBounds(bounds, { padding: 60, duration: 600 });
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
