import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const users = await pool.query("SELECT id, role, email, password_hash FROM users");
    console.log("USERS IN DB:", users.rows);

    const acceptances = await pool.query("SELECT * FROM peer_policy_acceptances");
    console.log("POLICY ACCEPTANCES IN DB:", acceptances.rows);
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await pool.end();
  }
}

run();
