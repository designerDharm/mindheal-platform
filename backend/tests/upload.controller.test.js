import test from "node:test";
import assert from "node:assert";
import { refreshUploadUrl, deleteUpload, validateUploadFile } from "../src/controllers/upload.controller.js";

test("upload controller validation", async (t) => {
  await t.test("accepts supported file signatures", () => {
    assert.strictEqual(validateUploadFile(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg").valid, true);
    assert.strictEqual(validateUploadFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png").valid, true);
    assert.strictEqual(validateUploadFile(Buffer.from("%PDF-1.7"), "application/pdf").valid, true);
    assert.strictEqual(validateUploadFile(fakeZipWithEntries([
      "[Content_Types].xml",
      "_rels/.rels",
      "word/document.xml"
    ]), "application/vnd.openxmlformats-officedocument.wordprocessingml.document").valid, true);
  });

  await t.test("rejects supported MIME types with mismatched file signatures", () => {
    const htmlDisguisedAsPng = Buffer.from("<script>alert('xss')</script>");
    const result = validateUploadFile(htmlDisguisedAsPng, "image/png");

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reason, "signature");
  });

  await t.test("rejects generic ZIP files disguised as DOCX", () => {
    const result = validateUploadFile(
      fakeZipWithEntries(["not-a-word-doc.txt"]),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reason, "signature");
  });

  await t.test("rejects unsupported MIME types", () => {
    const result = validateUploadFile(Buffer.from("<svg></svg>"), "image/svg+xml");

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reason, "mime");
  });

  await t.test("rejects empty buffers", () => {
    const result = validateUploadFile(Buffer.alloc(0), "image/png");

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reason, "empty");
  });
});

test("upload lifecycle endpoints", async (t) => {
  await t.test("requires a storage path before refreshing signed URLs", async () => {
    const response = await refreshUploadUrl({ body: {} });

    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.error.code, "BAD_REQUEST");
  });

  await t.test("refreshes signed URLs from durable storage paths", async () => {
    const response = await refreshUploadUrl({
      body: { storagePath: "uploads/user samples/report.pdf" }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.data.storagePath, "uploads/user_samples/report.pdf");
    assert.strictEqual(response.body.data.url, "https://mock-storage.local/uploads/user_samples/report.pdf");
  });

  await t.test("deletes uploaded storage objects by path", async () => {
    const response = await deleteUpload({
      body: { storagePath: "uploads/user samples/report.pdf" }
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(response.body.data, {
      storagePath: "uploads/user_samples/report.pdf",
      deleted: true,
      skipped: true
    });
  });
});

function fakeZipWithEntries(names) {
  const localHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const centralEntries = names.map((name) => {
    const nameBuffer = Buffer.from(name, "utf8");
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(nameBuffer.length, 28);
    return Buffer.concat([header, nameBuffer]);
  });
  return Buffer.concat([localHeader, ...centralEntries]);
}
