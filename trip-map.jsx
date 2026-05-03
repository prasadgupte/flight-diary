// TripGoogleMap — terrain map with markers, falls back to placeholder

const GMAPS_LIGHT_STYLES = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#dce8f5" }] },
  { featureType: "landscape.natural", elementType: "geometry.fill", stylers: [{ color: "#f0eeef" }] },
];

function TripGoogleMap({ trip, selectedDay, selectedActivity, style }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const markersRef = React.useRef([]);
  const polylineRef = React.useRef(null);
  const highlightMarkerRef = React.useRef(null);

  const hasGoogle = typeof window !== "undefined" && window.google && window.google.maps;

  // Initialize map
  React.useEffect(() => {
    if (!hasGoogle || !containerRef.current || mapRef.current) return;

    mapRef.current = new google.maps.Map(containerRef.current, {
      mapTypeId: "terrain",
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
      styles: GMAPS_LIGHT_STYLES,
    });

    // Fit to route bounds
    if (trip && trip.route && trip.route.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      trip.route.forEach(r => bounds.extend({ lat: r.coords[0], lng: r.coords[1] }));
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [hasGoogle]);

  // Update markers when trip changes
  React.useEffect(() => {
    if (!mapRef.current || !trip) return;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) polylineRef.current.setMap(null);

    // Route polyline
    if (trip.route && trip.route.length > 1) {
      const path = trip.route.map(r => ({ lat: r.coords[0], lng: r.coords[1] }));
      polylineRef.current = new google.maps.Polyline({
        path,
        geodesic: false,
        strokeColor: "#6C5CE7",
        strokeOpacity: 0.4,
        strokeWeight: 2,
        map: mapRef.current,
      });
    }

    // City markers
    trip.route.forEach(r => {
      const phase = trip.phases.find(p => p.days.some(d => r.dayNums.includes(d)));
      const color = phase ? phase.color : "#9B97B0";
      const marker = new google.maps.Marker({
        position: { lat: r.coords[0], lng: r.coords[1] },
        map: mapRef.current,
        title: r.city,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: "#fff",
          strokeWeight: 2,
          scale: 6,
        },
      });
      markersRef.current.push(marker);
    });
  }, [trip]);

  // Handle day/activity selection → zoom
  React.useEffect(() => {
    if (!mapRef.current || !trip) return;

    // Clear highlight marker
    if (highlightMarkerRef.current) {
      highlightMarkerRef.current.setMap(null);
      highlightMarkerRef.current = null;
    }

    if (selectedActivity && selectedActivity.coords) {
      // Zoom to activity
      mapRef.current.panTo({ lat: selectedActivity.coords[0], lng: selectedActivity.coords[1] });
      mapRef.current.setZoom(15);

      highlightMarkerRef.current = new google.maps.Marker({
        position: { lat: selectedActivity.coords[0], lng: selectedActivity.coords[1] },
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: selectedActivity.color || "#FF6B6B",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 3,
          scale: 10,
        },
        zIndex: 100,
      });
    } else if (selectedDay != null) {
      // Zoom to day's city
      const day = trip.days.find(d => d.dayNum === selectedDay);
      if (day && day.coords) {
        mapRef.current.panTo({ lat: day.coords[0], lng: day.coords[1] });
        mapRef.current.setZoom(12);
      }
    } else {
      // Fit all route
      if (trip.route && trip.route.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        trip.route.forEach(r => bounds.extend({ lat: r.coords[0], lng: r.coords[1] }));
        mapRef.current.fitBounds(bounds, 60);
      }
    }
  }, [selectedDay, selectedActivity]);

  // Fallback: no Google Maps API
  if (!hasGoogle) {
    return (
      <div className="td-map-fallback" style={style}>
        <div className="td-map-fallback__inner">
          <div className="td-map-fallback__icon">🗺️</div>
          <div className="td-map-fallback__title">Map requires Google Maps API</div>
          <div className="td-map-fallback__hint">
            Add a Maps JavaScript API key to enable terrain view.
            <br />
            Set <code>window.GOOGLE_MAPS_KEY</code> in your config.
          </div>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="td-map" style={style} />;
}

window.TripGoogleMap = TripGoogleMap;
