from pymongo import MongoClient
from datetime import datetime, timedelta, timezone
import random

import os

import psycopg2

# [Team 26] Reproducible demo data.
random.seed(42)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/")
client = MongoClient(MONGO_URI)

client.admin.command("ping")
print("Connected to MongoDB")

db = client["BiteStream"]

menus = db["Menus"]
reviews = db["Reviews"]
driver_pings = db["DriverPings"]

menus.delete_many({})
reviews.delete_many({})
driver_pings.delete_many({})

now = datetime.now(timezone.utc)


# ------------------------------------------------------------------
# [Team 26] Restaurants come from PostgreSQL (run postgres_seeder.py
# first). Menus and Reviews used integer restaurant ids 1-100 that
# matched no PostgreSQL restaurant, so a restaurant's reviews or menu
# could never be shown. They now use the PostgreSQL UUID (as a string)
# and every restaurant gets a menu. Same DB_* variables as the
# PostgreSQL seeder.
# ------------------------------------------------------------------
def get_pg_connection():
    params = {
        "dbname": os.getenv("DB_NAME", "bitestream"),
        "user": os.getenv("DB_USER", "postgres"),
        "port": os.getenv("DB_PORT", "5432"),
    }
    if os.getenv("DB_PASSWORD"):
        params["password"] = os.getenv("DB_PASSWORD")
    if os.getenv("DB_HOST"):
        params["host"] = os.getenv("DB_HOST")
    return psycopg2.connect(**params)


with get_pg_connection() as pg, pg.cursor() as cur:
    cur.execute("SELECT id::text, name FROM restaurants ORDER BY id")
    restaurants = cur.fetchall()

if not restaurants:
    raise SystemExit("No restaurants in PostgreSQL. Run postgres_seeder.py first.")

print(f"Read {len(restaurants)} restaurants from PostgreSQL")


# ------------------------------------------------------------------
# Menus: one flexible document per restaurant. Optional fields
# (customization_addons, dietary_tags, spice_level, combo items) are
# only present on some items, which is the point of the catalog.
# ------------------------------------------------------------------
CUISINES = {
    "indian": [
        ("Starters", [("Paneer Tikka", 240), ("Hara Bhara Kebab", 190), ("Chicken 65", 260)]),
        ("Main Course", [("Paneer Butter Masala", 280), ("Dal Makhani", 220), ("Butter Chicken", 320)]),
        ("Biryani", [("Veg Dum Biryani", 230), ("Hyderabadi Chicken Biryani", 310)]),
        ("Breads", [("Butter Naan", 50), ("Garlic Naan", 65), ("Tandoori Roti", 30)]),
    ],
    "cafe": [
        ("Coffee", [("Cappuccino", 160), ("Cold Brew", 190), ("Filter Coffee", 90)]),
        ("Sandwiches", [("Grilled Veg Sandwich", 170), ("Chicken Club", 230)]),
        ("Bakes", [("Blueberry Muffin", 120), ("Chocolate Brownie", 140)]),
    ],
    "street": [
        ("Chaat", [("Pani Puri", 80), ("Dahi Puri", 100), ("Pav Bhaji", 150)]),
        ("Rolls", [("Paneer Kathi Roll", 140), ("Egg Roll", 110), ("Chicken Roll", 160)]),
        ("Momos", [("Veg Steamed Momos", 120), ("Chicken Fried Momos", 160)]),
    ],
    "bowls": [
        ("Bowls", [("Rajma Chawal Bowl", 180), ("Teriyaki Tofu Bowl", 260), ("Chicken Burrito Bowl", 290)]),
        ("Salads", [("Greek Salad", 220), ("Quinoa Salad", 240)]),
        ("Drinks", [("Masala Chaas", 60), ("Fresh Lime Soda", 80)]),
    ],
}
ADDONS = [("Extra cheese", 40), ("Extra paneer", 50), ("Make it spicy", 0), ("Add raita", 35), ("Extra sauce", 20), ("Large size", 60)]
DIETARY = ["vegetarian", "vegan", "jain", "gluten-free", "contains-nuts"]
SPICE = ["mild", "medium", "hot"]


def cuisine_for(name):
    lowered = name.lower()
    if "curry" in lowered or "spice" in lowered or "tandoor" in lowered:
        return "indian"
    if "cafe" in lowered:
        return "cafe"
    if "street" in lowered or "corner" in lowered:
        return "street"
    if "bowl" in lowered or "green" in lowered or "fresh" in lowered:
        return "bowls"
    return random.choice(list(CUISINES))


def menu_item(name, base_price):
    item = {"name": name, "price": base_price + random.choice([0, 0, 10, 20, -10])}
    if random.random() < 0.45:
        item["customization_addons"] = [{"name": n, "price": p} for n, p in random.sample(ADDONS, random.randint(1, 3))]
    if random.random() < 0.35:
        item["dietary_tags"] = random.sample(DIETARY, random.randint(1, 2))
    if random.random() < 0.30:
        item["spice_level"] = random.choice(SPICE)
    return item


menu_docs = []
for restaurant_id, name in restaurants:
    categories = []
    for category, items in CUISINES[cuisine_for(name)]:
        categories.append({"name": category, "items": [menu_item(n, p) for n, p in items]})
    if random.random() < 0.4:
        first = categories[0]["items"][0]["name"]
        last = categories[-1]["items"][0]["name"]
        categories.append({
            "name": "Combos",
            "items": [{"name": f"{first} + {last}", "price": 299, "combo_items": [first, last]}],
        })
    menu_docs.append({
        "restaurant_id": restaurant_id,
        "restaurant_name": name,
        "categories": categories,
        "updated_at": now - timedelta(days=random.randint(0, 20)),
    })

menus.insert_many(menu_docs)


# ------------------------------------------------------------------
# Reviews: each restaurant has a quality score, so ratings differ by
# restaurant and lean positive overall, and tags follow the rating
# (the old uniform random data made every chart bar the same length).
# ------------------------------------------------------------------
POSITIVE_TAGS = ["tasty", "fresh", "good-service", "fast-delivery", "delicious", "value-for-money"]
NEGATIVE_TAGS = ["slow-delivery", "cold-food", "expensive", "small-portion", "late-order"]
TAG_WEIGHTS = {"tasty": 9, "fresh": 6, "good-service": 5, "fast-delivery": 4, "delicious": 7, "value-for-money": 3,
               "slow-delivery": 8, "cold-food": 4, "expensive": 6, "small-portion": 3, "late-order": 2}
COMMENTS = {
    5: ["Loved it, will order again.", "Hot, fresh and on time.", "Best biryani nearby."],
    4: ["Good food, slightly late.", "Tasty, decent portion.", "Nice packaging."],
    3: ["Okay, nothing special.", "Average taste.", "Food was fine, delivery slow."],
    2: ["Cold on arrival.", "Too pricey for the portion.", "Took over an hour."],
    1: ["Wrong order delivered.", "Very late and cold.", "Not worth it."],
}


def pick_tags(pool, k):
    chosen = set()
    while len(chosen) < k:
        chosen.add(random.choices(pool, weights=[TAG_WEIGHTS[t] for t in pool])[0])
    return list(chosen)


quality = {restaurant_id: random.gauss(0, 0.8) for restaurant_id, _ in restaurants}
restaurant_ids = [restaurant_id for restaurant_id, _ in restaurants]

reviews_batch = []
for _ in range(50000):
    restaurant_id = random.choice(restaurant_ids)
    rating = max(1, min(5, round(random.gauss(3.8 + quality[restaurant_id], 1.0))))
    if rating >= 4:
        tags = pick_tags(POSITIVE_TAGS, random.randint(1, 3))
    elif rating <= 2:
        tags = pick_tags(NEGATIVE_TAGS, random.randint(1, 2))
    else:
        tags = pick_tags(POSITIVE_TAGS, 1) + pick_tags(NEGATIVE_TAGS, 1)
    reviews_batch.append({
        "restaurant_id": restaurant_id,
        "user_id": random.randint(1, 10000),
        "rating": rating,
        "sentiment_tags": tags,
        "comment": random.choice(COMMENTS[rating]),
        "created_at": now - timedelta(minutes=random.randint(0, 60 * 24 * 60)),
    })

reviews.insert_many(reviews_batch, ordered=False)

NUM_DRIVERS = 10000

driver_active_status = {
    driver_id: random.random() < 0.7
    for driver_id in range(1, NUM_DRIVERS + 1)
}

batch = []

batch.append({
    "driver_id": 1,
    "active": True,
    "location": {
        "type": "Point",
        "coordinates": [78.4075, 17.4485]
    },
    "created_at": now
})



total_pings = 500500

for i in range(total_pings):
    driver_id = random.randint(1, NUM_DRIVERS)

    batch.append({
        "driver_id": driver_id,
        "active": driver_active_status[driver_id],
        "location": {
            "type": "Point",
            "coordinates": [
                78.35 + random.uniform(-0.08, 0.08),
                17.40 + random.uniform(-0.08, 0.08)
            ]
        },
        "created_at": now - timedelta(seconds=random.randint(0, 7199))
    })

    if len(batch) == 5000:
        driver_pings.insert_many(batch, ordered=False)
        batch.clear()
        print(f"Inserted {i + 1} DriverPings")

if batch:
    driver_pings.insert_many(batch, ordered=False)

print("Menus:", menus.count_documents({}))
print("Reviews:", reviews.count_documents({}))
print("DriverPings:", driver_pings.count_documents({}))

client.close()
