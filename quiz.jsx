// quiz.jsx — Interactive flight quiz
const { useState, useEffect } = React;

/* ── Utilities ─────────────────────────────────────────────────────────────── */
function flagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return "🌍";
  return String.fromCodePoint(
    ...iso2.toUpperCase().split("").map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN(arr, n) {
  return shuffle(arr).slice(0, n);
}

function getContinent(iso2) {
  const eu = ["DE","FR","GB","IT","ES","NL","BE","AT","CH","PT","SE","NO","DK","FI","PL","CZ","HU","RO","GR","IE","HR","RS","BG","SI","EE","LV","LT","SK","MK","AL","ME","BA","LU","MT","IS","MC","LI","SM","VA"];
  const as = ["IN","CN","JP","KR","SG","TH","MY","ID","PH","VN","PK","BD","LK","NP","BT","MM","KH","LA","MN","KZ","UZ","TM","TJ","KG","AZ","GE","AM","TR","IL","SA","AE","QA","KW","BH","OM","JO","LB","IQ","IR","AF","YE","SY","CY","HK","TW"];
  const am = ["US","CA","MX","BR","AR","CO","CL","PE","VE","EC","BO","PY","UY","GY","SR","PA","CR","GT","HN","SV","NI","DO","CU","JM","TT","BB","HT","BZ"];
  const af = ["ZA","EG","NG","KE","ET","GH","TZ","MA","DZ","TN","UG","MZ","AO","MG","CM","CI","ZM","ZW","SD","SN","ML","BF","NE","MW","MU","NA","BW","GA","GN","RW","BI","BJ","TG","SL","LR","GQ","ER","SS","DJ","SO","KM","ST","CV","GM","GW","MR","SC","CG","CD","CF","TD","LY","LS","SZ"];
  const oc = ["AU","NZ","PG","FJ","SB","VU","WS","TO","KI","FM","PW","MH","NR","TV"];
  if (eu.includes(iso2)) return "Europe";
  if (as.includes(iso2)) return "Asia";
  if (am.includes(iso2)) return "Americas";
  if (af.includes(iso2)) return "Africa";
  if (oc.includes(iso2)) return "Oceania";
  return "the world";
}

/* ── Question generators ───────────────────────────────────────────────────── */
function generateQuestions(flights, airports) {
  // Collect visited IATAs
  const visitedIatas = new Set();
  flights.forEach(f => { visitedIatas.add(f.From); visitedIatas.add(f.To); });
  const iataList = [...visitedIatas].filter(i => airports[i]);

  // Route map with distances
  const routeMap = {};
  flights.forEach(f => {
    if (!f.distanceKm || !airports[f.From] || !airports[f.To]) return;
    const key = [f.From, f.To].sort().join("→");
    if (!routeMap[key]) routeMap[key] = { from: f.From, to: f.To, dist: f.distanceKm, count: 0 };
    routeMap[key].count++;
  });
  const routes = Object.values(routeMap).filter(r => r.dist > 100);

  // Airline first year
  const airlineFirstYear = {};
  flights.forEach(f => {
    if (!f.Airline) return;
    if (!airlineFirstYear[f.Airline] || f.year < airlineFirstYear[f.Airline])
      airlineFirstYear[f.Airline] = f.year;
  });
  const airlines = Object.keys(airlineFirstYear);

  // Country → iata mapping from airports
  const visitedCountries = {};
  iataList.forEach(iata => {
    const ap = airports[iata];
    if (ap?.country) visitedCountries[ap.country] = iata;
  });

  // ISO-2 lookup from COUNTRIES_DATA
  const isoMap = {};
  ((window.COUNTRIES_DATA && window.COUNTRIES_DATA.countries) || []).forEach(c => {
    if (c.country && c.iso) isoMap[c.country] = c.iso;
  });

  function wrongIatas(correct) {
    return shuffle(iataList.filter(i => i !== correct)).slice(0, 3);
  }

  // ── Q type 1: City guess ──────────────────────────────────────
  function makeCityQuestion() {
    if (iataList.length < 4) return null;
    const iata = pickN(iataList, 1)[0];
    const correctCity = airports[iata].city;
    const wrongCities = wrongIatas(iata)
      .map(i => airports[i].city)
      .filter(c => c !== correctCity);
    if (wrongCities.length < 3) return null;
    const options = shuffle([correctCity, ...wrongCities.slice(0, 3)]);
    return {
      type: "city",
      prompt: `You've flown through ${iata}. What city is that?`,
      hint: `Country: ${airports[iata].country}`,
      options: options.map(o => ({ label: o, correct: o === correctCity })),
    };
  }

  // ── Q type 2: IATA guess ──────────────────────────────────────
  function makeIataQuestion() {
    if (iataList.length < 4) return null;
    const iata = pickN(iataList, 1)[0];
    const city = airports[iata].city;
    const wrongOpts = wrongIatas(iata);
    if (wrongOpts.length < 3) return null;
    const options = shuffle([iata, ...wrongOpts]);
    return {
      type: "iata",
      prompt: `What's the IATA code for ${city}?`,
      hint: `Starts with: ${iata[0]}`,
      options: options.map(o => ({ label: o, correct: o === iata })),
    };
  }

  // ── Q type 3: Longest route ───────────────────────────────────
  function makeLongestRouteQuestion() {
    if (routes.length < 4) return null;
    const sample = pickN(routes, 4);
    const longest = [...sample].sort((a, b) => b.dist - a.dist)[0];
    const options = shuffle(sample.map(r => ({
      label: `${r.from} → ${r.to}`,
      correct: r === longest,
    })));
    return {
      type: "route",
      prompt: "Which of these routes is the longest?",
      hint: `The longest is over ${Math.floor(longest.dist / 500) * 500} km`,
      options,
    };
  }

  // ── Q type 4: Airline first year ──────────────────────────────
  function makeAirlineYearQuestion() {
    if (airlines.length < 2) return null;
    const airline = pickN(airlines, 1)[0];
    const correctYear = airlineFirstYear[airline];
    const allYears = [...new Set(Object.values(airlineFirstYear))].sort();
    let wrongYears = allYears.filter(y => y !== correctYear);
    if (wrongYears.length < 3) {
      const extras = [-3,-2,-1,1,2,3].map(d => correctYear + d).filter(y => y !== correctYear && !allYears.includes(y));
      wrongYears = [...wrongYears, ...extras];
    }
    const mid = allYears[Math.floor(allYears.length / 2)];
    const opts = shuffle([correctYear, ...pickN(wrongYears, 3)]);
    return {
      type: "year",
      prompt: `When did you first fly with ${airline}?`,
      hint: `It was ${correctYear <= mid ? "on or before" : "after"} ${mid}`,
      options: opts.map(o => ({ label: String(o), correct: o === correctYear })),
    };
  }

  // ── Q type 5: Country flag ────────────────────────────────────
  function makeFlagQuestion() {
    const withIso = Object.keys(visitedCountries).filter(c => isoMap[c]);
    if (withIso.length < 4) return null;
    const correctCountry = pickN(withIso, 1)[0];
    const iso = isoMap[correctCountry];
    const flag = flagEmoji(iso);
    const wrongCountries = pickN(withIso.filter(c => c !== correctCountry), 3);
    const options = shuffle([correctCountry, ...wrongCountries]);
    return {
      type: "flag",
      prompt: `Which country has this flag?  ${flag}`,
      hint: `It's in ${getContinent(iso)}`,
      options: options.map(o => ({ label: o, correct: o === correctCountry })),
    };
  }

  // ── Q type 6: Route airline ───────────────────────────────────
  function makeRouteAirlineQuestion() {
    const routeAirlines = {};
    flights.forEach(f => {
      if (!f.Airline || !airports[f.From] || !airports[f.To]) return;
      const key = [f.From, f.To].sort().join("→");
      if (!routeAirlines[key]) routeAirlines[key] = {};
      routeAirlines[key][f.Airline] = (routeAirlines[key][f.Airline] || 0) + 1;
    });
    const entries = shuffle(Object.entries(routeAirlines));
    const entry = entries.find(([, map]) => Object.keys(map).length >= 1);
    if (!entry) return null;
    const [routeKey, airlineMap] = entry;
    const [from, to] = routeKey.split("→");
    const topAirline = Object.entries(airlineMap).sort((a, b) => b[1] - a[1])[0][0];
    const totalFlights = Object.values(airlineMap).reduce((s, n) => s + n, 0);
    const otherAirlines = shuffle(airlines.filter(a => a !== topAirline));
    if (otherAirlines.length < 3) return null;
    const options = shuffle([topAirline, ...otherAirlines.slice(0, 3)]);
    return {
      type: "route_airline",
      prompt: `Which airline did you fly most on ${from} ↔ ${to}?`,
      hint: `${totalFlights} flight${totalFlights !== 1 ? "s" : ""} total on this route`,
      options: options.map(o => ({ label: o, correct: o === topAirline })),
    };
  }

  const generators = [
    makeCityQuestion, makeIataQuestion, makeLongestRouteQuestion,
    makeAirlineYearQuestion, makeFlagQuestion, makeRouteAirlineQuestion,
  ];

  const pool = [];
  const usedTypes = {};
  for (let attempt = 0; attempt < 80 && pool.length < 10; attempt++) {
    const gen = generators[attempt % generators.length];
    const q = gen();
    if (q) {
      // Allow each type up to 3 times
      const typeCount = usedTypes[q.type] || 0;
      if (typeCount < 3) {
        pool.push(q);
        usedTypes[q.type] = typeCount + 1;
      }
    }
  }
  return shuffle(pool).slice(0, 10);
}

/* ── QuizModal Component ────────────────────────────────────────────────────── */
function QuizModal({ flights, onClose }) {
  const airports = window.AIRPORTS || {};
  const [questions, setQuestions] = useState(() => generateQuestions(flights, airports));
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[idx];
  const total = questions.length;
  const answered = chosen !== null;
  const isCorrect = answered && q?.options[chosen]?.correct;

  function handleChoice(i) {
    if (answered) return;
    setChosen(i);
    if (q.options[i].correct) setScore(s => s + 1);
  }

  function next() {
    if (idx + 1 >= total) { setDone(true); return; }
    setIdx(i => i + 1);
    setChosen(null);
    setShowHint(false);
  }

  function restart() {
    setQuestions(generateQuestions(flights, airports));
    setIdx(0); setChosen(null); setShowHint(false);
    setScore(0); setDone(false);
  }

  // Keyboard nav
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") { onClose(); return; }
      if (!answered) {
        const map = { "1": 0, "2": 1, "3": 2, "4": 3 };
        if (map[e.key] !== undefined) handleChoice(map[e.key]);
      } else if (e.key === "Enter" || e.key === " ") {
        next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answered, idx, chosen]);

  const overlay = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(15,13,30,0.88)", backdropFilter: "blur(16px)",
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const card = {
    background: "var(--t-surf-95)", border: "1px solid var(--t-acc-35)",
    borderRadius: 20, padding: "28px 32px", maxWidth: 520, width: "90%",
    boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    maxHeight: "90vh", overflowY: "auto",
  };

  function optionStyle(i) {
    let bg = "var(--t-over-06)";
    let border = "1px solid var(--t-over-08)";
    let color = "var(--t-fg)";
    if (answered) {
      if (q.options[i].correct) {
        bg = "rgba(0,210,160,0.15)"; border = "1px solid rgba(0,210,160,0.5)"; color = "#00D2A0";
      } else if (i === chosen) {
        bg = "rgba(255,107,107,0.12)"; border = "1px solid rgba(255,107,107,0.4)"; color = "#FF6B6B";
      }
    }
    return {
      width: "100%", textAlign: "left", padding: "11px 14px",
      background: bg, border, borderRadius: 10, color,
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13,
      cursor: answered ? "default" : "pointer", transition: "background 0.12s, border 0.12s",
      marginBottom: 7, display: "flex", alignItems: "center", gap: 10,
    };
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={card}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--t-accent)", letterSpacing: "0.05em" }}>
            ✈ FLIGHT QUIZ
          </span>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {!done && (
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--t-fg3)" }}>
                Q {idx + 1}/{total} · {score} pt{score !== 1 ? "s" : ""}
              </span>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--t-fg3)", fontSize: 16, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {done ? (
          /* ── End screen ── */
          <div style={{ textAlign: "center", padding: "24px 0 8px" }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>
              {score >= 9 ? "🏆" : score >= 7 ? "🥇" : score >= 5 ? "🥈" : "🧭"}
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 36, fontWeight: 700, color: "var(--t-accent)", marginBottom: 6 }}>
              {score}/{total}
            </div>
            <div style={{ color: "var(--t-fg2)", fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
              {score >= 9 ? "You know your flights by heart!" :
               score >= 7 ? "Frequent flyer knowledge unlocked!" :
               score >= 5 ? "Not bad for a jet-setter." :
               "More flights ahead — keep exploring!"}
            </div>
            <button onClick={restart} style={{
              background: "var(--t-acc-22)", border: "1px solid var(--t-acc-45)",
              color: "var(--t-accent)", borderRadius: 10, padding: "10px 28px",
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, cursor: "pointer",
            }}>Play again</button>
          </div>
        ) : q ? (
          <>
            {/* Progress bar */}
            <div style={{ background: "var(--t-over-06)", borderRadius: 4, height: 3, marginBottom: 22 }}>
              <div style={{
                background: "#6C5CE7", borderRadius: 4, height: 3,
                width: `${((idx + (answered ? 1 : 0)) / total) * 100}%`,
                transition: "width 0.3s",
              }} />
            </div>

            {/* Type label */}
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--t-fg4)", marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {{ city: "city name", iata: "iata code", route: "longest route", year: "first flight year", flag: "country flag", route_airline: "route airline" }[q.type] || q.type}
            </div>

            {/* Prompt */}
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--t-fg)", marginBottom: 18, lineHeight: 1.55 }}>
              {q.prompt}
            </div>

            {/* Options */}
            <div>
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  style={optionStyle(i)}
                  onClick={() => handleChoice(i)}
                  onMouseEnter={e => { if (!answered) e.currentTarget.style.background = "var(--t-acc-15)"; }}
                  onMouseLeave={e => { if (!answered) e.currentTarget.style.background = "var(--t-over-06)"; }}
                >
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, opacity: 0.45, flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  {opt.label}
                  {answered && opt.correct && <span style={{ marginLeft: "auto", fontSize: 12 }}>✓</span>}
                  {answered && !opt.correct && i === chosen && <span style={{ marginLeft: "auto", fontSize: 12 }}>✗</span>}
                </button>
              ))}
            </div>

            {/* Feedback */}
            {answered && (
              <div style={{
                padding: "8px 12px", borderRadius: 8, marginTop: 2, marginBottom: 12,
                background: isCorrect ? "rgba(0,210,160,0.08)" : "rgba(255,107,107,0.08)",
                color: isCorrect ? "#00D2A0" : "#FF6B6B", fontSize: 13,
              }}>
                {isCorrect ? "✓ Correct!" : `✗ Answer: ${q.options.find(o => o.correct)?.label}`}
              </div>
            )}

            {/* Hint + Next row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => setShowHint(h => !h)} style={{
                  background: "none", border: "1px solid var(--t-over-10)",
                  borderRadius: 8, padding: "5px 11px", color: showHint ? "#FDCB6E" : "var(--t-fg3)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, cursor: "pointer",
                }}>💡 Hint</button>
                {showHint && (
                  <span style={{ fontSize: 12, color: "var(--t-fg2)", fontStyle: "italic" }}>{q.hint}</span>
                )}
              </div>
              {answered && (
                <button onClick={next} style={{
                  background: "var(--t-acc-22)", border: "1px solid var(--t-acc-45)",
                  color: "var(--t-accent)", borderRadius: 10, padding: "8px 18px", flexShrink: 0,
                  fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, cursor: "pointer",
                }}>
                  {idx + 1 >= total ? "See results" : "Next →"}
                </button>
              )}
            </div>

            {/* Keyboard shortcut hint */}
            {!answered && (
              <div style={{ marginTop: 14, fontSize: 10, color: "var(--t-fg5)", fontFamily: "JetBrains Mono, monospace" }}>
                press 1–4 to answer · Esc to close
              </div>
            )}
          </>
        ) : (
          <div style={{ color: "var(--t-fg3)", textAlign: "center", padding: "40px 0", fontSize: 14 }}>
            Not enough flight data to generate questions yet.
          </div>
        )}
      </div>
    </div>
  );
}

window.QuizModal = QuizModal;
