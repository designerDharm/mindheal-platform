export async function parseBody(req, limit = 2 * 1024 * 1024) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return {};

  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    chunks.push(chunk);
    length += chunk.length;
    if (length > limit) {
      throw new Error("PAYLOAD_TOO_LARGE");
    }
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  req.rawBody = raw;
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
}

export function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function send(res, status, body) {
  res.writeHead(status);
  res.end(body);
}

export function notFound(res) {
  return json(res, 404, {
    success: false,
    error: { code: "NOT_FOUND", message: "Route not found." }
  });
}

export function ok(data, meta) {
  return { status: 200, body: { success: true, data, meta } };
}

export function created(data) {
  return { status: 201, body: { success: true, data } };
}

export function badRequest(message, fields = {}) {
  return { status: 400, body: { success: false, error: { code: "BAD_REQUEST", message, fields } } };
}

export function unauthorized(message = "Authentication required.") {
  return { status: 401, body: { success: false, error: { code: "UNAUTHORIZED", message } } };
}

export function forbidden(message = "You do not have permission to access this resource.") {
  return { status: 403, body: { success: false, error: { code: "FORBIDDEN", message } } };
}

export function internalServerError(message = "Something went wrong.") {
  return { status: 500, body: { success: false, error: { code: "INTERNAL_SERVER_ERROR", message } } };
}
