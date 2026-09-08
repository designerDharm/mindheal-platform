import { verifyPassword } from "../src/utils/security.js";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const res = await pool.query("SELECT * FROM users WHERE email = $1", ["admin@example.com"]);
  const user = res.rows[0];
  console.log("USER:", user);
  const matched = verifyPassword("Password123!", user.password_hash);
  console.log("PASSWORD MATCHES:", matched);
  await pool.end();
}

run();
