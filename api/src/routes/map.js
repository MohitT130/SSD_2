
import { Router } from 'express';
import { getMongoDb } from '../db.js';
import { demoPings } from '../demo.js';

const router = Router();

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

    const data = await db.collection(collection).aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          key: 'location',
          distanceField: 'distanceMeters',
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: { active: true }
        }
      },
      { $limit: 100 },
      {
        $project: {
          _id: 0,
          driver_id: 1,
          active: 1,
          location: 1,
          distanceMeters: 1,
          created_at: 1
        }
      }
    ]).toArray();

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
