
import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin,
  RefreshCw,
  Navigation,
  Radio,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';
import Panel from '../components/Panel';
import RestaurantPicker from '../components/RestaurantPicker';

const driverIcon = L.divIcon({
  className: 'driver-marker-wrap',
  html: '<div class="driver-marker"><span></span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function Recenter({ center }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  return null;
}

function getCoordinates(driver) {
  if (
    Number.isFinite(driver.latitude) &&
    Number.isFinite(driver.longitude)
  ) {
    return [driver.latitude, driver.longitude];
  }

  const coordinates = driver.location?.coordinates;

  if (
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    Number.isFinite(coordinates[0]) &&
    Number.isFinite(coordinates[1])
  ) {
    // GeoJSON stores [longitude, latitude].
    return [coordinates[1], coordinates[0]];
  }

  return null;
}

function formatDistance(meters) {
  const distance = Number(meters);

  if (!Number.isFinite(distance)) return 'Distance unavailable';

  return distance < 1000
    ? `${Math.round(distance)} m`
    : `${(distance / 1000).toFixed(2)} km`;
}

export default function DriverMap() {
  const [restaurant, setRestaurant] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [polling, setPolling] = useState(true);

  const origin = restaurant ? { label: restaurant.name, lat: Number(restaurant.latitude), lng: Number(restaurant.longitude) } : null;

  async function load(isPoll = false) {
    if (!isPoll) setLoading(true);

    setError('');

    try {
      if (!origin) { setDrivers([]); setLoading(false); return; }
      if (polling) await api.simulatePings().catch(() => {});
      const result = await api.nearby(origin.lat, origin.lng, 5, restaurant.id);

      const rows = Array.isArray(result.data) ? result.data : [];

      const nearbyDrivers = rows
        .map((driver, index) => ({
          ...driver,
          _coords: getCoordinates(driver),
          _id:
            driver.driver_id ??
            driver.driverId ??
            driver._id ??
            index,
        }))
        .filter((driver) => driver._coords)
        .sort(
          (a, b) =>
            Number(a.distanceMeters ?? Infinity) -
            Number(b.distanceMeters ?? Infinity)
        );

      setDrivers(nearbyDrivers);
      setSource(result.source || '');
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message || 'Unable to load nearby drivers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function pollDrivers() {
      if (cancelled) return;

      await load();

      if (!cancelled && polling) {
        timer = setTimeout(pollDrivers, 5000);
      }
    }

    pollDrivers();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [restaurant?.id, polling]);

  const center = useMemo(
    () => origin ? [origin.lat, origin.lng] : [17.4, 78.4],
    [origin?.lat, origin?.lng]
  );

  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">REAL-TIME OPERATIONS</div>
          <h1>Driver map</h1>
          <p className="page-description">
            Find available drivers near a selected restaurant,
            sorted by proximity.
          </p>
        </div>

        <button
          className="button secondary"
          onClick={() => load()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh now
        </button>
      </div>

      {source === 'demo' && (
        <div className="demo-banner">
          <span className="demo-dot" />
          Demo locations are displayed.
        </div>
      )}

      {error && (
        <div className="error-banner">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button onClick={() => load()}>Retry</button>
        </div>
      )}

      {!restaurant && <div className="empty-inline">Choose a restaurant to search for nearby drivers.</div>}
      <div className="map-toolbar">
        <label className="origin-select"><span>Restaurant origin</span></label>
        <RestaurantPicker value={restaurant} onChange={setRestaurant} disabled={loading} />

        <div className="radius-chip">
          <MapPin size={16} />
          5 km radius
        </div>

        <label className="poll-toggle">
          <input
            type="checkbox"
            checked={polling}
            onChange={(event) => setPolling(event.target.checked)}
          />
          Live updates
          <span className="live-dot" />
        </label>
      </div>

      <div className="map-layout">
        <Panel
          title="Nearby drivers"
          subtitle={`${drivers.length} available within 5 km`}
          className="drivers-panel"
        >
          <div className="driver-list">
            {loading && drivers.length === 0 ? (
              <div className="chart-empty">
                Loading nearby drivers…
              </div>
            ) : (
              drivers.map((driver, index) => (
                <button
                  className="driver-row"
                  key={driver._id}
                  type="button"
                  onClick={() => {
                    // Marker popups identify the selected driver.
                    const mapElement = document.querySelector(
                      '.leaflet-map'
                    );
                    mapElement?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'nearest',
                    });
                  }}
                >
                  <div className="driver-avatar">
                    <Navigation size={17} />
                  </div>

                  <div className="driver-info">
                    <strong>
                      {driver.driverName ||
                        driver.name ||
                        `Driver ${driver.driver_id ?? index + 1}`}
                    </strong>

                    <span>
                      ID: {driver.driver_id ?? driver.driverId ?? '—'}
                      {' · '}
                      <span className="available-text">
                        Available
                      </span>
                    </span>
                  </div>

                  <div className="driver-distance">
                    {formatDistance(driver.distanceMeters)}
                    <small>away</small>
                  </div>
                </button>
              ))
            )}

            {!loading && drivers.length === 0 && (
              <div className="empty-state">
                <MapPin size={25} />
                <strong>No drivers nearby</strong>
                <span>
                  Try the test location or refresh later.
                </span>
              </div>
            )}
          </div>

          <div className="map-list-footer">
            <Radio size={15} />
            {polling
              ? 'Polling every 10 seconds'
              : 'Live updates paused'}

            {lastUpdate && (
              <span>
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </Panel>

        <Panel
          title="Live location"
          subtitle="OpenStreetMap · approximate driver positions"
          className="leaflet-panel"
        >
          <div className="leaflet-frame">
            <MapContainer
              center={center}
              zoom={14}
              scrollWheelZoom
              className="leaflet-map"
            >
              <Recenter center={center} />

              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <Circle
                center={center}
                radius={5000}
                pathOptions={{
                  color: '#5279e7',
                  fillColor: '#5279e7',
                  fillOpacity: 0.06,
                  weight: 1.5,
                  dashArray: '5 6',
                }}
              />

              <Marker position={center}>
                <Popup>
                  {origin?.label || 'No restaurant selected'}
                  <br />
                  Selected origin
                </Popup>
              </Marker>

              {drivers.map((driver, index) => (
                <Marker
                  key={driver._id ?? index}
                  position={driver._coords}
                  icon={driverIcon}
                >
                  <Popup>
                    <strong>
                      {driver.driverName ||
                        driver.name ||
                        `Driver ${driver.driver_id ?? index + 1}`}
                    </strong>
                    <br />
                    ID: {driver.driver_id ?? '—'}
                    <br />
                    {formatDistance(driver.distanceMeters)} away
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="map-legend">
            <span>
              <i className="legend-origin" /> Selected origin
            </span>
            <span>
              <i className="legend-driver" /> Available driver
            </span>
            <span>
              <i className="legend-radius" /> 5 km radius
            </span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
