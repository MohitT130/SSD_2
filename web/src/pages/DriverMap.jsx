import { useCallback, useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, MousePointerClick, Radio, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import Panel from '../components/Panel';
import RestaurantPicker from '../components/RestaurantPicker';
import { EmptyState, ErrorBanner } from '../components/ui';
import { colors } from '../theme';

const RADIUS_KM = 5;
const POLL_MS = 10000;

const originIcon = L.divIcon({
  className: 'origin-marker-wrap',
  html: '<div class="origin-marker"><span></span></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -28],
});
const driverIcon = (selected) => L.divIcon({
  className: 'driver-marker-wrap',
  html: `<div class="driver-marker${selected ? ' selected' : ''}"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const formatDistance = (meters) =>
  meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;

function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (!Number.isFinite(minutes)) return '—';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`;
}

// GeoJSON stores [longitude, latitude]; Leaflet wants [latitude, longitude].
const toLatLng = (driver) => [driver.location.coordinates[1], driver.location.coordinates[0]];

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom()); }, [center, map]);
  return null;
}

function PickOnClick({ onPick }) {
  useMapEvents({ click: (event) => onPick(event.latlng) });
  return null;
}

// Screen 5: Workflow 3. Nearest active drivers ($geoNear) around a
// restaurant from PostgreSQL or a point clicked on the map.
export default function DriverMap() {
  const [origin, setOrigin] = useState(null); // { lat, lng, label, restaurant }
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [polling, setPolling] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [map, setMap] = useState(null);

  // Default origin: the first restaurant.
  useEffect(() => {
    api.restaurants({ pageSize: 1 })
      .then((result) => {
        const first = result.data[0];
        if (first) setOrigin({ lat: first.latitude, lng: first.longitude, label: first.name, restaurant: first });
        else setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  // `simulate`: on each live poll, first send fresh pings around the origin
  // (POST /map/simulate-pings) so drivers move and the 2-hour TTL never
  // empties the map during a demo.
  const load = useCallback(async (simulate = false) => {
    if (!origin) return;
    setError('');
    try {
      if (simulate) await api.simulatePings(origin.lat, origin.lng).catch(() => {});
      const result = await api.nearby(origin.lat, origin.lng, RADIUS_KM);
      setDrivers(result.data);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [origin]);

  // Load now, then poll so new pings appear without a page reload.
  useEffect(() => {
    if (!origin) return undefined;
    setLoading(true);
    setSelectedId(null);
    load();
    if (!polling) return undefined;
    const timer = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [origin, polling, load]);

  const center = useMemo(() => (origin ? [origin.lat, origin.lng] : [17.41, 78.38]), [origin]);

  function selectDriver(driver) {
    setSelectedId(driver.driver_id);
    map?.flyTo(toLatLng(driver), Math.max(map.getZoom(), 15), { duration: .6 });
  }

  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">Workflow 3 · Dispatch</div>
          <h1>Live driver map</h1>
          <p className="page-description">Active drivers within {RADIUS_KM} km of a restaurant, nearest first, from a <code>$geoNear</code> query on <code>DriverPings</code>. Click the map to search around any point.</p>
        </div>
        <button className="button secondary" onClick={() => load()} disabled={!origin}>
          <RefreshCw size={16} /> Refresh now
        </button>
      </div>

      <ErrorBanner message={error} onRetry={() => load()} />

      <div className="map-toolbar">
        <label className="origin-select">
          <span>Origin restaurant</span>
          <RestaurantPicker
            value={origin?.restaurant ?? (origin ? { name: origin.label } : null)}
            onChange={(r) => setOrigin({ lat: r.latitude, lng: r.longitude, label: r.name, restaurant: r })}
          />
        </label>
        <div className="radius-chip"><MapPin size={16} /> {RADIUS_KM} km radius</div>
        <label className="poll-toggle">
          <input type="checkbox" checked={polling} onChange={(event) => setPolling(event.target.checked)} />
          Live updates
          <span className={`live-dot ${polling ? '' : 'paused'}`} />
        </label>
      </div>

      <div className="map-layout">
        <Panel
          title="Nearest active drivers"
          subtitle={loading && !drivers.length ? 'Searching…' : `${drivers.length} driver${drivers.length === 1 ? '' : 's'} within ${RADIUS_KM} km of ${origin?.label ?? '…'}`}
          className="drivers-panel"
        >
          <div className="driver-list">
            {loading && !drivers.length ? (
              <div className="chart-empty">Finding drivers…</div>
            ) : drivers.length ? drivers.map((driver, index) => (
              <button
                type="button"
                key={driver.driver_id}
                className={`driver-row ticket ${selectedId === driver.driver_id ? 'selected' : ''}`}
                onClick={() => selectDriver(driver)}
              >
                <div className="driver-avatar">{index + 1}</div>
                <div className="driver-info">
                  <strong>Driver #{driver.driver_id}</strong>
                  <span>Last ping {timeAgo(driver.created_at)} · <span className="available-text">Active</span></span>
                </div>
                <div className="driver-distance">{formatDistance(driver.distanceMeters)}<small>away</small></div>
              </button>
            )) : (
              <EmptyState
                icon={MapPin}
                title={`No active drivers within ${RADIUS_KM} km`}
                text="Pings expire after 2 hours. Pick another restaurant, or re-run the Mongo seeder."
              />
            )}
          </div>
          <div className="map-list-footer">
            <Radio size={15} />
            {polling ? `Updating every ${POLL_MS / 1000} s` : 'Live updates paused'}
            {lastUpdate && <span>Updated {lastUpdate.toLocaleTimeString('en-IN')}</span>}
          </div>
        </Panel>

        <Panel title="Map" subtitle="OpenStreetMap · click anywhere to move the origin" className="leaflet-panel">
          <div className="leaflet-frame">
            <MapContainer center={center} zoom={14} scrollWheelZoom className="leaflet-map" ref={setMap}>
              <Recenter center={center} />
              <PickOnClick onPick={({ lat, lng }) => setOrigin({ lat, lng, label: 'pinned location', restaurant: null })} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Circle
                center={center}
                radius={RADIUS_KM * 1000}
                pathOptions={{ color: colors.brand, fillColor: colors.brand, fillOpacity: 0.06, weight: 1.5, dashArray: '6 6' }}
              />
              {origin && (
                <Marker position={center} icon={originIcon}>
                  <Popup><strong>{origin.restaurant ? origin.label : 'Pinned location'}</strong><br />Search origin</Popup>
                </Marker>
              )}
              {drivers.map((driver) => (
                <Marker
                  key={driver.driver_id}
                  position={toLatLng(driver)}
                  icon={driverIcon(selectedId === driver.driver_id)}
                  eventHandlers={{ click: () => setSelectedId(driver.driver_id) }}
                >
                  <Popup>
                    <strong>Driver #{driver.driver_id}</strong><br />
                    {formatDistance(driver.distanceMeters)} away · last ping {timeAgo(driver.created_at)}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          <div className="map-legend">
            <span><i className="legend-origin" /> Search origin</span>
            <span><i className="legend-driver" /> Active driver</span>
            <span><i className="legend-radius" /> {RADIUS_KM} km radius</span>
            <span><MousePointerClick size={13} /> Click the map to move the origin</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
