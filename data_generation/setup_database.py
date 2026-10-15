"""
[Team 26] One-command database setup for BiteStream.

Does exactly what the README's manual steps do, in order:

  1. create the PostgreSQL database if it does not exist
  2. run sql/01 -> 05 and sql/07 (all re-runnable)
  3. run postgres_seeder.py   (users, restaurants, orders, audit logs)
  4. run mongo_seeder.py      (menus, reviews, driver pings; reads restaurants from PostgreSQL)
  5. create the MongoDB collections and indexes of mongo/01_collections_and_indexes.js
     (with mongosh if it is installed, otherwise the same indexes through pymongo)

It only needs Python and the packages in requirements.txt (no psql / mongosh).

Usage (from the repository root):
    python data_generation/setup_database.py

Connection settings: the same environment variables as the seeders
    DB_NAME (bitestream), DB_USER (postgres), DB_PASSWORD, DB_HOST (localhost), DB_PORT (5432)
    MONGO_URI (mongodb://127.0.0.1:27017/)
"""
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import psycopg2
from psycopg2 import sql
from pymongo import MongoClient

# Keep our output in order with the seeders' output.
sys.stdout.reconfigure(line_buffering=True)

ROOT = Path(__file__).resolve().parent.parent
SQL_FILES = [
    "01_schema_ddl.sql",
    "02_indexes.sql",
    "03_triggers_and_audit.sql",
    "04_stored_procedures.sql",
    "05_materialized_views.sql",
    "07_fixes_transactions.sql",
]

os.environ.setdefault("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "bitestream")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/")


def pg_connect(dbname):
    params = {
        "dbname": dbname,
        "user": os.getenv("DB_USER", "postgres"),
        "host": os.getenv("DB_HOST"),
        "port": os.getenv("DB_PORT", "5432"),
    }
    if os.getenv("DB_PASSWORD"):
        params["password"] = os.getenv("DB_PASSWORD")
    return psycopg2.connect(**params)


def step(title):
    print(f"\n=== {title}")


def create_database():
    step(f"PostgreSQL: database '{DB_NAME}'")
    connection = pg_connect("postgres")
    connection.autocommit = True
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
        if cursor.fetchone():
            print("exists")
        else:
            cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(DB_NAME)))
            print("created")
    connection.close()


def run_sql_files():
    connection = pg_connect(DB_NAME)
    connection.autocommit = True  # like `psql -f`: each statement commits

    for name in SQL_FILES:
        step(f"PostgreSQL: sql/{name}")
        started = time.perf_counter()
        with connection.cursor() as cursor:
            cursor.execute((ROOT / "sql" / name).read_text(encoding="utf-8"))
        print(f"ok ({(time.perf_counter() - started) * 1000:.0f} ms)")

    connection.close()


def run_seeder(name):
    step(f"Seeder: data_generation/{name}")
    subprocess.run([sys.executable, str(ROOT / "data_generation" / name)], check=True)


def create_mongo_indexes():
    step("MongoDB: mongo/01_collections_and_indexes.js")
    mongosh = shutil.which("mongosh")

    if mongosh:
        subprocess.run([mongosh, "--quiet", MONGO_URI.rstrip("/") + "/BiteStream",
                        str(ROOT / "mongo" / "01_collections_and_indexes.js")], check=True)
        return

    # Same collections and indexes as the .js file, for machines without mongosh.
    db = MongoClient(MONGO_URI)["BiteStream"]
    for collection in ("Menus", "Reviews", "DriverPings"):
        if collection not in db.list_collection_names():
            db.create_collection(collection)
    db.DriverPings.create_index([("location", "2dsphere")], name="location_2dsphere")
    db.DriverPings.create_index([("created_at", 1)], name="created_at_1", expireAfterSeconds=7200)
    db.Reviews.create_index([("rating", 1), ("sentiment_tags", 1)], name="rating_1_sentiment_tags_1")
    print("mongosh not found; created the same indexes with pymongo")
    print("DriverPings indexes:", list(db.DriverPings.index_information()))
    print("Reviews indexes:", list(db.Reviews.index_information()))


def main():
    started = time.perf_counter()
    create_database()
    run_sql_files()
    run_seeder("postgres_seeder.py")
    run_seeder("mongo_seeder.py")
    create_mongo_indexes()
    print(f"\nDone in {time.perf_counter() - started:.0f} s. Start the API (api/) and the web app (web/).")


if __name__ == "__main__":
    main()
