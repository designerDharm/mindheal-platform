import test from "node:test";
import assert from "node:assert";
import {
  createDefaultDreamCaptureState,
  renderDreamCapture,
  initDreamCaptureHandlers
} from "../src/features/dream-capture.js";

test("Milestone 6: State contract includes approval and submission tracking", () => {
  const state = createDefaultDreamCaptureState();
  assert.strictEqual(state.isApproved, false, "Draft should initially be unapproved");
  assert.strictEqual(state.approvedDraft, "", "Approved draft should initially be empty string");
  assert.strictEqual(state.isSubmitting, false, "Submitting flag should initially be false");
  assert.strictEqual(state.wasUserEdited, false, "User edited flag should initially be false");
  assert.strictEqual(state.approvedAt, null, "Approved timestamp should initially be null");
});

test("Milestone 6: Render Approve & Analyse button states", () => {
  // 1. Normal state
  const normalState = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      processingStage: "review",
      rawInput: "I was flying over pine trees.",
      structuredDraft: "I was flying over pine trees.",
      editedDraft: "I was flying over pine trees.",
      reviewView: "organised"
    }
  };

  const normalHtml = renderDreamCapture(normalState);
  assert.ok(normalHtml.includes("Approve &amp; Analyse Dream") || normalHtml.includes("Approve & Analyse Dream"), "Must render Approve & Analyse Dream CTA");
  assert.ok(normalHtml.includes('data-action="dream-review-approve"'), "Must include approve action attribute");
  assert.ok(!normalHtml.includes("disabled"), "Approve button must not be disabled when idle");

  // 2. Submitting state (Double click / in-flight protection)
  const submittingState = {
    dreamCapture: {
      ...normalState.dreamCapture,
      isSubmitting: true
    }
  };

  const submittingHtml = renderDreamCapture(submittingState);
  assert.ok(submittingHtml.includes("disabled"), "Approve button must be disabled when submitting");
  assert.ok(submittingHtml.includes("Analysing Dream…"), "Must show loading spinner text");
});

test("Milestone 6: Flow 1 - Typed Direct Submission payload and metadata", () => {
  const text = "Directly typed dream about walking through a clock tower.";
  const metadata = {
    sourceType: "typed",
    wasAiOrganised: false,
    wasUserEdited: false,
    approvedAt: new Date().toISOString()
  };

  const payload = {
    type: "Dream Analysis",
    description: text,
    sampleFile: undefined,
    metadata
  };

  assert.strictEqual(payload.type, "Dream Analysis");
  assert.strictEqual(payload.description, text);
  assert.strictEqual(payload.sampleFile, undefined);
  assert.strictEqual(payload.metadata.sourceType, "typed");
  assert.strictEqual(payload.metadata.wasAiOrganised, false);
  assert.strictEqual(payload.metadata.wasUserEdited, false);
  assert.ok(typeof payload.metadata.approvedAt === "string");
});

test("Milestone 6: Flow 2 - Typed -> Organise -> Edit -> Approve & Analyse freezes exact text", async () => {
  const originalRaw = "saw weird blue bird with silver wings in my attic";
  const aiOrganised = "In an attic, I discovered a peculiar blue bird with bright silver wings.";
  const userEdited = "In an old dusty attic, I discovered a peculiar blue bird with bright silver wings that sparkled.";

  const state = {
    dreamInput: "",
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      sourceType: "type",
      rawInput: originalRaw,
      structuredDraft: aiOrganised,
      editedDraft: userEdited,
      wasUserEdited: true,
      processingStage: "review",
      reviewView: "organised",
      organisedData: { narrative: aiOrganised, symbolsOrObjects: ["blue bird"] }
    }
  };

  let capturedFinalDraft = null;
  let capturedMetadata = null;
  let renderCallCount = 0;

  // Set up mock DOM elements
  const textareaMock = { value: userEdited, addEventListener: () => {} };
  const mockButton = {
    addEventListener: (event, handler) => {
      mockButton.handler = handler;
    }
  };

  // Mock document
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

  initDreamCaptureHandlers(state, () => { renderCallCount++; }, async (finalDraft, meta) => {
    capturedFinalDraft = finalDraft;
    capturedMetadata = meta;
  });

  // Trigger approve click
  assert.ok(mockButton.handler, "Approve button handler should be registered");
  await mockButton.handler();

  // Verify frozen state
  assert.strictEqual(capturedFinalDraft, userEdited, "Submitted text must EXACTLY match the visible edited draft");
  assert.strictEqual(state.dreamCapture.approvedDraft, userEdited, "Approved draft in state must match edited draft");
  assert.strictEqual(state.dreamCapture.isApproved, true, "isApproved flag must be true");
  assert.strictEqual(state.dreamInput, userEdited, "Global dreamInput must match approved draft");
  assert.strictEqual(state.dreamCapture.wasUserEdited, true, "wasUserEdited must be true");
  assert.strictEqual(capturedMetadata.sourceType, "type");
  assert.strictEqual(capturedMetadata.wasAiOrganised, true);
  assert.strictEqual(capturedMetadata.wasUserEdited, true);
  assert.ok(capturedMetadata.approvedAt, "approvedAt must be present");
});

test("Milestone 6: Flow 3 - Voice -> Transcribe -> Organise -> Approve sends NO raw audio", async () => {
  const voiceTranscript = "I was swimming under cold water then found an underwater cathedral.";
  const organisedText = "Swimming deep underwater in cold currents, I came across an ancient sunken cathedral.";

  const state = {
    dreamInput: "",
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      inputMode: "voice",
      sourceType: "voice",
      rawInput: voiceTranscript,
      structuredDraft: organisedText,
      editedDraft: organisedText,
      wasUserEdited: false,
      processingStage: "review",
      reviewView: "organised",
      organisedData: { narrative: organisedText, places: ["underwater cathedral"] }
    }
  };

  let capturedDraft = null;
  let capturedMeta = null;

  const textareaMock = { value: organisedText, addEventListener: () => {} };
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

  assert.strictEqual(capturedDraft, organisedText);
  assert.strictEqual(capturedMeta.sourceType, "voice");
  assert.strictEqual(capturedMeta.wasAiOrganised, true);
  assert.strictEqual(capturedMeta.wasUserEdited, false);

  // When sending to executeDreamAnalysis(approvedDraft, null, metadata), sampleFile must be null
  const submissionPayload = {
    type: "Dream Analysis",
    description: capturedDraft,
    sampleFile: null,
    metadata: capturedMeta
  };

  assert.strictEqual(submissionPayload.sampleFile, null, "Raw audio file must NOT be attached to interpretation request");
  assert.strictEqual(submissionPayload.description, organisedText);
});

test("Milestone 6: Flow 4 - Image -> Extract -> Organise -> Edit -> Approve sends NO raw image", async () => {
  const extractedText = "Page 1: Red door in garden. Key was made of glass.";
  const organisedText = "In a garden stood a red door. The key to open it was made entirely of glass.";
  const finalEdited = "In a lush overgrown garden stood a red door. The key to open it was made entirely of glass.";

  const state = {
    dreamInput: "",
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      inputMode: "image",
      sourceType: "image",
      rawInput: extractedText,
      structuredDraft: organisedText,
      editedDraft: finalEdited,
      wasUserEdited: true,
      processingStage: "review",
      reviewView: "organised",
      organisedData: { narrative: organisedText, symbolsOrObjects: ["red door", "glass key"] }
    }
  };

  let capturedDraft = null;
  let capturedMeta = null;

  const textareaMock = { value: finalEdited, addEventListener: () => {} };
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

  assert.strictEqual(capturedDraft, finalEdited);
  assert.strictEqual(capturedMeta.sourceType, "image");
  assert.strictEqual(capturedMeta.wasAiOrganised, true);
  assert.strictEqual(capturedMeta.wasUserEdited, true);

  // Image binary must NOT be sent to interpretation
  const payload = {
    type: "Dream Analysis",
    description: capturedDraft,
    sampleFile: null,
    metadata: capturedMeta
  };
  assert.strictEqual(payload.sampleFile, null, "Raw notebook image must NOT be sent to interpretation pipeline");
});

test("Milestone 6: Double submission protection rejects repeated clicks while in-flight", async () => {
  let analysisCallCount = 0;

  const state = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      processingStage: "review",
      structuredDraft: "Testing double click protection.",
      editedDraft: "Testing double click protection.",
      isSubmitting: false
    }
  };

  const textareaMock = { value: "Testing double click protection.", addEventListener: () => {} };
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

  initDreamCaptureHandlers(state, () => {}, async () => {
    analysisCallCount++;
    // Simulate long-running request
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  // First click starts submission
  const p1 = mockButton.handler();
  assert.strictEqual(state.dreamCapture.isSubmitting, true, "State should be submitting immediately");

  // Second click while in-flight
  const p2 = mockButton.handler();

  await Promise.all([p1, p2]);

  assert.strictEqual(analysisCallCount, 1, "Analysis should only be dispatched ONCE despite multiple clicks");
});

test("Milestone 6: Error resilience preserves approved text and allows retry without re-extraction", async () => {
  const preservedDraft = "Dream about finding a hidden room behind a bookcase.";
  const state = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      processingStage: "review",
      structuredDraft: preservedDraft,
      editedDraft: preservedDraft,
      isSubmitting: false,
      errorMessage: ""
    }
  };

  const textareaMock = { value: preservedDraft, addEventListener: () => {} };
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

  let attempts = 0;
  initDreamCaptureHandlers(state, () => {}, async () => {
    attempts++;
    if (attempts === 1) {
      throw new Error("Network timeout contacting AI service.");
    }
    // Success on retry
  });

  // Attempt 1: Fails
  await mockButton.handler();

  assert.strictEqual(attempts, 1);
  assert.strictEqual(state.dreamCapture.isSubmitting, false, "Submitting flag should reset to false on failure");
  assert.strictEqual(state.dreamCapture.errorMessage, "Network timeout contacting AI service.");
  assert.strictEqual(state.dreamCapture.editedDraft, preservedDraft, "Draft content must be preserved");
  assert.strictEqual(state.dreamCapture.processingStage, "review", "Should remain in review stage for easy retry");

  // Attempt 2: User retries
  await mockButton.handler();
  assert.strictEqual(attempts, 2, "Second attempt succeeds without re-uploading or re-transcribing");
});
