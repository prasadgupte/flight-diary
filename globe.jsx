/* Globe.jsx — three-globe with country polygons + arcs + airport dots */
const { useRef, useEffect, useState, useMemo } = React;

const GLOBE_RADIUS = 100;

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
};

function hexToRGBA(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function Globe({ flights, airports, scheme, showLabels, focusedAirport, onAirportClick, countries, visitedCounts, onCountryClick, onCountryHover }) {
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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.cursor = "grab";

    // three-globe instance
    const Globe = window.ThreeGlobe || window.Globe || window.threeGlobe;
    const globe = new Globe()
      .globeImageUrl(null)
      .showAtmosphere(true)
      .atmosphereColor(sc.atmosphere)
      .atmosphereAltitude(0.18);

    // Set radius to match our scale
    globe.scale.setScalar(GLOBE_RADIUS / 100);

    // Solid color sphere material
    const globeMat = globe.globeMaterial();
    globeMat.color = new THREE.Color(sc.sphere);
    globeMat.transparent = false;

    scene.add(globe);

    // Lighting (three-globe uses MeshPhongMaterial which needs lights)
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
      // Hover: raycast for country polygons
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

      // Hits on polygons (countries) — they're inside globe.children
      const polys = [];
      const points = [];
      globe.traverse((obj) => {
        if (obj.userData && obj.userData.__threeObjType === "polygon") polys.push(obj);
        if (obj.userData && obj.userData.__threeObjType === "point") points.push(obj);
      });

      // For three-globe v2, polygon meshes have __data with the feature
      const objs = [...polys];
      const hits = raycaster.intersectObjects(objs, true);
      if (type === "hover") {
        if (hits.length) {
          const data = hits[0].object.__data || hits[0].object.userData?.__data;
          if (data && data.properties) {
            renderer.domElement.style.cursor = isDragging ? "grabbing" : "pointer";
            stateRef.current.onCountryHover && stateRef.current.onCountryHover({
              name: data.properties.NAME || data.properties.ADMIN || data.properties.name,
              iso: data.properties.ISO_A2 || data.properties.iso_a2,
              x: e.clientX,
              y: e.clientY,
            });
            return;
          }
        }
        renderer.domElement.style.cursor = isDragging ? "grabbing" : "grab";
        stateRef.current.onCountryHover && stateRef.current.onCountryHover(null);
      } else if (type === "click") {
        // First check airport dots
        const airportDots = stateRef.current.airportDots || [];
        const dotHits = raycaster.intersectObjects(airportDots, false);
        if (dotHits.length) {
          stateRef.current.onAirportClick && stateRef.current.onAirportClick(dotHits[0].object.userData.iata);
          return;
        }
        if (hits.length) {
          const data = hits[0].object.__data || hits[0].object.userData?.__data;
          if (data && data.properties) {
            const iso = data.properties.ISO_A2 || data.properties.iso_a2;
            stateRef.current.onCountryClick && stateRef.current.onCountryClick(iso);
            return;
          }
        }
        // Click empty → clear focus
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
      onAirportClick: null, onCountryClick: null, onCountryHover: null,
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

  // Set country polygons
  useEffect(() => {
    const s = stateRef.current;
    if (!s.globe || !countries || !countries.features) return;
    const sc = SCHEMES[scheme] || SCHEMES.ink;
    s.globe
      .polygonsData(countries.features)
      .polygonAltitude(0.006)
      .polygonCapColor((feat) => {
        const iso = feat.properties.ISO_A2 || feat.properties.iso_a2;
        const count = (visitedCounts || {})[iso] || 0;
        if (count === 0) return sc.landBase;
        // heatmap intensity
        const t = Math.min(1, Math.log(count + 1) / Math.log(maxVisitCount + 1));
        const alpha = 0.18 + t * 0.55;
        return hexToRGBA(sc.visitedFill, alpha);
      })
      .polygonSideColor(() => "rgba(0,0,0,0)")
      .polygonStrokeColor((feat) => {
        const iso = feat.properties.ISO_A2 || feat.properties.iso_a2;
        const visited = (visitedCounts || {})[iso] > 0;
        return visited ? sc.visitedStroke : sc.landStroke;
      })
      .polygonsTransitionDuration(400);
  }, [countries, visitedCounts, scheme, maxVisitCount]);

  // Set arcs
  useEffect(() => {
    const s = stateRef.current;
    if (!s.globe) return;
    const arcsData = flights.map((f) => {
      const A = airports[f.From], B = airports[f.To];
      if (!A || !B) return null;
      const isLeisure = f.Reason === "L";
      const dimmed = focusedAirport && f.From !== focusedAirport && f.To !== focusedAirport;
      return {
        startLat: A.lat, startLng: A.lon,
        endLat: B.lat, endLng: B.lon,
        color: dimmed
          ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.05)"]
          : ["#6C5CE7", isLeisure ? "#FF6B6B" : "#FDCB6E"],
      };
    }).filter(Boolean);

    s.globe
      .arcsData(arcsData)
      .arcColor("color")
      .arcStroke(0.4)
      .arcAltitudeAutoScale(0.4)
      .arcDashLength(1)
      .arcDashGap(0)
      .arcsTransitionDuration(400);
  }, [flights, airports, focusedAirport]);

  // Airport dots — use three-globe's pointsData (mint pulsing) + custom labels
  useEffect(() => {
    const s = stateRef.current;
    if (!s.globe) return;

    const counts = {};
    flights.forEach((f) => {
      counts[f.From] = (counts[f.From] || 0) + 1;
      counts[f.To] = (counts[f.To] || 0) + 1;
    });
    const pointsData = Object.entries(counts).map(([iata, count]) => {
      const A = airports[iata];
      if (!A) return null;
      return {
        iata, count,
        lat: A.lat, lng: A.lon,
        size: Math.max(0.18, Math.min(0.6, 0.2 + Math.log(count + 1) * 0.08)),
        color: focusedAirport && focusedAirport !== iata ? "rgba(0,210,160,0.35)" : "#00D2A0",
        label: showLabels ? iata : "",
      };
    }).filter(Boolean);

    s.globe
      .pointsData(pointsData)
      .pointAltitude(0.012)
      .pointRadius("size")
      .pointColor("color")
      .pointsMerge(false);

    // Labels
    if (showLabels) {
      s.globe
        .labelsData(pointsData)
        .labelLat("lat").labelLng("lng")
        .labelText("iata")
        .labelSize(0.5)
        .labelColor(() => "#FAFAFA")
        .labelDotRadius(0)
        .labelAltitude(0.025)
        .labelResolution(2);
    } else {
      s.globe.labelsData([]);
    }

    // Track airport point meshes for raycast
    setTimeout(() => {
      const dots = [];
      s.globe.traverse((obj) => {
        if (obj.userData && obj.userData.__threeObjType === "point") {
          dots.push(obj);
        }
      });
      s.airportDots = dots;
    }, 100);
  }, [flights, airports, focusedAirport, showLabels]);

  // Update callback refs
  useEffect(() => {
    stateRef.current.onAirportClick = onAirportClick;
    stateRef.current.onCountryClick = onCountryClick;
    stateRef.current.onCountryHover = onCountryHover;
  }, [onAirportClick, onCountryClick, onCountryHover]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />;
}

window.Globe = Globe;
window.GlobeSchemes = SCHEMES;
