import test from "node:test";
import assert from "node:assert";
import { memoryRepositories } from "../src/repositories/memory/index.js";
import { postgresRepositories } from "../src/repositories/postgres/index.js";

test("repository contracts", async (t) => {
  await t.test("postgres repositories expose every memory repository namespace and method", () => {
    const missing = [];

    for (const [namespace, methods] of Object.entries(memoryRepositories)) {
      if (!postgresRepositories[namespace]) {
        missing.push(namespace);
        continue;
      }

      for (const [methodName, method] of Object.entries(methods)) {
        if (typeof method === "function" && typeof postgresRepositories[namespace][methodName] !== "function") {
          missing.push(`${namespace}.${methodName}`);
        }
      }
    }

    assert.deepStrictEqual(missing, []);
  });
});
