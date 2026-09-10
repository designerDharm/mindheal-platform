import test from "node:test";
import assert from "node:assert";
import { Readable } from "node:stream";
import {
  validateAudioBuffer,
  detectLanguage,
  extractUncertaintyMarkers,
  transcribeAudio,
  ALLOWED_AUDIO_MIMES
} from "../src/services/ai.service.js";
import { transcribeDreamAudio } from "../src/controllers/ai.controller.js";

// Helper to construct synthetic multipart requests for busboy
function makeMultipartRequest({
  fields = {},
  file = null,
  customHeaders = {},
  boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
}) {
  const parts = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
    ));
  }

  if (file) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname || "audio"}"; filename="${file.filename || "recording.webm"}"\r\nContent-Type: ${file.mimeType || "audio/webm"}\r\n\r\n`
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

// Sample audio headers for tests
const sampleWebm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
const sampleWav = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WAVE"),
  Buffer.from("fmt ")
]);
const sampleOgg = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(10)]);
const sampleMp3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(10)]);
const sampleMp4 = Buffer.concat([Buffer.alloc(4), Buffer.from("ftyp"), Buffer.alloc(10)]);

test("Milestone 3: Audio buffer validation & format verification", async (t) => {
  await t.test("accepts valid audio signatures for supported formats", () => {
    assert.strictEqual(validateAudioBuffer(sampleWebm, "audio/webm").valid, true);
    assert.strictEqual(validateAudioBuffer(sampleWebm, "audio/webm;codecs=opus").valid, true);
    assert.strictEqual(validateAudioBuffer(sampleWav, "audio/wav").valid, true);
    assert.strictEqual(validateAudioBuffer(sampleOgg, "audio/ogg").valid, true);
    assert.strictEqual(validateAudioBuffer(sampleMp3, "audio/mp3").valid, true);
    assert.strictEqual(validateAudioBuffer(sampleMp3, "audio/mpeg").valid, true);
    assert.strictEqual(validateAudioBuffer(sampleMp4, "audio/mp4").valid, true);
    assert.strictEqual(validateAudioBuffer(sampleMp4, "audio/x-m4a").valid, true);
  });

  await t.test("rejects invalid MIME type", () => {
    const res = validateAudioBuffer(sampleWebm, "video/mp4");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, "mime");
  });

  await t.test("rejects mismatched file signature (e.g. text file disguised as audio)", () => {
    const fakeAudio = Buffer.from("This is plain text disguised as an audio recording");
    const res = validateAudioBuffer(fakeAudio, "audio/webm");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, "signature");
  });

  await t.test("rejects empty audio buffer", () => {
    const res = validateAudioBuffer(Buffer.alloc(0), "audio/webm");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, "empty");
  });

  await t.test("rejects audio file exceeding 15MB size limit", () => {
    const oversizedBuffer = Buffer.alloc(15 * 1024 * 1024 + 1);
    oversizedBuffer[0] = 0x1a;
    oversizedBuffer[1] = 0x45;
    oversizedBuffer[2] = 0xdf;
    oversizedBuffer[3] = 0xa3;
    const res = validateAudioBuffer(oversizedBuffer, "audio/webm");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, "size");
  });
});

test("Milestone 3: Language detection and uncertainty markers extraction", async (t) => {
  await t.test("detects English correctly", () => {
    assert.strictEqual(detectLanguage("I had a vivid dream about an open blue sky."), "en");
  });

  await t.test("detects Hindi (Devanagari) correctly", () => {
    assert.strictEqual(detectLanguage("मैं एक पुराने घर में था और चारों तरफ रोशनी थी।"), "hi");
  });

  await t.test("detects Hinglish code-switching correctly", () => {
    assert.strictEqual(detectLanguage("मैं एक bridge cross कर रहा था and then suddenly bridge shake होने लगा।"), "hinglish");
  });

  await t.test("extracts uncertainty markers including brackets and pauses", () => {
    const markers = extractUncertaintyMarkers("I was at a [temple?] or maybe a shrine... I think it was raining.");
    assert.ok(markers.includes("[temple?]"));
    assert.ok(markers.includes("..."));
    assert.ok(markers.includes("maybe"));
    assert.ok(markers.includes("i think"));
  });

  await t.test("extracts Hindi uncertainty words", () => {
    const markers = extractUncertaintyMarkers("शायद वो एक बड़ा पहाड़ था... पता नहीं कौन था वो।");
    assert.ok(markers.includes("..."));
    assert.ok(markers.includes("शायद"));
    assert.ok(markers.includes("पता नहीं"));
  });
});

test("Milestone 3: Audio transcription service", async (t) => {
  await t.test("transcribes English dream voice recording", async () => {
    const result = await transcribeAudio({
      buffer: sampleWebm,
      mimeType: "audio/webm",
      duration: 10
    });
    assert.strictEqual(result.isSilent, false);
    assert.strictEqual(result.languageDetected, "en");
    assert.ok(typeof result.transcript === "string" && result.transcript.length > 10);
    assert.strictEqual(result.durationSeconds, 10);
  });

  await t.test("transcribes Hindi speech preserving Devanagari script", async () => {
    const result = await transcribeAudio({
      buffer: sampleWebm,
      mimeType: "audio/webm",
      duration: 12,
      mockTest: "hindi"
    });
    assert.strictEqual(result.isSilent, false);
    assert.strictEqual(result.languageDetected, "hi");
    assert.ok(/[\u0900-\u097F]/.test(result.transcript), "Contains Devanagari characters");
    assert.ok(result.transcript.includes("घर"), "Contains Hindi words");
  });

  await t.test("transcribes Hinglish preserving natural code-switching without translation", async () => {
    const result = await transcribeAudio({
      buffer: sampleWebm,
      mimeType: "audio/webm",
      duration: 15,
      mockTest: "hinglish"
    });
    assert.strictEqual(result.isSilent, false);
    assert.strictEqual(result.languageDetected, "hinglish");
    assert.ok(/[\u0900-\u097F]/.test(result.transcript), "Contains Devanagari Hindi words");
    assert.ok(/[A-Za-z]/.test(result.transcript), "Contains English Latin words");
  });

  await t.test("preserves pauses and unfinished sentences faithfully", async () => {
    const result = await transcribeAudio({
      buffer: sampleWebm,
      mimeType: "audio/webm",
      duration: 8,
      mockTest: "unfinished"
    });
    assert.strictEqual(result.isSilent, false);
    assert.ok(result.transcript.includes("..."), "Preserves ellipsis/pauses");
    assert.ok(result.transcript.includes("um"), "Preserves filler word 'um'");
  });

  await t.test("handles silence or inaudible recording with isSilent flag", async () => {
    const result = await transcribeAudio({
      buffer: sampleWebm,
      mimeType: "audio/webm",
      duration: 5,
      mockTest: "silence"
    });
    assert.strictEqual(result.isSilent, true);
    assert.strictEqual(result.transcript, "");
  });
});

test("Milestone 3: Transcribe controller and security gates", async (t) => {
  const adultUser = { id: "usr_adult", dateOfBirth: "1992-05-10" };
  const minorUser = { id: "usr_minor", dateOfBirth: "2012-05-10" };

  await t.test("rejects unauthenticated requests with 401", async () => {
    const req = makeMultipartRequest({
      file: { buffer: sampleWebm, mimeType: "audio/webm" }
    });
    const response = await transcribeDreamAudio({ req, user: null });
    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.body.error.code, "UNAUTHORIZED");
  });

  await t.test("rejects minor accounts under 18 with 403", async () => {
    const req = makeMultipartRequest({
      file: { buffer: sampleWebm, mimeType: "audio/webm" }
    });
    const response = await transcribeDreamAudio({ req, user: minorUser });
    assert.strictEqual(response.status, 403);
    assert.strictEqual(response.body.error.code, "FORBIDDEN");
  });

  await t.test("rejects empty audio upload with 400", async () => {
    const req = makeMultipartRequest({
      fields: { duration: "10" }
    });
    const response = await transcribeDreamAudio({ req, user: adultUser });
    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.error.code, "BAD_REQUEST");
  });

  await t.test("rejects invalid/corrupt audio signature with 400", async () => {
    const corruptBuffer = Buffer.from("Corrupted audio data bytes without valid header");
    const req = makeMultipartRequest({
      file: { buffer: corruptBuffer, mimeType: "audio/webm" }
    });
    const response = await transcribeDreamAudio({ req, user: adultUser });
    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.error.code, "INVALID_AUDIO_FORMAT");
  });

  await t.test("successfully processes valid dream recording upload for adult user", async () => {
    const req = makeMultipartRequest({
      fields: { duration: "14" },
      file: { buffer: sampleWebm, mimeType: "audio/webm", filename: "recording.webm" }
    });
    const response = await transcribeDreamAudio({ req, user: adultUser });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.ok(response.body.data.transcript, "Transcript is returned");
    assert.strictEqual(response.body.data.durationSeconds, 14);
    assert.strictEqual(response.body.data.isSilent, false);
  });

  await t.test("privacy assertion: zero raw dream transcripts printed to logs", async () => {
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
        fields: { duration: "10" },
        file: { buffer: sampleWebm, mimeType: "audio/webm" }
      });
      const response = await transcribeDreamAudio({ req, user: adultUser });
      const transcript = response.body.data.transcript;

      // Ensure that the verbatim transcript does not appear in any server log outputs
      const leak = loggedOutputs.find((line) => line.includes(transcript));
      assert.strictEqual(leak, undefined, "Verbatim transcript must NEVER be logged to server logs.");
    } finally {
      console.log = originalLog;
      console.info = originalInfo;
    }
  });
});
