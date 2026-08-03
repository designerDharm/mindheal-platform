import { repositories } from "../repositories/index.js";
import { badRequest, created } from "../utils/http.js";
import { createId } from "../utils/security.js";
import { requireFields } from "../utils/validation.js";

export async function submitContact({ body }) {
  const missing = requireFields(body, ["name", "email", "message"]);
  if (missing) return badRequest("Missing required contact fields.", missing);
  const contact = { id: createId("cnt"), status: "new", createdAt: new Date().toISOString(), ...body };
  return created(await repositories.contacts.create(contact));
}
