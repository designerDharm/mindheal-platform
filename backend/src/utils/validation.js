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
  const str = String(dateOfBirth).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const dob = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dob.getTime())) return null;
  if (dob.getUTCFullYear() !== year || dob.getUTCMonth() !== month - 1 || dob.getUTCDate() !== day) {
    return null;
  }

  const today = new Date();
  if (dob > today) return null;

  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate())) {
    age--;
  }
  if (age < 0) return null;
  return age;
}

