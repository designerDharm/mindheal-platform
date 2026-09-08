import { loginUser } from "../src/services/auth.service.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  try {
    const session = await loginUser({
      email: "admin@example.com",
      password: "Password123!",
      role: "admin"
    });
    console.log("LOGIN SUCCESSFUL! SESSION:", session);
  } catch (err) {
    console.error("LOGIN FAILED:", err);
  }
}

run();
