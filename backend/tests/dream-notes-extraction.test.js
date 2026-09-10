import test from "node:test";
import assert from "node:assert";
import { Readable } from "node:stream";
import {
  validateNotesImageBuffer,
  isImageJpeg,
  isImagePng,
  isImageWebp,
  stripJpegExifBuffer,
  extractTextFromNotesImage,
  ALLOWED_NOTES_IMAGE_MIMES
} from "../src/services/ai.service.js";
import { extractDreamNotes } from "../src/controllers/ai.controller.js";

// Helper to construct synthetic multipart requests for busboy
function makeMultipartRequest({
  fields = {},
  file = null,
  customHeaders = {},
  boundary = "----WebKitFormBoundary9OA3ZNxkTrZu0gW"
}) {
  const parts = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
    ));
  }

  if (file) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname || "image"}"; filename="${file.filename || "dream_note.jpg"}"\r\nContent-Type: ${file.mimeType || "image/jpeg"}\r\n\r\n`
    ));
    parts.push(file.buffer);
    parts.push(Buffer.from("\r\n"));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const totalBuffer = Buffer.concat(parts);
  const stream = Readable.from([totalBuffer]);
  stream.headers = {
    "content-type": `multipart/form-data; boundary=${boundary}`,
    "content-length": String(totalBuffer.length),
    ...customHeaders
  };
  return stream;
}

// Sample image buffers for tests
const sampleJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const samplePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const sampleWebp = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x20, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP"),
  Buffer.from("VP8 ")
]);

test("Milestone 4: Image buffer validation & format verification", async (t) => {
  await t.test("accepts valid image signatures for supported formats (JPEG, PNG, WebP)", () => {
    assert.strictEqual(validateNotesImageBuffer(sampleJpeg, "image/jpeg").valid, true);
    assert.strictEqual(validateNotesImageBuffer(sampleJpeg, "image/jpg").valid, true);
    assert.strictEqual(validateNotesImageBuffer(samplePng, "image/png").valid, true);
    assert.strictEqual(validateNotesImageBuffer(sampleWebp, "image/webp").valid, true);
  });

  await t.test("rejects unsupported MIME type (e.g. PDF, GIF, BMP)", () => {
    const resPdf = validateNotesImageBuffer(sampleJpeg, "application/pdf");
    assert.strictEqual(resPdf.valid, false);
    assert.strictEqual(resPdf.reason, "mime");

    const resGif = validateNotesImageBuffer(sampleJpeg, "image/gif");
    assert.strictEqual(resGif.valid, false);
    assert.strictEqual(resGif.reason, "mime");
  });

  await t.test("rejects mismatched file signature (e.g. text file disguised as JPEG)", () => {
    const fakeImage = Buffer.from("This is plain text disguised as a photograph of a notebook");
    const res = validateNotesImageBuffer(fakeImage, "image/jpeg");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, "signature");
  });

  await t.test("rejects empty image buffer", () => {
    const res = validateNotesImageBuffer(Buffer.alloc(0), "image/jpeg");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, "empty");
  });

  await t.test("rejects image file exceeding 10MB size limit", () => {
    const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    oversizedBuffer[2] = 0xff;
    const res = validateNotesImageBuffer(oversizedBuffer, "image/jpeg");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, "size");
  });
});

test("Milestone 4: EXIF metadata stripping for privacy protection", async (t) => {
  await t.test("removes APP1 EXIF segment (0xFFE1) from JPEG buffer", () => {
    // Construct JPEG with APP1 EXIF segment
    const exifData = Buffer.from("Exif\x00\x00GPSLatitudeAndCameraModel");
    const exifLen = exifData.length + 2;
    const exifHeader = Buffer.alloc(4);
    exifHeader[0] = 0xff;
    exifHeader[1] = 0xe1; // APP1 marker
    exifHeader.writeUInt16BE(exifLen, 2);

    const jpegWithExif = Buffer.concat([
      Buffer.from([0xff, 0xd8]), // SOI
      exifHeader,
      exifData,
      Buffer.from([0xff, 0xd9])  // EOI
    ]);

    assert.ok(jpegWithExif.includes(Buffer.from("Exif")), "Original contains EXIF");
    const stripped = stripJpegExifBuffer(jpegWithExif);
    assert.ok(!stripped.includes(Buffer.from("Exif")), "Stripped buffer does NOT contain EXIF");
    assert.strictEqual(isImageJpeg(stripped), true, "Stripped buffer remains valid JPEG");
  });
});

test("Milestone 4: Multimodal Vision Text Extraction (All 10 Core Scenarios)", async (t) => {
  await t.test("Case 1: Clear printed text test", async () => {
    const result = await extractTextFromNotesImage({
      buffer: sampleJpeg,
      mimeType: "image/jpeg",
      mockTest: "default"
    });
    assert.ok(result.extractedText.length > 20);
    assert.ok(result.extractedText.includes("Dream notes:"));
    assert.strictEqual(result.warnings.length, 0);
  });

  await t.test("Case 2: Clean handwritten notebook page", async () => {
    const result = await extractTextFromNotesImage({
      buffer: sampleJpeg,
      mimeType: "image/jpeg",
      mockTest: "clean_handwriting"
    });
    assert.ok(result.extractedText.includes("childhood school"));
    assert.strictEqual(result.uncertainSegments.length, 0);
    assert.strictEqual(result.warnings.length, 0);
  });

  await t.test("Case 3: Messy handwriting with uncertain words in brackets [word?]", async () => {
    const result = await extractTextFromNotesImage({
      buffer: sampleJpeg,
      mimeType: "image/jpeg",
      mockTest: "messy_handwriting"
    });
    assert.ok(result.extractedText.includes("[temple?]"));
    assert.ok(result.extractedText.includes("[shadowy?]"));
    assert.ok(result.uncertainSegments.some((s) => s.text === "temple"));
    assert.ok(result.warnings.includes("UNCLEAR_HANDWRITING_DETECTED"));
  });

  await t.test("Case 4: Hindi handwriting in Devanagari script", async () => {
    const result = await extractTextFromNotesImage({
      buffer: sampleJpeg,
      mimeType: "image/jpeg",
      mockTest: "hindi"
    });
    assert.ok(/[\u0900-\u097F]/.test(result.extractedText), "Preserves Hindi Devanagari characters");
    assert.ok(result.extractedText.includes("मंदिर"));
  });

  await t.test("Case 5: English handwriting", async () => {
    const result = await extractTextFromNotesImage({
      buffer: samplePng,
      mimeType: "image/png",
      mockTest: "clean"
    });
    assert.ok(/^[A-Za-z0-9\s.,'?!-]+$/.test(result.extractedText));
    assert.strictEqual(result.warnings.length, 0);
  });

  await t.test("Case 6: Mixed Hindi and English (code-switching) preserved without translation", async () => {
    const result = await extractTextFromNotesImage({
      buffer: sampleJpeg,
      mimeType: "image/jpeg",
      mockTest: "mixed"
    });
    assert.ok(/[\u0900-\u097F]/.test(result.extractedText), "Contains Hindi words");
    assert.ok(/[A-Za-z]/.test(result.extractedText), "Contains English words");
    assert.ok(result.extractedText.includes("[cave?]"));
    assert.ok(result.extractedText.includes("anxious"));
  });

  await t.test("Case 7: Rotated notebook photo with ORIENTATION_ADJUSTED warning", async () => {
    const result = await extractTextFromNotesImage({
      buffer: sampleWebp,
      mimeType: "image/webp",
      mockTest: "rotated"
    });
    assert.ok(result.extractedText.includes("Running across an open field"));
    assert.ok(result.warnings.includes("ORIENTATION_ADJUSTED"));
  });

  await t.test("Case 8: Low-light / shadow notebook photo with LOW_LIGHT_IMAGE warning", async () => {
    const result = await extractTextFromNotesImage({
      buffer: sampleJpeg,
      mimeType: "image/jpeg",
      mockTest: "lowlight"
    });
    assert.ok(result.extractedText.includes("two glowing eyes"));
    assert.ok(result.warnings.includes("LOW_LIGHT_IMAGE"));
  });

  await t.test("Case 9: Partially cropped notebook page with PARTIALLY_CROPPED_PAGE warning", async () => {
    const result = await extractTextFromNotesImage({
      buffer: sampleJpeg,
      mimeType: "image/jpeg",
      mockTest: "cropped"
    });
    assert.ok(result.extractedText.includes("telephone cord was cut"));
    assert.ok(result.warnings.includes("PARTIALLY_CROPPED_PAGE"));
  });

  await t.test("Case 10: Image containing no text returns NO_TEXT_DETECTED", async () => {
    const result = await extractTextFromNotesImage({
      buffer: sampleJpeg,
      mimeType: "image/jpeg",
      mockTest: "notext"
    });
    assert.strictEqual(result.extractedText, "");
    assert.strictEqual(result.uncertainSegments.length, 0);
    assert.ok(result.warnings.includes("NO_TEXT_DETECTED"));
  });
});

test("Milestone 4: Dream Notes Controller & Security Gates", async (t) => {
  const adultUser = { id: "usr_adult_notes", dateOfBirth: "1990-03-15" };
  const minorUser = { id: "usr_minor_notes", dateOfBirth: "2013-03-15" };

  await t.test("Case 11a: Rejects unauthenticated requests with 401", async () => {
    const req = makeMultipartRequest({
      file: { buffer: sampleJpeg, mimeType: "image/jpeg" }
    });
    const response = await extractDreamNotes({ req, user: null });
    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.body.error.code, "UNAUTHORIZED");
  });

  await t.test("Case 11b: Rejects minor accounts under 18 with 403", async () => {
    const req = makeMultipartRequest({
      file: { buffer: sampleJpeg, mimeType: "image/jpeg" }
    });
    const response = await extractDreamNotes({ req, user: minorUser });
    assert.strictEqual(response.status, 403);
    assert.strictEqual(response.body.error.code, "FORBIDDEN");
  });

  await t.test("Case 11c: Rejects request with no uploaded image (400 BAD_REQUEST)", async () => {
    const req = makeMultipartRequest({
      fields: { noteTitle: "Untitled" }
    });
    const response = await extractDreamNotes({ req, user: adultUser });
    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.error.code, "BAD_REQUEST");
  });

  await t.test("Case 11d: Rejects invalid/corrupt image signature with 400 INVALID_IMAGE_FORMAT", async () => {
    const corruptBuffer = Buffer.from("Corrupted image byte stream");
    const req = makeMultipartRequest({
      file: { buffer: corruptBuffer, mimeType: "image/jpeg" }
    });
    const response = await extractDreamNotes({ req, user: adultUser });
    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.error.code, "INVALID_IMAGE_FORMAT");
  });

  await t.test("Case 12: Rejects oversized image >10MB with 413 PAYLOAD_TOO_LARGE", async () => {
    const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024);
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    oversizedBuffer[2] = 0xff;

    const req = makeMultipartRequest({
      file: { buffer: oversizedBuffer, mimeType: "image/jpeg" }
    });
    const response = await extractDreamNotes({ req, user: adultUser });
    assert.strictEqual(response.status, 413);
    assert.strictEqual(response.body.error.code, "PAYLOAD_TOO_LARGE");
  });

  await t.test("Case 13: Successfully extracts dream notes from photo for authorized adult", async () => {
    const req = makeMultipartRequest({
      file: { buffer: sampleJpeg, mimeType: "image/jpeg", filename: "my_journal_page.jpg" }
    });
    const response = await extractDreamNotes({ req, user: adultUser });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.ok(response.body.data.extractedText, "Extracted text is present");
    assert.ok(Array.isArray(response.body.data.uncertainSegments), "Uncertain segments array is present");
    assert.ok(Array.isArray(response.body.data.warnings), "Warnings array is present");
  });

  await t.test("Case 14: Privacy assertion: Zero user dream text or image data printed to server logs", async () => {
    const loggedOutputs = [];
    const originalLog = console.log;
    const originalInfo = console.info;

    console.log = (...args) => {
      loggedOutputs.push(args.join(" "));
      originalLog.apply(console, args);
    };
    console.info = (...args) => {
      loggedOutputs.push(args.join(" "));
      originalInfo.apply(console, args);
    };

    try {
      const req = makeMultipartRequest({
        file: { buffer: sampleJpeg, mimeType: "image/jpeg", filename: "secret_dream_note.jpg" }
      });
      const response = await extractDreamNotes({ req, user: adultUser });
      const extractedText = response.body.data.extractedText;

      const textLeak = loggedOutputs.find((line) => line.includes(extractedText));
      assert.strictEqual(textLeak, undefined, "Extracted notes text must NEVER be logged.");

      const base64Leak = loggedOutputs.find((line) => line.includes(sampleJpeg.toString("base64")));
      assert.strictEqual(base64Leak, undefined, "Image binary/base64 data must NEVER be logged.");
    } finally {
      console.log = originalLog;
      console.info = originalInfo;
    }
  });
});
