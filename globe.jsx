/* Globe.jsx — three-globe with country polygons + arcs + airport dots */
const { useRef, useEffect, useState, useMemo } = React;

const GLOBE_RADIUS = 100;

// Arc color helpers for new modes
function getAircraftMfr(plane) {
  if (!plane) return null;
  const p = plane.toUpperCase();
  if (/^B[0-9]/.test(p) || /^B7[0-9X]/.test(p)) return 'Boeing';
  if (/^A[0-9]/.test(p) || /^BCS/.test(p))       return 'Airbus';
  if (/^E[0-9]/.test(p) || /^ERJ/.test(p))        return 'Embraer';
  if (/^CRJ/.test(p) || /^DH8/.test(p))           return 'Bombardier';
  if (/^AT[0-9]/.test(p))                          return 'ATR';
  return null;
}
const ARC_CLASS_COLORS    = { Y:'#6C5CE7', Q:'#6C5CE7', C:'#FDCB6E', F:'#FF6B6B', P:'#00D2A0', W:'#00D2A0' };
const ARC_SEAT_COLORS     = { W:'#74B9FF', A:'#55EFC4', M:'#FDCB6E' };
const ARC_MFR_COLORS      = { Boeing:'#74B9FF', Airbus:'#FF6B6B', Embraer:'#00D2A0', Bombardier:'#FDCB6E', ATR:'#A29BFE' };
const ARC_ALLIANCE_COLORS = { Star:'#74B9FF', Oneworld:'#FF6B6B', SkyTeam:'#00D2A0', Others:'#95A5B3' };
const ARC_AIRLINE_ALLIANCES = {
  "Air Canada":"Star","Lufthansa":"Star","Singapore Airlines":"Star","United Airlines":"Star",
  "Air India":"Star","Air India Limited":"Star","Swiss International Air Lines":"Star",
  "Austrian Airlines":"Star","Brussels Airlines":"Star","TAP Portugal":"Star",
  "Scandinavian Airlines System":"Star","Turkish Airlines":"Star","Finnair":"Star",
  "LOT Polish Airlines":"Star","Egyptair":"Star","Ethiopian Airlines":"Star",
  "British Airways":"Oneworld","American Airlines":"Oneworld","Malaysia Airlines":"Oneworld",
  "Alaska Airlines":"Oneworld","Iberia":"Oneworld","Qatar Airways":"Oneworld",
  "Air France":"SkyTeam","Delta Air Lines":"SkyTeam","KLM Royal Dutch Airlines":"SkyTeam",
  "Korean Air":"SkyTeam","Air Serbia":"SkyTeam",
};

const ARC_REASON_COLORS = { L:"#FF6B6B", B:"#FDCB6E", O:"#A29BFE" };

function flightModeColor(f, mode, airlineColorMap, memberColorMap) {
  if (mode === "reason") return ARC_REASON_COLORS[f.Reason] || null;
  if (mode === "person" && memberColorMap) return memberColorMap[f._member] || null;
  if (mode === "airline" && airlineColorMap) return airlineColorMap[f.Airline] || null;
  if (mode === "class") return ARC_CLASS_COLORS[f.Class] || null;
  if (mode === "seat_type") return ARC_SEAT_COLORS[f.Seat_Type] || null;
  if (mode === "aircraft_mfr") { const m = getAircraftMfr(f.Plane); return m ? ARC_MFR_COLORS[m] : null; }
  if (mode === "alliance") { const al = ARC_AIRLINE_ALLIANCES[f.Airline]; return ARC_ALLIANCE_COLORS[al || 'Others']; }
  return null;
}
// null return = no data for this mode → arc gets dimmed treatment

// ── Country semantic color themes ───────────────────────────────────────────
// Single theme: Pulse.
// Flights mode uses 3 static frequency tiers (all violet):
//   tier1 (1–4 flights): light fill + border
//   tier2 (5–29 flights): medium fill + border
//   tier3 (30+ flights): solid fill, NO border ("worn-in home base")
// Countries mode uses a continuous log scale.
const MAP_COUNTRY_THEMES = {
  pulse: {
    name: "Pulse",
    lived:    { stroke: '#FF6EC7', strokeA: 1.0 },
    visited:  { fill: '#B06EFF', stroke: '#D4A0FF', passiveA: 0.06, activeMin: 0.35, activeMax: 0.82 },
    focus:    { fill: '#FFD700', stroke: '#FFE566', fillA: 0.88, strokeA: 1.0 },
  },
};
window.MAP_COUNTRY_THEMES = MAP_COUNTRY_THEMES;

// Returns { fill: rgba-string, stroke: hex, strokeA: float } for a country ISO code.
//
// FLIGHTS MODE — 3 static frequency tiers, all using pulse violet:
//   lived:          hot-pink border, max fill
//   tier3 (30+):    solid fill, no border ("worn-in")
//   tier2 (5–29):   medium fill + border
//   tier1 (1–4):    light fill + border
//   CSV-only visit: same as tier1 (at least 1 trip)
//
// COUNTRIES MODE — continuous log scale from CSV visit count
function getCountryColors(iso, { livedSet, visitedCounts, flownCounts, appMode, focusedCountry, mapColorTheme, scheme, maxVisitCount, highlightedCountries }) {
  const th = MAP_COUNTRY_THEMES.pulse; // single theme
  const sc = SCHEMES[scheme] || SCHEMES.ink;
  const dimByFocused = focusedCountry && focusedCountry !== iso;
  const dimByHighlight = highlightedCountries && !highlightedCountries.has(iso);
  const dimFactor = (dimByFocused || dimByHighlight) ? 0.35 : 1.0;

  if (focusedCountry === iso) {
    return { fill: hexToRGBA(th.focus.fill, th.focus.fillA), stroke: th.focus.stroke, strokeA: th.focus.strokeA };
  }

  // Endpoint country from route/flight selection — boost to clearly "active"
  if (highlightedCountries?.has(iso)) {
    return { fill: hexToRGBA(th.visited.fill, 0.70), stroke: th.visited.stroke, strokeA: 1.0 };
  }

  const isLived = livedSet?.has(iso);
  const visitCount = (visitedCounts || {})[iso] || 0;
  const flownCount = (flownCounts || {})[iso] || 0;

  // Lived — max fill + hot-pink border regardless of mode
  if (isLived) {
    return {
      fill: hexToRGBA(th.visited.fill, 0.85 * dimFactor),
      stroke: th.lived.stroke,
      strokeA: th.lived.strokeA * dimFactor,
    };
  }

  if (appMode === 'flights') {
    // Use flight count; fall back to 1 if only in countries CSV
    const count = flownCount > 0 ? flownCount : (visitCount > 0 ? 1 : 0);
    if (count >= 30) {
      // Tier 3: worn-in — solid fill, no border
      return {
        fill: hexToRGBA(th.visited.fill, 0.80 * dimFactor),
        stroke: th.visited.fill,
        strokeA: 0,
      };
    }
    if (count >= 5) {
      // Tier 2: mid-frequency
      return {
        fill: hexToRGBA(th.visited.fill, 0.45 * dimFactor),
        stroke: th.visited.stroke,
        strokeA: 0.70 * dimFactor,
      };
    }
    if (count >= 1) {
      // Tier 1: single / transit / CSV-only
      return {
        fill: hexToRGBA(th.visited.fill, 0.18 * dimFactor),
        stroke: th.visited.stroke,
        strokeA: 0.50 * dimFactor,
      };
    }
  } else {
    // Countries mode — continuous log scale from CSV
    if (visitCount > 0) {
      const t = maxVisitCount > 0 ? Math.min(1, Math.log(visitCount + 1) / Math.log(maxVisitCount + 1)) : 0;
      const alpha = th.visited.activeMin + t * (th.visited.activeMax - th.visited.activeMin);
      return {
        fill: hexToRGBA(th.visited.fill, alpha * dimFactor),
        stroke: th.visited.stroke,
        strokeA: 0.60 * dimFactor,
      };
    }
    if (flownCount > 0) {
      // Touched by flights but not in CSV — faint hint
      return {
        fill: hexToRGBA(th.visited.fill, 0.08 * dimFactor),
        stroke: th.visited.stroke,
        strokeA: 0.25 * dimFactor,
      };
    }
  }

  // Unvisited land — apply dimFactor so non-endpoint countries recede
  return {
    fill: dimFactor < 1 ? hexToRGBA(sc.landBase, 0.45) : (focusedCountry ? hexToRGBA(sc.landBase, 0.5) : sc.landBase),
    stroke: sc.landStroke,
    strokeA: 0.6 * dimFactor,
  };
}
window.getCountryColors = getCountryColors;

const SCHEMES = {
  ink: {
    bg: "#1E1B2E",
    sphere: "#1E1B2E",
    landBase: "#2D2A3E",
    landStroke: "#3D3A4E",
    visitedStroke: "#00D2A0",
    visitedFill: "#6C5CE7",
    atmosphere: "#6C5CE7",
  },
  aurora: {
    bg: "#0D2440",
    sphere: "#16203A",
    landBase: "#1F3050",
    landStroke: "#2D4870",
    visitedStroke: "#00D2A0",
    visitedFill: "#74B9FF",
    atmosphere: "#74B9FF",
  },
  mesh: {
    bg: "#1A0F2E",
    sphere: "#241F3C",
    landBase: "#3A2E55",
    landStroke: "#4D3D70",
    visitedStroke: "#00D2A0",
    visitedFill: "#FD79A8",
    atmosphere: "#FD79A8",
  },
  day: {
    bg: "#E8E4F0",
    sphere: "#D8D4EE",
    landBase: "#C6C0E0",
    landStroke: "#A89FCC",
    visitedStroke: "#00A882",
    visitedFill: "#6C5CE7",
    atmosphere: "#8577CC",
  },
};

function hexToRGBA(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function Globe({ flights, airports, scheme, showLabels, lightMode, focusedAirport, onAirportClick, onAirportHover, countries, visitedCounts, flownCounts, livedSet, mapColorTheme, appMode, focusedCountry, onCountryClick, onCountryHover, arcColorMode, airlineColorMap, memberColorMap, highlightedFlight, focusedRoute, onRouteClick, onArcHover, firstVisitAirports }) {
  const containerRef = useRef(null);
  const stateRef = useRef({});

  const sc = SCHEMES[scheme] || SCHEMES.ink;
  const maxVisitCount = useMemo(() => {
    let m = 0;
    Object.values(visitedCounts || {}).forEach((v) => { if (v > m) m = v; });
    return m;
  }, [visitedCounts]);

  // Init scene + three-globe instance
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    camera.position.set(0, 0, 340);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.cursor = "grab";

    // three-globe instance
    const GlobeCtor = window.ThreeGlobe || window.Globe || window.threeGlobe;
    const globe = new GlobeCtor()
      .globeImageUrl(null)
      .showAtmosphere(true)
      .atmosphereColor(sc.atmosphere)
      .atmosphereAltitude(0.18);

    globe.scale.setScalar(GLOBE_RADIUS / 100);

    const globeMat = globe.globeMaterial();
    globeMat.color = new THREE.Color(sc.sphere);
    globeMat.transparent = false;

    scene.add(globe);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 0.4);
    dir.position.set(1, 1, 1);
    scene.add(dir);

    // Manual rotation controls
    const targetLat = 30, targetLon = 20;
    const phi = (90 - targetLat) * Math.PI / 180;
    const theta = (targetLon + 180) * Math.PI / 180;
    const px = -Math.sin(phi) * Math.cos(theta);
    const pz = Math.sin(phi) * Math.sin(theta);
    const rotYInit = Math.atan2(-px, pz);
    const target = { rotX: -0.25, rotY: rotYInit };
    globe.rotation.x = target.rotX;
    globe.rotation.y = target.rotY;

    let isDragging = false;
    let lastX = 0, lastY = 0, lastInteract = performance.now();
    let dragMoved = false;

    const onPointerDown = (e) => {
      isDragging = true;
      dragMoved = false;
      lastX = e.clientX; lastY = e.clientY;
      lastInteract = performance.now();
      renderer.domElement.style.cursor = "grabbing";
    };
    const onPointerUp = () => {
      isDragging = false;
      lastInteract = performance.now();
      renderer.domElement.style.cursor = "grab";
    };
    const onPointerMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
        lastX = e.clientX; lastY = e.clientY;
        target.rotY += dx * 0.005;
        target.rotX += dy * 0.005;
        target.rotX = THREE.MathUtils.clamp(target.rotX, -Math.PI / 2.2, Math.PI / 2.2);
        lastInteract = performance.now();
      }
      raycast(e, "hover");
    };
    const onWheel = (e) => {
      e.preventDefault();
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + e.deltaY * 0.2, 200, 540);
      lastInteract = performance.now();
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 3 };
    const mouse = new THREE.Vector2();

    function raycast(e, type) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // Traverse scene to gather interactable objects
      const polys = [];
      const points = [];
      globe.traverse((obj) => {
        if (obj.userData && obj.userData.__threeObjType === "polygon") polys.push(obj);
        if (obj.userData && obj.userData.__threeObjType === "point") points.push(obj);
      });

      const polyHits = raycaster.intersectObjects(polys, true);
      if (type === "hover") {
        // Priority: airport > arc > country
        // 1. Airport points
        if (points.length) {
          const dotHits = raycaster.intersectObjects(points, true);
          if (dotHits.length) {
            const obj = dotHits[0].object;
            const data = obj.__data || obj.userData?.__data || obj.parent?.__data;
            if (data && data.iata) {
              renderer.domElement.style.cursor = isDragging ? "grabbing" : "pointer";
              stateRef.current.onAirportHover && stateRef.current.onAirportHover({ iata: data.iata, x: e.clientX, y: e.clientY });
              stateRef.current.onCountryHover && stateRef.current.onCountryHover(null);
              stateRef.current.onArcHover && stateRef.current.onArcHover(null);
              return;
            }
          }
        }
        // 2. Arcs
        const arcObjs2 = [];
        globe.traverse((obj) => {
          if (obj.userData && obj.userData.__threeObjType === "arc") arcObjs2.push(obj);
        });
        if (arcObjs2.length) {
          const arcHits = raycaster.intersectObjects(arcObjs2, true);
          if (arcHits.length) {
            const obj = arcHits[0].object;
            const data = obj.__data || obj.userData?.__data || obj.parent?.__data;
            if (data && data.__flight) {
              renderer.domElement.style.cursor = isDragging ? "grabbing" : "pointer";
              stateRef.current.onArcHover && stateRef.current.onArcHover({ flight: data.__flight, x: e.clientX, y: e.clientY });
              stateRef.current.onCountryHover && stateRef.current.onCountryHover(null);
              stateRef.current.onAirportHover && stateRef.current.onAirportHover(null);
              return;
            }
          }
        }
        // 3. Country polygons
        if (polyHits.length) {
          const data = polyHits[0].object.__data || polyHits[0].object.userData?.__data;
          if (data && data.properties) {
            renderer.domElement.style.cursor = isDragging ? "grabbing" : "pointer";
            stateRef.current.onCountryHover && stateRef.current.onCountryHover({
              name: data.properties.NAME || data.properties.ADMIN || data.properties.name,
              iso: data.properties.ISO_A2 || data.properties.iso_a2,
              x: e.clientX,
              y: e.clientY,
            });
            stateRef.current.onAirportHover && stateRef.current.onAirportHover(null);
            stateRef.current.onArcHover && stateRef.current.onArcHover(null);
            return;
          }
        }
        renderer.domElement.style.cursor = isDragging ? "grabbing" : "grab";
        stateRef.current.onCountryHover && stateRef.current.onCountryHover(null);
        stateRef.current.onAirportHover && stateRef.current.onAirportHover(null);
        stateRef.current.onArcHover && stateRef.current.onArcHover(null);
      } else if (type === "click") {
        // Check airport points first (use fresh traversal, read __data)
        if (points.length) {
          const dotHits = raycaster.intersectObjects(points, true);
          if (dotHits.length) {
            const obj = dotHits[0].object;
            const data = obj.__data || obj.userData?.__data || obj.parent?.__data;
            if (data && data.iata) {
              stateRef.current.onAirportClick && stateRef.current.onAirportClick(data.iata);
              return;
            }
          }
        }
        // Check arcs
        const arcObjs = [];
        globe.traverse((obj) => {
          if (obj.userData && obj.userData.__threeObjType === "arc") arcObjs.push(obj);
        });
        if (arcObjs.length) {
          const arcHits = raycaster.intersectObjects(arcObjs, true);
          if (arcHits.length) {
            const obj = arcHits[0].object;
            const data = obj.__data || obj.userData?.__data || obj.parent?.__data;
            if (data && data.__flight) {
              const f = data.__flight;
              stateRef.current.onRouteClick && stateRef.current.onRouteClick({ from: f.From, to: f.To });
              return;
            }
          }
        }
        // Check country polygons
        if (polyHits.length) {
          const data = polyHits[0].object.__data || polyHits[0].object.userData?.__data;
          if (data && data.properties) {
            const iso = data.properties.ISO_A2 || data.properties.iso_a2;
            stateRef.current.onCountryClick && stateRef.current.onCountryClick(iso);
            return;
          }
        }
        // Click empty → clear
        stateRef.current.onAirportClick && stateRef.current.onAirportClick(null);
        stateRef.current.onCountryClick && stateRef.current.onCountryClick(null);
      }
    }

    const onClick = (e) => {
      if (dragMoved) return;
      raycast(e, "click");
    };
    renderer.domElement.addEventListener("click", onClick);

    const resize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h, true);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf;
    const tick = () => {
      const idle = performance.now() - lastInteract > 2500;
      if (idle && !isDragging) {
        target.rotY += 0.0012;
      }
      globe.rotation.x += (target.rotX - globe.rotation.x) * 0.18;
      globe.rotation.y += (target.rotY - globe.rotation.y) * 0.18;

      // Pulse airport dots
      const t = performance.now() * 0.001;
      (stateRef.current.airportDots || []).forEach((m) => {
        const baseScale = m.userData.baseScale || 1;
        const pulse = 1 + Math.sin(t * 2 + (m.userData.phase || 0)) * 0.12;
        m.scale.setScalar(baseScale * pulse);
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    stateRef.current = {
      scene, camera, renderer, globe, target,
      airportDots: [],
      onAirportClick: null, onCountryClick: null, onCountryHover: null, onRouteClick: null,
      zoomIn: () => {
        camera.position.z = THREE.MathUtils.clamp(camera.position.z - 40, 200, 540);
        lastInteract = performance.now();
      },
      zoomOut: () => {
        camera.position.z = THREE.MathUtils.clamp(camera.position.z + 40, 200, 540);
        lastInteract = performance.now();
      },
      panTo: (avgLat, avgLon, targetZ) => {
        const phi = (90 - avgLat) * Math.PI / 180;
        const theta = (avgLon + 180) * Math.PI / 180;
        const px = -Math.sin(phi) * Math.cos(theta);
        const pz = Math.sin(phi) * Math.sin(theta);
        target.rotY = Math.atan2(-px, pz);
        target.rotX = THREE.MathUtils.clamp(-avgLat * Math.PI / 180 * 0.5, -Math.PI / 2.2, Math.PI / 2.2);
        camera.position.z = THREE.MathUtils.clamp(targetZ, 200, 520);
        lastInteract = performance.now();
      },
      dispose: () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("wheel", onWheel);
        renderer.domElement.removeEventListener("click", onClick);
        try { renderer.dispose(); } catch (e) {}
        try { container.removeChild(renderer.domElement); } catch (e) {}
      },
    };
    window.__globe = stateRef.current;

    return () => stateRef.current.dispose && stateRef.current.dispose();
  }, []);

  // Update scheme (sphere color, atmosphere)
  useEffect(() => {
    const s = stateRef.current;
    if (!s.globe) return;
    const sc = SCHEMES[scheme] || SCHEMES.ink;
    s.globe.atmosphereColor(sc.atmosphere);
    const mat = s.globe.globeMaterial();
    if (mat && mat.color) mat.color.set(sc.sphere);
  }, [scheme]);

  // Set country polygon geometry — only rebuilds when country data changes
  useEffect(() => {
    const s = stateRef.current;
    if (!s.globe || !countries || !countries.features) return;
    s.globe
      .polygonsData(countries.features)
      .polygonsTransitionDuration(400);
    // polygonAltitude and polygonSideColor are set as data-driven callbacks in the color effect
  }, [countries]);

  // Update polygon colors + altitude — semantic: lived / visited / flown / focus
  // Lived countries get altitude lift + side glow; altitude is data-driven so it reacts to livedSet changes
  useEffect(() => {
    const s = stateRef.current;
    if (!s.globe || !countries || !countries.features) return;
    const th = MAP_COUNTRY_THEMES.pulse;

    // Derive endpoint countries from highlighted flight or focused route for dimming
    let highlightedCountries = null;
    const hlFrom = highlightedFlight?.From || focusedRoute?.from;
    const hlTo   = highlightedFlight?.To   || focusedRoute?.to;
    if (hlFrom || hlTo) {
      highlightedCountries = new Set();
      const cmap = window.COUNTRY_NAME_TO_ISO_CHART || {};
      [hlFrom, hlTo].forEach(iata => {
        if (!iata) return;
        const ap = airports[iata];
        if (ap?.country) { const iso = cmap[ap.country]; if (iso) highlightedCountries.add(iso); }
      });
    }

    s.globe
      .polygonAltitude((feat) => {
        const iso = feat.properties.ISO_A2 || feat.properties.iso_a2;
        return livedSet?.has(iso) ? 0.015 : 0.006;
      })
      .polygonSideColor((feat) => {
        const iso = feat.properties.ISO_A2 || feat.properties.iso_a2;
        return livedSet?.has(iso) ? hexToRGBA(th.lived.stroke, 0.30) : "rgba(0,0,0,0)";
      })
      .polygonCapColor((feat) => {
        const iso = feat.properties.ISO_A2 || feat.properties.iso_a2;
        return getCountryColors(iso, { livedSet, visitedCounts, flownCounts, appMode, focusedCountry, mapColorTheme, scheme, maxVisitCount, highlightedCountries }).fill;
      })
      .polygonStrokeColor((feat) => {
        const iso = feat.properties.ISO_A2 || feat.properties.iso_a2;
        const c = getCountryColors(iso, { livedSet, visitedCounts, flownCounts, appMode, focusedCountry, mapColorTheme, scheme, maxVisitCount, highlightedCountries });
        return hexToRGBA(c.stroke, c.strokeA);
      });
  }, [countries, visitedCounts, flownCounts, livedSet, scheme, mapColorTheme, appMode, maxVisitCount, focusedCountry, highlightedFlight, focusedRoute, airports]);

  // Set arcs
  useEffect(() => {
    const s = stateRef.current;
    if (!s.globe) return;

    // Precompute per-route distinct colors so mixed-value routes get a gradient
    const routeColorSets = {};
    flights.forEach(f => {
      const key = [f.From, f.To].sort().join("↔");
      if (!routeColorSets[key]) routeColorSets[key] = [];
      const c = flightModeColor(f, arcColorMode, airlineColorMap, memberColorMap);
      if (c && !routeColorSets[key].includes(c)) routeColorSets[key].push(c);
    });

    const arcsData = flights.map((f) => {
      const A = airports[f.From], B = airports[f.To];
      if (!A || !B) return null;
      const isLeisure = f.Reason === "L";

      // Determine if this arc should be dimmed
      const dimmedByAirport = focusedAirport && f.From !== focusedAirport && f.To !== focusedAirport;
      const dimmedByRoute = focusedRoute && !(
        (f.From === focusedRoute.from && f.To === focusedRoute.to) ||
        (f.From === focusedRoute.to && f.To === focusedRoute.from)
      );
      const dimmedByHighlight = highlightedFlight && f.id !== highlightedFlight.id;
      const dimmed = dimmedByAirport || dimmedByRoute || dimmedByHighlight;

      const resolvedColor = flightModeColor(f, arcColorMode, airlineColorMap, memberColorMap);
      const noData = !resolvedColor; // flight missing data for this color mode

      let color;
      if (dimmed) {
        color = ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.05)"];
      } else if (noData) {
        color = ["rgba(255,255,255,0.09)", "rgba(255,255,255,0.09)"];
      } else {
        const routeKey = [f.From, f.To].sort().join("↔");
        const routeColors = routeColorSets[routeKey] || [];
        // Gradient only when the same route has been flown with different attribute values
        color = routeColors.length > 1 ? [routeColors[0], routeColors[1]] : [resolvedColor, resolvedColor];
      }

      return {
        startLat: A.lat, startLng: A.lon,
        endLat: B.lat, endLng: B.lon,
        color,
        noData,
        __flight: f,
      };
    }).filter(Boolean);

    s.globe
      .arcsData(arcsData)
      .arcColor("color")
      .arcStroke((d) => {
        if (highlightedFlight && d.__flight && d.__flight.id === highlightedFlight.id) return 1.2;
        if (d.noData) return 0.18; // thin for no-data arcs
        return 0.4;
      })
      .arcAltitudeAutoScale(0.4)
      .arcDashLength(1)
      .arcDashGap(0)
      .arcsTransitionDuration(400);
  }, [flights, airports, focusedAirport, arcColorMode, airlineColorMap, memberColorMap, highlightedFlight, focusedRoute]);

  // Airport dots
  useEffect(() => {
    const s = stateRef.current;
    if (!s.globe) return;

    const counts = {};
    flights.forEach((f) => {
      counts[f.From] = (counts[f.From] || 0) + 1;
      counts[f.To] = (counts[f.To] || 0) + 1;
    });

    // Determine which airports to force-highlight
    const hlAirports = new Set();
    if (highlightedFlight) {
      hlAirports.add(highlightedFlight.From);
      hlAirports.add(highlightedFlight.To);
    }
    if (focusedRoute) {
      hlAirports.add(focusedRoute.from);
      hlAirports.add(focusedRoute.to);
    }

    const pointsData = Object.entries(counts).map(([iata, count]) => {
      const A = airports[iata];
      if (!A) return null;
      const highlighted = hlAirports.has(iata);
      const dimmed = highlighted ? false
        : focusedAirport ? focusedAirport !== iata
        : !!(highlightedFlight || focusedRoute);
      const isFirstVisit = firstVisitAirports?.has(iata);
      return {
        iata, count,
        lat: A.lat, lng: A.lon,
        size: isFirstVisit
          ? Math.max(0.6, Math.min(1.1, 0.5 + Math.log(count + 1) * 0.1))
          : highlighted
            ? Math.max(0.4, Math.min(0.8, 0.3 + Math.log(count + 1) * 0.1))
            : Math.max(0.18, Math.min(0.6, 0.2 + Math.log(count + 1) * 0.08)),
        color: dimmed ? "rgba(0,210,160,0.35)"
          : isFirstVisit ? "#4DFFD2"
          : "#00D2A0",
        label: (showLabels || highlighted || isFirstVisit || focusedAirport === iata) ? iata : "",
      };
    }).filter(Boolean);

    s.globe
      .pointsData(pointsData)
      .pointAltitude(0.012)
      .pointRadius("size")
      .pointColor("color")
      .pointsMerge(false);

    // Labels
    const labelData = pointsData.filter(p => p.label);
    if (labelData.length) {
      s.globe
        .labelsData(labelData)
        .labelLat("lat").labelLng("lng")
        .labelText("iata")
        .labelSize(0.5)
        .labelColor(() => lightMode ? "#1E1B2E" : "#FAFAFA")
        .labelDotRadius(0)
        .labelAltitude(0.025)
        .labelResolution(2);
    } else {
      s.globe.labelsData([]);
    }

    // Collect airport dot meshes for pulse animation
    setTimeout(() => {
      const dots = [];
      s.globe.traverse((obj) => {
        if (obj.userData && obj.userData.__threeObjType === "point") {
          dots.push(obj);
        }
      });
      s.airportDots = dots;
    }, 200);
  }, [flights, airports, focusedAirport, showLabels, highlightedFlight, focusedRoute, firstVisitAirports, lightMode]);

  // Update callback refs
  useEffect(() => {
    stateRef.current.onAirportClick = onAirportClick;
    stateRef.current.onAirportHover = onAirportHover;
    stateRef.current.onCountryClick = onCountryClick;
    stateRef.current.onCountryHover = onCountryHover;
    stateRef.current.onRouteClick = onRouteClick;
    stateRef.current.onArcHover = onArcHover;
  }, [onAirportClick, onAirportHover, onCountryClick, onCountryHover, onRouteClick, onArcHover]);

  // Pan globe to highlighted flight midpoint (F2)
  useEffect(() => {
    if (!highlightedFlight) return;
    const s = stateRef.current;
    if (!s.target) return;
    const A = airports[highlightedFlight.From], B = airports[highlightedFlight.To];
    if (!A || !B) return;
    const midLat = (A.lat + B.lat) / 2;
    const midLon = (A.lon + B.lon) / 2;
    const phi = (90 - midLat) * Math.PI / 180;
    const theta = (midLon + 180) * Math.PI / 180;
    const px = -Math.sin(phi) * Math.cos(theta);
    const pz = Math.sin(phi) * Math.sin(theta);
    s.target.rotY = Math.atan2(-px, pz);
    s.target.rotX = THREE.MathUtils.clamp(-midLat * Math.PI / 180 * 0.5, -Math.PI / 2.2, Math.PI / 2.2);
  }, [highlightedFlight, airports]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />;
}

window.Globe = Globe;
window.GlobeSchemes = SCHEMES;
