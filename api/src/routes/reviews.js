import { Router } from 'express';
import { getMongoDb } from '../db.js';
import { demoReviews, demoMenus } from '../demo.js';

const router = Router();

const reviewCollection = () =>
  process.env.REVIEWS_COLLECTION || 'Reviews';

router.get('/analytics', async (req, res, next) => {
  if (process.env.DEMO_MODE === 'true') {
    return res.json({
      data: demoReviews,
      source: 'demo',
    });
  }

  try {
    const db = await getMongoDb();

    const [facet] = await db
      .collection(reviewCollection())
      .aggregate([
        {
          $facet: {
            ratingDistribution: [
              {
                $group: {
                  _id: '$rating',
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: -1 } },
            ],

            topTags: [
              { $unwind: '$sentiment_tags' },
              {
                $group: {
                  _id: '$sentiment_tags',
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 } },
              { $limit: 10 },
            ],

            overall: [
              {
                $group: {
                  _id: null,
                  averageRating: { $avg: '$rating' },
                  totalReviews: { $sum: 1 },
                },
              },
            ],

            restaurants: [
              {
                $group: {
                  _id: '$restaurant_id',
                  averageRating: { $avg: '$rating' },
                  totalReviews: { $sum: 1 },
                },
              },
              { $sort: { totalReviews: -1 } },
              { $limit: 10 },
            ],
          },
        },
      ])
      .toArray();

    const overall = facet?.overall?.[0] ?? {
      averageRating: 0,
      totalReviews: 0,
    };

    const data = {
      averageRating: overall.averageRating ?? 0,
      totalReviews: overall.totalReviews ?? 0,

      distribution: (facet?.ratingDistribution ?? []).map((item) => ({
        rating: item._id,
        count: item.count,
      })),

      topTags: (facet?.topTags ?? []).map((item) => ({
        tag: item._id,
        count: item.count,
      })),

      restaurants: (facet?.restaurants ?? []).map((item) => ({
        restaurant_id: item._id,
        averageRating: item.averageRating,
        totalReviews: item.totalReviews,
      })),
    };

    return res.json({
      data,
      source: 'mongodb',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/menus', async (req, res, next) => {
  if (process.env.DEMO_MODE === 'true') {
    return res.json({
      data: demoMenus,
      source: 'demo',
    });
  }

  try {
    const db = await getMongoDb();

    const data = await db
      .collection(process.env.MENUS_COLLECTION || 'Menus')
      .find({})
      .limit(100)
      .toArray();

    return res.json({
      data,
      source: 'mongodb',
    });
  } catch (error) {
    next(error);
  }
});

export default router;