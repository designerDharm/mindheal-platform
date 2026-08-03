import test from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { StorageService } from "../src/services/storage.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");

test("storage service", async (t) => {
  await t.test("uses sanitized mock URLs outside production when Firebase Storage is not configured", async () => {
    const upload = await StorageService.uploadFile(
      Buffer.from("demo"),
      "../unsafe file.png",
      "image/png",
      "uploads/user samples"
    );

    assert.deepStrictEqual(upload, {
      url: "https://mock-storage.local/uploads/user_samples/unsafe_file.png",
      storagePath: "uploads/user_samples/unsafe_file.png",
      filename: "unsafe_file.png",
      expiresAt: null
    });
  });

  await t.test("refreshes and deletes by durable storage path in local mode", async () => {
    const refreshed = await StorageService.getSignedUrl("../uploads/user samples/report.pdf");
    const deleted = await StorageService.deleteFile("../uploads/user samples/report.pdf");

    assert.deepStrictEqual(refreshed, {
      url: "https://mock-storage.local/uploads/user_samples/report.pdf",
      storagePath: "uploads/user_samples/report.pdf",
      expiresAt: null
    });
    assert.deepStrictEqual(deleted, {
      storagePath: "uploads/user_samples/report.pdf",
      deleted: true,
      skipped: true
    });
  });

  await t.test("fails closed in production when Firebase Storage is not configured", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          "process.env.NODE_ENV = 'production';",
          "delete process.env.FIREBASE_STORAGE_BUCKET;",
          "delete process.env.GOOGLE_APPLICATION_CREDENTIALS;",
          "delete process.env.FIREBASE_ADMIN_CREDENTIALS;",
          "const { StorageService } = await import('./src/services/storage.service.js');",
          "try {",
          "  await StorageService.uploadFile(Buffer.from('demo'), 'sample.png', 'image/png', 'uploads');",
          "  process.exit(1);",
          "} catch (error) {",
          "  process.stdout.write(error.message);",
          "}"
        ].join("\n")
      ],
      {
        cwd: backendRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_ENV: "production",
          JWT_ACCESS_SECRET: "test_access_secret_32_chars_minimum_value",
          JWT_REFRESH_SECRET: "test_refresh_secret_32_chars_minimum_value",
          ALLOWED_ORIGINS: "https://mindheal.example"
        }
      }
    );

    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /Firebase Storage is not configured/);
  });
});
