import pg from 'pg';
import dotenv from 'dotenv';
import { AsyncLocalStorage } from 'node:async_hooks';
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mindheal:mindheal@localhost:5432/mindheal',
});

const transactionContext = new AsyncLocalStorage();

export const query = (text, params) => {
  const client = transactionContext.getStore();
  return (client || pool).query(text, params);
};

export async function withTransaction(callback) {
  const activeClient = transactionContext.getStore();
  if (activeClient) return await callback();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await transactionContext.run(client, callback);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Test the connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
