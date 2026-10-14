import os
import random
import uuid
from datetime import datetime, timedelta, timezone

import psycopg2
from psycopg2.extras import execute_values, register_uuid

register_uuid()

# ByteStream - PostgreSQL Data Seeder (To produce bulk data of user,restaurants,orders)
#
# [Team 26] Changes for Assignment 2 are marked "[Team 26]" and listed in the
# README change log / docs/handover_note.md.

random.seed(42)

DB_NAME = os.getenv("DB_NAME", "bitestream")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")

NUM_USERS = 10_000
NUM_RESTAURANTS = 500
NUM_ORDERS = 50_000
NUM_AUDIT_LOGS = 120_000  # target total: one DEBIT per order + wallet top-up CREDITs

# [Team 26] Share of users whose newest order is still active
# (PREPARING/DELIVERING). The original logic left 96.8% of users with an
# active order, so almost every demo checkout was blocked.
ACTIVE_ORDER_SHARE = 0.20

# [Team 26] Restaurants are placed inside the area covered by the MongoDB
# DriverPings (Hyderabad). The original used Colombo, so $geoNear from a
# restaurant could never find a driver.
RESTAURANT_LAT_RANGE = (17.36, 17.46)
RESTAURANT_LNG_RANGE = (78.33, 78.43)

BATCH_SIZE = 5_000

# Sample data

FIRST_NAMES = [
    "Aarav",
    "Aisha",
    "Daniel",
    "Emma",
    "Ethan",
    "Fatima",
    "Grace",
    "Hannah",
    "Ishan",
    "Jack",
    "James",
    "Kavya",
    "Liam",
    "Maya",
    "Noah",
    "Olivia",
    "Ravi",
    "Sarah",
    "Sophia",
    "Zoe",
]

LAST_NAMES = [
    "Perera",
    "Fernando",
    "Silva",
    "Kumar",
    "Patel",
    "Smith",
    "Brown",
    "Williams",
    "Jones",
    "Garcia",
]

RESTAURANT_NAMES = [
    "Spice Garden",
    "Urban Bites",
    "Green Leaf",
    "The Food Hub",
    "Curry House",
    "Street Kitchen",
    "Golden Bowl",
    "Fresh Feast",
    "Byte Cafe",
    "Tasty Corner",
]

# Database connection

def get_connection():
    connection_params = {
        "dbname": DB_NAME,
        "user": DB_USER,
        "port": DB_PORT,
    }

    if DB_PASSWORD:
        connection_params["password"] = DB_PASSWORD

    if DB_HOST:
        connection_params["host"] = DB_HOST

    return psycopg2.connect(**connection_params)

# Generating users

def generate_users():
    users = []

    for _ in range(NUM_USERS):
        user_id = uuid.uuid4()

        name = (
            f"{random.choice(FIRST_NAMES)} "
            f"{random.choice(LAST_NAMES)}"
        )

        # [Team 26] Opening balance of the wallet history; the final
        # wallet_balance is computed by generate_audit_logs().
        wallet_balance = round(
            random.uniform(100.00, 50_000.00),
            2
        )

        users.append(
            (
                user_id,
                name,
                wallet_balance,
            )
        )

    return users

# Generating restaurants

def generate_restaurants():
    restaurants = []

    for _ in range(NUM_RESTAURANTS):
        restaurant_id = uuid.uuid4()

        name = (
            f"{random.choice(RESTAURANT_NAMES)} "
            f"{random.randint(1, 999)}"
        )

        # [Team 26] Same area as the MongoDB DriverPings
        latitude = round(
            random.uniform(*RESTAURANT_LAT_RANGE),
            6
        )

        longitude = round(
            random.uniform(*RESTAURANT_LNG_RANGE),
            6
        )

        restaurants.append(
            (
                restaurant_id,
                name,
                latitude,
                longitude,
            )
        )

    return restaurants

# Generating orders

def generate_orders(user_ids, restaurant_ids):
    orders = []

    now = datetime.now(timezone.utc)
    start_time = now - timedelta(days=30)

    for _ in range(NUM_ORDERS):
        order_id = uuid.uuid4()

        user_id = random.choice(user_ids)
        restaurant_id = random.choice(restaurant_ids)

        total_amount = round(
            random.uniform(250.00, 10_000.00),
            2
        )

        created_at = start_time + timedelta(
            seconds=random.randint(
                0,
                int((now - start_time).total_seconds())
            )
        )

        orders.append(
            [
                order_id,
                user_id,
                restaurant_id,
                total_amount,
                "DELIVERED",
                created_at,
            ]
        )

    # [Team 26] Only a user's NEWEST order can still be active, and only for
    # ACTIVE_ORDER_SHARE of users. This respects the partial unique index
    # (one PREPARING/DELIVERING order per user) and is realistic: older
    # orders have already been delivered.
    newest_order = {}

    for order in orders:
        user_id = order[1]

        if user_id not in newest_order or order[5] > newest_order[user_id][5]:
            newest_order[user_id] = order

    for order in newest_order.values():
        if random.random() < ACTIVE_ORDER_SHARE:
            order[4] = random.choice(["PREPARING", "DELIVERING"])

    return [tuple(order) for order in orders]

# Generating wallet audit logs

def generate_audit_logs(users, orders):
    """
    [Team 26] Build a consistent wallet history for every user.

    The original generated random rows, so balance_after never matched the
    wallet (0 of 10,000 users). Here each user's history is replayed in
    time order from an opening balance:

      * every order is a DEBIT of its total_amount at the order time;
      * random wallet top-ups are CREDITs;
      * if a debit would make the balance negative, an automatic top-up
        CREDIT is inserted one minute before it (chk_wallet_balance forbids
        negative balances).

    The final balance becomes users.wallet_balance, so the newest
    balance_after always equals the wallet and the Audit screen's running
    balance is meaningful.

    Returns (audit_logs, final_balance_by_user_id).
    """
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(days=30)

    events_by_user = {user[0]: [] for user in users}

    for order in orders:
        events_by_user[order[1]].append((order[5], "DEBIT", order[3]))

    num_top_ups = max(0, NUM_AUDIT_LOGS - len(orders))
    user_ids = list(events_by_user)

    for _ in range(num_top_ups):
        timestamp = start_time + timedelta(
            seconds=random.randint(
                0,
                int((now - start_time).total_seconds())
            )
        )

        amount = round(random.uniform(500.00, 15_000.00), 2)
        events_by_user[random.choice(user_ids)].append((timestamp, "CREDIT", amount))

    audit_logs = []
    final_balances = {}

    for user_id, _, opening_balance in users:
        balance = round(opening_balance, 2)
        previous_timestamp = start_time - timedelta(days=1)

        for timestamp, action_type, amount in sorted(events_by_user[user_id]):
            if action_type == "DEBIT" and amount > balance:
                top_up = round(amount - balance + random.uniform(500.00, 5_000.00), 2)
                balance = round(balance + top_up, 2)

                # One minute before the debit, but never before the
                # previous event, so the chain stays in time order.
                top_up_timestamp = max(
                    timestamp - timedelta(minutes=1),
                    previous_timestamp + (timestamp - previous_timestamp) / 2,
                )

                audit_logs.append(
                    (
                        uuid.uuid4(),
                        user_id,
                        top_up,
                        "CREDIT",
                        balance,
                        top_up_timestamp,
                    )
                )

            if action_type == "DEBIT":
                balance = round(balance - amount, 2)
            else:
                balance = round(balance + amount, 2)

            audit_logs.append(
                (
                    uuid.uuid4(),
                    user_id,
                    amount,
                    action_type,
                    balance,
                    timestamp,
                )
            )

            previous_timestamp = timestamp

        final_balances[user_id] = balance

    return audit_logs, final_balances

# Bulk insert helper

def bulk_insert(cursor, query, rows):
    for start in range(0, len(rows), BATCH_SIZE):
        batch = rows[start:start + BATCH_SIZE]

        execute_values(
            cursor,
            query,
            batch,
            page_size=BATCH_SIZE,
        )

        print(
            f"Inserted {min(start + BATCH_SIZE, len(rows))}"
            f"/{len(rows)}"
        )

# Main

def main():
    print("Connecting to PostgreSQL...")

    connection = get_connection()

    try:
        with connection:
            with connection.cursor() as cursor:

                # [Team 26] Start from empty tables so re-running the
                # seeder replaces the data instead of doubling it.
                print("\nClearing existing data...")
                cursor.execute(
                    "TRUNCATE wallet_audit_logs, orders, restaurants, users"
                )

                print("\nGenerating users...")
                users = generate_users()

                print("Generating restaurants...")
                restaurants = generate_restaurants()

                user_ids = [
                    row[0]
                    for row in users
                ]

                restaurant_ids = [
                    row[0]
                    for row in restaurants
                ]

                print("Generating orders...")
                orders = generate_orders(
                    user_ids,
                    restaurant_ids,
                )

                print("Generating wallet audit logs...")
                audit_logs, final_balances = generate_audit_logs(
                    users,
                    orders,
                )

                # [Team 26] Wallet balance = end of each user's audit chain.
                users = [
                    (user_id, name, final_balances[user_id])
                    for user_id, name, _ in users
                ]

                print("\nInserting users...")

                bulk_insert(
                    cursor,
                    """
                    INSERT INTO users (
                        id,
                        name,
                        wallet_balance
                    )
                    VALUES %s
                    """,
                    users,
                )

                print("\nInserting restaurants...")

                bulk_insert(
                    cursor,
                    """
                    INSERT INTO restaurants (
                        id,
                        name,
                        latitude,
                        longitude
                    )
                    VALUES %s
                    """,
                    restaurants,
                )

                print("\nInserting orders...")

                bulk_insert(
                    cursor,
                    """
                    INSERT INTO orders (
                        id,
                        user_id,
                        restaurant_id,
                        total_amount,
                        status,
                        created_at
                    )
                    VALUES %s
                    """,
                    orders,
                )

                print("\nInserting wallet audit logs...")

                bulk_insert(
                    cursor,
                    """
                    INSERT INTO wallet_audit_logs (
                        id,
                        user_id,
                        amount_changed,
                        action_type,
                        balance_after,
                        timestamp
                    )
                    VALUES %s
                    """,
                    audit_logs,
                )

                # [Team 26] sql/05 creates the materialized view before any
                # data exists, so it is empty. Populate it now so the
                # Analytics screen has numbers straight after seeding.
                cursor.execute(
                    "SELECT to_regclass('restaurant_completed_revenue') IS NOT NULL"
                )

                if cursor.fetchone()[0]:
                    print("\nRefreshing materialized view restaurant_completed_revenue...")
                    cursor.execute(
                        "REFRESH MATERIALIZED VIEW restaurant_completed_revenue"
                    )

        active_orders = sum(1 for order in orders if order[4] != "DELIVERED")

        print("\n======================================")
        print("Data generation completed successfully")
        print("======================================")
        print(f"Users:              {len(users):,}")
        print(f"Restaurants:        {len(restaurants):,}")
        print(f"Orders:             {len(orders):,} ({active_orders:,} active)")
        print(f"Wallet audit logs:  {len(audit_logs):,}")

    finally:
        connection.close()


if __name__ == "__main__":
    main()
