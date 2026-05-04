/* App.jsx — Travel Diary main shell */
const { useState, useEffect, useMemo, useRef, useCallback } = React;

const SCHEME_OPTIONS = [
  { value: "ink", label: "Ink" },
  { value: "aurora", label: "Aurora" },
  { value: "mesh", label: "Mesh" },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "scheme": "ink",
  "showLabels": false,
  "compactSidebar": false
}/*EDITMODE-END*/;

const AIRLINE_PALETTE = [
  "#6C5CE7", "#FF6B6B", "#00D2A0", "#FDCB6E", "#74B9FF",
  "#FD79A8", "#A29BFE", "#55EFC4", "#FF8E8E", "#FFEAA7",
];

const MEMBER_COLOR_PALETTE = ["#6C5CE7", "#FF6B6B", "#00D2A0", "#FDCB6E", "#74B9FF", "#FD79A8", "#A29BFE", "#55EFC4"];
function buildMemberColors(members) {
  const map = {};
  (members || []).forEach((m, i) => { map[m.id] = MEMBER_COLOR_PALETTE[i % MEMBER_COLOR_PALETTE.length]; });
  return map;
}

const AIRLINE_ALLIANCES = {
  // Star Alliance
  "Air Canada":"Star","Lufthansa":"Star","Singapore Airlines":"Star","United Airlines":"Star",
  "Air India":"Star","Swiss International Air Lines":"Star","Austrian Airlines":"Star",
  "Brussels Airlines":"Star","TAP Portugal":"Star","Scandinavian Airlines System":"Star",
  "Turkish Airlines":"Star","Finnair":"Star","LOT Polish Airlines":"Star",
  "Egyptair":"Star","Ethiopian Airlines":"Star","Avianca":"Star",
  // Oneworld
  "British Airways":"Oneworld","American Airlines":"Oneworld","Cathay Pacific":"Oneworld",
  "Japan Airlines":"Oneworld","Alaska Airlines":"Oneworld","Iberia":"Oneworld",
  "Finnair":"Oneworld","Malaysia Airlines":"Oneworld","Qatar Airways":"Oneworld",
  "Royal Jordanian":"Oneworld",
  // SkyTeam
  "Air France":"SkyTeam","Delta Air Lines":"SkyTeam","KLM Royal Dutch Airlines":"SkyTeam",
  "Korean Air":"SkyTeam","Aeromexico":"SkyTeam","China Airlines":"SkyTeam",
  "Air Serbia":"SkyTeam","Czech Airlines":"SkyTeam",
};
const ALLIANCE_COLORS = { Star:"#74B9FF", Oneworld:"#FF6B6B", SkyTeam:"#00D2A0" };
const ALLIANCE_SHORT  = { Star:"★", Oneworld:"◆", SkyTeam:"⬡" };

const AIRLINE_MM = new Set([
  "Lufthansa","Austrian Airlines","Swiss International Air Lines","Brussels Airlines",
  "Eurowings","Luxair","Croatia Airlines","Air Dolomiti",
]);
const MM_COLOR = "#F5C842";

function getAircraftMfr(plane) {
  if (!plane) return null;
  const p = plane.toUpperCase();
  if (/^B[0-9]/.test(p) || /^B7[0-9X]/.test(p)) return "Boeing";
  if (/^A[0-9]/.test(p) || /^BCS/.test(p))       return "Airbus";
  if (/^E[0-9]/.test(p) || /^ERJ/.test(p))        return "Embraer";
  if (/^CRJ/.test(p) || /^DH8/.test(p))           return "Bombardier";
  if (/^AT[0-9]/.test(p))                          return "ATR";
  return null;
}

function fmtNum(n) { return n.toLocaleString("en-US"); }
function fmtDur(mins) {
  if (!mins) return "";
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
function fmtKm(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000)    return Math.round(n / 1_000) + "K";
  return n.toLocaleString("en-US");
}
function fmtDate(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function isoToFlag(iso) {
  if (!iso || iso.length !== 2) return "";
  return String.fromCodePoint(...iso.toUpperCase().split("").map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}
function acName(code) {
  if (!code) return "";
  return (window.AIRCRAFT_TYPES || {})[code]?.name || code;
}
function parseDurMins(dur) {
  if (!dur) return 0;
  if (dur.includes(":")) {
    const [h, m] = dur.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  const n = parseFloat(dur);
  return isNaN(n) ? 0 : n;
}
function fmtTime(d) {
  if (!d) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const ISO_TO_CONTINENT = {
  // Africa
  DZ:"AF",AO:"AF",BJ:"AF",BW:"AF",BF:"AF",BI:"AF",CV:"AF",CM:"AF",CF:"AF",TD:"AF",
  KM:"AF",CG:"AF",CD:"AF",CI:"AF",DJ:"AF",EG:"AF",GQ:"AF",ER:"AF",ET:"AF",GA:"AF",
  GM:"AF",GH:"AF",GN:"AF",GW:"AF",KE:"AF",LS:"AF",LR:"AF",LY:"AF",MG:"AF",MW:"AF",
  ML:"AF",MR:"AF",MU:"AF",MA:"AF",MZ:"AF",NA:"AF",NE:"AF",NG:"AF",RW:"AF",ST:"AF",
  SN:"AF",SC:"AF",SL:"AF",SO:"AF",ZA:"AF",SS:"AF",SD:"AF",SZ:"AF",TZ:"AF",TG:"AF",
  TN:"AF",UG:"AF",ZM:"AF",ZW:"AF",
  // Asia
  AF:"AS",AM:"AS",AZ:"AS",BH:"AS",BD:"AS",BT:"AS",BN:"AS",KH:"AS",CN:"AS",GE:"AS",
  IN:"AS",ID:"AS",IR:"AS",IQ:"AS",IL:"AS",JP:"AS",JO:"AS",KZ:"AS",KW:"AS",KG:"AS",
  LA:"AS",LB:"AS",MY:"AS",MV:"AS",MN:"AS",MM:"AS",NP:"AS",KP:"AS",OM:"AS",PK:"AS",
  PH:"AS",QA:"AS",SA:"AS",SG:"AS",KR:"AS",LK:"AS",SY:"AS",TW:"AS",TJ:"AS",TH:"AS",
  TL:"AS",TM:"AS",UZ:"AS",VN:"AS",YE:"AS",HK:"AS",MO:"AS",PS:"AS",
  // Europe
  AL:"EU",AD:"EU",AT:"EU",BY:"EU",BE:"EU",BA:"EU",BG:"EU",HR:"EU",CY:"EU",CZ:"EU",
  DK:"EU",EE:"EU",FI:"EU",FR:"EU",DE:"EU",GR:"EU",HU:"EU",IS:"EU",IE:"EU",IT:"EU",
  XK:"EU",LV:"EU",LI:"EU",LT:"EU",LU:"EU",MT:"EU",MD:"EU",MC:"EU",ME:"EU",NL:"EU",
  MK:"EU",NO:"EU",PL:"EU",PT:"EU",RO:"EU",RU:"EU",SM:"EU",RS:"EU",SK:"EU",SI:"EU",
  ES:"EU",SE:"EU",CH:"EU",UA:"EU",GB:"EU",VA:"EU",
  // North America
  AG:"NA",BS:"NA",BB:"NA",BZ:"NA",CA:"NA",CR:"NA",CU:"NA",DM:"NA",DO:"NA",SV:"NA",
  GD:"NA",GT:"NA",HT:"NA",HN:"NA",JM:"NA",MX:"NA",NI:"NA",PA:"NA",KN:"NA",LC:"NA",
  VC:"NA",TT:"NA",US:"NA",
  // South America
  AR:"SA",BO:"SA",BR:"SA",CL:"SA",CO:"SA",EC:"SA",GY:"SA",PY:"SA",PE:"SA",SR:"SA",
  UY:"SA",VE:"SA",
  // Oceania
  AU:"OC",FJ:"OC",KI:"OC",MH:"OC",FM:"OC",NR:"OC",NZ:"OC",PW:"OC",PG:"OC",WS:"OC",
  SB:"OC",TO:"OC",TV:"OC",VU:"OC",
  // Turkey straddles EU/AS — placed in AS per geography
  TR:"AS",
  // UAE
  AE:"AS",
};

const CONTINENT_NAMES = {
  EU: "Europe", AS: "Asia", NA: "North America",
  SA: "South America", AF: "Africa", OC: "Oceania",
};
const CONTINENT_ORDER = ["EU","AS","NA","SA","AF","OC"];

function getAircraftBaseGroup(code) {
  if (!code) return "Other";
  const c = code.trim().toUpperCase();
  if (/^B78/.test(c)) return "Boeing 787 Dreamliner";
  if (/^B77/.test(c)) return "Boeing 777";
  if (/^B76/.test(c)) return "Boeing 767";
  if (/^B75/.test(c)) return "Boeing 757";
  if (/^B74/.test(c)) return "Boeing 747";
  if (/^B73/.test(c)) return "Boeing 737";
  if (/^(A318|A319|A320|A20N)$/.test(c)) return "Airbus A320 Family";
  if (/^(A321|A21N)$/.test(c)) return "Airbus A321";
  if (/^A33/.test(c)) return "Airbus A330";
  if (/^A35/.test(c)) return "Airbus A350";
  if (/^A38/.test(c)) return "Airbus A380";
  if (/^BCS/.test(c)) return "Airbus A220";
  if (/^(CRJ|DH8)/.test(c)) return "Bombardier";
  if (/^AT/.test(c)) return "ATR";
  if (/^E/.test(c)) return "Embraer";
  return "Other";
}

/* ── Reusable components ── */

function DataQualityPanel({ errors, warnings, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const total = errors.length + warnings.length;
  return (
    <div ref={ref} style={{
      position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
      width: 340, maxHeight: 480, overflowY: "auto",
      background: "var(--t-surf-95)", border: "1px solid rgba(255,107,107,0.3)",
      borderRadius: 14, boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
      backdropFilter: "blur(16px)",
      fontFamily: "var(--font-body)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 14px 10px", borderBottom: "1px solid var(--t-over-06)",
      }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--t-fg)" }}>
          Data Quality
        </span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {errors.length > 0 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#FF6B6B",
              background: "rgba(255,107,107,0.12)", border: "1px solid rgba(255,107,107,0.25)",
              borderRadius: 6, padding: "2px 7px" }}>
              {errors.length} error{errors.length !== 1 ? "s" : ""}
            </span>
          )}
          {warnings.length > 0 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#FDCB6E",
              background: "rgba(253,203,110,0.12)", border: "1px solid rgba(253,203,110,0.25)",
              borderRadius: 6, padding: "2px 7px" }}>
              {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
            </span>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--t-fg3)", fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1 }}><LucideIcon name="x" size={14} /></button>
        </div>
      </div>

      {total === 0 ? (
        <div style={{ padding: "24px 14px", textAlign: "center", color: "var(--t-fg3)", fontSize: 13 }}>
          <LucideIcon name="check" size={13} color="#00D2A0" /> No issues found
        </div>
      ) : (
        <div style={{ padding: "6px 0 8px" }}>
          {errors.length > 0 && (
            <>
              <div style={{ padding: "6px 14px 3px", fontFamily: "var(--font-mono)", fontSize: 9,
                color: "#FF6B6B", letterSpacing: "0.07em", textTransform: "uppercase" }}>Errors</div>
              {errors.map((e, i) => (
                <div key={i} style={{
                  padding: "5px 14px", display: "flex", gap: 8, alignItems: "flex-start",
                  borderBottom: i < errors.length - 1 ? "1px solid var(--t-over-03)" : "none",
                }}>
                  <span style={{ color: "#FF6B6B", fontSize: 11, flexShrink: 0, marginTop: 1 }}><LucideIcon name="x" size={11} color="#FF6B6B" /></span>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--t-fg)", lineHeight: 1.4 }}>{e.msg}</div>
                    <div style={{ fontSize: 10, color: "var(--t-fg3)", fontFamily: "var(--font-mono)", marginTop: 1 }}>{e.loc}</div>
                  </div>
                </div>
              ))}
            </>
          )}
          {warnings.length > 0 && (
            <>
              <div style={{ padding: "8px 14px 3px", fontFamily: "var(--font-mono)", fontSize: 9,
                color: "#FDCB6E", letterSpacing: "0.07em", textTransform: "uppercase",
                borderTop: errors.length > 0 ? "1px solid var(--t-over-05)" : "none",
                marginTop: errors.length > 0 ? 4 : 0 }}>Warnings</div>
              {warnings.map((w, i) => (
                <div key={i} style={{
                  padding: "5px 14px", display: "flex", gap: 8, alignItems: "flex-start",
                  borderBottom: i < warnings.length - 1 ? "1px solid var(--t-over-03)" : "none",
                }}>
                  <span style={{ color: "#FDCB6E", fontSize: 11, flexShrink: 0, marginTop: 1 }}><LucideIcon name="triangle-alert" size={11} color="#FDCB6E" /></span>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--t-fg)", lineHeight: 1.4 }}>{w.msg}</div>
                    <div style={{ fontSize: 10, color: "var(--t-fg3)", fontFamily: "var(--font-mono)", marginTop: 1 }}>{w.loc}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color, mono, onClick, tooltip }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} title={tooltip}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--t-surf-65)",
        border: "1px solid " + (hover && onClick ? "var(--t-acc-35)" : "var(--t-card-border)"),
        borderRadius: 14,
        padding: "18px 18px",
        backdropFilter: "blur(12px)",
        boxShadow: "var(--t-card-shadow)",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10, fontWeight: 500,
        color: "var(--t-accent)", letterSpacing: 0.5,
        textTransform: "uppercase", marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: 36, fontWeight: 700, letterSpacing: -1,
        color: color || "var(--t-fg)", lineHeight: 1,
      }}>{value}</div>
      {sub && <div style={{
        marginTop: 6,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
        fontSize: 11, color: "var(--t-fg2)",
      }}>{sub}</div>}
    </div>
  );
}

function MemberDropdown({ members, activeMembers, onToggle, onSolo, onAll, collapseRef, memberColors }) {
  const MEMBER_COLORS = memberColors || {};
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (collapseRef) collapseRef.current = () => setOpen(false);
  }, [collapseRef]);

  const activeList = members.filter(m => activeMembers.has(m.id));
  const label = activeList.length === 0 ? "None"
    : activeList.length === members.length ? "All"
    : activeList.map(m => m.name).join(" + ");

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "6px 12px", borderRadius: 999,
        border: "1px solid var(--t-acc-35)",
        background: open ? "var(--t-acc-18)" : "var(--t-surf-60)",
        color: "var(--t-accent)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13,
        cursor: "pointer", transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}>
        <span style={{ display: "flex", gap: 3 }}>
          {activeList.map(m => (
            <span key={m.id} style={{ width: 7, height: 7, borderRadius: 999, background: MEMBER_COLORS[m.id] || "#A29BFE", boxShadow: `0 0 5px ${MEMBER_COLORS[m.id] || "#A29BFE"}80` }} />
          ))}
        </span>
        {label}
        <span style={{ fontSize: 9, opacity: 0.7 }}>{open ? "▲" : "▾"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "var(--t-surf-95)", border: "1px solid var(--t-acc-25)",
          borderRadius: 14, padding: "6px 0", minWidth: 200,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          backdropFilter: "blur(16px)",
        }}>
          {/* All */}
          <div onClick={() => { onAll(); setOpen(false); }} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 14px", cursor: "pointer", color: "var(--t-fg3)",
            fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 500,
            transition: "background 0.1s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--t-over-05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--t-over-25)" }} />
            All members
          </div>
          <div style={{ height: 1, background: "var(--t-over-07)", margin: "4px 0" }} />
          {members.map(m => {
            const active = activeMembers.has(m.id);
            const color = MEMBER_COLORS[m.id] || "#A29BFE";
            return (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 14px",
                transition: "background 0.1s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--t-over-04)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span onClick={() => onToggle(m.id)} style={{
                  display: "flex", alignItems: "center", gap: 8, flex: 1, cursor: "pointer",
                  color: active ? color : "var(--t-fg3)",
                  fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 999,
                    background: active ? color : "var(--t-over-15)",
                    boxShadow: active ? `0 0 8px ${color}60` : "none",
                    flexShrink: 0, transition: "all 0.15s",
                  }} />
                  {m.name}
                  {m.hasFlights && <span style={{ fontSize: 10, opacity: active ? 0.8 : 0.3 }}><LucideIcon name="plane" size={10} /></span>}
                </span>
                <button onClick={() => { onSolo(m.id); setOpen(false); }} style={{
                  padding: "2px 7px", borderRadius: 999, border: "1px solid var(--t-over-12)",
                  background: "transparent", color: "var(--t-fg3)",
                  fontFamily: "var(--font-mono)", fontSize: 9, cursor: "pointer",
                  transition: "all 0.1s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = color; e.currentTarget.style.borderColor = color + "60"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--t-fg3)"; e.currentTarget.style.borderColor = "var(--t-over-12)"; }}
                >only</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Autocomplete input ── */

function AutocompleteInput({ placeholder, value, options, onSelect, onClear, renderLabel }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const filtered = useMemo(() => {
    if (!query) return options.slice(0, 20);
    const q = query.toLowerCase();
    return options.filter(o =>
      o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [query, options]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (value) {
    return (
      <div ref={ref} style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 8px 3px 10px", borderRadius: 999,
        background: "var(--t-acc-18)",
        border: "1px solid var(--t-acc-40)",
        fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--t-accent)",
      }}>
        {renderLabel ? renderLabel(value) : value}
        <button onClick={onClear} style={{
          background: "transparent", border: "none", color: "var(--t-fg3)",
          cursor: "pointer", padding: 0, marginLeft: 2, fontSize: 14, lineHeight: 1,
        }}>×</button>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={{
          width: 120, padding: "5px 10px", borderRadius: 8,
          background: "var(--t-surf-60)",
          border: "1px solid var(--t-acc-30)",
          color: "var(--t-accent)",
          fontFamily: "var(--font-mono)", fontSize: 11,
          outline: "none",
        }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: 4,
          width: 220, maxHeight: 240, overflowY: "auto",
          background: "var(--t-surf-95)", border: "1px solid var(--t-acc-35)",
          borderRadius: 10, zIndex: 100, backdropFilter: "blur(12px)",
          padding: "4px 0",
        }}>
          {filtered.map((o) => (
            <div key={o.value}
              onClick={() => { onSelect(o.value); setQuery(""); setOpen(false); }}
              style={{
                padding: "6px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                fontFamily: "var(--font-body)", fontSize: 12, color: "var(--t-fg)",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--t-acc-15)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>
                {o.flag ? <span style={{ marginRight: 4 }}>{o.flag}</span> : null}
                {o.label}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", flexShrink: 0 }}>×{o.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Country enrichment card ── */

function CountryCard({ iso }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    if (!iso || !window.Enrichment) { setLoading(false); return; }
    setLoading(true);
    setData(null);
    window.Enrichment.country(iso).then(d => { setData(d); setLoading(false); });
  }, [iso]);

  if (loading) return (
    <div style={{ padding: "6px 14px 8px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg4)" }}>loading…</div>
  );
  if (!data) return null;

  const cap = data.capital?.[0] || "—";
  const pop = data.population
    ? data.population >= 1e9 ? (data.population / 1e9).toFixed(1) + "B"
    : data.population >= 1e6 ? (data.population / 1e6).toFixed(1) + "M"
    : (data.population / 1e3).toFixed(0) + "K"
    : "—";
  const area = data.area
    ? data.area >= 1e6 ? (data.area / 1e6).toFixed(1) + "M km²"
    : Math.round(data.area).toLocaleString() + " km²"
    : "—";
  const langs = data.languages ? Object.values(data.languages).slice(0, 3).join(", ") : "—";
  const curr = data.currencies ? Object.values(data.currencies).map(c => (c.symbol ? `${c.symbol} ${c.name}` : c.name)).slice(0, 2).join(", ") : "—";
  const region = [data.subregion, data.region].filter(Boolean).join(" · ") || "—";

  // Borders: ISO3 codes from REST Countries — mark visited ones
  const visitedISOs = new Set(Object.values(window.COUNTRY_NAME_TO_ISO_CHART || {}));

  return (
    <div style={{ padding: "8px 14px 10px", background: "var(--t-acc-06)", borderTop: "1px solid var(--t-over-04)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px", fontFamily: "var(--font-mono)", fontSize: 10, marginBottom: 8 }}>
        {[["capital", cap], ["pop.", pop], ["area", area], ["currency", curr], ["languages", langs], ["region", region]].map(([k, v]) => (
          <React.Fragment key={k}>
            <span style={{ color: "var(--t-fg4)" }}>{k}</span>
            <span style={{ color: "var(--t-fg2)" }}>{v}</span>
          </React.Fragment>
        ))}
      </div>
      {data.borders?.length > 0 && (
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-fg4)", marginBottom: 4 }}>neighbours</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {data.borders.map(b => {
              const been = visitedISOs.has(b);
              return (
                <span key={b} style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 6px", borderRadius: 3,
                  background: been ? "rgba(0,210,160,0.12)" : "var(--t-over-04)",
                  color: been ? "#00D2A0" : "var(--t-fg4)",
                  border: `1px solid ${been ? "rgba(0,210,160,0.25)" : "var(--t-over-06)"}`,
                  title: been ? "visited" : "",
                }}>{b}{been ? <> <LucideIcon name="check" size={9} /></> : ""}</span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Detail list view ── */

function DetailListView({
  type, flights, stats, onBack,
  onFlightSelect, selectedFlight,
  airlineColorMap, arcColorMode,
  isoToName, COUNTRY_NAME_TO_ISO,
  onCountryClick, onAirportClick, onAirlineClick, onAircraftClick, onTripClick, onRouteClick,
  focusedCountry, focusedAirport, focusedAirline, focusedAircraft, focusedTrip, focusedRoute,
  initialRouteSort,
}) {
  const reasonLabel = { L: "Leisure", B: "Business", O: "Other" };
  const [search, setSearch] = useState("");
  const [grouped, setGrouped] = useState(false);
  const [routeSort, setRouteSort] = useState(initialRouteSort || "count");

  const listData = useMemo(() => {
    switch (type) {
      case "flights":
        return flights.slice().sort((a, b) => b.dateObj - a.dateObj);
      case "distance":
        return flights.slice().sort((a, b) => b.distanceKm - a.distanceKm);
      case "nextday":
        return (stats.nextDayFlights || []).slice().sort((a, b) => b.dateObj - a.dateObj);
      case "birthday":
        return (stats.birthdayFlightsList || []).slice().sort((a, b) => b.dateObj - a.dateObj);
      case "countries": {
        // Build reverse COUNTRY_NAME_TO_ISO as fallback for territories missing from GeoJSON (HK, SG, MT, etc.)
        const isoToLocalName = {};
        Object.entries(COUNTRY_NAME_TO_ISO).forEach(([name, iso]) => { if (!isoToLocalName[iso]) isoToLocalName[iso] = name; });
        const m = new Map();
        flights.forEach(f => {
          const A = window.AIRPORTS[f.From], B = window.AIRPORTS[f.To];
          [A, B].forEach(ap => {
            if (!ap) return;
            const iso = COUNTRY_NAME_TO_ISO[ap.country];
            if (iso) m.set(iso, (m.get(iso) || 0) + 1);
          });
        });
        return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([iso, count]) => ({
          iso, name: isoToName[iso] || isoToLocalName[iso] || iso, count, flag: isoToFlag(iso),
        }));
      }
      case "airports": {
        const m = new Map();
        flights.forEach(f => {
          m.set(f.From, (m.get(f.From) || 0) + 1);
          m.set(f.To, (m.get(f.To) || 0) + 1);
        });
        return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([iata, count]) => {
          const ap = window.AIRPORTS[iata];
          const iso = ap ? COUNTRY_NAME_TO_ISO[ap.country] : null;
          return { iata, city: ap?.city || "", country: ap?.country || "", iso, count, flag: iso ? isoToFlag(iso) : "" };
        });
      }
      case "airlines": {
        const m = new Map(); // name → { count, iata }
        flights.forEach(f => {
          if (!f.Airline) return;
          if (!m.has(f.Airline)) {
            const iata = (f.Flight_Number || "").replace(/\d+$/, "").trim().slice(0, 3).toUpperCase();
            m.set(f.Airline, { count: 0, iata });
          }
          m.get(f.Airline).count++;
        });
        return [...m.entries()].sort((a, b) => b[1].count - a[1].count)
          .map(([name, { count, iata }]) => ({ name, count, iata }));
      }
      case "aircraft": {
        const m = new Map();
        flights.forEach(f => { if (f.Plane) m.set(f.Plane, (m.get(f.Plane) || 0) + 1); });
        return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
      }
      case "trips": {
        const m = new Map();
        flights.forEach(f => {
          if (!f.Trip) return;
          if (!m.has(f.Trip)) m.set(f.Trip, { code: f.Trip, flights: [], airports: new Set() });
          const entry = m.get(f.Trip);
          entry.flights.push(f);
          entry.airports.add(f.From);
          entry.airports.add(f.To);
        });
        return [...m.values()].map(entry => {
          const parts = entry.code.split("-");
          const yymm = parts[0] || "";
          const yy = parseInt(yymm.slice(0, 2), 10);
          const mm = parseInt(yymm.slice(2, 4), 10);
          const fullYear = (yy <= 30 ? 2000 : 1900) + yy;
          const dest = parts[1] || "";
          const rawLast = parts[parts.length - 1] || "";
          const typeChar = rawLast.slice(-1).toLowerCase();
          const tripIcon = typeChar === "f" ? "tree-palm" : (typeChar === "b" || typeChar === "w") ? "briefcase" : "plane";
          const displayCode = parts.slice(0, -1).join(" ");
          return {
            code: entry.code,
            displayCode,
            tripIcon,
            dest,
            year: fullYear,
            month: mm,
            flightCount: entry.flights.length,
            airports: [...entry.airports].filter(Boolean),
            sortDate: new Date(fullYear, (mm || 1) - 1, 1),
          };
        }).sort((a, b) => b.sortDate - a.sortDate);
      }
      case "duration": {
        // List flights with duration, sorted longest first
        return flights
          .filter(f => f.Duration)
          .map(f => {
            const [h, m] = f.Duration.split(":").map(Number);
            return { ...f, durMins: (h || 0) * 60 + (m || 0) };
          })
          .sort((a, b) => b.durMins - a.durMins);
      }
      case "seats": {
        const m = new Map();
        flights.forEach(f => {
          if (!f.Seat) return;
          if (!m.has(f.Seat)) m.set(f.Seat, { seat: f.Seat, count: 0, flights: [] });
          m.get(f.Seat).count++;
          m.get(f.Seat).flights.push(f);
        });
        return [...m.values()].sort((a, b) => b.count - a.count);
      }
      case "routes": {
        const m = new Map();
        flights.forEach(f => {
          const key = [f.From, f.To].sort().join("-");
          if (!m.has(key)) {
            const [a, b] = key.split("-");
            m.set(key, { key, from: a, to: b, count: 0, airlines: new Set(), totalDist: 0 });
          }
          const entry = m.get(key);
          entry.count++;
          entry.totalDist += (f.distanceKm || 0);
          if (f.Airline) entry.airlines.add(f.Airline);
        });
        return [...m.values()]
          .map(r => ({ ...r, airlines: [...r.airlines], avgDist: r.count ? Math.round(r.totalDist / r.count) : 0 }))
          .sort((a, b) => b.count - a.count);
      }
      default: return [];
    }
  }, [type, flights]);

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return listData;
    switch (type) {
      case "flights":
      case "distance":
        return listData.filter(f =>
          (f.From || "").toLowerCase().includes(q) ||
          (f.To || "").toLowerCase().includes(q) ||
          (f.Airline || "").toLowerCase().includes(q) ||
          (f.Flight_Number || "").toLowerCase().includes(q) ||
          (f.Plane || "").toLowerCase().includes(q)
        );
      case "countries":
        return listData.filter(c => c.name.toLowerCase().includes(q) || c.iso.toLowerCase().includes(q));
      case "airports":
        return listData.filter(a =>
          a.iata.toLowerCase().includes(q) ||
          a.city.toLowerCase().includes(q) ||
          a.country.toLowerCase().includes(q)
        );
      case "airlines":
        return listData.filter(a => a.name.toLowerCase().includes(q));
      case "aircraft":
        return listData.filter(a =>
          a.name.toLowerCase().includes(q) ||
          getAircraftBaseGroup(a.name).toLowerCase().includes(q)
        );
      case "trips":
        return listData.filter(t =>
          t.code.toLowerCase().includes(q) ||
          t.airports.some(iata => iata.toLowerCase().includes(q))
        );
      case "duration":
        return listData.filter(f =>
          (f.From || "").toLowerCase().includes(q) ||
          (f.To || "").toLowerCase().includes(q) ||
          (f.Airline || "").toLowerCase().includes(q)
        );
      case "seats":
        return listData.filter(s => s.seat.toLowerCase().includes(q));
      case "routes":
        return listData.filter(r =>
          r.from.toLowerCase().includes(q) ||
          r.to.toLowerCase().includes(q) ||
          r.airlines.some(a => a.toLowerCase().includes(q))
        );
      default: return listData;
    }
  }, [listData, search, type]);

  const rowStyle = {
    padding: "10px 14px", borderBottom: "1px solid var(--t-over-04)",
    cursor: "pointer", transition: "background 0.1s",
  };
  const focusedRowExtra = {
    borderLeft: "2px solid #6C5CE7",
    background: "var(--t-acc-12)",
  };
  const subStyle = {
    fontFamily: "var(--font-body)",
    fontSize: 11, color: "var(--t-fg3)",
  };
  const groupHeaderStyle = {
    fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-accent)",
    letterSpacing: 0.5, textTransform: "uppercase",
    padding: "7px 14px 5px 14px",
    background: "var(--t-acc-06)",
    borderRadius: 6, marginTop: 6,
  };
  const showGroupBtn = !["airlines", "distance", "routes", "seats"].includes(type);

  function renderCountryRow(c) {
    const isFocused = focusedCountry === c.iso;
    return (
      <div key={c.iso} style={{ borderBottom: "1px solid var(--t-over-04)" }}>
        <div
          style={{ ...rowStyle, borderBottom: "none", ...(isFocused ? focusedRowExtra : {}), display: "flex", alignItems: "center" }}
          onClick={() => onCountryClick && onCountryClick(c.iso)}
          onMouseEnter={e => { if (!isFocused) e.currentTarget.style.background = "var(--t-over-03)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = isFocused ? "var(--t-acc-12)" : "transparent"; }}
        >
          <span style={{ marginRight: 6 }}>{c.flag}</span>
          <span style={{ fontSize: 13 }}>{c.name}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-fg3)", marginLeft: 5 }}>({c.iso})</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", marginLeft: "auto" }}>×{c.count}</span>
        </div>
        {isFocused && <CountryCard iso={c.iso} />}
      </div>
    );
  }

  function renderTripRow(t) {
    const isFocused = focusedTrip === t.code;
    const airportLine = t.airports.map(iata => {
      const ap = window.AIRPORTS[iata];
      const iso = ap ? COUNTRY_NAME_TO_ISO[ap.country] : null;
      const flag = iso ? isoToFlag(iso) : "";
      return flag ? `${flag}\u202f${iata}` : iata;
    }).join(" · ");
    return (
      <div key={t.code}
        style={{ ...rowStyle, ...(isFocused ? focusedRowExtra : {}) }}
        onClick={() => onTripClick && onTripClick(t.code)}
        onMouseEnter={e => { if (!isFocused) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = isFocused ? "var(--t-acc-12)" : "transparent"; }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13 }}><LucideIcon name={t.tripIcon} size={13} /> {t.displayCode}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", display: "flex", alignItems: "center", gap: 3 }}><LucideIcon name="plane" size={10} /> {t.flightCount}</span>
        </div>
        {airportLine && <div style={{ ...subStyle, marginTop: 3 }}>{airportLine}</div>}
      </div>
    );
  }

  function renderGrouped() {
    if (type === "countries") {
      const byContinent = new Map();
      filteredData.forEach(c => {
        const cont = ISO_TO_CONTINENT[c.iso] || "OC";
        if (!byContinent.has(cont)) byContinent.set(cont, []);
        byContinent.get(cont).push(c);
      });
      return CONTINENT_ORDER.map(cont => {
        const items = byContinent.get(cont);
        if (!items || items.length === 0) return null;
        return (
          <div key={cont}>
            <div style={groupHeaderStyle}>{CONTINENT_NAMES[cont]} ({items.length})</div>
            {items.map(c => renderCountryRow(c))}
          </div>
        );
      });
    }

    if (type === "flights" || type === "distance" || type === "nextday" || type === "birthday") {
      const byFlight = new Map();
      filteredData.forEach(f => {
        const key = f.Flight_Number || "(no number)";
        if (!byFlight.has(key)) byFlight.set(key, { num: key, airline: f.Airline, flights: [] });
        byFlight.get(key).flights.push(f);
      });
      const groups = [...byFlight.values()].sort((a, b) => b.flights[0].dateObj - a.flights[0].dateObj);
      return groups.map(g => (
        <div key={g.num}>
          <div style={groupHeaderStyle}>
            {g.num}
            {g.airline && <span style={{ color: "var(--t-fg3)", fontWeight: 400, textTransform: "none", marginLeft: 6 }}>{g.airline}</span>}
          </div>
          {g.flights.map(f => (
            <div key={f.id} onClick={() => onFlightSelect(selectedFlight?.id === f.id ? null : f)}
              style={{ ...rowStyle, paddingLeft: 20, background: selectedFlight?.id === f.id ? "var(--t-acc-12)" : "transparent" }}
              onMouseEnter={e => { if (selectedFlight?.id !== f.id) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = selectedFlight?.id === f.id ? "var(--t-acc-12)" : "transparent"; }}
            >
              <div style={subStyle}>{fmtDate(f.dateObj)}</div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#00D2A0" }}>{f.From}</span>
                <span style={{ color: "var(--t-fg3)", fontSize: 10, margin: "0 4px" }}>→</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#00D2A0" }}>{f.To}</span>
                {type === "distance" && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#FDCB6E", marginLeft: 8 }}>{fmtNum(f.distanceKm)} km</span>}
              </div>
            </div>
          ))}
        </div>
      ));
    }

    if (type === "airports") {
      const byCity = new Map();
      filteredData.forEach(a => {
        const city = a.city || "(unknown)";
        if (!byCity.has(city)) byCity.set(city, { city, flag: a.flag, items: [], total: 0 });
        const g = byCity.get(city);
        g.items.push(a);
        g.total += a.count;
      });
      const groups = [...byCity.values()].sort((a, b) => b.total - a.total);
      return groups.map(g => (
        <div key={g.city}>
          <div style={groupHeaderStyle}>{g.flag} {g.city}</div>
          {g.items.map(a => {
            const isFocused = focusedAirport === a.iata;
            return (
              <div key={a.iata}
                style={{ ...rowStyle, paddingLeft: 20, display: "flex", alignItems: "center", ...(isFocused ? focusedRowExtra : {}) }}
                onClick={() => onAirportClick && onAirportClick(a.iata)}
                onMouseEnter={e => { if (!isFocused) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isFocused ? "var(--t-acc-12)" : "transparent"; }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#00D2A0" }}>{a.iata}</span>
                <span style={{ ...subStyle, marginLeft: 8 }}>×{a.count}</span>
              </div>
            );
          })}
        </div>
      ));
    }

    if (type === "aircraft") {
      const byGroup = new Map();
      filteredData.forEach(a => {
        const g = getAircraftBaseGroup(a.name);
        if (!byGroup.has(g)) byGroup.set(g, { group: g, items: [], total: 0 });
        const entry = byGroup.get(g);
        entry.items.push(a);
        entry.total += a.count;
      });
      const groups = [...byGroup.values()].sort((a, b) => b.total - a.total);
      return groups.map(g => (
        <div key={g.group}>
          <div style={groupHeaderStyle}>{g.group} <span style={{ color: "var(--t-fg3)" }}>×{g.total}</span></div>
          {g.items.map(a => {
            const isFocused = focusedAircraft === a.name;
            return (
              <div key={a.name}
                style={{ ...rowStyle, paddingLeft: 20, display: "flex", alignItems: "center", ...(isFocused ? focusedRowExtra : {}) }}
                onClick={() => onAircraftClick && onAircraftClick(a.name)}
                onMouseEnter={e => { if (!isFocused) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isFocused ? "var(--t-acc-12)" : "transparent"; }}
              >
                <span style={{ ...subStyle, color: "var(--t-fg2)" }}>{acName(a.name)}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-fg4)", marginLeft: 5 }}>{a.name}</span>
                <span style={{ ...subStyle, marginLeft: 8 }}>×{a.count}</span>
              </div>
            );
          })}
        </div>
      ));
    }

    if (type === "duration") {
      const byHour = new Map();
      filteredData.forEach(f => {
        const bucket = Math.ceil(f.durMins / 60);
        if (!byHour.has(bucket)) byHour.set(bucket, []);
        byHour.get(bucket).push(f);
      });
      const sortedBuckets = [...byHour.keys()].sort((a, b) => a - b);
      return sortedBuckets.map(h => (
        <div key={h}>
          <div style={groupHeaderStyle}>
            {h === 1 ? "under 1 hour" : `${h} hour${h === 1 ? "" : "s"}`}
            <span style={{ color: "var(--t-fg3)", fontWeight: 400, marginLeft: 6 }}>×{byHour.get(h).length}</span>
          </div>
          {byHour.get(h).map(f => (
            <div key={f.id} onClick={() => onFlightSelect(selectedFlight?.id === f.id ? null : f)}
              style={{ ...rowStyle, paddingLeft: 20, background: selectedFlight?.id === f.id ? "var(--t-acc-12)" : "transparent" }}
              onMouseEnter={e => { if (selectedFlight?.id !== f.id) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = selectedFlight?.id === f.id ? "var(--t-acc-12)" : "transparent"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#00D2A0" }}>{f.From} → {f.To}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#74B9FF" }}>{fmtDur(f.durMins)}</span>
              </div>
              <div style={subStyle}>{fmtDate(f.dateObj)} · {f.Airline || ""}</div>
            </div>
          ))}
        </div>
      ));
    }

    if (type === "trips") {
      const byYear = new Map();
      filteredData.forEach(t => {
        if (!byYear.has(t.year)) byYear.set(t.year, []);
        byYear.get(t.year).push(t);
      });
      const sortedYears = [...byYear.keys()].sort((a, b) => b - a);
      return sortedYears.map(yr => (
        <div key={yr}>
          <div style={groupHeaderStyle}>{yr}</div>
          {byYear.get(yr).map(t => renderTripRow(t))}
        </div>
      ));
    }

    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <button onClick={onBack} style={{
        background: "transparent", border: "none", color: "var(--t-accent)",
        cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11,
        display: "flex", alignItems: "center", gap: 4, padding: "0 0 12px 0", textAlign: "left",
      }}>← back to stats</button>

      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)",
        letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8,
      }}>// {({ nextday: "next-day arrivals", birthday: "birthday flights" }[type] || type)} ({filteredData.length}{search.trim() ? ` of ${listData.length}` : ""})</div>

      {/* Search + group toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`search ${type}...`}
            style={{
              width: "100%", padding: "5px 28px 5px 10px", borderRadius: 8, boxSizing: "border-box",
              background: "var(--t-icon-bg)",
              border: "1px solid var(--t-icon-border)",
              color: "var(--t-icon-txt)",
              fontFamily: "var(--font-mono)", fontSize: 11,
              outline: "none",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", color: "var(--t-fg3)",
              cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0,
            }}>×</button>
          )}
        </div>
        {showGroupBtn && (
          <button onClick={() => setGrouped(g => !g)} style={{
            padding: "5px 9px", borderRadius: 8, cursor: "pointer",
            background: grouped ? "var(--t-pill-active-bg)" : "var(--t-icon-bg)",
            border: `1px solid ${grouped ? "var(--t-acc-50)" : "var(--t-icon-border)"}`,
            color: grouped ? "var(--t-pill-active-txt)" : "var(--t-pill-idle-txt)",
            fontFamily: "var(--font-mono)", fontSize: 10,
            whiteSpace: "nowrap",
          }}>{grouped ? "⊟ flat" : "⊞ group"}</button>
        )}
        {type === "routes" && (
          <div style={{ display: "flex", gap: 3 }}>
            {[["count", "×"], ["km-desc", "↓km"], ["km-asc", "↑km"]].map(([val, label]) => (
              <button key={val} onClick={() => setRouteSort(val)} style={{
                padding: "5px 7px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap",
                background: routeSort === val ? "var(--t-pill-active-bg)" : "var(--t-icon-bg)",
                border: `1px solid ${routeSort === val ? "var(--t-acc-50)" : "var(--t-icon-border)"}`,
                color: routeSort === val ? "var(--t-pill-active-txt)" : "var(--t-pill-idle-txt)",
                fontFamily: "var(--font-mono)", fontSize: 10,
              }}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Selected flight card */}
      {selectedFlight && (type === "flights" || type === "distance" || type === "nextday" || type === "birthday") && (() => {
        const sf = selectedFlight;
        const durMins = parseDurMins(sf.Duration);
        const hasTime = sf.Date && sf.Date.length > 10;
        const depTime = hasTime ? fmtTime(sf.dateObj) : null;
        const arrDate = (hasTime && durMins > 0) ? new Date(sf.dateObj.getTime() + durMins * 60000) : null;
        const arrTime = arrDate ? fmtTime(arrDate) : null;
        const nextDay = arrDate && sf.dateObj && arrDate.getDate() !== sf.dateObj.getDate();
        const seatLabel = { W: "Window", A: "Aisle", M: "Middle" }[sf.Seat_Type] || sf.Seat_Type || "";
        const classLabel = { Y: "Economy", J: "Business", F: "First" }[sf.Class] || sf.Class || "";
        const monoRow = { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", marginTop: 4 };
        return (
          <div style={{
            padding: "14px 16px", borderRadius: 12, marginBottom: 12,
            background: "linear-gradient(135deg, rgba(108,92,231,0.2) 0%, rgba(0,210,160,0.1) 100%)",
            border: "1px solid var(--t-acc-30)",
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, marginBottom: 6, color: "var(--t-fg)" }}>
              {sf.Flight_Number || "—"} · {sf.Airline || "—"}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--t-accent)", marginBottom: 4 }}>
              {sf.From} → {sf.To}
              {sf.distanceKm > 0 && <span style={{ color: "var(--t-fg3)", fontSize: 11, marginLeft: 8 }}>{fmtNum(sf.distanceKm)} km</span>}
            </div>
            {/* Date + departure/arrival times */}
            <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--t-fg2)", marginBottom: 2 }}>
              {fmtDate(sf.dateObj)}
              {depTime && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginLeft: 8 }}>
                  {depTime}
                  {arrTime && (
                    <>
                      <span style={{ color: "var(--t-fg3)", margin: "0 4px" }}>→</span>
                      {arrTime}
                      {nextDay && (
                        <span style={{
                          display: "inline-block", marginLeft: 4,
                          background: "rgba(253,203,110,0.25)", color: "#FDCB6E",
                          borderRadius: 4, padding: "0 4px", fontSize: 9, fontWeight: 700, verticalAlign: "middle",
                        }}>+1</span>
                      )}
                    </>
                  )}
                </span>
              )}
              {durMins > 0 && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", marginLeft: 8 }}>
                  {fmtDur(durMins)}
                </span>
              )}
            </div>
            {/* Seat / class / reason */}
            {(sf.Seat || seatLabel || classLabel || sf.Reason) && (
              <div style={monoRow}>
                {[sf.Seat, seatLabel, classLabel, reasonLabel[sf.Reason] || ""].filter(Boolean).join(" · ")}
              </div>
            )}
            {/* Aircraft + registration */}
            {(sf.Plane || sf.Registration) && (
              <div style={monoRow}>
                {[acName(sf.Plane), sf.Registration].filter(Boolean).join(" · ")}
              </div>
            )}
            {/* Trip tag */}
            {sf.Trip && (
              <div style={{ ...monoRow, color: "var(--t-fg2)" }}>
                <span style={{ color: "var(--t-fg3)" }}>trip </span>{sf.Trip}
              </div>
            )}
            {/* Note */}
            {sf.Note && (
              <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--t-fg2)", marginTop: 4, fontStyle: "italic" }}>
                {sf.Note}
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ flex: 1, overflowY: "auto", margin: "0 -14px", padding: "0 14px" }}>
        {grouped ? renderGrouped() : (
          <>
            {(type === "flights" || type === "distance" || type === "nextday" || type === "birthday") && filteredData.map((f) => (
              <div key={f.id} onClick={() => onFlightSelect(selectedFlight?.id === f.id ? null : f)}
                style={{ ...rowStyle, background: selectedFlight?.id === f.id ? "var(--t-acc-12)" : "transparent" }}
                onMouseEnter={(e) => { if (selectedFlight?.id !== f.id) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = selectedFlight?.id === f.id ? "var(--t-acc-12)" : "transparent"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#00D2A0" }}>{f.From}</span>
                    <span style={{ color: "var(--t-fg3)", fontSize: 11, margin: "0 4px" }}>→</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#00D2A0" }}>{f.To}</span>
                    <span style={{ fontSize: 11, color: "var(--t-fg2)", marginLeft: 8 }}>{f.Airline || ""}</span>
                    {f.Flight_Number && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", marginLeft: 6 }}>{f.Flight_Number}</span>}
                  </div>
                  {type === "distance" && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#FDCB6E" }}>{fmtNum(f.distanceKm)} km</span>
                  )}
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--t-fg3)", marginTop: 2 }}>
                  {fmtDate(f.dateObj)} {f.Plane ? `· ${acName(f.Plane)}` : ""}
                </div>
              </div>
            ))}

            {type === "countries" && filteredData.map(c => renderCountryRow(c))}

            {type === "airports" && filteredData.map((a) => {
              const isFocused = focusedAirport === a.iata;
              const enr = window.AIRPORT_ENRICHMENT?.[a.iata];
              return (
                <div key={a.iata} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div
                    style={{ ...rowStyle, borderBottom: "none", ...(isFocused ? focusedRowExtra : {}), display: "flex", alignItems: "center" }}
                    onClick={() => onAirportClick && onAirportClick(a.iata)}
                    onMouseEnter={e => { if (!isFocused) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isFocused ? "var(--t-acc-12)" : "transparent"; }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#00D2A0", marginRight: 8 }}>{a.iata}</span>
                    {enr?.icao && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-fg4)", marginRight: 6 }}>{enr.icao}</span>}
                    {a.flag && <span style={{ marginRight: 4 }}>{a.flag}</span>}
                    <span style={{ fontSize: 12 }}>{a.city}</span>
                    {enr?.elev && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-fg4)", marginLeft: 6 }}>{fmtNum(enr.elev)}ft</span>}
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", marginLeft: "auto" }}>×{a.count}</span>
                  </div>
                  {isFocused && (() => {
                    const apFlights = flights.filter(f => f.From === a.iata || f.To === a.iata);
                    if (apFlights.length === 0) return null;
                    const dates = apFlights.map(f => f.dateObj).sort((x, y) => x - y);
                    const connMap = {};
                    apFlights.forEach(f => {
                      const other = f.From === a.iata ? f.To : f.From;
                      connMap[other] = (connMap[other] || 0) + 1;
                    });
                    const topConn = Object.entries(connMap).sort((x, y) => y[1] - x[1]).slice(0, 6);
                    const airlines = [...new Set(apFlights.map(f => f.Airline).filter(Boolean))];
                    const deps = apFlights.filter(f => f.From === a.iata).length;
                    const arrs = apFlights.filter(f => f.To === a.iata).length;
                    return (
                      <div style={{ padding: "8px 14px 10px 14px", background: "var(--t-acc-06)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ display: "flex", gap: 14, marginBottom: 5, fontFamily: "var(--font-body)", fontSize: 10, color: "var(--t-fg3)" }}>
                          <span>first <span style={{ color: "var(--t-fg2)" }}>{fmtDate(dates[0])}</span></span>
                          <span>last <span style={{ color: "var(--t-fg2)" }}>{fmtDate(dates[dates.length - 1])}</span></span>
                          <span>↑{deps} ↓{arrs}</span>
                        </div>
                        {airlines.length > 0 && (
                          <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--t-fg3)", marginBottom: 6 }}>
                            via {airlines.slice(0, 4).join(" · ")}
                            {airlines.length > 4 && <span style={{ color: "var(--t-fg4)" }}> +{airlines.length - 4}</span>}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {topConn.map(([iata, n]) => (
                            <span key={iata} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#00D2A0",
                              background: "rgba(0,210,160,0.08)", borderRadius: 4, padding: "2px 7px" }}>
                              {iata} <span style={{ color: "var(--t-fg4)" }}>×{n}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}

            {type === "airlines" && filteredData.map((a) => {
              const isFocused = focusedAirline === a.name;
              return (
                <div key={a.name}
                  style={{ ...rowStyle, ...(isFocused ? focusedRowExtra : {}), display: "flex", alignItems: "center" }}
                  onClick={() => onAirlineClick && onAirlineClick(a.name)}
                  onMouseEnter={e => { if (!isFocused) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isFocused ? "var(--t-acc-12)" : "transparent"; }}
                >
                  {arcColorMode === "airline" && airlineColorMap && (
                    <span style={{
                      width: 8, height: 8, borderRadius: 999, display: "inline-block", marginRight: 6, flexShrink: 0,
                      background: airlineColorMap[a.name] || "#6E6A82",
                    }} />
                  )}
                  <span style={{ fontSize: 12 }}>{a.name}</span>
                  {a.iata && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 300, color: "var(--t-fg3)", marginLeft: 6 }}>{a.iata}</span>}
                  {AIRLINE_ALLIANCES[a.name] && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                      color: ALLIANCE_COLORS[AIRLINE_ALLIANCES[a.name]],
                      border: `1px solid ${ALLIANCE_COLORS[AIRLINE_ALLIANCES[a.name]]}`,
                      borderRadius: 4, padding: "1px 5px", marginLeft: 6, flexShrink: 0 }}>
                      {ALLIANCE_SHORT[AIRLINE_ALLIANCES[a.name]]} {AIRLINE_ALLIANCES[a.name]}
                    </span>
                  )}
                  {AIRLINE_MM.has(a.name) && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                      color: "#1E1B2E", background: MM_COLOR,
                      borderRadius: 4, padding: "1px 4px", marginLeft: 6, flexShrink: 0, fontWeight: 700 }}>
                      M&amp;M
                    </span>
                  )}
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", marginLeft: "auto" }}>×{a.count}</span>
                </div>
              );
            })}

            {type === "aircraft" && filteredData.map((a) => {
              const isFocused = focusedAircraft === a.name;
              return (
                <div key={a.name}
                  style={{ ...rowStyle, ...(isFocused ? focusedRowExtra : {}), display: "flex", alignItems: "center" }}
                  onClick={() => onAircraftClick && onAircraftClick(a.name)}
                  onMouseEnter={e => { if (!isFocused) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isFocused ? "var(--t-acc-12)" : "transparent"; }}
                >
                  <span style={{ fontSize: 12 }}>{acName(a.name)}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg4)", marginLeft: 6 }}>{a.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", marginLeft: "auto" }}>×{a.count}</span>
                </div>
              );
            })}

            {type === "duration" && filteredData.map(f => (
              <div key={f.id} onClick={() => onFlightSelect(selectedFlight?.id === f.id ? null : f)}
                style={{ ...rowStyle, background: selectedFlight?.id === f.id ? "var(--t-acc-12)" : "transparent" }}
                onMouseEnter={e => { if (selectedFlight?.id !== f.id) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = selectedFlight?.id === f.id ? "var(--t-acc-12)" : "transparent"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#00D2A0" }}>{f.From} → {f.To}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#74B9FF" }}>{fmtDur(f.durMins)}</span>
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--t-fg3)", marginTop: 2 }}>
                  {fmtDate(f.dateObj)} · {f.Airline || ""}
                </div>
              </div>
            ))}

            {type === "seats" && filteredData.map(s => (
              <div key={s.seat}
                style={{ ...rowStyle, display: "flex", alignItems: "center" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--t-accent)", minWidth: 40 }}>{s.seat}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", marginLeft: "auto" }}>×{s.count}</span>
              </div>
            ))}

            {type === "trips" && filteredData.map(t => renderTripRow(t))}

            {type === "routes" && (() => {
              const sortedRoutes = routeSort === "km-desc"
                ? [...filteredData].sort((a, b) => b.avgDist - a.avgDist)
                : routeSort === "km-asc"
                  ? [...filteredData].sort((a, b) => a.avgDist - b.avgDist)
                  : filteredData;
              return sortedRoutes.map(r => {
              const apFrom = window.AIRPORTS[r.from];
              const apTo   = window.AIRPORTS[r.to];
              const isoFrom = apFrom ? COUNTRY_NAME_TO_ISO[apFrom.country] : null;
              const isoTo   = apTo   ? COUNTRY_NAME_TO_ISO[apTo.country]   : null;
              const isFocused = focusedRoute && (
                (focusedRoute.from === r.from && focusedRoute.to === r.to) ||
                (focusedRoute.from === r.to   && focusedRoute.to === r.from)
              );
              return (
                <div key={r.key}
                  style={{ ...rowStyle, ...(isFocused ? focusedRowExtra : {}) }}
                  onClick={() => onRouteClick && onRouteClick({ from: r.from, to: r.to })}
                  onMouseEnter={e => { if (!isFocused) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isFocused ? "var(--t-acc-12)" : "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {isoFrom && <span style={{ marginRight: 3 }}>{isoToFlag(isoFrom)}</span>}
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#00D2A0" }}>{r.from}</span>
                    <span style={{ color: "var(--t-fg3)", fontSize: 11, margin: "0 6px" }}>⟷</span>
                    {isoTo && <span style={{ marginRight: 3 }}>{isoToFlag(isoTo)}</span>}
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#00D2A0" }}>{r.to}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", marginLeft: "auto" }}>×{r.count}</span>
                  </div>
                  {r.avgDist > 0 && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg4)", marginTop: 2 }}>{fmtNum(r.avgDist)} km avg</div>
                  )}
                  {isFocused && r.airlines.length > 0 && (
                    <div style={{ ...subStyle, marginTop: 4, color: "var(--t-fg2)" }}>
                      {r.airlines.join(" · ")}
                    </div>
                  )}
                </div>
              );
            });
            })()}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Countries sidebar ── */

function CountriesSidebar({ activeMembers, countriesData, memberColors, isoToName, onCountryClick, focusedCountry, chartWidth, activeYear, onYearClick }) {
  const [detailView, setDetailView] = useState(null);  // null | "countries"
  const [countrySearch, setCountrySearch] = useState("");
  const [countryGrouped, setCountryGrouped] = useState(false);

  const countryList = useMemo(() => {
    const cd = countriesData;
    if (!cd?.countries) return [];
    const byIso = new Map();
    cd.countries.forEach(c => {
      const iso = c.iso;
      if (!byIso.has(iso)) byIso.set(iso, { iso, names: [], visits: {} });
      const entry = byIso.get(iso);
      if (!entry.names.includes(c.country)) entry.names.push(c.country);
      Object.entries(c.visits).forEach(([memberId, year]) => {
        if (activeMembers.has(memberId)) {
          if (!entry.visits[memberId] || year < entry.visits[memberId]) {
            entry.visits[memberId] = year;
          }
        }
      });
    });
    return [...byIso.values()]
      .filter(c => Object.keys(c.visits).length === activeMembers.size)
      .sort((a, b) => {
        const maxA = Math.max(...Object.values(a.visits));
        const maxB = Math.max(...Object.values(b.visits));
        return maxB - maxA || a.names[0].localeCompare(b.names[0]);
      });
  }, [activeMembers, countriesData]);

  const totalCountries = countryList.length;
  const activeMemberCount = activeMembers.size;

  // Individual totals per member (not intersection-gated)
  const individualMemberCounts = useMemo(() => {
    const counts = {};
    const cd = countriesData;
    if (!cd?.countries) return counts;
    cd.countries.forEach(c => {
      activeMembers.forEach(id => {
        if (c.visits?.[id]) counts[id] = (counts[id] || 0) + 1;
      });
    });
    return counts;
  }, [activeMembers, countriesData]);

  const journeySpan = useMemo(() => {
    let earliest = { year: 9999, country: "", iso: "" };
    let latest   = { year: 0,    country: "", iso: "" };
    countryList.forEach(c => {
      Object.values(c.visits).forEach(yr => {
        if (yr < earliest.year) earliest = { year: yr, country: c.names[0], iso: c.iso };
        if (yr > latest.year)   latest   = { year: yr, country: c.names[0], iso: c.iso };
      });
    });
    return { earliest, latest };
  }, [countryList]);

  const rowStyle = { padding: "8px 12px", borderRadius: 10, cursor: "pointer", transition: "background 0.12s" };

  // ── Detail list view (countries) ──────────────────────────────────────────
  if (detailView === "countries") {
    const filteredCountries = countrySearch.trim()
      ? countryList.filter(c => c.names[0].toLowerCase().includes(countrySearch.trim().toLowerCase()))
      : countryList;

    const CountryRow = ({ c }) => (
      <div key={c.iso}
        onClick={() => onCountryClick && onCountryClick(c.iso)}
        style={{
          ...rowStyle,
          background: focusedCountry === c.iso ? "var(--t-acc-12)" : "transparent",
          borderLeft: focusedCountry === c.iso ? "2px solid #6C5CE7" : "2px solid transparent",
        }}
        onMouseEnter={e => { if (focusedCountry !== c.iso) e.currentTarget.style.background = "var(--t-over-04)"; }}
        onMouseLeave={e => { if (focusedCountry !== c.iso) e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--t-fg)" }}>{isoToFlag(c.iso.split("-")[0])} {c.names[0]}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px", marginTop: 3 }}>
          {Object.entries(c.visits).sort((a, b) => a[1] - b[1]).map(([id, yr]) => (
            <span key={id} style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
              <span style={{ color: memberColors[id] || "var(--t-accent)" }}>●</span>{" "}
              <span style={{ color: "var(--t-fg2)" }}>{id.charAt(0).toUpperCase() + id.slice(1)} {yr}</span>
            </span>
          ))}
        </div>
      </div>
    );

    return (
      <>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            // countries ({countrySearch.trim() ? `${filteredCountries.length} of ${totalCountries}` : totalCountries})
          </div>
          <div onClick={() => { setDetailView(null); setCountrySearch(""); setCountryGrouped(false); }}
            style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--t-accent)", cursor: "pointer", userSelect: "none" }}
          >← back</div>
        </div>
        {/* Search + group toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
              placeholder="search countries..."
              style={{ width: "100%", padding: "5px 28px 5px 10px", borderRadius: 8, boxSizing: "border-box",
                background: "var(--t-icon-bg)", border: "1px solid var(--t-icon-border)",
                color: "var(--t-icon-txt)", fontFamily: "var(--font-mono)", fontSize: 11, outline: "none" }} />
            {countrySearch && (
              <button onClick={() => setCountrySearch("")} style={{
                position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                background: "transparent", border: "none", color: "var(--t-fg3)",
                cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            )}
          </div>
          <button onClick={() => setCountryGrouped(g => !g)} style={{
            padding: "5px 9px", borderRadius: 8, cursor: "pointer",
            background: countryGrouped ? "var(--t-pill-active-bg)" : "var(--t-icon-bg)",
            border: `1px solid ${countryGrouped ? "var(--t-acc-50)" : "var(--t-icon-border)"}`,
            color: countryGrouped ? "var(--t-pill-active-txt)" : "var(--t-pill-idle-txt)",
            fontFamily: "var(--font-mono)", fontSize: 10, whiteSpace: "nowrap" }}>
            {countryGrouped ? "⊟ flat" : "⊞ continent"}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, overflowY: "auto", flex: 1 }}>
          {countryGrouped ? (() => {
            const byContinent = new Map();
            filteredCountries.forEach(c => {
              const cont = ISO_TO_CONTINENT[c.iso.split("-")[0]] || "OC";
              if (!byContinent.has(cont)) byContinent.set(cont, []);
              byContinent.get(cont).push(c);
            });
            return [...byContinent.entries()].sort((a, b) => (CONTINENT_NAMES[a[0]] || a[0]).localeCompare(CONTINENT_NAMES[b[0]] || b[0])).map(([cont, items]) => (
              <div key={cont}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-fg3)", textTransform: "uppercase", letterSpacing: 0.6, padding: "10px 12px 4px" }}>
                  // {CONTINENT_NAMES[cont] || cont} ({items.length})
                </div>
                {items.map(c => <CountryRow key={c.iso} c={c} />)}
              </div>
            ));
          })() : filteredCountries.map(c => <CountryRow key={c.iso} c={c} />)}
        </div>
      </>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Section label */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", letterSpacing: 0.5 }}>
        // {[...activeMembers].join(", ") || "none"} · countries
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <StatCard label="Countries" value={totalCountries} color="#55EFC4" sub="visited"
          onClick={() => setDetailView("countries")} />
        <StatCard label="Members"   value={activeMemberCount} sub="selected" />
        <StatCard label="Since"     value={journeySpan.earliest.year < 9999 ? journeySpan.earliest.year : "—"} sub="first visit" />
      </div>

      {/* Chart */}
      {window.StatsChart && totalCountries > 0 && (
        <window.StatsChart mode="countries" allFlights={[]} countriesData={countriesData} activeMembers={activeMembers}
          width={chartWidth}
          activeYear={activeYear}
          onYearClick={onYearClick}
        />
      )}

      {/* THE JOURNEY card — near top for context */}
      {totalCountries > 0 && (
        <div style={{
          padding: "14px 16px", borderRadius: 14,
          background: "linear-gradient(135deg, rgba(108,92,231,0.15) 0%, rgba(0,210,160,0.10) 100%)",
          border: "1px solid var(--t-acc-25)",
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-accent)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            // THE JOURNEY
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--t-fg2)" }}>
                {isoToFlag(journeySpan.earliest.iso)} {journeySpan.earliest.country}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>
                {journeySpan.earliest.year < 9999 ? journeySpan.earliest.year : "—"}
              </div>
            </div>
            <div style={{ flex: 2, position: "relative", height: 24 }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, background: "linear-gradient(90deg, #6C5CE7, #FF6B6B, #00D2A0, #FDCB6E)", borderRadius: 2, transform: "translateY(-50%)" }} />
              <div style={{ position: "absolute", left: 0, top: "50%", width: 8, height: 8, borderRadius: 999, background: "#6C5CE7", transform: "translate(-50%, -50%)" }} />
              <div style={{ position: "absolute", right: 0, top: "50%", width: 8, height: 8, borderRadius: 999, background: "#FDCB6E", transform: "translate(50%, -50%)" }} />
            </div>
            <div style={{ flex: 1, textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--t-fg2)" }}>
                {isoToFlag(journeySpan.latest.iso)} {journeySpan.latest.country}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>
                {journeySpan.latest.year > 0 ? journeySpan.latest.year : "—"}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--t-fg2)" }}>
            <span style={{ color: "var(--t-fg)", fontWeight: 500 }}>{totalCountries} {totalCountries === 1 ? "country" : "countries"}</span>
            {journeySpan.earliest.year < 9999 && journeySpan.latest.year > 0 && (
              <> across <span style={{ color: "var(--t-fg)", fontWeight: 500 }}>{journeySpan.latest.year - journeySpan.earliest.year} years</span></>
            )}
          </div>
        </div>
      )}

      {/* Per-member counts — individual totals (not intersection) */}
      {activeMemberCount > 0 && (
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            // per member
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[...activeMembers].map(id => (
              <div key={id} style={{
                padding: "4px 10px", borderRadius: 999,
                background: (memberColors[id] || "#A29BFE") + "20",
                border: "1px solid " + (memberColors[id] || "#A29BFE") + "40",
                fontFamily: "var(--font-mono)", fontSize: 11,
                color: memberColors[id] || "#A29BFE",
              }}>
                {id.charAt(0).toUpperCase() + id.slice(1)}{" "}
                <span style={{ color: "var(--t-fg3)" }}>{individualMemberCounts[id] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Country list — top 5 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          // recent countries
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {countryList.slice(0, 5).map(c => (
            <div key={c.iso}
              onClick={() => onCountryClick && onCountryClick(c.iso)}
              style={{
                ...rowStyle,
                background: focusedCountry === c.iso ? "var(--t-acc-12)" : "transparent",
                borderLeft: focusedCountry === c.iso ? "2px solid #6C5CE7" : "2px solid transparent",
              }}
              onMouseEnter={e => { if (focusedCountry !== c.iso) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={e => { if (focusedCountry !== c.iso) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ fontSize: 13, fontWeight: 500 }}>{isoToFlag(c.iso.split("-")[0])} {c.names[0]}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px", marginTop: 3 }}>
                {Object.entries(c.visits).sort((a, b) => a[1] - b[1]).map(([id, yr]) => (
                  <span key={id} style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
                    <span style={{ color: memberColors[id] || "#A29BFE" }}>●</span>{" "}
                    <span style={{ color: "var(--t-fg2)" }}>{id.charAt(0).toUpperCase() + id.slice(1)} {yr}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {totalCountries > 5 && (
          <div
            onClick={() => setDetailView("countries")}
            style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--t-accent)", cursor: "pointer", userSelect: "none" }}
            onMouseEnter={e => e.currentTarget.style.color = "#6C5CE7"}
            onMouseLeave={e => e.currentTarget.style.color = "#A29BFE"}
          >
            → all {totalCountries} countries
          </div>
        )}
      </div>
    </>
  );
}

/* ── Main App ── */

function App() {
  const [activeMembers, setActiveMembers] = useState(new Set());
  const [appMode, setAppMode] = useState("countries");  // "countries" | "flights"
  const [year, setYear] = useState("all");
  const [mode, setMode] = useState("3d");
  const [focusedAirport, setFocusedAirport] = useState(null);
  const [focusedCountry, setFocusedCountry] = useState(null);
  const [focusedAirline, setFocusedAirline] = useState(null);
  const [focusedAircraft, setFocusedAircraft] = useState(null);
  const [focusedRoute, setFocusedRoute] = useState(null);
  const [focusedCity, setFocusedCity] = useState(null);
  const [focusedTrip, setFocusedTrip] = useState(null);
  const [focusedActivityType, setFocusedActivityType] = useState(null);
  const [tripViewMode, setTripViewMode] = useState("day");
  const [focusedReason, setFocusedReason] = useState(null);
  const [focusedClass, setFocusedClass] = useState(null);
  const [focusedSeatType, setFocusedSeatType] = useState(null);
  const [routeDetailSort, setRouteDetailSort] = useState("count");
  const [hoverCountry, setHoverCountry] = useState(null);
  const [hoverAirport, setHoverAirport] = useState(null);
  const [hoverArc, setHoverArc] = useState(null);
  const [countries, setCountries] = useState(null);
  const [dataReady, setDataReady] = useState(false);
  const [arcColorMode, setArcColorMode] = useState("reason");
  const [mapColorTheme, setMapColorTheme] = useState("pulse");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [detailView, setDetailView] = useState(null);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [showLabels, setShowLabels] = useState(false);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showQualityPanel, setShowQualityPanel] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [airlinesIndex, setAirlinesIndex] = useState(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [autoplayMode, setAutoplayMode] = useState(false);
  const [autoplayState, setAutoplayState] = useState(null);
  const [tripPlaying, setTripPlaying] = useState(false);
  const mapPanelRef = useRef(null);
  const mainPanelRef = useRef(null);
  const sidebarRef = useRef(null);
  const memberDropdownCollapseRef = useRef(null);
  const urlRestoredRef = useRef(false);

  const clearFocus = () => {
    setFocusedAirport(null); setFocusedCountry(null); setFocusedAirline(null);
    setFocusedAircraft(null); setFocusedRoute(null); setFocusedCity(null);
    setFocusedTrip(null); setFocusedActivityType(null); setFocusedReason(null);
    setFocusedClass(null); setFocusedSeatType(null); setDetailView(null);
    setSelectedFlight(null);
  };

  const toggleFocusCountry = useCallback((iso) => {
    setFocusedCountry(p => p === iso ? null : iso);
    setFocusedAirport(null); setFocusedAirline(null); setFocusedAircraft(null);
    setFocusedRoute(null); setFocusedCity(null); setFocusedTrip(null);
  }, []);

  const toggleFocusAirport = useCallback((iata) => {
    setFocusedAirport(p => p === iata ? null : iata);
    setFocusedCountry(null); setFocusedAirline(null); setFocusedAircraft(null);
    setFocusedRoute(null); setFocusedCity(null); setFocusedTrip(null);
  }, []);

  const toggleFocusAirline = useCallback((name) => {
    setFocusedAirline(p => p === name ? null : name);
    setFocusedAirport(null); setFocusedCountry(null); setFocusedAircraft(null);
    setFocusedRoute(null); setFocusedCity(null); setFocusedTrip(null);
  }, []);

  const toggleFocusCity = useCallback((city) => {
    setFocusedCity(p => p === city ? null : city);
    setFocusedAirport(null); setFocusedCountry(null); setFocusedAirline(null);
    setFocusedAircraft(null); setFocusedRoute(null); setFocusedTrip(null);
  }, []);

  const toggleFocusAircraft = useCallback((name) => {
    setFocusedAircraft(p => p === name ? null : name);
    setFocusedAirport(null); setFocusedCountry(null); setFocusedAirline(null);
    setFocusedRoute(null); setFocusedCity(null); setFocusedTrip(null);
  }, []);

  const toggleFocusTrip = useCallback((code) => {
    setFocusedTrip(p => p === code ? null : code);
    setFocusedAirport(null); setFocusedCountry(null); setFocusedAirline(null);
    setFocusedAircraft(null); setFocusedRoute(null); setFocusedCity(null);
  }, []);

  const toggleFocusReason = useCallback((r) => {
    setFocusedReason(p => p === r ? null : r);
    setFocusedAirport(null); setFocusedCountry(null); setFocusedAirline(null);
    setFocusedAircraft(null); setFocusedRoute(null); setFocusedCity(null); setFocusedTrip(null);
    setFocusedClass(null); setFocusedSeatType(null);
  }, []);

  const toggleFocusClass = useCallback((label) => {
    setFocusedClass(p => p === label ? null : label);
    setFocusedAirport(null); setFocusedCountry(null); setFocusedAirline(null);
    setFocusedAircraft(null); setFocusedRoute(null); setFocusedCity(null); setFocusedTrip(null);
    setFocusedReason(null); setFocusedSeatType(null);
  }, []);

  const toggleFocusSeatType = useCallback((label) => {
    setFocusedSeatType(p => p === label ? null : label);
    setFocusedAirport(null); setFocusedCountry(null); setFocusedAirline(null);
    setFocusedAircraft(null); setFocusedRoute(null); setFocusedCity(null); setFocusedTrip(null);
    setFocusedReason(null); setFocusedClass(null);
  }, []);

  const toggleMember = useCallback((id) => {
    setActiveMembers(prev => {
      const all = new Set((window.MEMBER_LIST || []).map(m => m.id));
      // Solo: active member clicked while others also active → isolate just this one
      if (prev.size > 1 && prev.has(id)) return new Set([id]);
      // Un-solo: only this member active → restore all
      if (prev.size === 1 && prev.has(id)) return all;
      // Otherwise: toggle in/out
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAllMembers = useCallback(() => {
    const members = window.MEMBER_LIST || [];
    setActiveMembers(new Set(members.map(m => m.id)));
  }, []);

  const switchMode = useCallback((newMode) => {
    setAppMode(newMode);
    clearFocus();
    setYear("all");
    setTripPlaying(false);
    setTripViewMode("day");
  }, []);

  const [lightMode, setLightMode] = useState(() => { const v = localStorage.getItem('flightLightMode'); return v === null ? true : v === '1'; });
  useEffect(() => {
    document.body.classList.toggle('light', lightMode);
    localStorage.setItem('flightLightMode', lightMode ? '1' : '0');
  }, [lightMode]);

  const [tweaks, setTweaks] = window.useTweaks
    ? window.useTweaks(TWEAK_DEFAULTS)
    : [TWEAK_DEFAULTS, () => {}];

  // Sync showLabels with tweaks
  useEffect(() => { setShowLabels(tweaks.showLabels); }, [tweaks.showLabels]);

  // Build member→color map dynamically from MEMBER_LIST order
  const MEMBER_COLORS = useMemo(() => buildMemberColors(window.MEMBER_LIST || []), [dataReady]);

  // Initialize all members selected once data is ready; restore URL state on first load
  useEffect(() => {
    if (!dataReady) return;
    const members = window.MEMBER_LIST || [];
    const allIds = new Set(members.map(m => m.id));

    if (!urlRestoredRef.current) {
      urlRestoredRef.current = true;
      const p = new URLSearchParams(window.location.search);

      // members
      if (p.has("mb")) {
        const ids = p.get("mb").split(",").filter(id => allIds.has(id));
        setActiveMembers(ids.length ? new Set(ids) : allIds);
      } else if (members.length > 0 && activeMembers.size === 0) {
        setActiveMembers(allIds);
      }

      // mode
      if (p.get("m") === "flights") setAppMode("flights");
      if (p.get("m") === "trips") setAppMode("trips");
      if (p.get("v") === "2d") setMode("2d");
      if (p.get("arc")) setArcColorMode(p.get("arc"));
      if (p.get("mct")) setMapColorTheme(p.get("mct"));
      if (p.get("yr")) setYear(p.get("yr"));
      if (p.get("dv")) setDetailView(p.get("dv"));
      if (p.get("ap")) setFocusedAirport(p.get("ap"));
      if (p.get("co")) setFocusedCountry(p.get("co"));
      if (p.get("al")) setFocusedAirline(p.get("al"));
      if (p.get("ac")) setFocusedAircraft(p.get("ac"));
      if (p.get("tr")) setFocusedTrip(p.get("tr"));
      if (p.get("at")) setFocusedActivityType(p.get("at"));
      if (p.get("tvm") === "list") setTripViewMode("list");
      if (p.get("ct")) setFocusedCity(p.get("ct"));
      if (p.get("ro")) {
        const parts = p.get("ro").split("-");
        if (parts.length === 2) setFocusedRoute({ from: parts[0], to: parts[1] });
      }
    } else if (members.length > 0 && activeMembers.size === 0) {
      setActiveMembers(allIds);
    }
  }, [dataReady]);

  // Sync state → URL (replaceState, no history entries)
  useEffect(() => {
    if (!urlRestoredRef.current) return;
    const p = new URLSearchParams();
    const allIds = (window.MEMBER_LIST || []).map(m => m.id);
    const membersSorted = [...activeMembers].sort();
    if (membersSorted.length > 0 && membersSorted.length < allIds.length) p.set("mb", membersSorted.join(","));
    if (appMode !== "countries") p.set("m", appMode);
    if (mode !== "3d") p.set("v", mode);
    if (arcColorMode !== "reason") p.set("arc", arcColorMode);
    if (mapColorTheme !== "pulse") p.set("mct", mapColorTheme);
    if (year !== "all") p.set("yr", year);
    if (detailView) p.set("dv", detailView);
    if (focusedAirport) p.set("ap", focusedAirport);
    if (focusedCountry) p.set("co", focusedCountry);
    if (focusedAirline) p.set("al", focusedAirline);
    if (focusedAircraft) p.set("ac", focusedAircraft);
    if (focusedRoute) p.set("ro", focusedRoute.from + "-" + focusedRoute.to);
    if (focusedTrip) p.set("tr", focusedTrip);
    if (focusedActivityType) p.set("at", focusedActivityType);
    if (tripViewMode !== "day") p.set("tvm", tripViewMode);
    if (focusedCity) p.set("ct", focusedCity);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [appMode, mode, activeMembers, year, detailView, focusedAirport, focusedCountry, focusedAirline, focusedAircraft, focusedRoute, focusedTrip, focusedActivityType, tripViewMode, focusedCity, arcColorMode, mapColorTheme]);

  useEffect(() => {
    const onLoaded = () => setDataReady(true);
    window.addEventListener("flights-loaded", onLoaded);
    if (window.loadAllFlights) {
      window.loadAllFlights();
    } else {
      setDataReady(true);
    }
    return () => window.removeEventListener("flights-loaded", onLoaded);
  }, []);

  const reloadData = useCallback(() => {
    if (!window.loadAllFlights) return;
    setDataReady(false);
    setActiveMembers(new Set());
    window.loadAllFlights();
  }, []);

  // Load airlines index for quality checks
  useEffect(() => {
    fetch("master_data/airlines_by_iata.json").then(r => r.ok ? r.json() : null).then(d => { if (d) setAirlinesIndex(d); }).catch(() => {});
  }, []);

  // Data quality checker — groups repeated issue types with counts
  const dataQuality = useMemo(() => {
    if (!dataReady) return { errors: [], warnings: [], errorCount: 0, warnCount: 0 };
    const airports = window.AIRPORTS || {};
    const countries = window.COUNTRIES_DATA?.countries || [];

    function parseDurMins(dur) {
      if (!dur) return null;
      if (dur.includes(":")) {
        const [h, m] = dur.split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
      }
      const n = parseFloat(dur);
      return isNaN(n) ? null : n;
    }

    // Collect all flights across all members
    const allMemberFlights = [];
    Object.entries(window.FLIGHTS || {}).forEach(([member, flights]) => {
      (flights || []).forEach(f => allMemberFlights.push({ ...f, _member: member }));
    });

    // Counters for groupable issues
    const missingDate = [], missingFrom = [], missingTo = [], missingAirline = [],
          missingDist = [], shortDur = [], longDur = [], badDur = [],
          missingOID = [];
    const unknownAirports = new Set();
    const warnMissingSeat = [], warnMissingClass = [], warnMissingPlane = [];

    // Airline lookup: use IATA code extracted from flight number (first 1-2 alpha chars)
    // This is more reliable than name matching since master data names differ (e.g. "Air India Limited" vs "Air India")
    const unknownAirlines = new Set();
    function airlineIataFromFlightNum(flightNum) {
      if (!flightNum) return null;
      const m = flightNum.trim().match(/^([A-Z0-9]{2})[^A-Z]/i) || flightNum.trim().match(/^([A-Z]{2,3})\d/i);
      return m ? m[1].toUpperCase() : null;
    }

    allMemberFlights.forEach(f => {
      const loc = `${(f.Date || "?").slice(0, 10)} ${f.From || "?"}→${f.To || "?"}`;
      if (!f.Date || isNaN(f.dateObj)) missingDate.push(loc);
      if (!f.From) missingFrom.push(loc);
      if (!f.To) missingTo.push(loc);
      if (!f.Airline) missingAirline.push(loc);
      if (!f.Distance || f.distanceKm === 0) missingDist.push(loc);

      if (f.From && !airports[f.From]) unknownAirports.add(f.From);
      if (f.To && !airports[f.To]) unknownAirports.add(f.To);

      // Airline check: resolve by IATA code from flight number first, fall back to name search
      if (airlinesIndex && f.Airline) {
        const iata = airlineIataFromFlightNum(f.Flight_Number);
        const resolvedByCode = iata && airlinesIndex[iata];
        if (!resolvedByCode) {
          // Fallback: partial name match (catches names not derivable from flight number)
          const nameLower = f.Airline.toLowerCase();
          const resolvedByName = Object.values(airlinesIndex).some(a =>
            a.name && (a.name.toLowerCase().includes(nameLower) || nameLower.includes(a.name.toLowerCase()))
          );
          if (!resolvedByName) unknownAirlines.add(f.Airline);
        }
      }

      const durMins = parseDurMins(f.Duration);
      if (durMins !== null) {
        if (durMins < 15) shortDur.push({ loc, dur: f.Duration });
        if (durMins > 1200) longDur.push({ loc, dur: f.Duration });
      } else if (f.Duration) {
        badDur.push({ loc, dur: f.Duration });
      }

      if (!f.Seat) warnMissingSeat.push(loc);
      if (!f.Class) warnMissingClass.push(loc);
      if (!f.Plane) warnMissingPlane.push(loc);
    });

    // Country ISO validity — accept ISO 3166-1 alpha-2 (GB) and ISO 3166-2 subdivisions (GB-ENG)
    const badCountries = [];
    countries.forEach(c => {
      if (c.iso && !/^[A-Z]{2}(-[A-Z0-9]+)?$/.test(c.iso)) badCountries.push(`${c.country} (${c.iso})`);
    });

    // Build grouped error/warning items
    const errors = [];
    const warnings = [];

    function addGroup(arr, msg, detail, isError) {
      if (!arr.length) return;
      const locs = arr.slice(0, 5).map(x => typeof x === "string" ? x : x.loc);
      const extra = arr.length > 5 ? ` +${arr.length - 5} more` : "";
      const entry = { msg: `${msg} (${arr.length})`, loc: locs.join(", ") + extra };
      if (isError) errors.push(entry); else warnings.push(entry);
    }

    addGroup(missingDate,    "Missing/invalid date",           null, true);
    addGroup(missingFrom,    "Missing origin airport code",    null, true);
    addGroup(missingTo,      "Missing destination airport code", null, true);
    addGroup(missingAirline, "Missing airline",                null, true);
    addGroup(missingDist,    "Missing distance",               null, true);
    shortDur.forEach(x => errors.push({ msg: `Duration too short (${x.dur})`, loc: x.loc }));
    longDur.forEach(x => errors.push({ msg: `Duration too long (${x.dur})`, loc: x.loc }));
    badDur.forEach(x => errors.push({ msg: `Unparseable duration "${x.dur}"`, loc: x.loc }));
    unknownAirports.forEach(iata => errors.push({ msg: `Airport "${iata}" not in master data`, loc: iata }));
    unknownAirlines.forEach(name => errors.push({ msg: `Airline "${name}" not in master data`, loc: name }));
    badCountries.forEach(c => errors.push({ msg: `Invalid country ISO code`, loc: c }));

    addGroup(warnMissingSeat,  "Missing seat number",  null, false);
    addGroup(warnMissingPlane, "Missing aircraft type", null, false);
    addGroup(warnMissingClass, "Missing cabin class",   null, false);

    const errorCount = missingDate.length + missingFrom.length + missingTo.length +
      missingAirline.length + missingDist.length + shortDur.length + longDur.length +
      badDur.length + unknownAirports.size + unknownAirlines.size + badCountries.length;
    const warnCount = warnMissingSeat.length + warnMissingClass.length + warnMissingPlane.length;

    return { errors, warnings, errorCount, warnCount };
  }, [dataReady, airlinesIndex]);

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then((topo) => {
        const geo = window.topojson.feature(topo, topo.objects.countries);
        geo.features.forEach((f) => {
          const iso = window.NUMERIC_TO_ISO2[String(f.id).padStart(3, "0")];
          if (iso) f.properties.ISO_A2 = iso;
        });
        setCountries(geo);
      })
      .catch((e) => console.error("countries load failed", e));
  }, []);

  const isoToName = useMemo(() => {
    const m = {};
    if (countries && countries.features) {
      countries.features.forEach((f) => {
        const iso = f.properties.ISO_A2;
        const name = f.properties.NAME || f.properties.ADMIN || f.properties.name;
        if (iso) m[iso] = name;
      });
    }
    return m;
  }, [countries]);

  const countryCentroids = useMemo(() => {
    const map = {};
    if (!countries?.features || !window.d3) return map;
    countries.features.forEach(f => {
      const iso = f.properties.ISO_A2;
      if (!iso || iso === "-99") return;
      try {
        const [lon, lat] = window.d3.geoCentroid(f);
        map[iso.toUpperCase()] = { lat, lon };
      } catch (_) {}
    });
    return map;
  }, [countries]);

  const COUNTRY_NAME_TO_ISO = window.COUNTRY_NAME_TO_ISO_CHART = {
    "Albania": "AL", "Australia": "AU", "Austria": "AT",
    "Belgium": "BE", "Bhutan": "BT", "Canada": "CA",
    "China": "CN", "Croatia": "HR", "Cyprus": "CY",
    "Denmark": "DK", "Egypt": "EG", "Finland": "FI",
    "France": "FR", "Germany": "DE", "Greece": "GR",
    "Hong Kong": "HK", "Hungary": "HU", "Iceland": "IS",
    "India": "IN", "Indonesia": "ID", "Italy": "IT",
    "Japan": "JP", "Malaysia": "MY", "Malta": "MT",
    "Nepal": "NP", "Netherlands": "NL", "Norway": "NO",
    "Poland": "PL", "Portugal": "PT", "Saudi Arabia": "SA",
    "Serbia": "RS", "Singapore": "SG", "Spain": "ES",
    "Sri Lanka": "LK", "Switzerland": "CH", "Thailand": "TH",
    "Turkey": "TR", "Ukraine": "UA",
    "United Arab Emirates": "AE", "United Kingdom": "GB",
    "United States": "US",
  };

  const allFlights = useMemo(() => {
    if (appMode !== "flights") return [];
    const result = [];
    activeMembers.forEach(id => {
      if (window.FLIGHTS[id]) {
        window.FLIGHTS[id].forEach(f => result.push({ ...f, _member: id }));
      }
    });
    return result.sort((a, b) => b.dateObj - a.dateObj);
  }, [activeMembers, appMode, dataReady]);
  const years = useMemo(() => {
    return Array.from(new Set(allFlights.map((f) => f.year))).sort((a, b) => b - a);
  }, [allFlights]);

  const yearOptions = useMemo(() => {
    const counts = {};
    allFlights.forEach(f => { counts[f.year] = (counts[f.year] || 0) + 1; });
    return years.map(y => ({ value: String(y), label: String(y), count: counts[y] || 0 }));
  }, [years, allFlights]);

  const countriesYearOptions = useMemo(() => {
    const cd = window.COUNTRIES_DATA;
    if (!cd?.countries) return [];
    const counts = {};
    cd.countries.forEach(c => {
      activeMembers.forEach(id => {
        if (c.visits[id]) counts[c.visits[id]] = (counts[c.visits[id]] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => +b[0] - +a[0]).map(([y, count]) => ({ value: String(y), label: String(y), count }));
  }, [activeMembers, dataReady]);

  const countriesCountryOptions = useMemo(() => {
    const cd = window.COUNTRIES_DATA;
    if (!cd?.countries) return [];
    const m = new Map();
    cd.countries.forEach(c => {
      activeMembers.forEach(id => {
        if (c.visits[id]) m.set(c.iso, (m.get(c.iso) || 0) + 1);
      });
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([iso, count]) => ({
      value: iso, label: isoToName[iso] || iso, count, flag: isoToFlag(iso.split("-")[0]),
    }));
  }, [activeMembers, dataReady, isoToName]);

  // Multi-airport city groups (F6) — must be before filtered
  const cityGroups = useMemo(() => {
    const groups = {};
    Object.entries(window.AIRPORTS || {}).forEach(([iata, ap]) => {
      if (!ap.city) return;
      if (!groups[ap.city]) groups[ap.city] = [];
      groups[ap.city].push(iata);
    });
    return Object.fromEntries(Object.entries(groups).filter(([, aps]) => aps.length > 1));
  }, [dataReady]);

  const filtered = useMemo(() => {
    let f = allFlights;
    if (year !== "all") f = f.filter((x) => x.year === +year);
    if (focusedAirport) f = f.filter((x) => x.From === focusedAirport || x.To === focusedAirport);
    if (focusedAirline) f = f.filter((x) => x.Airline === focusedAirline);
    if (focusedAircraft) f = f.filter((x) => x.Plane === focusedAircraft);
    if (focusedCountry) {
      f = f.filter((x) => {
        const A = window.AIRPORTS[x.From], B = window.AIRPORTS[x.To];
        return (A && COUNTRY_NAME_TO_ISO[A.country] === focusedCountry) ||
               (B && COUNTRY_NAME_TO_ISO[B.country] === focusedCountry);
      });
    }
    if (focusedCity && cityGroups[focusedCity]) {
      const cityAps = new Set(cityGroups[focusedCity]);
      f = f.filter((x) => cityAps.has(x.From) || cityAps.has(x.To));
    }
    if (focusedRoute) {
      f = f.filter((x) =>
        (x.From === focusedRoute.from && x.To === focusedRoute.to) ||
        (x.From === focusedRoute.to && x.To === focusedRoute.from)
      );
    }
    if (focusedTrip) f = f.filter(x => x.Trip === focusedTrip);
    if (focusedReason) f = f.filter(x => x.Reason === focusedReason);
    if (focusedClass) {
      const cl = { Y:"Economy", C:"Business", F:"First", P:"Premium Economy", W:"Premium Economy", Q:"Economy" };
      f = f.filter(x => (cl[x.Class] || x.Class) === focusedClass);
    }
    if (focusedSeatType) {
      const st = { W:"Window", A:"Aisle", M:"Middle" };
      f = f.filter(x => (st[x.Seat_Type] || x.Seat_Type) === focusedSeatType);
    }
    return f;
  }, [allFlights, year, focusedAirport, focusedCity, focusedCountry, focusedAirline, focusedAircraft, focusedRoute, focusedTrip, focusedReason, focusedClass, focusedSeatType, cityGroups]);

  const visitedCounts = useMemo(() => {
    const counts = {};
    const yearFiltered = year === "all" ? allFlights : allFlights.filter((x) => x.year === +year);
    yearFiltered.forEach((f) => {
      const A = window.AIRPORTS[f.From], B = window.AIRPORTS[f.To];
      if (A) { const iso = COUNTRY_NAME_TO_ISO[A.country]; if (iso) counts[iso] = (counts[iso] || 0) + 1; }
      if (B) { const iso = COUNTRY_NAME_TO_ISO[B.country]; if (iso) counts[iso] = (counts[iso] || 0) + 1; }
    });
    return counts;
  }, [allFlights, year]);

  // Countries-mode: build visitedCounts from COUNTRIES_DATA CSV instead of flight data
  const countriesVisitedCounts = useMemo(() => {
    const counts = {};
    const cd = window.COUNTRIES_DATA;
    if (!cd?.countries) return counts;
    const filterYear = year !== "all" ? +year : null;
    cd.countries.forEach(c => {
      const iso = c.iso.includes("-") ? c.iso.split("-")[0] : c.iso;
      let memberCount = 0;
      activeMembers.forEach(id => {
        const visitYear = c.visits[id];
        if (visitYear && (!filterYear || visitYear === filterYear)) memberCount++;
      });
      if (memberCount === activeMembers.size) counts[iso] = Math.max(counts[iso] || 0, memberCount);
    });
    return counts;
  }, [activeMembers, dataReady, year]);

  // Countries lived — union of COUNTRIES_LIVED entries for active members
  const livedSet = useMemo(() => {
    const s = new Set();
    const lived = window.COUNTRIES_LIVED || {};
    activeMembers.forEach(id => { (lived[id] || []).forEach(iso => s.add(iso)); });
    return s;
  }, [activeMembers, dataReady]);

  // Reset autoplay revealed state when switching modes (keep autoplay active)
  useEffect(() => {
    if (autoplayMode) {
      setAutoplayState(prev => prev ? {
        ...prev,
        currentGroupIndex: 0,
        playing: false,
        revealedFlightIds: new Set(),
        seenAirports: new Set(),
        firstVisitAirports: new Set(),
        revealedVisitedCounts: {},
      } : prev);
    }
  }, [appMode]);

  // Stats
  const stats = useMemo(() => {
    const flights = filtered;
    const countriesSet = new Set();
    const airportsSet = new Set();
    const aircraftSet = new Set();
    const tripsSet = new Set();
    const routesSet = new Set();
    let dist = 0;
    const airlinesSet = new Set();
    const airportCounts = new Map();
    const airlineCounts = new Map();
    let leisure = 0, biz = 0, other = 0;
    flights.forEach((f) => {
      const A = window.AIRPORTS[f.From], B = window.AIRPORTS[f.To];
      if (A) countriesSet.add(A.country);
      if (B) countriesSet.add(B.country);
      airportsSet.add(f.From); airportsSet.add(f.To);
      if (f.Plane) aircraftSet.add(f.Plane);
      if (f.Trip) tripsSet.add(f.Trip);
      routesSet.add([f.From, f.To].sort().join("-"));
      dist += f.distanceKm;
      if (f.Airline) airlinesSet.add(f.Airline);
      airlineCounts.set(f.Airline, (airlineCounts.get(f.Airline) || 0) + 1);
      airportCounts.set(f.From, (airportCounts.get(f.From) || 0) + 1);
      airportCounts.set(f.To, (airportCounts.get(f.To) || 0) + 1);
      if (f.Reason === "L") leisure++;
      else if (f.Reason === "B") biz++;
      else if (f.Reason === "O") other++;
    });
    // Routes
    const routeCounts = new Map();
    flights.forEach(f => {
      const key = [f.From, f.To].sort().join("-");
      if (!routeCounts.has(key)) routeCounts.set(key, { from: [f.From, f.To].sort()[0], to: [f.From, f.To].sort()[1], count: 0, totalDist: 0, totalDurMins: 0, routeFlights: [] });
      const r = routeCounts.get(key);
      r.count++;
      r.totalDist += (f.distanceKm || 0);
      const durMins = (() => { if (!f.Duration) return 0; const [h,m] = f.Duration.split(":").map(Number); return (h||0)*60+(m||0); })();
      r.totalDurMins += durMins;
      r.routeFlights.push(f);
    });
    // Aircraft grouped
    const aircraftGroupCounts = new Map();
    flights.forEach(f => {
      if (!f.Plane) return;
      const g = getAircraftBaseGroup(f.Plane);
      aircraftGroupCounts.set(g, (aircraftGroupCounts.get(g) || 0) + 1);
    });
    // Trips (sorted by date desc)
    const tripMap = new Map();
    flights.forEach(f => {
      if (!f.Trip) return;
      if (!tripMap.has(f.Trip)) {
        const parts = f.Trip.split("-");
        const yymm = parts[0] || "";
        const yy = parseInt(yymm.slice(0, 2), 10);
        const mm = parseInt(yymm.slice(2, 4), 10);
        const fullYear = (yy <= 30 ? 2000 : 1900) + yy;
        const typeChar = (parts[parts.length - 1] || "").slice(-1).toLowerCase();
        tripMap.set(f.Trip, {
          code: f.Trip,
          dest: parts[1] || "",
          tripIcon: typeChar === "f" ? "tree-palm" : (typeChar === "b" || typeChar === "w") ? "briefcase" : "plane",
          sortDate: new Date(fullYear, (mm || 1) - 1, 1),
        });
      }
    });
    // Countries top
    const countryCounts = new Map();
    flights.forEach(f => {
      const A = window.AIRPORTS[f.From], B = window.AIRPORTS[f.To];
      [A, B].forEach(ap => {
        if (!ap) return;
        const iso = COUNTRY_NAME_TO_ISO[ap.country];
        if (iso) countryCounts.set(iso, (countryCounts.get(iso) || 0) + 1);
      });
    });

    // Duration in minutes
    function parseDurMins(dur) {
      if (!dur) return 0;
      const [h, m] = dur.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    }
    let totalDurMins = 0;
    const durationFlights = []; // { from, to, durMins, dur }
    flights.forEach(f => {
      const mins = parseDurMins(f.Duration);
      if (mins > 0) {
        totalDurMins += mins;
        durationFlights.push({ ...f, durMins: mins });
      }
    });
    // Seats
    const seatCounts = new Map();
    flights.forEach(f => { if (f.Seat) seatCounts.set(f.Seat, (seatCounts.get(f.Seat) || 0) + 1); });
    // Class breakdown — map codes to labels
    const classLabels = { Y: "Economy", C: "Business", F: "First", P: "Premium Economy", W: "Premium Economy", Q: "Economy" };
    const classCounts = {};
    flights.forEach(f => {
      if (!f.Class) return;
      const label = classLabels[f.Class] || f.Class;
      classCounts[label] = (classCounts[label] || 0) + 1;
    });
    // Seat type breakdown
    const seatTypeLabels = { W: "Window", A: "Aisle", M: "Middle" };
    const seatTypeCounts = {};
    flights.forEach(f => {
      if (!f.Seat_Type) return;
      const label = seatTypeLabels[f.Seat_Type] || f.Seat_Type;
      seatTypeCounts[label] = (seatTypeCounts[label] || 0) + 1;
    });
    // Manufacturer breakdown
    const mfrCounts = {};
    flights.forEach(f => {
      const mfr = getAircraftMfr(f.Plane);
      if (!mfr) return;
      mfrCounts[mfr] = (mfrCounts[mfr] || 0) + 1;
    });
    // Compass airports (most N/S/E/W by lat/lon)
    const coordFlights = flights.filter(f => window.AIRPORTS[f.From] || window.AIRPORTS[f.To]);
    const allAps = new Map();
    flights.forEach(f => {
      [f.From, f.To].forEach(iata => {
        const ap = window.AIRPORTS[iata];
        if (ap && ap.lat != null && ap.lon != null) allAps.set(iata, ap);
      });
    });
    const apArr = [...allAps.entries()];
    const northmost = apArr.length ? apArr.reduce((a, b) => b[1].lat > a[1].lat ? b : a) : null;
    const southmost = apArr.length ? apArr.reduce((a, b) => b[1].lat < a[1].lat ? b : a) : null;
    const eastmost  = apArr.length ? apArr.reduce((a, b) => b[1].lon > a[1].lon ? b : a) : null;
    const westmost  = apArr.length ? apArr.reduce((a, b) => b[1].lon < a[1].lon ? b : a) : null;
    // Longest & shortest by duration
    const withDur = durationFlights.slice().sort((a, b) => b.durMins - a.durMins);
    const longestFlight  = withDur[0] || null;
    const shortestFlight = withDur[withDur.length - 1] || null;

    // Next-day arrivals (departure time + duration crosses midnight, using departure local TZ)
    const nextDayFlights = [];
    flights.forEach(f => {
      const mins = parseDurMins(f.Duration);
      if (!mins || !f.dateObj) return;
      const dep = f.dateObj;
      const arr = new Date(dep.getTime() + mins * 60000);
      if (arr.getDate() !== dep.getDate() || arr.getMonth() !== dep.getMonth() || arr.getFullYear() !== dep.getFullYear()) {
        nextDayFlights.push(f);
      }
    });
    // Birthday flights
    const birthdays = window.BIRTHDAYS || {};
    const birthdayFlightsList = [];
    flights.forEach(f => {
      const bday = birthdays[f._member];
      if (!bday) return;
      const [mm, dd] = bday.split("-").map(Number);
      const d = f.dateObj;
      if (d && d.getMonth() + 1 === mm && d.getDate() === dd) birthdayFlightsList.push(f);
    });

    const sorted = flights.slice().sort((a, b) => a.dateObj - b.dateObj);
    return {
      count: flights.length,
      countries: countriesSet.size,
      airports: airportsSet.size,
      aircraft: aircraftSet.size,
      trips: tripsSet.size,
      routes: routesSet.size,
      distance: dist,
      airlines: airlinesSet.size,
      first: sorted[0],
      last: sorted[sorted.length - 1],
      topAirlines: [...airlineCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      topAirports: [...airportCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      topAircraft: [...aircraftGroupCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      topRoutes: [...routeCounts.values()].map(r => ({
        ...r,
        avgDist: r.count ? Math.round(r.totalDist / r.count) : 0,
        avgDurMins: r.totalDurMins && r.count ? Math.round(r.totalDurMins / r.count) : 0,
        routeFlights: r.routeFlights.slice().sort((a, b) => a.dateObj - b.dateObj),
      })).sort((a, b) => b.count - a.count).slice(0, 3),
      longestRouteByKm: (() => { const arr = [...routeCounts.values()].map(r => ({ ...r, avgDist: r.count ? Math.round(r.totalDist / r.count) : 0 })).filter(r => r.avgDist > 0); return arr.length ? arr.reduce((b, r) => r.avgDist > b.avgDist ? r : b) : null; })(),
      shortestRouteByKm: (() => { const arr = [...routeCounts.values()].map(r => ({ ...r, avgDist: r.count ? Math.round(r.totalDist / r.count) : 0 })).filter(r => r.avgDist > 0); return arr.length ? arr.reduce((b, r) => r.avgDist < b.avgDist ? r : b) : null; })(),
      lastTrips: [...tripMap.values()].sort((a, b) => b.sortDate - a.sortDate).slice(0, 3),
      topCountries: [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      leisure, biz, other,
      totalDurMins,
      durationFlights,
      seatCounts,
      seats: seatCounts.size,
      classCounts,
      seatTypeCounts,
      mfrCounts,
      northmost, southmost, eastmost, westmost,
      longestFlight, shortestFlight,
      nextDayCount: nextDayFlights.length,
      nextDayFlights,
      birthdayFlights: birthdayFlightsList.length,
      birthdayFlightsList,
    };
  }, [filtered]);

  const earthLaps = (stats.distance / 40075).toFixed(1);

  // Airline color map
  const airlineColorMap = useMemo(() => {
    const counts = new Map();
    allFlights.forEach(f => { if (f.Airline) counts.set(f.Airline, (counts.get(f.Airline) || 0) + 1); });
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const map = {};
    sorted.forEach(([name], i) => { map[name] = AIRLINE_PALETTE[i % AIRLINE_PALETTE.length]; });
    return map;
  }, [filtered]);

  // Autoplay group builders
  const flightsAutoplayGroups = useMemo(() => {
    if (appMode !== "flights" || !allFlights.length) return [];
    const map = new Map();
    allFlights.forEach(f => {
      const key = f.Date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, fls]) => ({ label: key, date: new Date(key), payload: fls }));
  }, [appMode, allFlights]);

  const countriesAutoplayGroups = useMemo(() => {
    if (appMode !== "countries") return [];
    const cd = window.COUNTRIES_DATA;
    if (!cd?.countries) return [];
    const yearMap = new Map();
    cd.countries.forEach(c => {
      activeMembers.forEach(m => {
        const yr = c.visits?.[m];
        if (!yr) return;
        if (!yearMap.has(yr)) yearMap.set(yr, []);
        yearMap.get(yr).push({ country: c.country, iso: c.iso, member: m });
      });
    });
    return [...yearMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([yr, entries]) => ({ label: String(yr), date: new Date(yr, 0, 1), payload: entries }));
  }, [appMode, activeMembers, dataReady]);

  const autoplayGroups = useMemo(() =>
    appMode === "flights" ? flightsAutoplayGroups : countriesAutoplayGroups,
    [appMode, flightsAutoplayGroups, countriesAutoplayGroups]
  );

  // Option lists for autocomplete
  const airlineOptions = useMemo(() => {
    const m = new Map();
    allFlights.forEach(f => { if (f.Airline) m.set(f.Airline, (m.get(f.Airline) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ value: name, label: name, count }));
  }, [allFlights]);

  const airportOptions = useMemo(() => {
    const m = new Map();
    allFlights.forEach(f => {
      m.set(f.From, (m.get(f.From) || 0) + 1);
      m.set(f.To, (m.get(f.To) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([iata, count]) => {
      const ap = window.AIRPORTS[iata];
      const iso = ap ? COUNTRY_NAME_TO_ISO[ap.country] : null;
      return { value: iata, label: `${iata} — ${ap?.city || ""}`, count, flag: iso ? isoToFlag(iso) : "" };
    });
  }, [allFlights]);

  const countryOptions = useMemo(() => {
    const m = new Map();
    allFlights.forEach(f => {
      const A = window.AIRPORTS[f.From], B = window.AIRPORTS[f.To];
      [A, B].forEach(ap => {
        if (!ap) return;
        const iso = COUNTRY_NAME_TO_ISO[ap.country];
        if (iso) m.set(iso, (m.get(iso) || 0) + 1);
      });
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([iso, count]) => ({
      value: iso, label: isoToName[iso] || iso, count, flag: isoToFlag(iso),
    }));
  }, [allFlights, isoToName]);

  const aircraftOptions = useMemo(() => {
    const m = new Map();
    allFlights.forEach(f => { if (f.Plane) m.set(f.Plane, (m.get(f.Plane) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ value: name, label: acName(name) || name, count }));
  }, [allFlights]);

  // Trip options (sorted newest first)
  const tripOptions = useMemo(() => {
    if (!window.TRIPS_DATA) return [];
    return [...window.TRIPS_DATA]
      .sort((a, b) => b.dates.start.localeCompare(a.dates.start))
      .map(t => ({ value: t.slug, label: t.name, count: t.days.length }));
  }, [dataReady]);

  // Auto-select when only 1 trip
  useEffect(() => {
    if (tripOptions.length === 1 && !focusedTrip) setFocusedTrip(tripOptions[0].value);
  }, [tripOptions]);

  // Clear activity filter when trip changes
  useEffect(() => { setFocusedActivityType(null); }, [focusedTrip]);

  // Activity type options (grouped by category, with emoji prefixes)
  const activityTypeOptions = useMemo(() => {
    if (!window.TRIPS_DATA || !focusedTrip || !window.buildTimelineEntries) return [];
    const trip = window.TRIPS_DATA.find(t => t.slug === focusedTrip);
    if (!trip) return [];
    const counts = {};
    trip.days.forEach(d => {
      window.buildTimelineEntries(d, trip).forEach(e => { if (e.type) counts[e.type] = (counts[e.type] || 0) + 1; });
    });
    const CATS = [
      ["Transport", "\u{1F686}", ["flight","train","ferry","car","taxi"]],
      ["Culture", "\u{1F3EF}", ["temple","shrine","castle","museum","palace","art"]],
      ["Outdoor", "\u{1F33F}", ["park","garden","nature","theme park","observation","memorial"]],
      ["Urban", "\u{1F3D9}", ["neighbourhood","market"]],
      ["Experience", "\u2728", ["experience"]],
      ["Food", "\u{1F35C}", ["restaurant","street food","food hall"]],
      ["Meals", "\u{1F37D}", ["breakfast","lunch","dinner"]],
      ["Stay", "\u{1F3E8}", ["hotel","apartment","ryokan"]],
    ];
    const result = [];
    const seen = new Set();
    CATS.forEach(([, emoji, types]) => {
      types.forEach(type => {
        if (counts[type]) { result.push({ value: type, label: `${emoji} ${type}`, count: counts[type] }); seen.add(type); }
      });
    });
    Object.keys(counts).forEach(type => { if (!seen.has(type)) result.push({ value: type, label: type, count: counts[type] }); });
    return result;
  }, [focusedTrip, dataReady]);

  // Zoom handler
  const handleZoom = useCallback((dir) => {
    if (mode === "3d" && window.__globe) {
      dir > 0 ? window.__globe.zoomIn() : window.__globe.zoomOut();
    } else if (mode === "2d" && window.__map2dZoom) {
      dir > 0 ? window.__map2dZoom.zoomIn() : window.__map2dZoom.zoomOut();
    }
  }, [mode]);

  // Sidebar resize
  const onResizeStart = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    if (sidebarRef.current) sidebarRef.current.style.transition = "none";
    const onMove = (ev) => {
      const delta = startX - ev.clientX;
      setSidebarWidth(Math.max(280, Math.min(600, startWidth + delta)));
    };
    const onUp = () => {
      if (sidebarRef.current) sidebarRef.current.style.transition = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [sidebarWidth]);

  // Route click handler
  const handleRouteClick = useCallback((route) => {
    setFocusedRoute(prev => {
      if (prev && prev.from === route.from && prev.to === route.to) return null;
      if (prev && prev.from === route.to && prev.to === route.from) return null;
      return route;
    });
    setFocusedAirport(null); setFocusedCountry(null); setFocusedAirline(null); setFocusedAircraft(null);
  }, []);

  // PNG export helpers (F7)
  const downloadBlob = (url, name) => {
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
  };

  const exportMapOnly = useCallback(() => {
    setShowExportMenu(false);
    memberDropdownCollapseRef.current?.();
    if (mode === "2d") {
      const svg = mapPanelRef.current?.querySelector("svg");
      if (!svg) return;
      const serialized = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([serialized], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = svg.clientWidth * 2; canvas.height = svg.clientHeight * 2;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        downloadBlob(canvas.toDataURL("image/png"), "flight-map.png");
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } else {
      const canvas = mapPanelRef.current?.querySelector("canvas");
      if (!canvas) return;
      downloadBlob(canvas.toDataURL("image/png"), "flight-globe.png");
    }
  }, [mode]);

  const exportMapAndStats = useCallback(() => {
    setShowExportMenu(false);
    memberDropdownCollapseRef.current?.();
    if (!window.html2canvas || !mainPanelRef.current) return;
    setTimeout(() => {
      window.html2canvas(mainPanelRef.current, { backgroundColor: "#1E1B2E", scale: 2, useCORS: true })
        .then(canvas => downloadBlob(canvas.toDataURL("image/png"), "flight-map-stats.png"));
    }, 80);
  }, []);

  // ── Autoplay helpers ─────────────────────────────────────────────────────

  const stopAutoplay = useCallback(() => {
    setAutoplayMode(false);
    setAutoplayState(null);
    setSidebarOpen(true);
  }, []);

  const startAutoplay = useCallback(() => {
    setAutoplayMode(true);
    setSidebarOpen(false);
    setAutoplayState({
      playing: true,
      speed: 1,
      currentGroupIndex: 0,
      revealedFlightIds: new Set(),
      seenAirports: new Set(),
      firstVisitAirports: new Set(),
      revealedVisitedCounts: {},
    });
    // Pan globe to world overview when starting countries autoplay
    if (appMode === "countries") {
      setTimeout(() => { window.__globe?.panTo(20, 20, 500); }, 50);
    }
  }, [appMode]);

  const onRevealFlight = useCallback((group) => {
    if (window.panGlobeToGroup) window.panGlobeToGroup(group.payload || []);
    setAutoplayState(prev => {
      if (!prev) return prev;
      const newRevealed = new Set(prev.revealedFlightIds);
      const newSeen = new Set(prev.seenAirports);
      const newFirst = new Set();
      (group.payload || []).forEach(f => {
        newRevealed.add(f.id);
        [f.From, f.To].forEach(iata => {
          if (!newSeen.has(iata)) { newFirst.add(iata); newSeen.add(iata); }
        });
      });
      return { ...prev, revealedFlightIds: newRevealed, seenAirports: newSeen, firstVisitAirports: newFirst };
    });
    // Fade first-visit glow after 1500ms
    setTimeout(() => {
      setAutoplayState(p => p ? { ...p, firstVisitAirports: new Set() } : p);
    }, 1500);
  }, []);

  const onRevealCountry = useCallback((group) => {
    setAutoplayState(prev => {
      if (!prev) return prev;
      const newCounts = { ...(prev.revealedVisitedCounts || {}) };
      (group.payload || []).forEach(({ iso }) => {
        const baseIso = iso.includes("-") ? iso.split("-")[0] : iso;
        newCounts[baseIso] = (newCounts[baseIso] || 0) + 1;
      });
      return { ...prev, revealedVisitedCounts: newCounts };
    });
    // Pan globe to centroid of newly revealed countries
    const isos = [...new Set((group.payload || []).map(p => (p.iso || "").split("-")[0].toUpperCase()))];
    const coords = isos.map(iso => countryCentroids[iso]).filter(Boolean);
    if (coords.length && window.__globe?.panTo) {
      const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
      const avgLon = coords.reduce((s, c) => s + c.lon, 0) / coords.length;
      window.__globe.panTo(avgLat, avgLon, 340);
    }
  }, [countryCentroids]);

  const handleScrub = useCallback((idx) => {
    if (!autoplayGroups.length) return;
    const targetDate = autoplayGroups[Math.min(idx, autoplayGroups.length - 1)]?.date || new Date(0);
    if (appMode === "flights") {
      const newRevealed = new Set();
      const newSeen = new Set();
      allFlights.forEach(f => {
        if (f.dateObj <= targetDate) {
          newRevealed.add(f.id);
          newSeen.add(f.From);
          newSeen.add(f.To);
        }
      });
      setAutoplayState(prev => prev ? {
        ...prev,
        currentGroupIndex: idx,
        playing: false,
        revealedFlightIds: newRevealed,
        seenAirports: newSeen,
        firstVisitAirports: new Set(),
      } : prev);
    } else {
      const targetYear = targetDate.getFullYear();
      const cd = window.COUNTRIES_DATA;
      const newCounts = {};
      if (cd?.countries) {
        cd.countries.forEach(c => {
          const baseIso = c.iso.includes("-") ? c.iso.split("-")[0] : c.iso;
          activeMembers.forEach(m => {
            const yr = c.visits?.[m];
            if (yr && yr <= targetYear) {
              newCounts[baseIso] = (newCounts[baseIso] || 0) + 1;
            }
          });
        });
      }
      setAutoplayState(prev => prev ? {
        ...prev,
        currentGroupIndex: idx,
        playing: false,
        revealedVisitedCounts: newCounts,
        firstVisitAirports: new Set(),
      } : prev);
    }
  }, [autoplayGroups, appMode, allFlights, activeMembers]);

  const selectStyle = {
    padding: "5px 10px", borderRadius: 8,
    background: "var(--t-icon-bg)", border: "1px solid var(--t-icon-border)",
    color: "var(--t-accent)", fontFamily: "var(--font-mono)", fontSize: 11,
    outline: "none", cursor: "pointer",
  };

  const zoomBtnStyle = {
    width: 36, height: 36, borderRadius: 999,
    background: "rgba(30,27,46,0.85)", border: "1px solid var(--t-acc-30)",
    color: "var(--t-accent)", fontFamily: "var(--font-mono)", fontSize: 18,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    backdropFilter: "blur(8px)",
  };

  return (
    <div style={{
      height: "100vh", maxHeight: "100vh", overflow: "hidden",
      background: "var(--t-page-bg)",
      color: "var(--t-fg)", fontFamily: "var(--font-body)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Top bar */}
      <header style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 20px", borderBottom: "1px solid var(--t-hdr-border)",
        flexWrap: "wrap",
      }}>
        {/* Wordmark */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginRight: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: -0.5 }}>Travel Diary</div>
            {dataReady && window.FAMILY_NAME && (
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 13, color: "var(--t-fg2)", letterSpacing: 0 }}>{window.FAMILY_NAME}</div>
            )}
          </div>
          <div style={{ height: 2, width: 46, background: "linear-gradient(90deg, #6C5CE7, #FF6B6B, #00D2A0, #FDCB6E)", borderRadius: 2 }} />
        </div>

        {/* Member dropdown */}
        {dataReady && (
          <MemberDropdown
            members={window.MEMBER_LIST || []}
            activeMembers={activeMembers}
            onToggle={toggleMember}
            onSolo={(id) => setActiveMembers(new Set([id]))}
            onAll={selectAllMembers}
            collapseRef={memberDropdownCollapseRef}
            memberColors={MEMBER_COLORS}
          />
        )}

        {/* Mode dropdown (Countries / Flights / Trips / Quiz) */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button onClick={() => setShowModeMenu(p => !p)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 999,
            background: "var(--t-pill-bg)", border: "1px solid var(--t-pill-border)",
            color: "var(--t-pill-active-txt)",
            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
            cursor: "pointer", textTransform: "uppercase",
          }}>
            <span><LucideIcon name={appMode === "countries" ? "globe" : appMode === "trips" ? "map" : "plane"} size={13} /></span>
            <span>{appMode === "countries" ? "Countries" : appMode === "trips" ? "Trips" : "Flights"}</span>
            <span style={{ fontSize: 8, opacity: 0.5 }}>▾</span>
          </button>
          {showModeMenu && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
              background: "var(--t-surf-95)", border: "1px solid var(--t-acc-30)",
              backdropFilter: "blur(12px)", borderRadius: 10, padding: "6px 0", minWidth: 140,
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            }}>
              {[{key:"countries",icon:"globe",label:"Countries"},{key:"flights",icon:"plane",label:"Flights"},{key:"trips",icon:"map",label:"Trips"}].map(m => (
                <button key={m.key} onClick={() => { switchMode(m.key); setShowModeMenu(false); }} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "8px 14px", background: appMode === m.key ? "var(--t-acc-15)" : "transparent",
                  border: "none", color: appMode === m.key ? "#A29BFE" : "var(--t-fg2)",
                  fontFamily: "var(--font-mono)", fontSize: 11, cursor: "pointer", textAlign: "left",
                  textTransform: "uppercase",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--t-acc-12)"}
                onMouseLeave={e => e.currentTarget.style.background = appMode === m.key ? "var(--t-acc-15)" : "transparent"}
                ><span><LucideIcon name={m.icon} size={13} /></span><span>{m.label}</span></button>
              ))}
              {window.QuizModal && (
                <>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
                  <button onClick={() => { setQuizOpen(true); setShowModeMenu(false); }} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: "100%", padding: "8px 14px", background: "transparent",
                    border: "none", color: "var(--t-fg2)",
                    fontFamily: "var(--font-mono)", fontSize: 11, cursor: "pointer", textAlign: "left",
                    textTransform: "uppercase",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--t-acc-12)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  ><span><LucideIcon name="target" size={13} /></span><span>Quiz</span></button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 2D / 3D toggle — hidden in trips mode */}
        {appMode !== "trips" && (
          <button onClick={() => setMode(m => m === "3d" ? "2d" : "3d")} title={mode === "3d" ? "Switch to 2D map" : "Switch to 3D globe"} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "5px 10px", borderRadius: 999,
            background: "var(--t-pill-bg)", border: "1px solid var(--t-pill-border)",
            color: "var(--t-pill-active-txt)",
            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
            cursor: "pointer",
          }}>
            <span style={{ fontSize: 12 }}>{mode === "3d" ? "◉" : "▭"}</span>
            <span>{mode === "3d" ? "3D" : "2D"}</span>
          </button>
        )}

        {/* Autoplay — icon only */}
        <button
          onClick={appMode === "trips"
            ? () => setTripPlaying(p => !p)
            : (autoplayMode ? stopAutoplay : startAutoplay)}
          title={appMode === "trips"
            ? (tripPlaying ? "Pause trip" : "Play trip")
            : (autoplayMode ? "Exit autoplay" : "Play autoplay")}
          style={{
            width: 32, height: 32, borderRadius: 999,
            background: (autoplayMode || tripPlaying) ? "var(--t-acc-45)" : "var(--t-acc-15)",
            border: "1px solid " + ((autoplayMode || tripPlaying) ? "var(--t-acc-70)" : "var(--t-acc-40)"),
            color: "var(--t-accent)", fontSize: 13,
            cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}
        ><LucideIcon name={autoplayMode ? "x" : (tripPlaying ? "pause" : "play")} size={14} /></button>

        {/* Countries filters — only shown in countries mode */}
        {appMode === "countries" && (
          <div style={{
            display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 0, flexWrap: "wrap",
            opacity: autoplayMode ? 0.4 : 1,
            pointerEvents: autoplayMode ? "none" : "auto",
            transition: "opacity 0.2s",
          }}>
            <AutocompleteInput placeholder="Year" value={year !== "all" ? year : null}
              options={countriesYearOptions}
              onSelect={v => setYear(v)}
              onClear={() => setYear("all")}
            />
            <AutocompleteInput placeholder="Country" value={focusedCountry}
              options={countriesCountryOptions}
              onSelect={toggleFocusCountry}
              onClear={() => setFocusedCountry(null)}
              renderLabel={(v) => <>{isoToFlag(v.split("-")[0])} {isoToName[v] || v}</>}
            />
          </div>
        )}

        {/* Flight filters — only shown in flights mode */}
        {appMode === "flights" && (
          <div style={{
            display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 0, flexWrap: "wrap",
            opacity: autoplayMode ? 0.4 : 1,
            pointerEvents: autoplayMode ? "none" : "auto",
            transition: "opacity 0.2s",
          }}>
            <AutocompleteInput placeholder="Year" value={year !== "all" ? year : null}
              options={yearOptions}
              onSelect={v => setYear(v)}
              onClear={() => setYear("all")}
            />
            <AutocompleteInput placeholder="Airline" value={focusedAirline}
              options={airlineOptions}
              onSelect={toggleFocusAirline}
              onClear={() => setFocusedAirline(null)}
            />
            <AutocompleteInput placeholder="Airport" value={focusedAirport}
              options={airportOptions}
              onSelect={toggleFocusAirport}
              onClear={() => setFocusedAirport(null)}
              renderLabel={(v) => {
                const ap = window.AIRPORTS[v];
                const iso = ap ? COUNTRY_NAME_TO_ISO[ap.country] : null;
                return <>{iso ? <span style={{ marginRight: 3 }}>{isoToFlag(iso)}</span> : null}{v}</>;
              }}
            />
            <label style={{
              display: "flex", alignItems: "center", gap: 4,
              fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)",
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
              <input type="checkbox" checked={showLabels}
                onChange={(e) => { setShowLabels(e.target.checked); setTweaks("showLabels", e.target.checked); }}
                style={{ accentColor: "#6C5CE7" }}
              />
              Labels
            </label>
            <AutocompleteInput placeholder="Country" value={focusedCountry}
              options={countryOptions}
              onSelect={toggleFocusCountry}
              onClear={() => setFocusedCountry(null)}
              renderLabel={(v) => <>{isoToFlag(v)} {isoToName[v] || v}</>}
            />
            <AutocompleteInput placeholder="Aircraft" value={focusedAircraft}
              options={aircraftOptions}
              onSelect={(v) => { setFocusedAircraft(v); setFocusedAirline(null); setFocusedAirport(null); setFocusedCountry(null); setFocusedRoute(null); setFocusedCity(null); }}
              onClear={() => setFocusedAircraft(null)}
            />
            <select value={arcColorMode} onChange={(e) => setArcColorMode(e.target.value)} style={selectStyle}>
              <option value="reason">Arcs: reason</option>
              <option value="airline">Arcs: airline</option>
              <option value="alliance">Arcs: alliance</option>
              <option value="class">Arcs: class</option>
              <option value="seat_type">Arcs: seat type</option>
              <option value="aircraft_mfr">Arcs: manufacturer</option>
              {activeMembers.size > 1 && <option value="person">Arcs: person</option>}
            </select>
          </div>
        )}

        {/* Trip filters — only shown in trips mode */}
        {appMode === "trips" && (
          <div style={{
            display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 0, flexWrap: "wrap",
          }}>
            <AutocompleteInput placeholder="Trip" value={focusedTrip}
              options={tripOptions}
              onSelect={(v) => setFocusedTrip(v)}
              onClear={() => setFocusedTrip(null)}
              renderLabel={(v) => { const t = (window.TRIPS_DATA || []).find(x => x.slug === v); return t ? t.name : v; }}
            />
            {/* Day / List toggle */}
            <div style={{ display: "inline-flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--t-acc-30)" }}>
              {[{key:"day",icon:"calendar-days",label:"Day"},{key:"list",icon:"list",label:"List"}].map(v => (
                <button key={v.key} onClick={() => setTripViewMode(v.key)} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", border: "none", cursor: "pointer",
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  background: tripViewMode === v.key ? "var(--t-acc-22)" : "transparent",
                  color: tripViewMode === v.key ? "var(--t-accent)" : "var(--t-fg3)",
                }}><LucideIcon name={v.icon} size={12} />{v.label}</button>
              ))}
            </div>
            {/* Activity type filter */}
            <AutocompleteInput placeholder="Activity" value={focusedActivityType}
              options={activityTypeOptions}
              onSelect={(v) => setFocusedActivityType(v)}
              onClear={() => setFocusedActivityType(null)}
            />
          </div>
        )}

        {/* Light/dark mode toggle */}
        <button onClick={() => setLightMode(m => !m)} title={lightMode ? "Dark mode" : "Light mode"} style={{
          width: 32, height: 32, borderRadius: 10, border: "1px solid var(--t-acc-30)",
          background: "var(--t-surf-70)", backdropFilter: "blur(8px)",
          color: "var(--t-accent)", fontSize: 14, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}><LucideIcon name={lightMode ? "moon" : "sun"} size={14} /></button>

        {/* Overflow menu — 3D/2D, reload, errors, save */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button onClick={() => setShowOverflowMenu(p => !p)} title="More options" style={{
            width: 32, height: 32, borderRadius: 10, border: "1px solid var(--t-icon-border)",
            background: showOverflowMenu ? "var(--t-acc-22)" : "var(--t-icon-bg)",
            backdropFilter: "blur(8px)", color: "var(--t-icon-txt)", fontSize: 16,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>⋯</button>
          {showOverflowMenu && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200,
              background: "var(--t-surf-95)", border: "1px solid var(--t-acc-30)",
              backdropFilter: "blur(12px)", borderRadius: 10, padding: "6px 0", minWidth: 180,
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            }}>
              {/* Reload */}
              <button onClick={() => { reloadData(); setShowOverflowMenu(false); }} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "8px 14px", background: "transparent", border: "none",
                color: "var(--t-fg2)", fontFamily: "var(--font-body)", fontSize: 12,
                cursor: "pointer", textAlign: "left",
                animation: !dataReady ? "spin 1s linear infinite" : "none",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--t-acc-12)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              ><span><LucideIcon name="refresh-cw" size={13} /></span><span>Refresh data</span></button>
              {/* Save */}
              <button onClick={exportMapOnly} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "8px 14px", background: "transparent", border: "none",
                color: "var(--t-fg2)", fontFamily: "var(--font-body)", fontSize: 12,
                cursor: "pointer", textAlign: "left",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--t-acc-12)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              ><span><LucideIcon name="download" size={13} /></span><span>Save image</span></button>
              <button onClick={exportMapAndStats} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "8px 14px", background: "transparent", border: "none",
                color: "var(--t-fg2)", fontFamily: "var(--font-body)", fontSize: 12,
                cursor: "pointer", textAlign: "left",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--t-acc-12)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              ><span><LucideIcon name="image" size={13} /></span><span>Save map + stats</span></button>
              {/* Errors */}
              {dataReady && (() => {
                const errCount = dataQuality.errorCount;
                const warnCount = dataQuality.warnCount;
                const total = errCount + warnCount;
                if (total === 0) return null;
                const hasErrors = errCount > 0;
                const badgeColor = hasErrors ? "#FF6B6B" : "#FDCB6E";
                return (
                  <>
                    <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />
                    <button onClick={() => { setShowQualityPanel(p => !p); setShowOverflowMenu(false); }} style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "8px 14px", background: "transparent", border: "none",
                      color: badgeColor, fontFamily: "var(--font-body)", fontSize: 12,
                      cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,107,107,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    ><span><LucideIcon name="triangle-alert" size={13} /></span><span>{total} issue{total !== 1 ? "s" : ""}</span></button>
                  </>
                );
              })()}
            </div>
          )}
          {/* Quality panel anchored below overflow button */}
          {showQualityPanel && (
            <DataQualityPanel
              errors={dataQuality.errors}
              warnings={dataQuality.warnings}
              onClose={() => setShowQualityPanel(false)}
            />
          )}
        </div>
      </header>

      {/* Main */}
      <div ref={mainPanelRef} style={{ flex: 1, display: "flex", minHeight: 0, minWidth: 0, position: "relative", width: "100%" }}>
        {appMode === "trips" && window.TripView ? (
          <window.TripView
            trips={window.TRIPS_DATA}
            lightMode={lightMode}
            activeMembers={activeMembers}
            playing={tripPlaying}
            onPlayToggle={() => setTripPlaying(p => !p)}
            activeSlug={focusedTrip}
            onSlugChange={setFocusedTrip}
            tripViewMode={tripViewMode}
            activityTypeFilter={focusedActivityType}
          />
        ) : (
        <>
        {/* Globe / Map */}
        <div ref={mapPanelRef} style={{ flex: 1, position: "relative", minWidth: 0 }}>
          {mode === "3d" ? (
            <window.Globe
              flights={
                autoplayMode && appMode === "flights" && autoplayState
                  ? allFlights.filter(f => autoplayState.revealedFlightIds.has(f.id))
                  : appMode === "flights" ? filtered : []
              }
              airports={window.AIRPORTS}
              scheme={lightMode ? "day" : tweaks.scheme}
              lightMode={lightMode}
              showLabels={showLabels}
              focusedAirport={autoplayMode ? null : focusedAirport}
              focusedCountry={autoplayMode ? null : focusedCountry}
              countries={countries}
              visitedCounts={autoplayMode && appMode === "countries" && autoplayState ? autoplayState.revealedVisitedCounts : countriesVisitedCounts}
              flownCounts={visitedCounts}
              livedSet={livedSet}
              mapColorTheme={mapColorTheme}
              appMode={appMode}
              arcColorMode={arcColorMode}
              airlineColorMap={airlineColorMap}
              memberColorMap={MEMBER_COLORS}
              highlightedFlight={autoplayMode ? null : selectedFlight}
              focusedRoute={autoplayMode ? null : focusedRoute}
              firstVisitAirports={autoplayState?.firstVisitAirports}
              onAirportClick={toggleFocusAirport}
              onAirportHover={setHoverAirport}
              onCountryClick={toggleFocusCountry}
              onCountryHover={setHoverCountry}
              onRouteClick={handleRouteClick}
              onArcHover={setHoverArc}
            />
          ) : (
            <window.Map2D
              flights={
                autoplayMode && appMode === "flights" && autoplayState
                  ? allFlights.filter(f => autoplayState.revealedFlightIds.has(f.id))
                  : appMode === "flights" ? filtered : []
              }
              airports={window.AIRPORTS}
              focusedAirport={autoplayMode ? null : focusedAirport}
              focusedCountry={autoplayMode ? null : focusedCountry}
              countries={countries}
              visitedCounts={autoplayMode && appMode === "countries" && autoplayState ? autoplayState.revealedVisitedCounts : countriesVisitedCounts}
              flownCounts={visitedCounts}
              livedSet={livedSet}
              mapColorTheme={mapColorTheme}
              appMode={appMode}
              scheme={lightMode ? "day" : tweaks.scheme}
              showLabels={showLabels}
              arcColorMode={arcColorMode}
              airlineColorMap={airlineColorMap}
              memberColorMap={MEMBER_COLORS}
              highlightedFlight={autoplayMode ? null : selectedFlight}
              focusedRoute={autoplayMode ? null : focusedRoute}
              lightMode={lightMode}
              onAirportClick={toggleFocusAirport}
              onAirportHover={setHoverAirport}
              onCountryClick={toggleFocusCountry}
              onCountryHover={setHoverCountry}
              onRouteClick={handleRouteClick}
              onArcHover={setHoverArc}
            />
          )}

          {/* Empty state overlay */}
          {(activeMembers.size === 0 || (appMode === "flights" && allFlights.length === 0 && activeMembers.size > 0)) && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 16,
              background: "rgba(15,13,26,0.75)", backdropFilter: "blur(4px)", zIndex: 10,
            }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--t-fg2)" }}>
                {activeMembers.size === 0 ? "No members selected" : "No flight data for selected members"}
              </div>
              <button
                onClick={activeMembers.size === 0 ? selectAllMembers : () => switchMode("countries")}
                style={{
                  padding: "10px 28px", borderRadius: 999,
                  background: "linear-gradient(135deg, #6C5CE7 0%, #3D35A0 100%)",
                  border: "none", color: "#fff",
                  fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14,
                  cursor: "pointer", boxShadow: "0 4px 18px var(--t-acc-35)",
                }}>
                {activeMembers.size === 0 ? "Select all" : "Switch to Countries"}
              </button>
            </div>
          )}

          {/* Hover tooltip — priority: airport > arc > country */}
          {(() => {
            const tipStyle = (pos) => ({
              position: "fixed", left: pos.x + 14, top: pos.y + 14,
              padding: "8px 12px", background: "rgba(30,27,46,0.95)",
              border: "1px solid var(--t-acc-35)", borderRadius: 10,
              fontFamily: "var(--font-body)", fontSize: 12, color: "#FAFAFA",
              pointerEvents: "none", zIndex: 1000, backdropFilter: "blur(8px)", maxWidth: 300,
            });
            const monoSm = { fontFamily: "var(--font-mono)", fontSize: 10 };
            const monoSmDim = { ...monoSm, color: "var(--t-fg3)" };

            if (hoverAirport) {
              const A = (window.AIRPORTS || {})[hoverAirport.iata];
              const flightCount = (visitedCounts || {})[hoverAirport.iata] || 0;
              return (
                <div style={tipStyle(hoverAirport)}>
                  <div style={{ fontWeight: 700, marginBottom: 3, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...monoSm, color: "#00D2A0", fontSize: 13 }}>{hoverAirport.iata}</span>
                    {A && <span style={{ color: "#FAFAFA" }}>{A.city}</span>}
                  </div>
                  {A && <div style={monoSmDim}>{A.country}</div>}
                  {flightCount > 0 && <div style={{ ...monoSm, color: "var(--t-accent)", marginTop: 4 }}>{flightCount} flight{flightCount !== 1 ? "s" : ""}</div>}
                </div>
              );
            }

            if (hoverArc) {
              const f = hoverArc.flight;
              const fromA = (window.AIRPORTS || {})[f.From];
              const toA = (window.AIRPORTS || {})[f.To];
              const reasonLabel = { L: "Leisure", B: "Business", O: "Other" }[f.Reason] || f.Reason;
              return (
                <div style={tipStyle(hoverArc)}>
                  <div style={{ fontWeight: 700, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ ...monoSm, color: "#00D2A0", fontSize: 13 }}>{f.From}</span>
                    <span style={{ color: "var(--t-fg3)" }}>→</span>
                    <span style={{ ...monoSm, color: "#00D2A0", fontSize: 13 }}>{f.To}</span>
                  </div>
                  {(fromA || toA) && (
                    <div style={monoSmDim}>{fromA?.city || f.From} → {toA?.city || f.To}</div>
                  )}
                  <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
                    {f.Airline && <span style={monoSmDim}>{f.Airline}</span>}
                    {f.Flight_Number && <span style={{ ...monoSm, color: "var(--t-accent)" }}>{f.Flight_Number}</span>}
                    {f.Reason && <span style={{ ...monoSm, color: "#FDCB6E" }}>{reasonLabel}</span>}
                  </div>
                  {f.Date && <div style={{ ...monoSmDim, marginTop: 2 }}>{f.Date}</div>}
                </div>
              );
            }

            if (hoverCountry) {
              return (
                <div style={tipStyle(hoverCountry)}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{isoToFlag(hoverCountry.iso)} {hoverCountry.name}</div>
                  {appMode === "countries" ? (() => {
                    const cd = window.COUNTRIES_DATA;
                    if (!cd?.countries) return null;
                    const matches = cd.countries.filter(c => {
                      const iso = c.iso.includes("-") ? c.iso.split("-")[0] : c.iso;
                      return iso === hoverCountry.iso;
                    });
                    const visits = {};
                    matches.forEach(c => {
                      Object.entries(c.visits).forEach(([id, yr]) => {
                        if (activeMembers.has(id) && (!visits[id] || yr < visits[id])) visits[id] = yr;
                      });
                    });
                    if (Object.keys(visits).length === 0) return (
                      <div style={monoSmDim}>not visited</div>
                    );
                    return (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px" }}>
                        {Object.entries(visits).sort((a, b) => a[1] - b[1]).map(([id, yr]) => (
                          <span key={id} style={monoSm}>
                            <span style={{ color: MEMBER_COLORS[id] || "#A29BFE" }}>●</span>{" "}
                            <span style={{ color: "var(--t-fg2)" }}>{id.charAt(0).toUpperCase() + id.slice(1)} {yr}</span>
                          </span>
                        ))}
                      </div>
                    );
                  })() : (
                    <div style={{ ...monoSm, color: "var(--t-accent)" }}>
                      {visitedCounts[hoverCountry.iso]
                        ? `${visitedCounts[hoverCountry.iso]} flight${visitedCounts[hoverCountry.iso] === 1 ? "" : "s"}`
                        : "not visited"}
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })()}

          {/* Route badge */}
          {focusedRoute && (
            <div style={{
              position: "absolute", top: 16, left: 16,
              padding: "7px 12px 7px 14px", background: "rgba(30,27,46,0.85)",
              border: "1px solid var(--t-acc-40)", borderRadius: 999,
              display: "flex", alignItems: "center", gap: 8,
              backdropFilter: "blur(12px)", zIndex: 5,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#A29BFE", boxShadow: "0 0 10px #A29BFE" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#00D2A0" }}>
                {focusedRoute.from} → {focusedRoute.to}
              </span>
              <button onClick={() => setFocusedRoute(null)} style={{
                background: "transparent", border: "none", color: "var(--t-fg3)",
                cursor: "pointer", padding: 0, marginLeft: 2, fontSize: 14, lineHeight: 1,
              }}>×</button>
            </div>
          )}

          {/* Autoplay HUD overlays (pointer-events: none, so globe stays interactive) */}
          {autoplayMode && autoplayState && appMode === "flights" && window.AutoplayOverlay && (
            <window.AutoplayOverlay autoplayState={autoplayState} groups={autoplayGroups} lightMode={lightMode} />
          )}
          {autoplayMode && autoplayState && appMode === "countries" && window.CountriesAutoplayOverlay && (
            <window.CountriesAutoplayOverlay autoplayState={autoplayState} groups={autoplayGroups} lightMode={lightMode} />
          )}

          {/* Autoplay controller (no render) */}
          {autoplayMode && autoplayState && autoplayGroups.length > 0 && window.AutoplayController && (
            <window.AutoplayController
              groups={autoplayGroups}
              autoplayState={autoplayState}
              setAutoplayState={setAutoplayState}
              onReveal={appMode === "flights" ? onRevealFlight : onRevealCountry}
              onEnd={stopAutoplay}
            />
          )}

          {/* Timeline bar */}
          {autoplayMode && autoplayGroups.length > 0 && window.TimelineBar && (
            <window.TimelineBar
              groups={autoplayGroups}
              currentGroupIndex={autoplayState?.currentGroupIndex || 0}
              playing={autoplayState?.playing || false}
              speed={autoplayState?.speed || 1}
              onPlayPause={() => setAutoplayState(p => p ? { ...p, playing: !p.playing } : p)}
              onSpeedChange={s => setAutoplayState(p => p ? { ...p, speed: s } : p)}
              onScrub={handleScrub}
              onExit={stopAutoplay}
            />
          )}

          {/* Legend */}
          {appMode === "flights" && (
            <div style={{
              position: "absolute", bottom: autoplayMode ? 88 : 16, left: 16,
              display: "flex", gap: 12, padding: "8px 12px",
              background: "rgba(30,27,46,0.7)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, backdropFilter: "blur(10px)",
              fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg2)",
              flexWrap: "wrap",
            }}>
              {arcColorMode === "person" ? (
                [...activeMembers].filter(id => (window.FLIGHTS[id]?.length || 0) > 0).map(id => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: MEMBER_COLORS[id] || "#6E6A82" }} />
                    <span>{id.charAt(0).toUpperCase() + id.slice(1)}</span>
                  </div>
                ))
              ) : arcColorMode === "reason" ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 18, height: 2, background: "linear-gradient(90deg, #6C5CE7, #FF6B6B)" }} />
                    leisure
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 18, height: 2, background: "linear-gradient(90deg, #6C5CE7, #FDCB6E)" }} />
                    business
                  </div>
                </>
              ) : arcColorMode === "class" ? (
                [["Economy","#6C5CE7"],["Business","#FDCB6E"],["First","#FF6B6B"],["Premium Economy","#00D2A0"]].map(([label, c]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: c }} />
                    <span>{label}</span>
                  </div>
                ))
              ) : arcColorMode === "seat_type" ? (
                [["Window","#74B9FF"],["Aisle","#55EFC4"],["Middle","#FDCB6E"]].map(([label, c]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: c }} />
                    <span>{label}</span>
                  </div>
                ))
              ) : arcColorMode === "aircraft_mfr" ? (
                [["Boeing","#74B9FF"],["Airbus","#FF6B6B"],["Embraer","#00D2A0"],["Bombardier","#FDCB6E"],["ATR","#A29BFE"]].map(([label, c]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: c }} />
                    <span>{label}</span>
                  </div>
                ))
              ) : arcColorMode === "alliance" ? (
                [["Star Alliance","#74B9FF"],["Oneworld","#FF6B6B"],["SkyTeam","#00D2A0"],["Others","#95A5B3"]].map(([label, c]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: c }} />
                    <span>{label}</span>
                  </div>
                ))
              ) : arcColorMode === "airline" ? (
                stats.topAirlines.slice(0, 5).map(([name]) => (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: airlineColorMap[name] || "#6E6A82" }} />
                    <span style={{ maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                  </div>
                ))
              ) : null}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "#00D2A0", boxShadow: "0 0 6px #00D2A0" }} />
                airport
              </div>
            </div>
          )}

          {/* Zoom buttons */}
          <div style={{
            position: "absolute", bottom: autoplayMode ? 88 : 16, right: 16, zIndex: 5,
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <button onClick={() => handleZoom(1)} style={zoomBtnStyle}>+</button>
            <button onClick={() => handleZoom(-1)} style={zoomBtnStyle}>−</button>
          </div>
        </div>

        {/* Sidebar toggle */}
        <button onClick={() => setSidebarOpen(p => !p)} style={{
          position: "absolute", right: sidebarOpen ? sidebarWidth : 0, top: "50%",
          transform: "translateY(-50%)", zIndex: 10,
          width: 20, height: 48,
          background: "rgba(30,27,46,0.85)", border: "1px solid var(--t-acc-30)",
          borderRadius: "8px 0 0 8px", color: "var(--t-accent)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontFamily: "monospace",
          transition: "right 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}>{sidebarOpen ? "›" : "‹"}</button>

        {/* Sidebar */}
        <aside ref={sidebarRef} style={{
          width: sidebarOpen ? sidebarWidth : 0,
          flexShrink: 0,
          padding: sidebarOpen ? "20px 22px" : 0,
          borderLeft: "1px solid var(--t-sidebar-border)",
          background: "var(--t-sidebar)",
          overflow: sidebarOpen ? "auto" : "hidden",
          display: "flex", flexDirection: "column", gap: 16,
          position: "relative",
          transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}>
          {/* Resize handle */}
          {sidebarOpen && (
            <div onPointerDown={onResizeStart} style={{
              position: "absolute", left: -3, top: 0, bottom: 0, width: 6,
              cursor: "col-resize", zIndex: 5,
            }} />
          )}

          {appMode === "countries" ? (
            <CountriesSidebar
              activeMembers={activeMembers}
              countriesData={window.COUNTRIES_DATA}
              memberColors={MEMBER_COLORS}
              isoToName={isoToName}
              onCountryClick={toggleFocusCountry}
              focusedCountry={focusedCountry}
              chartWidth={sidebarWidth - 44}
              activeYear={year !== "all" ? +year : null}
              onYearClick={(y) => setYear(prev => prev === String(y) ? "all" : String(y))}
            />
          ) : detailView ? (
            <DetailListView
              type={detailView}
              flights={filtered}
              stats={stats}
              onBack={() => { setDetailView(null); setSelectedFlight(null); }}
              onFlightSelect={setSelectedFlight}
              selectedFlight={selectedFlight}
              airlineColorMap={airlineColorMap}
              arcColorMode={arcColorMode}
              isoToName={isoToName}
              COUNTRY_NAME_TO_ISO={COUNTRY_NAME_TO_ISO}
              onCountryClick={toggleFocusCountry}
              onAirportClick={toggleFocusAirport}
              onAirlineClick={toggleFocusAirline}
              onAircraftClick={toggleFocusAircraft}
              onTripClick={toggleFocusTrip}
              onRouteClick={handleRouteClick}
              focusedCountry={focusedCountry}
              focusedAirport={focusedAirport}
              focusedAirline={focusedAirline}
              focusedAircraft={focusedAircraft}
              focusedTrip={focusedTrip}
              focusedRoute={focusedRoute}
              initialRouteSort={routeDetailSort}
            />
          ) : (
            <>
              {/* Section label */}
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: "var(--t-fg3)", letterSpacing: 0.5,
              }}>
                // {[...activeMembers].map(id => id.charAt(0).toUpperCase() + id.slice(1)).join(", ") || "none"} · flights
                {year !== "all" ? ` · ${year}` : ""}
                {focusedAirport ? ` · ${focusedAirport}` : ""}
                {focusedCountry ? ` · ${isoToFlag(focusedCountry)} ${focusedCountry}` : ""}
                {focusedAirline ? ` · ${focusedAirline}` : ""}
                {focusedAircraft ? ` · ${focusedAircraft}` : ""}
                {focusedRoute ? ` · ${focusedRoute.from}→${focusedRoute.to}` : ""}
              </div>

              {/* THE ARC — moved to top */}
              {stats.first && stats.last && (
                <div style={{
                  padding: "14px 16px", borderRadius: 14,
                  background: "linear-gradient(135deg, rgba(108,92,231,0.15) 0%, rgba(255,107,107,0.10) 100%)",
                  border: "1px solid var(--t-acc-25)",
                }}>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: 10,
                    color: "var(--t-accent)", marginBottom: 10,
                    textTransform: "uppercase", letterSpacing: 0.5,
                  }}>// {(focusedAirport || focusedCountry || focusedAirline || focusedAircraft || focusedRoute || focusedReason || focusedClass || focusedSeatType) ? "THE ARC · focused" : "THE ARC"}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--t-fg2)" }}>
                        {stats.first.From} → {stats.first.To}
                      </div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>
                        {fmtDate(stats.first.dateObj)}
                      </div>
                    </div>
                    <div style={{ flex: 2, position: "relative", height: 24 }}>
                      <div style={{
                        position: "absolute", left: 0, right: 0, top: "50%",
                        height: 2, background: "linear-gradient(90deg, #6C5CE7, #FF6B6B, #00D2A0, #FDCB6E)",
                        borderRadius: 2, transform: "translateY(-50%)",
                      }} />
                      <div style={{ position: "absolute", left: 0, top: "50%", width: 8, height: 8, borderRadius: 999, background: "#6C5CE7", transform: "translate(-50%, -50%)" }} />
                      <div style={{ position: "absolute", right: 0, top: "50%", width: 8, height: 8, borderRadius: 999, background: "#FDCB6E", transform: "translate(50%, -50%)" }} />
                    </div>
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--t-fg2)" }}>
                        {stats.last.From} → {stats.last.To}
                      </div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>
                        {fmtDate(stats.last.dateObj)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--t-fg2)", lineHeight: 1.5 }}>
                    {(() => {
                      const yearsSpan = stats.last.dateObj.getFullYear() - stats.first.dateObj.getFullYear();
                      const ctx = focusedAirport ? `via ${focusedAirport}` :
                                  focusedCountry ? `in ${isoToName[focusedCountry] || focusedCountry}` :
                                  focusedAirline ? `on ${focusedAirline}` :
                                  focusedRoute ? `${focusedRoute.from}→${focusedRoute.to}` : null;
                      if (yearsSpan === 0) {
                        return <><span style={{ color: "var(--t-fg)", fontWeight: 500 }}>{stats.first.dateObj.getFullYear()}</span> — {ctx ? <>{stats.count} flight{stats.count === 1 ? "" : "s"} {ctx}.</> : <span style={{ fontStyle: "italic" }}>a single chapter.</span>}</>;
                      }
                      return <><span style={{ color: "var(--t-fg)", fontWeight: 500 }}>{yearsSpan} year{yearsSpan === 1 ? "" : "s"}</span> {ctx ? <>{ctx} — {stats.count} flights.</> : <>between first and latest — <span style={{ fontStyle: "italic" }}>the long arc.</span></>}</>;
                    })()}
                  </div>
                </div>
              )}

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <StatCard label="Flights" value={stats.count} sub={stats.count === 1 ? "flight" : "flights"} onClick={() => setDetailView("flights")} />
                <StatCard label="Countries" value={stats.countries} color="var(--t-stat-mint)" sub="visited" onClick={() => setDetailView("countries")} />
                <StatCard label="Airports" value={stats.airports} sub="touched" onClick={() => setDetailView("airports")} />
                <StatCard label="Distance" value={fmtKm(stats.distance)} sub={`${earthLaps}× Earth`} tooltip={`${fmtNum(stats.distance)} km`} onClick={() => setDetailView("distance")} />
                <StatCard label="Airlines" value={stats.airlines} sub="carriers" onClick={() => setDetailView("airlines")} />
                <StatCard label="Aircraft" value={stats.aircraft} color="var(--t-stat-amber)" sub="types" onClick={() => setDetailView("aircraft")} />
                <StatCard label="Routes" value={stats.routes} color="var(--t-stat-sky)" sub="distinct" onClick={() => { setRouteDetailSort("count"); setDetailView("routes"); }} />
                {stats.totalDurMins > 0 && (
                  <StatCard label="Air Days" value={Math.round(stats.totalDurMins / 1440)} color="var(--t-stat-mint)"
                    sub={`${Math.round(stats.totalDurMins / 60)}h`}
                    onClick={() => setDetailView("duration")} />
                )}
                {stats.nextDayCount > 0 && (
                  <StatCard label="Next Day" value={stats.nextDayCount} color="var(--t-stat-sky)"
                    sub="late arrivals" onClick={() => setDetailView("nextday")} />
                )}
                {stats.birthdayFlights > 0 && (
                  <StatCard label="Birthday ✦" value={stats.birthdayFlights} color="var(--t-stat-blush)"
                    sub="on your b-day" onClick={() => setDetailView("birthday")} />
                )}
                {stats.seats > 0 && (
                  <StatCard label="Seats" value={stats.seats} color="var(--t-stat-violet)" sub="unique" onClick={() => setDetailView("seats")} />
                )}
                {stats.trips > 0 && (
                  <StatCard label="Trips" value={stats.trips} color="var(--t-stat-blush)" sub="journeys" onClick={() => setDetailView("trips")} />
                )}
              </div>

              {/* Chart */}
              {window.StatsChart && allFlights.length > 0 && (
                <window.StatsChart mode="flights" allFlights={allFlights} countriesData={window.COUNTRIES_DATA} activeMembers={activeMembers}
                  width={sidebarWidth - 44}
                  activeYear={year !== "all" ? +year : null}
                  onYearClick={(y) => setYear(prev => prev === String(y) ? "all" : String(y))}
                />
              )}

              {/* Bottom quick-lists */}
              {(() => {
                const secLabel = (label, onClick) => (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                    {onClick && <div onClick={onClick} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-accent)", cursor: "pointer" }}>all →</div>}
                  </div>
                );
                const rowBase = {
                  display: "flex", alignItems: "center",
                  padding: "7px 10px", borderRadius: 8, cursor: "pointer",
                  transition: "background 0.1s",
                };
                const count = (n) => (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", marginLeft: "auto", flexShrink: 0 }}>×{n}</span>
                );
                const hover = { onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.04)", onMouseLeave: e => e.currentTarget.style.background = "transparent" };
                const focused = { background: "var(--t-acc-12)", borderLeft: "2px solid #6C5CE7" };

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                    {/* Top airports */}
                    {stats.topAirports.length > 0 && (
                      <div>
                        {secLabel("// top airports", () => setDetailView("airports"))}
                        {stats.topAirports.map(([iata, n]) => {
                          const ap = window.AIRPORTS[iata];
                          const iso = ap ? COUNTRY_NAME_TO_ISO[ap.country] : null;
                          const isFocused = focusedAirport === iata;
                          return (
                            <div key={iata} onClick={() => toggleFocusAirport(iata)} {...hover}
                              style={{ ...rowBase, ...(isFocused ? focused : {}) }}>
                              {iso && <span style={{ marginRight: 5 }}>{isoToFlag(iso)}</span>}
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#00D2A0" }}>{iata}</span>
                              {ap?.city && <span style={{ fontSize: 11, color: "var(--t-fg3)", marginLeft: 6 }}>{ap.city}</span>}
                              {count(n)}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Top airlines */}
                    {stats.topAirlines.length > 0 && (
                      <div>
                        {secLabel("// top airlines", () => setDetailView("airlines"))}
                        {stats.topAirlines.map(([name, n]) => {
                          const isFocused = focusedAirline === name;
                          return (
                            <div key={name} onClick={() => toggleFocusAirline(name)} {...hover}
                              style={{ ...rowBase, ...(isFocused ? focused : {}) }}>
                              {arcColorMode === "airline" && (
                                <span style={{ width: 7, height: 7, borderRadius: 999, background: airlineColorMap[name] || "#6E6A82", flexShrink: 0, marginRight: 7 }} />
                              )}
                              <span style={{ fontSize: 12 }}>{name}</span>
                              {AIRLINE_ALLIANCES[name] && (
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                                  color: ALLIANCE_COLORS[AIRLINE_ALLIANCES[name]],
                                  border: `1px solid ${ALLIANCE_COLORS[AIRLINE_ALLIANCES[name]]}`,
                                  borderRadius: 4, padding: "1px 4px", marginLeft: 5, flexShrink: 0 }}>
                                  {ALLIANCE_SHORT[AIRLINE_ALLIANCES[name]]}
                                </span>
                              )}
                              {AIRLINE_MM.has(name) && (
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                                  color: "#1E1B2E", background: MM_COLOR,
                                  borderRadius: 4, padding: "1px 3px", marginLeft: 4, flexShrink: 0, fontWeight: 700 }}>
                                  M
                                </span>
                              )}
                              {count(n)}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Top aircraft (grouped) */}
                    {stats.topAircraft.length > 0 && (
                      <div>
                        {secLabel("// top aircraft", () => setDetailView("aircraft"))}
                        {stats.topAircraft.map(([group, n]) => (
                          <div key={group} onClick={() => { setDetailView("aircraft"); }} {...hover}
                            style={{ ...rowBase }}>
                            <span style={{ fontSize: 12 }}>{group}</span>
                            {count(n)}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Top routes */}
                    {stats.topRoutes.length > 0 && (
                      <div>
                        {secLabel("// top routes", () => { setRouteDetailSort("count"); setDetailView("routes"); })}
                        {stats.topRoutes.map(r => {
                          const apF = window.AIRPORTS[r.from], apT = window.AIRPORTS[r.to];
                          const isoF = apF ? COUNTRY_NAME_TO_ISO[apF.country] : null;
                          const isoT = apT ? COUNTRY_NAME_TO_ISO[apT.country] : null;
                          const isFocused = focusedRoute && (
                            (focusedRoute.from === r.from && focusedRoute.to === r.to) ||
                            (focusedRoute.from === r.to   && focusedRoute.to === r.from)
                          );
                          const durStr = r.avgDurMins > 0 ? `${Math.floor(r.avgDurMins/60)}h${String(r.avgDurMins%60).padStart(2,"0")}` : null;
                          // Deduplicate flights by date+airline
                          const seen = new Set();
                          const distinctLegs = r.routeFlights.filter(f => {
                            const key = `${f.Date}|${f.Airline}`;
                            if (seen.has(key)) return false;
                            seen.add(key); return true;
                          });
                          return (
                            <div key={r.from + r.to} style={{ marginBottom: 4 }}>
                              {/* Route header row */}
                              <div onClick={() => handleRouteClick({ from: r.from, to: r.to })} {...hover}
                                style={{ ...rowBase, ...(isFocused ? focused : {}), alignItems: "flex-start" }}>
                                {/* Left: route */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                    {isoF && <span>{isoToFlag(isoF)}</span>}
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#00D2A0" }}>{r.from}</span>
                                    <span style={{ color: "var(--t-fg3)", fontSize: 10, margin: "0 3px" }}>⟷</span>
                                    {isoT && <span>{isoToFlag(isoT)}</span>}
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#00D2A0" }}>{r.to}</span>
                                  </div>
                                </div>
                                {/* Right: count + dist/dur stacked */}
                                <div style={{ textAlign: "right", flexShrink: 0, paddingLeft: 8 }}>
                                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)" }}>×{r.count}</div>
                                  {r.avgDist > 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-fg4)" }}>{fmtNum(r.avgDist)} km</div>}
                                  {durStr && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-fg4)" }}>{durStr}</div>}
                                </div>
                              </div>
                              {/* Flights list: date · airline */}
                              <div style={{ paddingLeft: 10, paddingBottom: 2 }}>
                                {distinctLegs.slice(0, 6).map((f, i) => (
                                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "1px 0" }}>
                                    <span style={{ width: 4, height: 4, borderRadius: 999, background: "#4A4665", flexShrink: 0 }} />
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-fg3)" }}>{f.Date}</span>
                                    {f.Airline && <span style={{ fontSize: 9, color: "var(--t-fg4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.Airline}</span>}
                                  </div>
                                ))}
                                {distinctLegs.length > 6 && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-fg4)", paddingLeft: 9 }}>+{distinctLegs.length - 6} more</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Last trips */}
                    {stats.lastTrips.length > 0 && (
                      <div>
                        {secLabel("// last trips", () => setDetailView("trips"))}
                        {stats.lastTrips.map(t => {
                          const isFocused = focusedTrip === t.code;
                          return (
                            <div key={t.code} onClick={() => toggleFocusTrip(t.code)} {...hover}
                              style={{ ...rowBase, ...(isFocused ? focused : {}) }}>
                              <span style={{ marginRight: 6 }}><LucideIcon name={t.tripIcon} size={12} /></span>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{t.dest}</span>
                              <span style={{ fontSize: 11, color: "var(--t-fg3)", marginLeft: 5 }}>{t.sortDate.getFullYear()}</span>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-fg4)", marginLeft: "auto" }}>{t.code}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Top countries */}
                    {stats.topCountries.length > 0 && (() => {
                      const isoToLocalName = {};
                      Object.entries(COUNTRY_NAME_TO_ISO).forEach(([n, i]) => { if (!isoToLocalName[i]) isoToLocalName[i] = n; });
                      return (
                      <div>
                        {secLabel("// top countries", () => setDetailView("countries"))}
                        {stats.topCountries.map(([iso, n]) => {
                          const name = isoToName[iso] || isoToLocalName[iso] || iso;
                          const isFocused = focusedCountry === iso;
                          return (
                            <div key={iso} onClick={() => toggleFocusCountry(iso)} {...hover}
                              style={{ ...rowBase, ...(isFocused ? focused : {}) }}>
                              <span style={{ marginRight: 6 }}>{isoToFlag(iso)}</span>
                              <span style={{ fontSize: 12 }}>{name}</span>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-fg3)", marginLeft: 5 }}>({iso})</span>
                              {count(n)}
                            </div>
                          );
                        })}
                      </div>
                      );
                    })()}

                    {/* Reason split */}
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>// reason split</div>
                      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.04)", cursor: "pointer" }}>
                        {stats.leisure > 0 && <div onClick={() => toggleFocusReason("L")} title="Filter: Leisure"
                          style={{ flex: stats.leisure, background: "#FF6B6B", opacity: focusedReason && focusedReason !== "L" ? 0.3 : 1 }} />}
                        {stats.biz > 0 && <div onClick={() => toggleFocusReason("B")} title="Filter: Business"
                          style={{ flex: stats.biz, background: "#FDCB6E", opacity: focusedReason && focusedReason !== "B" ? 0.3 : 1 }} />}
                        {stats.other > 0 && <div onClick={() => toggleFocusReason("O")} title="Filter: Other"
                          style={{ flex: stats.other, background: "#A29BFE", opacity: focusedReason && focusedReason !== "O" ? 0.3 : 1 }} />}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg2)" }}>
                        <span onClick={() => toggleFocusReason("L")} style={{ cursor: "pointer", opacity: focusedReason && focusedReason !== "L" ? 0.4 : 1, fontWeight: focusedReason === "L" ? 600 : 400 }}><span style={{ color: "#FF8E8E" }}>●</span> leisure {stats.leisure}</span>
                        <span onClick={() => toggleFocusReason("B")} style={{ cursor: "pointer", opacity: focusedReason && focusedReason !== "B" ? 0.4 : 1, fontWeight: focusedReason === "B" ? 600 : 400 }}><span style={{ color: "#FDCB6E" }}>●</span> business {stats.biz}</span>
                        {stats.other > 0 && <span onClick={() => toggleFocusReason("O")} style={{ cursor: "pointer", opacity: focusedReason && focusedReason !== "O" ? 0.4 : 1, fontWeight: focusedReason === "O" ? 600 : 400 }}><span style={{ color: "var(--t-accent)" }}>●</span> other {stats.other}</span>}
                      </div>
                    </div>

                    {/* Class breakdown */}
                    {Object.keys(stats.classCounts).length > 0 && (() => {
                      const entries = Object.entries(stats.classCounts).sort((a, b) => b[1] - a[1]);
                      const total = entries.reduce((s, [, n]) => s + n, 0);
                      const colors = { "Economy": "#6C5CE7", "Premium Economy": "#00D2A0", "Business": "#FDCB6E", "First": "#FF6B6B" };
                      return (
                        <div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>// class</div>
                          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.04)", marginBottom: 6 }}>
                            {entries.map(([label, n]) => (
                              <div key={label} onClick={() => toggleFocusClass(label)} title={`Filter: ${label}`}
                                style={{ flex: n, background: colors[label] || "#A29BFE", cursor: "pointer", opacity: focusedClass && focusedClass !== label ? 0.3 : 1 }} />
                            ))}
                          </div>
                          {entries.map(([label, n]) => {
                            const isFocused = focusedClass === label;
                            return (
                            <div key={label} onClick={() => toggleFocusClass(label)}
                              onMouseEnter={e => { if (!isFocused) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = isFocused ? "var(--t-acc-12)" : "transparent"; }}
                              style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer", ...(isFocused ? { background: "var(--t-acc-12)", borderLeft: "2px solid #6C5CE7" } : {}) }}>
                              <span style={{ width: 7, height: 7, borderRadius: 2, background: colors[label] || "#A29BFE", flexShrink: 0 }} />
                              <span style={{ color: isFocused ? "#FAFAFA" : "#A9A6BB", flex: 1 }}>{label}</span>
                              <div style={{ flex: 2, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", height: 4 }}>
                                <div style={{ width: `${(n / total * 100).toFixed(1)}%`, height: "100%", background: colors[label] || "#A29BFE" }} />
                              </div>
                              <span style={{ color: "var(--t-fg3)", flexShrink: 0, minWidth: 20, textAlign: "right" }}>{n}</span>
                            </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Seat type breakdown */}
                    {Object.keys(stats.seatTypeCounts).length > 0 && (() => {
                      const entries = Object.entries(stats.seatTypeCounts).sort((a, b) => b[1] - a[1]);
                      const total = entries.reduce((s, [, n]) => s + n, 0);
                      const colors = { "Window": "#74B9FF", "Aisle": "#55EFC4", "Middle": "#FDCB6E" };
                      return (
                        <div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>// seat type</div>
                          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.04)", marginBottom: 6 }}>
                            {entries.map(([label, n]) => (
                              <div key={label} onClick={() => toggleFocusSeatType(label)} title={`Filter: ${label}`}
                                style={{ flex: n, background: colors[label] || "#A29BFE", cursor: "pointer", opacity: focusedSeatType && focusedSeatType !== label ? 0.3 : 1 }} />
                            ))}
                          </div>
                          {entries.map(([label, n]) => {
                            const isFocused = focusedSeatType === label;
                            return (
                            <div key={label} onClick={() => toggleFocusSeatType(label)}
                              onMouseEnter={e => { if (!isFocused) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = isFocused ? "var(--t-acc-12)" : "transparent"; }}
                              style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer", ...(isFocused ? { background: "var(--t-acc-12)", borderLeft: "2px solid #6C5CE7" } : {}) }}>
                              <span style={{ width: 7, height: 7, borderRadius: 2, background: colors[label] || "#A29BFE", flexShrink: 0 }} />
                              <span style={{ color: isFocused ? "#FAFAFA" : "#A9A6BB", flex: 1 }}>{label}</span>
                              <div style={{ flex: 2, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", height: 4 }}>
                                <div style={{ width: `${(n / total * 100).toFixed(1)}%`, height: "100%", background: colors[label] || "#A29BFE" }} />
                              </div>
                              <span style={{ color: "var(--t-fg3)", flexShrink: 0, minWidth: 20, textAlign: "right" }}>{n}</span>
                            </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Manufacturer breakdown */}
                    {Object.keys(stats.mfrCounts).length > 0 && (() => {
                      const entries = Object.entries(stats.mfrCounts).sort((a, b) => b[1] - a[1]);
                      const total = entries.reduce((s, [, n]) => s + n, 0);
                      const colors = { Boeing:"#74B9FF", Airbus:"#FF6B6B", Embraer:"#00D2A0", Bombardier:"#FDCB6E", ATR:"#A29BFE" };
                      return (
                        <div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>// manufacturer</div>
                          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.04)", marginBottom: 6 }}>
                            {entries.map(([label, n]) => (
                              <div key={label} title={`${label}: ${n}`}
                                style={{ flex: n, background: colors[label] || "#A29BFE" }} />
                            ))}
                          </div>
                          {entries.map(([label, n]) => (
                            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 10 }}>
                              <span style={{ width: 7, height: 7, borderRadius: 2, background: colors[label] || "#A29BFE", flexShrink: 0 }} />
                              <span style={{ color: "var(--t-fg2)", flex: 1 }}>{label}</span>
                              <div style={{ flex: 2, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", height: 4 }}>
                                <div style={{ width: `${(n / total * 100).toFixed(1)}%`, height: "100%", background: colors[label] || "#A29BFE" }} />
                              </div>
                              <span style={{ color: "var(--t-fg3)", flexShrink: 0, minWidth: 20, textAlign: "right" }}>{n}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Longest & shortest flights */}
                    {(stats.longestFlight || stats.shortestFlight) && (
                      <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>// flight duration extremes</div>
                        {[
                          { label: "longest", f: stats.longestFlight, color: "#FF6B6B" },
                          { label: "shortest", f: stats.shortestFlight, color: "#55EFC4" },
                        ].filter(x => x.f).map(({ label, f, color }) => (
                          <div key={label} style={{ padding: "7px 10px", borderRadius: 8, marginBottom: 4, background: "rgba(255,255,255,0.02)" }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#00D2A0" }}>{f.From} → {f.To}</span>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: color, marginLeft: "auto" }}>{fmtDur(f.durMins)}</span>
                            </div>
                            <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--t-fg3)", marginTop: 2 }}>{fmtDate(f.dateObj)} · {f.Airline || ""}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Route distance extremes */}
                    {(stats.longestRouteByKm || stats.shortestRouteByKm) && (
                      <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>// route distance extremes</div>
                        {[
                          { label: "longest", r: stats.longestRouteByKm, color: "#FF6B6B", sort: "km-desc" },
                          { label: "shortest", r: stats.shortestRouteByKm, color: "#55EFC4", sort: "km-asc" },
                        ].filter(x => x.r).map(({ label, r, color, sort }) => {
                          const apF = window.AIRPORTS[r.from], apT = window.AIRPORTS[r.to];
                          const isoF = apF ? COUNTRY_NAME_TO_ISO[apF.country] : null;
                          const isoT = apT ? COUNTRY_NAME_TO_ISO[apT.country] : null;
                          return (
                            <div key={label}
                              onClick={() => { setRouteDetailSort(sort); setDetailView("routes"); }}
                              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                              style={{ padding: "7px 10px", borderRadius: 8, marginBottom: 4, background: "rgba(255,255,255,0.02)", cursor: "pointer" }}>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
                              <div style={{ display: "flex", alignItems: "center" }}>
                                {isoF && <span style={{ marginRight: 3 }}>{isoToFlag(isoF)}</span>}
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#00D2A0" }}>{r.from}</span>
                                <span style={{ color: "var(--t-fg3)", fontSize: 10, margin: "0 5px" }}>⟷</span>
                                {isoT && <span style={{ marginRight: 3 }}>{isoToFlag(isoT)}</span>}
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#00D2A0" }}>{r.to}</span>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color, marginLeft: "auto" }}>{fmtNum(r.avgDist)} km</span>
                              </div>
                              <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--t-fg3)", marginTop: 2 }}>×{r.count} flight{r.count > 1 ? "s" : ""}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Compass airports */}
                    {stats.northmost && (
                      <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--t-fg3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>// compass extremes</div>
                        {[
                          { dir: "N", label: "northmost", entry: stats.northmost, color: "#74B9FF" },
                          { dir: "S", label: "southmost", entry: stats.southmost, color: "#55EFC4" },
                          { dir: "E", label: "eastmost",  entry: stats.eastmost,  color: "#FDCB6E" },
                          { dir: "W", label: "westmost",  entry: stats.westmost,  color: "#FF6B6B" },
                        ].filter(x => x.entry).map(({ dir, label, entry: [iata, ap], color }) => {
                          const iso = ap ? COUNTRY_NAME_TO_ISO[ap.country] : null;
                          const coord = dir === "N" || dir === "S"
                            ? `${Math.abs(ap.lat).toFixed(1)}°${dir}`
                            : `${Math.abs(ap.lon).toFixed(1)}°${dir}`;
                          return (
                            <div key={dir} onClick={() => toggleFocusAirport(iata)} {...hover}
                              style={{ ...rowBase }}>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color, minWidth: 18 }}>{dir}</span>
                              {iso && <span style={{ marginRight: 5 }}>{isoToFlag(iso)}</span>}
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#00D2A0" }}>{iata}</span>
                              <span style={{ fontSize: 11, color: "var(--t-fg3)", marginLeft: 6 }}>{ap.city}</span>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-fg4)", marginLeft: "auto" }}>{coord}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                );
              })()}
            </>
          )}
        </aside>
        </>
        )}
      </div>

      {/* Quiz modal */}
      {window.QuizModal && quizOpen && (() => {
        const QuizModal = window.QuizModal;
        return <QuizModal flights={filtered.length > 0 ? filtered : allFlights} onClose={() => setQuizOpen(false)} />;
      })()}

      {/* Tweaks panel */}
      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Globe">
            <window.TweakRadio
              label="Color scheme"
              value={tweaks.scheme}
              onChange={(v) => setTweaks("scheme", v)}
              options={SCHEME_OPTIONS}
            />
            <window.TweakToggle
              label="Airport labels"
              value={showLabels}
              onChange={(v) => { setShowLabels(v); setTweaks("showLabels", v); }}
            />
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
