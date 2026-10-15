
import { Router } from 'express';
import { getMongoDb } from '../db.js';
import { demoPings } from '../demo.js';

const router = Router();

const NEAREST_LIMIT = 20;

router.get('/nearby', async (req, res, next) => {
  const lat = Number(req.query.lat ?? 17.3850);
  const lng = Number(req.query.lng ?? 78.4867);
  const radiusKm = Math.min(
    5,
    Math.max(0.1, Number(req.query.radiusKm ?? 5))
  );

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return res.status(400).json({
      error: 'Provide valid lat and lng coordinates.'
    });
  }

  if (process.env.DEMO_MODE === 'true') {
    return res.json({
      origin: { lat, lng },
      radiusKm,
      data: demoPings.filter(
        p => p.distanceMeters <= radiusKm * 1000
      ),
      source: 'demo'
    });
  }

  try {
    const db = await getMongoDb();

    const collection =
      process.env.DRIVER_PINGS_COLLECTION || 'DriverPings';

    // Workflow 3. Each driver sends many pings, so after $geoNear the pings
    // are grouped per driver, keeping the latest ping and its distance (the
    // marker and the listed distance then agree), and sorted nearest first.
    const data = await db.collection(collection).aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [lng, lat] // GeoJSON order is [longitude, latitude]
          },
          key: 'location',
          distanceField: 'distanceMeters',
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: { active: true }
        }
      },
      { $sort: { driver_id: 1, created_at: -1 } },
      {
        $group: {
          _id: '$driver_id',
          location: { $first: '$location' },
          created_at: { $first: '$created_at' },
          distanceMeters: { $first: '$distanceMeters' }
        }
      },
      { $sort: { distanceMeters: 1, _id: 1 } },
      { $limit: NEAREST_LIMIT },
      {
        $project: {
          _id: 0,
          driver_id: '$_id',
          location: 1,
          distanceMeters: 1,
          created_at: 1
        }
      }
    ], { allowDiskUse: true }).toArray();

    res.json({
      origin: { lat, lng },
      radiusKm,
      data,
      source: 'mongodb'
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/map/simulate-pings   body (optional): { lat, lng }
//
// Demo ping simulator (Kodavali Sai). DriverPings has a 2-hour TTL index, so
// without new pings the map empties during a demo. Each call sends a fresh
// ping for active drivers: their latest position, moved up to ~40 m, stamped
// now. With an origin, drivers within 5 km of it are moved; if fewer than 5
// are left there, a few active drivers are brought into the area so the
// $geoNear list never goes empty.
const SIMULATED_DRIVERS = 30;
const jitter = () => (Math.random() - 0.5) * 0.0008; // ~±40 m

router.post('/simulate-pings', async (req, res, next) => {
  if (process.env.DEMO_MODE === 'true') return res.json({ data: { inserted: 0 }, source: 'demo' });

  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const hasOrigin = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

    const db = await getMongoDb();
    const pings = db.collection(process.env.DRIVER_PINGS_COLLECTION || 'DriverPings');

    const latestPerDriver = [
      { $sort: { driver_id: 1, created_at: -1 } },
      { $group: { _id: '$driver_id', location: { $first: '$location' } } },
    ];

    // With an origin: the drivers the map is showing (nearest first), so the
    // visible markers are the ones that move.
    let drivers = hasOrigin
      ? await pings.aggregate([
          { $geoNear: { near: { type: 'Point', coordinates: [lng, lat] }, key: 'location', distanceField: 'd', maxDistance: 5000, spherical: true, query: { active: true } } },
          { $sort: { driver_id: 1, created_at: -1 } },
          { $group: { _id: '$driver_id', location: { $first: '$location' }, d: { $first: '$d' } } },
          { $sort: { d: 1 } },
          { $limit: SIMULATED_DRIVERS },
        ], { allowDiskUse: true }).toArray()
      : await pings.aggregate([
          { $match: { active: true } },
          ...latestPerDriver,
          { $limit: SIMULATED_DRIVERS },
        ], { allowDiskUse: true }).toArray();

    if (hasOrigin && drivers.length < 5) {
      const nearby = new Set(drivers.map((d) => d._id));
      const extra = await pings.aggregate([
        { $match: { active: true } },
        { $group: { _id: '$driver_id' } },
        { $sample: { size: 10 } },
      ]).toArray();
      for (const { _id } of extra) {
        if (nearby.has(_id)) continue;
        // Somewhere within ~3 km of the origin.
        drivers.push({ _id, location: { type: 'Point', coordinates: [lng + (Math.random() - 0.5) * 0.05, lat + (Math.random() - 0.5) * 0.05] } });
      }
    }

    if (!drivers.length) return res.json({ data: { inserted: 0 }, source: 'mongodb' });

    const now = new Date();
    await pings.insertMany(drivers.map(({ _id, location }) => ({
      driver_id: _id,
      active: true,
      location: { type: 'Point', coordinates: [location.coordinates[0] + jitter(), location.coordinates[1] + jitter()] },
      created_at: now,
    })), { ordered: false });

    res.json({ data: { inserted: drivers.length }, source: 'mongodb' });
  } catch (e) {
    next(e);
  }
});

export default router;
