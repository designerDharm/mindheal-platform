import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(backendRoot, ".env") });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });

async function initMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version varchar(255) PRIMARY KEY,
      applied_at timestamptz DEFAULT now()
    );
  `);
}

async function getAppliedMigrations() {
  const result = await pool.query(`SELECT version FROM schema_migrations`);
  return new Set(result.rows.map(row => row.version));
}

async function runSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, "utf-8");
  await pool.query(sql);
}

async function runMigrations() {
  try {
    await initMigrationsTable();
    const applied = await getAppliedMigrations();
    const migrationsDir = path.join(backendRoot, "migrations");
    
    if (!fs.existsSync(migrationsDir)) {
      console.log("No migrations directory found.");
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (!applied.has(file)) {
        console.log(`Applying migration: ${file}`);
        const filePath = path.join(migrationsDir, file);
        
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(fs.readFileSync(filePath, "utf-8"));
          await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
          await client.query("COMMIT");
          count++;
        } catch (error) {
          await client.query("ROLLBACK");
          throw new Error(`Failed to apply migration ${file}: ${error.message}`);
        } finally {
          client.release();
        }
      }
    }

    if (count === 0) {
      console.log("Database is up to date. No new migrations applied.");
    } else {
      console.log(`Successfully applied ${count} migration(s).`);
    }

    // Handle seeds if flag is present
    if (process.argv.includes("--seed")) {
      const seedsDir = path.join(backendRoot, "seeds");
      if (fs.existsSync(seedsDir)) {
        const seedFiles = fs.readdirSync(seedsDir).filter(f => f.endsWith(".sql")).sort();
        for (const file of seedFiles) {
          console.log(`Applying seed: ${file}`);
          await runSqlFile(path.join(seedsDir, file));
        }
        console.log(`Applied ${seedFiles.length} seed file(s).`);
      }
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
