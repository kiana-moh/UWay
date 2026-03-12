import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import Onboarding from "./Onboarding";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5001/api";

interface PathPoint {
  lat: number;
  lng: number;
}

interface PathData {
  from: { code: string; name: string };
  to: { code: string; name: string };
  distance: number;
  distance_formatted: string;
  path: PathPoint[];
}

interface ClassSegment {
  className: string;
  fullName: string;
  from?: string | null;
  to?: string | null;
  previousLocation?: string | null;
  location: string;
  time: string;
  component?: string;
  pathData?: PathData;
}

interface Building {
  code: string;
  name: string;
  lat?: number;
  lng?: number;
}

const FALLBACK_BUILDINGS: Building[] = [
  { code: "MC", name: "Mathematics & Computer" },
  { code: "DC", name: "Davis Centre" },
  { code: "E5", name: "Engineering 5" },
  { code: "E7", name: "Engineering 7" },
  { code: "RCH", name: "RCH" },
  { code: "SLC", name: "Student Life Centre" },
  { code: "ML", name: "Modern Languages" },
];

function MapPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [dayOffset, setDayOffset] = useState(0);
  const [scheduleLegs, setScheduleLegs] = useState<ClassSegment[]>([]);
  const [selectedClassIndex, setSelectedClassIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<"schedule" | "quick">("schedule");
  const [buildings, setBuildings] = useState<Building[]>(FALLBACK_BUILDINGS);
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const [buildingsError, setBuildingsError] = useState("");
  const [customFrom, setCustomFrom] = useState(FALLBACK_BUILDINGS[0].code);
  const [customTo, setCustomTo] = useState(FALLBACK_BUILDINGS[1].code);
  const [customPath, setCustomPath] = useState<PathData | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState("");
  const [retryingImport, setRetryingImport] = useState(false);
  const scheduleCacheKey = "uwayScheduleText";
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingDate, setPendingDate] = useState(() => formatDate(new Date()));

  function formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDateInput(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) {
      return new Date(value);
    }
    return new Date(year, month - 1, day);
  }

  const formatDisplayDate = (date: Date) => {
    const today = new Date();
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    if (isToday) {
      return "Today";
    }

    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDateSubtext = (date: Date) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const goToPreviousDay = () => {
    const newOffset = dayOffset - 1;
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + newOffset);
    setDayOffset(newOffset);
    setCurrentDate(newDate);
    setSelectedClassIndex(null);
    setPendingDate(formatDate(newDate));
  };

  const goToNextDay = () => {
    const newOffset = dayOffset + 1;
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + newOffset);
    setDayOffset(newOffset);
    setCurrentDate(newDate);
    setSelectedClassIndex(null);
    setPendingDate(formatDate(newDate));
  };

  const goToToday = () => {
    setDayOffset(0);
    setCurrentDate(new Date());
    setSelectedClassIndex(null);
    setPendingDate(formatDate(new Date()));
  };

  useEffect(() => {
    loadScheduleForDate(currentDate);
  }, [currentDate, dayOffset]);

  useEffect(() => {
    const loadBuildings = async () => {
      setBuildingsLoading(true);
      setBuildingsError("");
      try {
        const response = await fetch(`${API_BASE}/buildings`);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Unable to load buildings");
        }
        const data = await response.json();
        const list = (data.buildings || []) as Building[];
        if (list.length > 0) {
          setBuildings(list);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setBuildingsError(message);
        setBuildings(FALLBACK_BUILDINGS);
      } finally {
        setBuildingsLoading(false);
      }
    };

    loadBuildings();
  }, []);

  useEffect(() => {
    if (buildings.length > 0) {
      if (!buildings.find((b) => b.code === customFrom)) {
        setCustomFrom(buildings[0].code);
      }
      if (!buildings.find((b) => b.code === customTo)) {
        setCustomTo(buildings[Math.min(1, buildings.length - 1)].code);
      }
    }
  }, [buildings, customFrom, customTo]);

  useEffect(() => {
    setCustomPath(null);
    setCustomError("");
  }, [customFrom, customTo]);

  useEffect(() => {
    setRetryingImport(false);
  }, [currentDate, dayOffset]);

  const loadScheduleForDate = async (date: Date) => {
    setLoading(true);
    setError("");
    const dateStr = formatDate(date);

    try {
      const response = await fetch(`${API_BASE}/schedule/travel?date=${dateStr}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load schedule");
      }

      const legs = await response.json();

      if (legs.length === 0) {
        setScheduleLegs([]);
        setError("No classes scheduled for this date.");
        return;
      }

      const segmentsWithPaths: ClassSegment[] = [];
      for (const leg of legs) {
        const baseSegment: ClassSegment = {
          className: leg.className || "Class",
          fullName: leg.fullName || leg.className || "Class",
          from: leg.from ?? null,
          to: leg.to ?? null,
          previousLocation: leg.previousLocation ?? null,
          location: leg.location || `${leg.to ?? leg.from ?? ""}`,
          time: leg.time || "",
          component: leg.component || undefined,
        };

        if (!leg.from || !leg.to) {
          segmentsWithPaths.push(baseSegment);
          continue;
        }

        try {
          const pathResponse = await fetch(`${API_BASE}/path`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: leg.from, to: leg.to }),
          });

          if (pathResponse.ok) {
            const pathData = await pathResponse.json();
            segmentsWithPaths.push({ ...baseSegment, pathData });
          } else {
            segmentsWithPaths.push(baseSegment);
          }
        } catch (err) {
          console.error("Error fetching path for leg:", err);
          segmentsWithPaths.push(baseSegment);
        }
      }

      setScheduleLegs(segmentsWithPaths);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!retryingImport) {
        const cached = localStorage.getItem(scheduleCacheKey);
        if (cached) {
          try {
            setRetryingImport(true);
            const importResponse = await fetch(`${API_BASE}/schedule/import`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: cached }),
            });
            if (importResponse.ok) {
              await loadScheduleForDate(date);
              return;
            }
          } catch (importErr) {
            console.error("Auto-import failed:", importErr);
          }
        }
      }

      setError(message);
      setScheduleLegs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomRoute = async () => {
    if (!customFrom || !customTo) return;
    setCustomLoading(true);
    setCustomError("");
    setSelectedClassIndex(null);

    try {
      const response = await fetch(`${API_BASE}/path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: customFrom, to: customTo }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Unable to load route");
      }

      const pathData = await response.json();
      setCustomPath(pathData);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCustomError(message);
      setCustomPath(null);
    } finally {
      setCustomLoading(false);
    }
  };

  const swapCustomPoints = () => {
    setCustomFrom(customTo);
    setCustomTo(customFrom);
  };

  const clearCustomRoute = () => {
    setCustomPath(null);
    setCustomError("");
  };

  const handleClassClick = (index: number) => {
    setSelectedClassIndex(selectedClassIndex === index ? null : index);
  };

  const selectedLeg = selectedClassIndex !== null ? scheduleLegs[selectedClassIndex] : null;
  const selectedPath = selectedLeg?.pathData ?? null;
  const selectedDistance = selectedLeg?.pathData?.distance_formatted ?? "–";
  const totalDistance = scheduleLegs.reduce((sum, leg) => sum + (leg.pathData?.distance ?? 0), 0);
  const activePath = activeView === "quick" ? customPath : selectedPath;
  const scheduleRouteLabel = selectedLeg
    ? selectedLeg.to
      ? selectedLeg.from
        ? `${selectedLeg.from} → ${selectedLeg.to}`
        : `${selectedLeg.to} (first class)`
      : null
    : null;

  const activeRouteLabel =
    activeView === "quick"
      ? customPath
        ? `${customPath.from.code} → ${customPath.to.code}`
        : `${customFrom} → ${customTo}`
      : scheduleRouteLabel;

  const activeDistance =
    activeView === "quick"
      ? customPath?.distance_formatted ?? "–"
      : selectedLeg?.from && selectedLeg?.to
        ? selectedDistance
        : "—";
  const isToday = dayOffset === 0;

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <div className="sidebar">
        <div className="sidebar-content">
          {/* Header */}
          <div className="header-card">
            <div className="brand-chip">UWay Navigator</div>
            <h1 className="app-title">Plan your day with clarity</h1>
            <p className="app-subtitle">Minimal routes, on-time arrivals, zero confusion.</p>

            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-label">Classes</span>
                <span className="stat-value">{scheduleLegs.length || "—"}</span>
                <span className="stat-hint">on this day</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Route</span>
                <span className="stat-value">
                  {activeView === "quick"
                    ? `${customFrom} → ${customTo}`
                    : selectedLeg
                      ? selectedLeg.from && selectedLeg.to
                        ? `${selectedLeg.from} → ${selectedLeg.to}`
                        : selectedLeg.to
                          ? `${selectedLeg.to} (first class)`
                          : "Tap a class"
                      : "Tap a class"}
                </span>
                <span className="stat-hint">{activeView === "quick" ? "set any two buildings" : "visualize your next walk"}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Distance</span>
                <span className="stat-value">{activeDistance}</span>
                <span className="stat-hint">{activeView === "quick" ? "from building picker" : totalDistance > 0 ? `${(totalDistance / 1000).toFixed(1)} km total` : "awaiting data"}</span>
              </div>
            </div>
          </div>

          <div className="view-toggle">
            <button
              className={`view-btn ${activeView === "schedule" ? "active" : ""}`}
              onClick={() => setActiveView("schedule")}
            >
              Schedule
            </button>
            <button className={`view-btn ${activeView === "quick" ? "active" : ""}`} onClick={() => setActiveView("quick")}>
              Quick route
            </button>
          </div>

          {activeView === "schedule" && (
            <div className="date-nav">
            <div className="date-nav-controls">
              <button className="nav-arrow" onClick={goToPreviousDay} aria-label="Previous day">
                ‹
              </button>
              <div className="date-display">
                <div className="current-date">{formatDisplayDate(currentDate)}</div>
                <div className="date-subtext">{getDateSubtext(currentDate)}</div>
              </div>
              <button className="nav-arrow" onClick={goToNextDay} aria-label="Next day">
                ›
              </button>
              <button className="calendar-btn" onClick={() => setShowDatePicker(!showDatePicker)} aria-label="Pick a date">
                📅
              </button>
            </div>
            {!isToday && (
              <button className="today-btn" onClick={goToToday}>
                Back to Today
              </button>
            )}

            {showDatePicker && (
              <div className="date-picker">
                <label htmlFor="calendar-input">Jump to date</label>
                <input
                  id="calendar-input"
                  type="date"
                  value={pendingDate}
                  onChange={(e) => setPendingDate(e.target.value)}
                />
                <div className="date-picker-actions">
                  <button
                    className="ghost-btn"
                    onClick={() => {
                      setShowDatePicker(false);
                      setPendingDate(formatDate(currentDate));
                    }}
                  >
                    Close
                  </button>
                  <button
                    className="primary-btn"
                    onClick={() => {
                      if (!pendingDate) return;
                      const target = parseDateInput(pendingDate);
                      const today = new Date();
                      const diffDays = Math.floor(
                        (target.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) /
                          (1000 * 60 * 60 * 24)
                      );
                      setDayOffset(diffDays);
                      setCurrentDate(parseDateInput(pendingDate));
                      setSelectedClassIndex(null);
                      setShowDatePicker(false);
                    }}
                  >
                    Go
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {activeView === "quick" && (
            <div className="custom-route-card">
              <div className="custom-route-top">
                <div>
                  <div className="custom-title">Quick route</div>
                  <div className="custom-subtitle">Pick any two buildings and preview the walk.</div>
                </div>
                {customPath && (
                  <button className="ghost-btn" onClick={clearCustomRoute}>
                    Clear
                  </button>
                )}
              </div>
              <div className="custom-fields">
                <div className="custom-field">
                  <label htmlFor="from-select">From</label>
                  <select
                    id="from-select"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    disabled={customLoading || buildingsLoading}
                  >
                    {buildings.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="swap-btn" onClick={swapCustomPoints} aria-label="Swap buildings" disabled={customLoading}>
                  ⇅
                </button>
                <div className="custom-field">
                  <label htmlFor="to-select">To</label>
                  <select
                    id="to-select"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    disabled={customLoading || buildingsLoading}
                  >
                    {buildings.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {buildingsLoading && <div className="custom-note">Loading buildings from server…</div>}
              {buildingsError && <div className="custom-error">{buildingsError}</div>}
              {customError && <div className="custom-error">{customError}</div>}
              <button className="primary-btn" onClick={fetchCustomRoute} disabled={customLoading || buildingsLoading}>
                {customLoading ? "Loading route..." : "Show route"}
              </button>
            </div>
          )}

          {activeView === "schedule" && (
            <div className="schedule-container">
              <h2 className="schedule-title">
                <svg className="schedule-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Classes
              </h2>

              {loading && <div className="loading-message">Loading schedule...</div>}

              {error && !loading && <div className="error-message">{error}</div>}

              {!loading && !error && scheduleLegs.length === 0 && (
                <div className="empty-message">No classes scheduled for this day.</div>
              )}

              {!loading && scheduleLegs.length > 0 && (
                <div className="class-list">
                  {scheduleLegs.map((classItem, index) => (
                    <div
                      key={`${classItem.className}-${index}`}
                      className={`class-item ${selectedClassIndex === index ? "selected" : ""}`}
                      onClick={() => handleClassClick(index)}
                    >
                      <div className="class-number">{index + 1}</div>
                      <div className="class-details">
                        <div className="class-title-row">
                          <div className="class-name">{classItem.className}</div>
                          {classItem.component && (
                            <span className="class-component">{classItem.component}</span>
                          )}
                        </div>
                        <div className="class-fullname">{classItem.fullName}</div>
                        <div className="class-info-row">
                          <svg className="class-icon time" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{classItem.time}</span>
                        </div>
                        <div className="class-info-row">
                          <svg className="class-icon location" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>{classItem.location}</span>
                        </div>
                        {selectedClassIndex === index && (
                          <div className="class-route-info">
                            <svg className="class-route-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            <span>
                              {classItem.from && classItem.to
                                ? `Route from ${classItem.from} to ${classItem.to}`
                                : !classItem.from
                                  ? "No prior class — start of day"
                                  : `No next class — finish at ${classItem.location}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="map-container">
        <div className="map-overlay">
          <div className="map-badge">Route preview</div>
          <div className="map-text">
            {activePath ? (
              <>
                <span>{activeRouteLabel}</span>
                <small>{activeDistance === "–" ? "Distance coming from backend" : activeDistance}</small>
              </>
            ) : activeView === "quick" ? (
              <>
                <span>Pick two buildings and press “Show route”</span>
                <small>Loaded from your campus pathfinder</small>
              </>
            ) : (
              <>
                <span>Choose a class to render its walk</span>
                <small>Paths load from your backend</small>
              </>
            )}
          </div>
        </div>
        <MapContainer
          center={[43.471222, -80.542685]}
          zoom={16.5}
          zoomSnap={0.25}
          minZoom={16}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}" />

          {activePath && activePath.path.length > 0 && (
            <>
              <Polyline
                positions={activePath.path.map((p) => [p.lat, p.lng])}
                pathOptions={{
                  color: "#ec4899",
                  weight: 6,
                  opacity: 0.8,
                }}
              />
              <Marker position={[activePath.path[0].lat, activePath.path[0].lng]}>
                <Popup>
                  <strong>Start: {activePath.from.code}</strong>
                  <br />
                  {activePath.from.name}
                </Popup>
              </Marker>
              <Marker
                position={[
                  activePath.path[activePath.path.length - 1].lat,
                  activePath.path[activePath.path.length - 1].lng,
                ]}
              >
                <Popup>
                  <strong>End: {activePath.to.code}</strong>
                  <br />
                  {activePath.to.name}
                </Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Onboarding />} />
        <Route path="/onboarding" element={<Navigate to="/" replace />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
