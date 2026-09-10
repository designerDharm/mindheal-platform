import test from "node:test";
import assert from "node:assert";
import {
  createDefaultDreamCaptureState,
  renderDreamCapture,
  resetDreamCaptureState,
  formatElapsedSeconds
} from "../src/features/dream-capture.js";

test("Dream Capture: Initial state contract", () => {
  const state = createDefaultDreamCaptureState();
  assert.strictEqual(state.inputMode, "type");
  assert.strictEqual(state.processingStage, "idle");
  assert.strictEqual(state.sourceType, "type");
  assert.strictEqual(state.rawInput, "");
  assert.strictEqual(state.structuredDraft, "");
  assert.strictEqual(state.editedDraft, "");
  assert.strictEqual(state.reviewView, "organised");
  assert.strictEqual(state.voiceElapsedSeconds, 0);
  assert.strictEqual(state.selectedImage, null);
  assert.strictEqual(state.errorMessage, "");
  assert.deepStrictEqual(state.uncertaintyMarkers, []);
});

test("Dream Capture: Format elapsed seconds helper", () => {
  assert.strictEqual(formatElapsedSeconds(0), "00:00");
  assert.strictEqual(formatElapsedSeconds(9), "00:09");
  assert.strictEqual(formatElapsedSeconds(65), "01:05");
  assert.strictEqual(formatElapsedSeconds(3600), "60:00");
});

test("Dream Capture: Render Segmented Mode Switcher in default Type mode", () => {
  const state = { dreamCapture: createDefaultDreamCaptureState(), dreamInput: "" };
  const htmlOutput = renderDreamCapture(state);

  // Assert container and accessible tablist
  assert.ok(htmlOutput.includes('class="dream-mode-segmented"'), "Segmented tabs container rendered");
  assert.ok(htmlOutput.includes('role="tablist"'), "tablist role exists");
  assert.ok(htmlOutput.includes('aria-label="Dream Input Mode"'), "tablist has accessible name");

  // Three tabs present
  assert.ok(htmlOutput.includes('data-mode="type"'), "Type tab exists");
  assert.ok(htmlOutput.includes('data-mode="voice"'), "Speak tab exists");
  assert.ok(htmlOutput.includes('data-mode="image"'), "Scan Notes tab exists");

  // Type is active
  assert.ok(htmlOutput.includes('class="dream-mode-tab active"'), "A tab is active");
  assert.ok(htmlOutput.includes('aria-selected="true"'), "Active tab has aria-selected=true");

  // Supporting copy & placeholder
  assert.ok(htmlOutput.includes("Tell us everything you remember — even small or incomplete details."), "Supporting copy rendered");
  assert.ok(htmlOutput.includes("Describe the dream as you remember it. It doesn't need to be organised."), "Textarea placeholder rendered");

  // Optional secondary action "Organise my notes"
  assert.ok(htmlOutput.includes('data-action="dream-organise-typed"'), "Organise my notes action button rendered");
  assert.ok(htmlOutput.includes("Organise my notes"), "Button label rendered");
});

test("Dream Capture: Switch to Speak mode renders idle recording state", () => {
  const state = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      inputMode: "voice",
      processingStage: "idle"
    }
  };
  const htmlOutput = renderDreamCapture(state);

  assert.ok(htmlOutput.includes('data-mode="voice"'), "Voice mode present");
  assert.ok(htmlOutput.includes("Speak Your Dream Memories"), "Voice heading rendered");
  assert.ok(htmlOutput.includes('data-action="dream-voice-start"'), "Start Recording button rendered");
  assert.ok(htmlOutput.includes("Start Recording"), "Start Recording text rendered");
});

test("Dream Capture: Voice recording active state displays timer and controls", () => {
  const state = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      inputMode: "voice",
      processingStage: "recording",
      voiceElapsedSeconds: 42
    }
  };
  const htmlOutput = renderDreamCapture(state);

  assert.ok(htmlOutput.includes('class="pulse-indicator live"'), "Live recording indicator rendered");
  assert.ok(htmlOutput.includes("00:42"), "Elapsed timer rendered");
  assert.ok(htmlOutput.includes('data-action="dream-voice-pause"'), "Pause button rendered");
  assert.ok(htmlOutput.includes('data-action="dream-voice-finish"'), "Finish button rendered");
  assert.ok(htmlOutput.includes('data-action="dream-voice-discard"'), "Discard button rendered");
});

test("Dream Capture: Voice paused state displays resume and finish controls", () => {
  const state = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      inputMode: "voice",
      processingStage: "paused",
      voiceElapsedSeconds: 75
    }
  };
  const htmlOutput = renderDreamCapture(state);

  assert.ok(htmlOutput.includes('class="pulse-indicator paused"'), "Paused indicator rendered");
  assert.ok(htmlOutput.includes("01:15"), "Elapsed timer paused time rendered");
  assert.ok(htmlOutput.includes('data-action="dream-voice-resume"'), "Resume button rendered");
  assert.ok(htmlOutput.includes('data-action="dream-voice-finish"'), "Finish button rendered");
});

test("Dream Capture: Switch to Scan Notes mode renders camera & upload triggers", () => {
  const state = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      inputMode: "image",
      processingStage: "idle"
    }
  };
  const htmlOutput = renderDreamCapture(state);

  assert.ok(htmlOutput.includes('data-mode="image"'), "Scan Notes tab mode present");
  assert.ok(htmlOutput.includes("Take Photo"), "Take Photo option exists");
  assert.ok(htmlOutput.includes('capture="environment"'), "Camera option has capture=environment for mobile");
  assert.ok(htmlOutput.includes('accept="image/*"'), "Image accept attribute set");
  assert.ok(htmlOutput.includes("Upload Image"), "Upload Image option exists");
});

test("Dream Capture: Scan Notes preview state renders replace and remove buttons", () => {
  const state = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      inputMode: "image",
      processingStage: "idle",
      selectedImage: {
        previewUrl: "blob:http://localhost/test-preview",
        name: "dream_notebook_page1.jpg",
        size: 1048576
      }
    }
  };
  const htmlOutput = renderDreamCapture(state);

  assert.ok(htmlOutput.includes('src="blob:http://localhost/test-preview"'), "Preview image rendered");
  assert.ok(htmlOutput.includes("dream_notebook_page1.jpg"), "File name rendered");
  assert.ok(htmlOutput.includes("1024 KB"), "File size formatted and rendered");
  assert.ok(htmlOutput.includes('data-action="dream-scan-remove"'), "Remove button exists");
  assert.ok(htmlOutput.includes('class="btn secondary preview-btn-replace"'), "Replace button exists");
  assert.ok(htmlOutput.includes('data-action="dream-scan-process"'), "Read notes button exists");
  assert.ok(htmlOutput.includes("Read my notes"), "Read my notes button label rendered");
});

test("Dream Capture: Processing states render appropriate status messages", () => {
  const stateTranscribing = {
    dreamCapture: { ...createDefaultDreamCaptureState(), processingStage: "transcribing" }
  };
  assert.ok(renderDreamCapture(stateTranscribing).includes("Transcribing your dream…"), "Transcribing message rendered");

  const stateExtracting = {
    dreamCapture: { ...createDefaultDreamCaptureState(), processingStage: "extracting" }
  };
  assert.ok(renderDreamCapture(stateExtracting).includes("Reading your notes…"), "Reading notes message rendered");

  const stateOrganising = {
    dreamCapture: { ...createDefaultDreamCaptureState(), processingStage: "organising" }
  };
  assert.ok(renderDreamCapture(stateOrganising).includes("Organising your memories…"), "Organising memories message rendered");
});

test("Dream Capture: Shared Review Dream UI renders Organised view with uncertainty badges", () => {
  const state = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      processingStage: "review",
      sourceType: "image",
      rawInput: "Raw notes saw [temple?] in the rain",
      structuredDraft: "I saw an ancient temple in the rain.",
      editedDraft: "I saw an ancient [temple?] in the rain.",
      reviewView: "organised",
      uncertaintyMarkers: ["[temple?]"]
    }
  };
  const htmlOutput = renderDreamCapture(state);

  assert.ok(htmlOutput.includes("Review Your Dream"), "Review heading rendered");
  assert.ok(htmlOutput.includes("Scanned Notes"), "Source pill rendered");
  assert.ok(htmlOutput.includes('data-view="organised"'), "Organised view button exists");
  assert.ok(htmlOutput.includes('class="uncertainty-tag">[temple?]</span>'), "Uncertainty marker highlighted in banner");
  assert.ok(htmlOutput.includes('id="dreamReviewEditedDraft"'), "Editable textarea rendered in organised view");
  assert.ok(htmlOutput.includes('data-action="dream-review-reorganise"'), "Re-organise button exists");
  assert.ok(htmlOutput.includes('data-action="dream-review-restore-original"') || htmlOutput.includes('data-action="dream-review-reset"'), "Restore original button exists");
  assert.ok(htmlOutput.includes('data-action="dream-review-approve"'), "Approve & Analyse Dream button exists");
});

test("Dream Capture: Shared Review Dream UI renders Original view in read-only format", () => {
  const state = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      processingStage: "review",
      sourceType: "voice",
      rawInput: "Verbatim voice recording speech text here.",
      structuredDraft: "Structured voice recording speech text here.",
      editedDraft: "Structured voice recording speech text here.",
      reviewView: "original"
    }
  };
  const htmlOutput = renderDreamCapture(state);

  assert.ok(htmlOutput.includes("Voice Recording"), "Source pill identifies Voice Recording");
  assert.ok(htmlOutput.includes('data-view="original"'), "Original view button exists");
  assert.ok(htmlOutput.includes('class="dream-review-original"'), "Read-only original container rendered");
  assert.ok(htmlOutput.includes("Verbatim voice recording speech text here."), "Exact verbatim text displayed");
});

test("Dream Capture: resetDreamCaptureState cleanly resets all properties", () => {
  const state = {
    dreamCapture: {
      inputMode: "voice",
      processingStage: "recording",
      sourceType: "voice",
      rawInput: "temporary audio text",
      structuredDraft: "temporary draft",
      editedDraft: "edited draft",
      reviewView: "original",
      voiceElapsedSeconds: 120,
      selectedImage: null,
      errorMessage: "some error",
      uncertaintyMarkers: ["[?]"]
    }
  };

  resetDreamCaptureState(state);

  assert.strictEqual(state.dreamCapture.inputMode, "type");
  assert.strictEqual(state.dreamCapture.processingStage, "idle");
  assert.strictEqual(state.dreamCapture.rawInput, "");
  assert.strictEqual(state.dreamCapture.editedDraft, "");
  assert.strictEqual(state.dreamCapture.voiceElapsedSeconds, 0);
  assert.strictEqual(state.dreamCapture.errorMessage, "");
  assert.strictEqual(state.dreamCapture.audioBlob, null);
});

test("Milestone 3: Voice error panel with preserved audioBlob renders retry and record again actions", () => {
  const dummyBlob = { size: 1024, type: "audio/webm" };
  const state = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      inputMode: "voice",
      processingStage: "error",
      audioBlob: dummyBlob,
      errorMessage: "Transcription timed out. Please retry."
    }
  };
  const htmlOutput = renderDreamCapture(state);

  assert.ok(htmlOutput.includes("Transcription Unsuccessful"), "Error heading rendered");
  assert.ok(htmlOutput.includes("Transcription timed out. Please retry."), "Error message rendered");
  assert.ok(htmlOutput.includes('data-action="dream-voice-retry"'), "Retry Transcription button rendered");
  assert.ok(htmlOutput.includes("Retry Transcription"), "Retry button text rendered");
  assert.ok(htmlOutput.includes('data-action="dream-voice-discard"'), "Record Again button rendered");
  assert.ok(htmlOutput.includes("Record Again"), "Record Again text rendered");
});

test("Milestone 4: Scan Notes error state retains preview card and shows error banner with retry option", () => {
  const state = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      inputMode: "image",
      processingStage: "idle",
      selectedImage: {
        previewUrl: "blob:http://localhost/scanned-journal",
        name: "journal_page.png",
        size: 512000
      },
      errorMessage: "No clear text or handwriting could be detected in this image. Please try retaking the photo with better lighting or focus."
    }
  };
  const htmlOutput = renderDreamCapture(state);

  assert.ok(htmlOutput.includes('class="dream-capture-error"'), "Error banner rendered");
  assert.ok(htmlOutput.includes("No clear text or handwriting could be detected in this image"), "Accurate error message shown");
  assert.ok(htmlOutput.includes('data-action="dream-clear-error"'), "Dismiss error button available");
  assert.ok(htmlOutput.includes('src="blob:http://localhost/scanned-journal"'), "Image preview retained so user can retry immediately");
  assert.ok(htmlOutput.includes('data-action="dream-scan-process"'), "Read my notes button retained for retry");
  assert.ok(htmlOutput.includes('data-action="dream-scan-remove"'), "Remove button available");
});

