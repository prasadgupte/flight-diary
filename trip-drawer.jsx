// TripActivityDrawer — slide-up detail panel for selected activity

function TripActivityDrawer({ entry, day, trip, onClose }) {
  const [visible, setVisible] = React.useState(false);

  // Animate in on mount
  React.useEffect(() => {
    if (entry) {
      requestAnimationFrame(() => setVisible(true));
    }
  }, [entry]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300); // wait for animation
  };

  if (!entry) return null;

  const data = entry.data;
  const currency = trip.currency || {};

  const formatCost = (cost) => {
    if (!cost) return null;
    const rate = currency[cost.currency] || 1;
    const eur = Math.round(cost.amount * rate);
    const sym = cost.currency === "JPY" ? "¥" : cost.currency === "KRW" ? "₩" : cost.currency === "CNY" ? "¥" : "€";
    return `${sym}${cost.amount.toLocaleString()} (~€${eur})`;
  };

  const mapsUrl = entry.coords
    ? `https://www.google.com/maps/search/?api=1&query=${entry.coords[0]},${entry.coords[1]}`
    : null;

  return (
    <React.Fragment>
      {/* Backdrop */}
      <div
        className={`td-drawer-backdrop ${visible ? "td-drawer-backdrop--visible" : ""}`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div className={`td-drawer ${visible ? "td-drawer--open" : ""}`}>
        {/* Handle */}
        <div className="td-drawer__handle" onClick={handleClose}>
          <div className="td-drawer__handle-bar" />
        </div>

        {/* Header */}
        <div className="td-drawer__header">
          <div className="td-drawer__title">
            <span className="td-drawer__icon">{entry.icon}</span>
            {entry.title}
          </div>
          <button className="td-drawer__close" onClick={handleClose}>✕</button>
        </div>

        {/* Meta */}
        <div className="td-drawer__meta">
          <span className="td-drawer__badge" style={{ "--badge-color": entry.color }}>
            {entry.type}
          </span>
          {entry.time && <span className="td-drawer__time">{entry.time}</span>}
          {entry.cost && <span className="td-drawer__cost">{entry.cost}</span>}
        </div>

        {/* Details based on entry kind */}
        <div className="td-drawer__body">
          {entry.kind === "activity" && data && (
            <div className="td-drawer__detail-grid">
              {data.type && (
                <div className="td-drawer__detail-row">
                  <span className="td-drawer__detail-label">Type</span>
                  <span className="td-drawer__detail-value">{data.type}</span>
                </div>
              )}
              {data.cost && (
                <div className="td-drawer__detail-row">
                  <span className="td-drawer__detail-label">Cost</span>
                  <span className="td-drawer__detail-value">{formatCost(data.cost)}</span>
                </div>
              )}
            </div>
          )}

          {entry.kind === "transport" && data && (
            <div className="td-drawer__detail-grid">
              <div className="td-drawer__detail-row">
                <span className="td-drawer__detail-label">Route</span>
                <span className="td-drawer__detail-value">{data.from.name} → {data.to.name}</span>
              </div>
              {data.status && (
                <div className="td-drawer__detail-row">
                  <span className="td-drawer__detail-label">Status</span>
                  <span className="td-drawer__detail-value">{data.status}{data.ref ? ` · ${data.ref}` : ""}</span>
                </div>
              )}
              {data.jrPass && (
                <div className="td-drawer__detail-row">
                  <span className="td-drawer__detail-label">Pass</span>
                  <span className="td-drawer__detail-value">🎫 JR Pass covered</span>
                </div>
              )}
            </div>
          )}

          {entry.kind === "accommodation" && data && (
            <div className="td-drawer__detail-grid">
              <div className="td-drawer__detail-row">
                <span className="td-drawer__detail-label">Type</span>
                <span className="td-drawer__detail-value">{data.type}</span>
              </div>
              <div className="td-drawer__detail-row">
                <span className="td-drawer__detail-label">Dates</span>
                <span className="td-drawer__detail-value">{data.dates.in} → {data.dates.out}</span>
              </div>
              {data.cost && (
                <div className="td-drawer__detail-row">
                  <span className="td-drawer__detail-label">Cost</span>
                  <span className="td-drawer__detail-value">{formatCost(data.cost)}</span>
                </div>
              )}
              {data.status && (
                <div className="td-drawer__detail-row">
                  <span className="td-drawer__detail-label">Status</span>
                  <span className="td-drawer__detail-value">{data.status}{data.ref ? ` · ref ${data.ref}` : ""}</span>
                </div>
              )}
              {data.cancelBy && (
                <div className="td-drawer__detail-row">
                  <span className="td-drawer__detail-label">Cancel by</span>
                  <span className="td-drawer__detail-value">{data.cancelBy}</span>
                </div>
              )}
              {data.amenities && data.amenities.length > 0 && (
                <div className="td-drawer__detail-row">
                  <span className="td-drawer__detail-label">Amenities</span>
                  <span className="td-drawer__detail-value">{data.amenities.join(", ")}</span>
                </div>
              )}
            </div>
          )}

          {/* Groups info if day has splits */}
          {day && day.groups && day.groups.length > 1 && (
            <div className="td-drawer__groups">
              <div className="td-drawer__groups-title">Groups</div>
              {day.groups.map((g, i) => (
                <div key={i} className="td-drawer__group-row">
                  <span className="td-drawer__group-codes">{g.travelers.join(", ")}</span>
                  {g.label && <span className="td-drawer__group-label">{g.label}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Links */}
        <div className="td-drawer__links">
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener" className="td-drawer__link">
              📍 Open in Maps
            </a>
          )}
          {data && data.links && Object.entries(data.links).map(([key, url]) => (
            <a key={key} href={url} target="_blank" rel="noopener" className="td-drawer__link">
              {key}
            </a>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}

window.TripActivityDrawer = TripActivityDrawer;
