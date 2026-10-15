
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

export default router;
