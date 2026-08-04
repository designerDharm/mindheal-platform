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

export function calculateAgeFromDob(dateOfBirth) {
  if (!dateOfBirth) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateOfBirth).trim())) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate())) {
    age--;
  }
  return age;
}
