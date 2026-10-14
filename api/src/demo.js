const days = ['Oct 08','Oct 09','Oct 10','Oct 11','Oct 12','Oct 13','Oct 14'];
export const demoMovingAverage = days.map((day, i) => ({ date: day, restaurant: 'All restaurants', dailyRevenue: [12500,14100,13200,15800,16900,15400,18100][i], movingAverage: [12500,13300,13267,13900,14500,14983,15686][i] }));
export const demoRankings = [
  { rank: 1, restaurantId: 'R-101', restaurantName: 'Spice Route', revenue: 86500, orderCount: 143 },
  { rank: 2, restaurantId: 'R-104', restaurantName: 'Green Bowl', revenue: 79200, orderCount: 128 },
  { rank: 3, restaurantId: 'R-102', restaurantName: 'Urban Tandoor', revenue: 68100, orderCount: 117 },
  { rank: 4, restaurantId: 'R-107', restaurantName: 'Noodle House', revenue: 62300, orderCount: 101 },
  { rank: 5, restaurantId: 'R-103', restaurantName: 'Coastal Curry', revenue: 58400, orderCount: 94 }
];
export const demoSummary = { totalRevenue: 426500, totalOrders: 783, averageOrderValue: 544.7, restaurantCount: 12, lastRefreshed: new Date().toISOString() };
export const demoReviews = { averageRating: 4.3, totalReviews: 1248, distribution: [{rating:5,count:680},{rating:4,count:330},{rating:3,count:145},{rating:2,count:61},{rating:1,count:32}], topTags: [{tag:'taste',count:420},{tag:'delivery',count:318},{tag:'quality',count:276},{tag:'value',count:201},{tag:'packaging',count:153}], restaurants: [{restaurantName:'Spice Route',averageRating:4.7,reviewCount:214},{restaurantName:'Green Bowl',averageRating:4.5,reviewCount:182},{restaurantName:'Urban Tandoor',averageRating:4.4,reviewCount:163}] };
export const demoMenus = [{restaurantName:'Spice Route',name:'Paneer Tikka Bowl',category:'Main course',price:249,description:'Smoky paneer with rice and mint chutney.'},{restaurantName:'Green Bowl',name:'Avocado Garden Salad',category:'Salads',price:199,description:'Fresh greens, avocado, seeds and citrus dressing.'},{restaurantName:'Urban Tandoor',name:'Dal Makhani Combo',category:'Combos',price:229,description:'Slow-cooked black lentils with rice.'}];
export const demoPings = [
 {driverId:'D-012',driverName:'Driver 12',distanceMeters:320,latitude:17.3855,longitude:78.4862,isAvailable:true},
 {driverId:'D-008',driverName:'Driver 08',distanceMeters:740,latitude:17.3890,longitude:78.4898,isAvailable:true},
 {driverId:'D-021',driverName:'Driver 21',distanceMeters:1280,latitude:17.3805,longitude:78.4805,isAvailable:true},
 {driverId:'D-004',driverName:'Driver 04',distanceMeters:2190,latitude:17.3950,longitude:78.4780,isAvailable:true},
 {driverId:'D-016',driverName:'Driver 16',distanceMeters:3820,latitude:17.3690,longitude:78.5000,isAvailable:true}
];
