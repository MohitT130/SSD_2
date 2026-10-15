import { Router } from 'express';
import { getMongoDb } from '../db.js';
import { getPgPool } from '../db.js';
import { demoPings } from '../demo.js';
const router=Router();

router.post('/simulate-pings',async(req,res,next)=>{
 if(process.env.DEMO_MODE==='true') return res.json({success:true,inserted:0,source:'demo'});
 try{
  const db=await getMongoDb();
  const drivers=await db.collection(process.env.DRIVER_PINGS_COLLECTION||'DriverPings').aggregate([
   {$match:{active:true}},{$sort:{created_at:-1}},{$group:{_id:'$driver_id',location:{$first:'$location'}}},{$limit:50}
  ]).toArray();
  if(!drivers.length) return res.json({success:true,inserted:0,source:'mongodb'});
  const now=new Date();
  await db.collection(process.env.DRIVER_PINGS_COLLECTION||'DriverPings').insertMany(drivers.map(d=>({driver_id:d._id,active:true,location:d.location,created_at:now})),{ordered:false});
  res.json({success:true,inserted:drivers.length,source:'mongodb'});
 }catch(e){next(e)}
});

router.get('/nearby',async(req,res,next)=>{
 const restaurantId=req.query.restaurantId;
 const radiusKm=Math.min(5,Math.max(.1,Number(req.query.radiusKm??5)));
 try{
  let lat=Number(req.query.lat),lng=Number(req.query.lng);
  if(restaurantId){
   if(!/^[0-9a-f-]{36}$/i.test(restaurantId)) return res.status(400).json({error:'Invalid restaurantId.',code:'INVALID_RESTAURANT_ID'});
   const r=await getPgPool().query('SELECT latitude,longitude FROM restaurants WHERE id=$1',[restaurantId]);
   if(!r.rowCount) return res.status(404).json({error:'Restaurant not found.',code:'RESTAURANT_NOT_FOUND'});
   lat=Number(r.rows[0].latitude); lng=Number(r.rows[0].longitude);
  }
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180) return res.status(400).json({error:'Choose a restaurant or provide valid coordinates.',code:'INVALID_ORIGIN'});
  if(process.env.DEMO_MODE==='true') return res.json({origin:{lat,lng},radiusKm,data:demoPings.filter(p=>p.distanceMeters<=radiusKm*1000),source:'demo'});
  const db=await getMongoDb();
  const data=await db.collection(process.env.DRIVER_PINGS_COLLECTION||'DriverPings').aggregate([
   {$geoNear:{near:{type:'Point',coordinates:[lng,lat]},key:'location',distanceField:'distanceMeters',maxDistance:radiusKm*1000,spherical:true,query:{active:true}}},
   {$sort:{created_at:-1}},
   {$group:{_id:'$driver_id',latestPing:{$first:'$$ROOT'},minDistance:{$min:'$distanceMeters'}}},
   {$replaceRoot:{newRoot:{$mergeObjects:['$latestPing',{distanceMeters:'$minDistance'}]}}},
   {$sort:{distanceMeters:1}},{$limit:20},
   {$project:{_id:0,driver_id:1,active:1,location:1,distanceMeters:1,created_at:1}}
  ]).toArray();
  res.json({origin:{lat,lng},radiusKm,data,source:'mongodb'});
 }catch(e){next(e)}
});
export default router;
