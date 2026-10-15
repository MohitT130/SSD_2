
db = db.getSiblingDB("BiteStream")

// Workflow 3: active drivers within 5 km of an origin, nearest first.
//
// [Team 26] The original ended with `$limit: 1`, so it returned a single
// ping, and because every driver sends many pings a plain list repeated the
// same driver (62,770 pings from 7,038 drivers within 5 km). The pings are
// now grouped per driver (latest ping and its distance), sorted by distance
// and limited to the 20 nearest drivers. The API (api/src/routes/map.js)
// runs the same pipeline with the origin chosen on the Map screen.
db.DriverPings.aggregate([
  {
    $geoNear: {
      near: {
        type: "Point",
        coordinates: [78.4071, 17.4483]   // [longitude, latitude]
      },
      distanceField: "distance",
      maxDistance: 5000,
      spherical: true,
      query: {
        active: true
      }
    }
  },
  { $sort: { driver_id: 1, created_at: -1 } },
  {
    $group: {
      _id: "$driver_id",
      location: { $first: "$location" },
      created_at: { $first: "$created_at" },
      distance: { $first: "$distance" }
    }
  },
  { $sort: { distance: 1, _id: 1 } },
  { $limit: 20 }
], { allowDiskUse: true }).forEach(printjson)
