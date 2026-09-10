import test from "node:test";
import assert from "node:assert";
import {
  createDefaultDreamCaptureState,
  renderDreamCapture,
  initDreamCaptureHandlers
} from "../src/features/dream-capture.js";

test("Review Your Dream: Layout matches user ASCII specification", () => {
  const sampleState = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      processingStage: "review",
      sourceType: "type",
      rawInput: "I was standing near a station. I think there was a dog, or perhaps a wolf...",
      structuredDraft: "I was standing near a station. I think there was a dog, or perhaps a wolf...",
      editedDraft: "I was standing near a station. I think there was a dog, or perhaps a wolf...",
      reviewView: "organised",
      organisedData: {
        narrative: "I was standing near a station. I think there was a dog, or perhaps a wolf...",
        places: ["Station"],
        symbolsOrObjects: ["Dog or possibly wolf"],
        emotions: ["Feeling of uneasiness"],
        people: [],
        sensoryDetails: [],
        uncertainDetails: ["Exact animal was unclear"]
      }
    }
  };

  const htmlOutput = renderDreamCapture(sampleState);

  // 1. Title
  assert.ok(htmlOutput.includes("Review Your Dream"), "Title must include 'Review Your Dream'");

  // 2. Tabs order: Original first, Organised second
  const originalPos = htmlOutput.indexOf('data-view="original"');
  const organisedPos = htmlOutput.indexOf('data-view="organised"');
  assert.ok(originalPos !== -1, "Original tab exists");
  assert.ok(organisedPos !== -1, "Organised tab exists");
  assert.ok(originalPos < organisedPos, "Original tab must precede Organised tab");

  // 3. Textarea and caption
  assert.ok(htmlOutput.includes('id="dreamReviewEditedDraft"'), "Textarea must be rendered");
  assert.ok(htmlOutput.includes("editable organised text"), "Must show caption 'editable organised text'");

  // 4. AI preserved bullet list
  assert.ok(htmlOutput.includes("AI preserved:"), "Must show 'AI preserved:' header");
  assert.ok(htmlOutput.includes("Station"), "Must include preserved place 'Station'");
  assert.ok(htmlOutput.includes("Dog or possibly wolf"), "Must include preserved symbol 'Dog or possibly wolf'");
  assert.ok(htmlOutput.includes("Feeling of uneasiness"), "Must include preserved emotion 'Feeling of uneasiness'");

  // 5. Uncertain details bullet list
  assert.ok(htmlOutput.includes("Uncertain details:"), "Must show 'Uncertain details:' header");
  assert.ok(htmlOutput.includes("Exact animal was unclear"), "Must include uncertain detail");

  // 6. Action buttons
  assert.ok(htmlOutput.includes("Restore Original"), "Must include 'Restore Original' button");
  assert.ok(htmlOutput.includes('data-action="dream-review-restore-original"'), "Restore button has correct data-action");
  assert.ok(htmlOutput.includes("Re-organise"), "Must include 'Re-organise' button");
  assert.ok(htmlOutput.includes('data-action="dream-review-reorganise"'), "Re-organise button has correct data-action");
  assert.ok(htmlOutput.includes("Approve & Analyse Dream"), "Must include 'Approve & Analyse Dream' button");
  assert.ok(htmlOutput.includes('data-action="dream-review-approve"'), "Approve button has correct data-action");
});

test("Review Your Dream: Tab switching between Organised and Original", () => {
  const originalState = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      processingStage: "review",
      sourceType: "voice",
      rawInput: "Raw fragmented voice recording notes.",
      structuredDraft: "Structured voice recording narrative.",
      editedDraft: "Structured voice recording narrative.",
      reviewView: "original"
    }
  };

  const htmlOutput = renderDreamCapture(originalState);
  assert.ok(htmlOutput.includes("Original Verbatim Source (Read-only record)"), "Original container rendered");
  assert.ok(htmlOutput.includes("Raw fragmented voice recording notes."), "Raw text visible");
  assert.ok(htmlOutput.includes("original verbatim text"), "Original caption displayed");
});

test("Review Your Dream: Restore Original action resets edited draft to rawInput", () => {
  const state = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      processingStage: "review",
      sourceType: "type",
      rawInput: "Original verbatim dream input",
      structuredDraft: "Organised AI draft",
      editedDraft: "User manually modified draft",
      reviewView: "organised"
    }
  };

  // Mock document
  let clickHandler = null;
  const originalDoc = global.document;
  global.document = {
    querySelectorAll: (selector) => {
      if (selector === "[data-action='dream-review-restore-original']") {
        return [{
          addEventListener: (evt, fn) => {
            if (evt === "click") clickHandler = fn;
          }
        }];
      }
      return [];
    },
    querySelector: () => null
  };

  let rendered = false;
  initDreamCaptureHandlers(state, () => { rendered = true; }, null);

  assert.strictEqual(typeof clickHandler, "function", "Handler registered");
  clickHandler();

  assert.strictEqual(state.dreamCapture.editedDraft, "Original verbatim dream input", "Restores rawInput");
  assert.strictEqual(state.dreamCapture.structuredDraft, "Original verbatim dream input", "Updates structuredDraft");
  assert.strictEqual(rendered, true, "Triggered re-render");

  global.document = originalDoc;
});
