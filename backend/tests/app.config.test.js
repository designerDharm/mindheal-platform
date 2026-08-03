import test from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");

test("app config", async (t) => {
  await t.test("allows development JWT fallbacks for local setup", () => {
    const result = loadConfig({
      NODE_ENV: "development",
      JWT_ACCESS_SECRET: "",
      JWT_REFRESH_SECRET: ""
    });

    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /development-access-secret-change-me/);
  });

  await t.test("requires explicit JWT secrets in production", () => {
    const result = loadConfig({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "",
      JWT_REFRESH_SECRET: ""
    });

    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, /JWT_ACCESS_SECRET must be configured in production/);
  });

  await t.test("rejects placeholder JWT secrets in production", () => {
    const result = loadConfig({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "your_super_secret_access_key",
      JWT_REFRESH_SECRET: "your_super_secret_refresh_key"
    });

    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, /JWT_ACCESS_SECRET is too weak for production/);
  });

  await t.test("accepts strong JWT secrets in production", () => {
    const result = loadConfig({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "prod_access_secret_32_chars_minimum_value",
      JWT_REFRESH_SECRET: "prod_refresh_secret_32_chars_minimum_value",
      ALLOWED_ORIGINS: "https://mindheal.example"
    });

    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /prod_access_secret_32_chars_minimum_value/);
  });

  await t.test("requires explicit allowed origins in production", () => {
    const result = loadConfig(strongProductionEnv({ ALLOWED_ORIGINS: "" }));

    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, /ALLOWED_ORIGINS must be configured in production/);
  });

  await t.test("rejects wildcard allowed origins in production", () => {
    const result = loadConfig(strongProductionEnv({ ALLOWED_ORIGINS: "https://mindheal.example,*" }));

    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, /ALLOWED_ORIGINS cannot include '\*' in production/);
  });

  await t.test("rejects invalid allowed origins in production", () => {
    const result = loadConfig(strongProductionEnv({ ALLOWED_ORIGINS: "mindheal.example" }));

    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, /ALLOWED_ORIGINS contains an invalid origin/);
  });

  await t.test("parses and trims allowed origins", () => {
    const result = loadConfig(strongProductionEnv({
      ALLOWED_ORIGINS: " https://mindheal.example, https://app.mindheal.example "
    }), "process.stdout.write(JSON.stringify(appConfig.allowedOrigins));");

    assert.strictEqual(result.status, 0);
    assert.deepStrictEqual(JSON.parse(result.stdout), [
      "https://mindheal.example",
      "https://app.mindheal.example"
    ]);
  });
});

function strongProductionEnv(patch = {}) {
  return {
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: "prod_access_secret_32_chars_minimum_value",
    JWT_REFRESH_SECRET: "prod_refresh_secret_32_chars_minimum_value",
    ...patch
  };
}

function loadConfig(envPatch, expression = "process.stdout.write(appConfig.jwtAccessSecret);") {
  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const { appConfig } = await import('./src/config/app.js'); ${expression}`
    ],
    {
      cwd: backendRoot,
      encoding: "utf8",
      env: { ...process.env, ...envPatch }
    }
  );
}
