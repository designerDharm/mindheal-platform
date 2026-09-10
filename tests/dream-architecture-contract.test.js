import test from "node:test";
import assert from "node:assert";
import {
  createDefaultDreamCaptureState,
  initDreamCaptureHandlers
} from "../src/features/dream-capture.js";

test("DreamCapture Contract: Default state includes all 6 core architecture fields", () => {
  const state = createDefaultDreamCaptureState();

  // Core Contract
  assert.ok("sourceType" in state, "Must have sourceType");
  assert.ok("rawText" in state, "Must have rawText");
  assert.ok("organisedText" in state, "Must have organisedText");
  assert.ok("approvedText" in state, "Must have approvedText");
  assert.ok("wasAiOrganised" in state, "Must have wasAiOrganised");
  assert.ok("wasUserEdited" in state, "Must have wasUserEdited");

  // Initial defaults
  assert.strictEqual(state.rawText, "");
  assert.strictEqual(state.organisedText, "");
  assert.strictEqual(state.approvedText, "");
  assert.strictEqual(state.wasAiOrganised, false);
  assert.strictEqual(state.wasUserEdited, false);
});

test("DreamCapture Contract: Voice Case - rawText immutable, organisedText cleaned, approvedText edited", async () => {
  const exactTranscription = "I saw a strange white deer in the dark pine woods running away.";
  const aiCleanedVersion = "In dark pine woods, I saw an unusual white deer running away into the trees.";
  const finalUserEdited = "In dark pine woods near my childhood home, I saw an unusual white deer running away.";

  const state = {
    dreamInput: "",
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      inputMode: "voice",
      sourceType: "voice",
      rawText: exactTranscription,
      rawInput: exactTranscription,
      organisedText: aiCleanedVersion,
      structuredDraft: aiCleanedVersion,
      editedDraft: finalUserEdited,
      wasAiOrganised: true,
      wasUserEdited: true,
      processingStage: "review",
      reviewView: "organised",
      organisedData: { narrative: aiCleanedVersion, places: ["pine woods"], symbolsOrObjects: ["white deer"] }
    }
  };

  let capturedDraft = null;
  let capturedMeta = null;

  const textareaMock = { value: finalUserEdited, addEventListener: () => {} };
  const mockButton = {
    addEventListener: (event, handler) => {
      mockButton.handler = handler;
    }
  };

  global.document = {
    querySelectorAll: (sel) => {
      if (sel === "[data-action='dream-review-approve']") return [mockButton];
      return [];
    },
    querySelector: (sel) => {
      if (sel === "#dreamReviewEditedDraft") return textareaMock;
      return null;
    }
  };

  initDreamCaptureHandlers(state, () => {}, async (draft, meta) => {
    capturedDraft = draft;
    capturedMeta = meta;
  });

  await mockButton.handler();

  // 1. rawText must be exact transcription and NEVER overwritten
  assert.strictEqual(state.dreamCapture.rawText, exactTranscription, "rawText must remain exact transcription");
  assert.strictEqual(capturedMeta.rawText, exactTranscription, "metadata.rawText must be exact transcription");

  // 2. organisedText must be AI cleaned version
  assert.strictEqual(state.dreamCapture.organisedText, aiCleanedVersion, "organisedText must remain AI cleaned version");
  assert.strictEqual(capturedMeta.organisedText, aiCleanedVersion, "metadata.organisedText must be AI cleaned version");

  // 3. approvedText must be final user-edited version
  assert.strictEqual(state.dreamCapture.approvedText, finalUserEdited, "approvedText in state must match final user edit");
  assert.strictEqual(capturedDraft, finalUserEdited, "Draft sent to analysis must be ONLY approvedText");
  assert.strictEqual(capturedMeta.approvedText, finalUserEdited, "metadata.approvedText must match final user edit");

  // 4. Flags
  assert.strictEqual(capturedMeta.wasAiOrganised, true, "wasAiOrganised must be true");
  assert.strictEqual(capturedMeta.wasUserEdited, true, "wasUserEdited must be true");
  assert.strictEqual(capturedMeta.sourceType, "voice");
});

test("DreamCapture Contract: Image Case - rawText immutable, organisedText structured, approvedText reviewed", async () => {
  const extractedHandwriting = "Lake... mist... boat without paddles. felt calm.";
  const structuredVersion = "I was at a calm mist-covered lake watching an empty boat drift without paddles.";
  const userReviewedVersion = "I was at a misty mountain lake watching an empty wooden boat drift without paddles.";

  const state = {
    dreamInput: "",
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      inputMode: "image",
      sourceType: "image",
      rawText: extractedHandwriting,
      rawInput: extractedHandwriting,
      organisedText: structuredVersion,
      structuredDraft: structuredVersion,
      editedDraft: userReviewedVersion,
      wasAiOrganised: true,
      wasUserEdited: true,
      processingStage: "review",
      reviewView: "organised",
      organisedData: { narrative: structuredVersion, places: ["lake"], emotions: ["calm"] }
    }
  };

  let capturedDraft = null;
  let capturedMeta = null;

  const textareaMock = { value: userReviewedVersion, addEventListener: () => {} };
  const mockButton = {
    addEventListener: (event, handler) => {
      mockButton.handler = handler;
    }
  };

  global.document = {
    querySelectorAll: (sel) => {
      if (sel === "[data-action='dream-review-approve']") return [mockButton];
      return [];
    },
    querySelector: (sel) => {
      if (sel === "#dreamReviewEditedDraft") return textareaMock;
      return null;
    }
  };

  initDreamCaptureHandlers(state, () => {}, async (draft, meta) => {
    capturedDraft = draft;
    capturedMeta = meta;
  });

  await mockButton.handler();

  // 1. rawText must be extracted handwriting and NEVER overwritten
  assert.strictEqual(state.dreamCapture.rawText, extractedHandwriting, "rawText must remain extracted handwriting");
  assert.strictEqual(capturedMeta.rawText, extractedHandwriting);

  // 2. organisedText must be structured version
  assert.strictEqual(state.dreamCapture.organisedText, structuredVersion);
  assert.strictEqual(capturedMeta.organisedText, structuredVersion);

  // 3. approvedText must be final user-reviewed version
  assert.strictEqual(state.dreamCapture.approvedText, userReviewedVersion);
  assert.strictEqual(capturedDraft, userReviewedVersion, "Analysis must receive ONLY approvedText");
  assert.strictEqual(capturedMeta.approvedText, userReviewedVersion);

  // 4. Flags
  assert.strictEqual(capturedMeta.wasAiOrganised, true);
  assert.strictEqual(capturedMeta.wasUserEdited, true);
  assert.strictEqual(capturedMeta.sourceType, "image");
});

test("DreamCapture Contract: Restore Original and Re-organise NEVER overwrite rawText", async () => {
  const originalRaw = "Exact initial verbatim text.";
  const organisedFirst = "First AI organised version.";

  const state = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      sourceType: "type",
      rawText: originalRaw,
      rawInput: originalRaw,
      organisedText: organisedFirst,
      structuredDraft: organisedFirst,
      editedDraft: "User typed extra words.",
      reviewView: "organised"
    }
  };

  let restoreHandler = null;
  global.document = {
    querySelectorAll: (sel) => {
      if (sel === "[data-action='dream-review-restore-original']") {
        return [{ addEventListener: (evt, fn) => { restoreHandler = fn; } }];
      }
      return [];
    },
    querySelector: () => null
  };

  initDreamCaptureHandlers(state, () => {}, null);

  // Trigger restore original
  assert.ok(restoreHandler, "Restore original handler registered");
  restoreHandler();

  // Active draft is reset to originalRaw
  assert.strictEqual(state.dreamCapture.editedDraft, originalRaw, "Active draft should match original");
  // rawText MUST NEVER be overwritten
  assert.strictEqual(state.dreamCapture.rawText, originalRaw, "rawText must remain strictly immutable");
});
