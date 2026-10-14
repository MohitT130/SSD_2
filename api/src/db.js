import pg from 'pg';
import { MongoClient } from 'mongodb';
const { Pool } = pg;
let pool;
let mongoClient;
export function getPgPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}
export async function getMongoDb() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured');
  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
  }
  return mongoClient.db(process.env.MONGODB_DB || 'bitestream');
}
export async function closeConnections() {
  if (pool) await pool.end();
  if (mongoClient) await mongoClient.close();
}
