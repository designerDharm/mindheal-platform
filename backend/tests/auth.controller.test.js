import test from "node:test";
import assert from "node:assert";
import { login } from "../src/controllers/auth.controller.js";
import { repositories } from "../src/repositories/index.js";
import { hashPassword } from "../src/utils/security.js";

test("auth controller", async (t) => {
  await t.test("returns the same generic response for missing users and wrong passwords", async () => {
    const originalUsers = repositories.users;

    try {
      repositories.users = {
        ...originalUsers,
        findByEmailAndRole: async () => null
      };
      const missingUser = await login({
        body: { email: "missing@example.com", password: "wrong", role: "user" }
      });

      repositories.users = {
        ...originalUsers,
        findByEmailAndRole: async () => ({
          id: "usr_login",
          role: "user",
          email: "known@example.com",
          passwordHash: hashPassword("correct-password"),
          isActive: true
        })
      };
      const wrongPassword = await login({
        body: { email: "known@example.com", password: "wrong", role: "user" }
      });

      assert.strictEqual(missingUser.status, 401);
      assert.strictEqual(wrongPassword.status, 401);
      assert.deepStrictEqual(missingUser.body, wrongPassword.body);
      assert.strictEqual(missingUser.body.error.message, "Invalid email, password, or role.");
      assert.ok(!JSON.stringify(missingUser.body).includes("User not found"));
      assert.ok(!JSON.stringify(wrongPassword.body).includes("Invalid password"));
    } finally {
      repositories.users = originalUsers;
    }
  });
});
