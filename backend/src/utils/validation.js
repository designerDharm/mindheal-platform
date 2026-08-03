export function requireFields(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === "");
  if (!missing.length) return null;
  return Object.fromEntries(missing.map((field) => [field, "Required"]));
}

export function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

export function toPaise(amountInr) {
  return Math.round(Number(amountInr || 0) * 100);
}
