import test from "node:test";
import assert from "node:assert";
import {
  createDefaultDreamCaptureState,
  renderDreamCapture
} from "../src/features/dream-capture.js";

test("Milestone 5 - Frontend Dream Capture State Initialization", (t) => {
  const state = createDefaultDreamCaptureState();
  assert.strictEqual(state.inputMode, "type");
  assert.strictEqual(state.processingStage, "idle");
  assert.strictEqual(state.organisedData, null);
  assert.deepStrictEqual(state.revisionHistory, []);
  assert.strictEqual(state.reviewView, "organised");
});

test("Milestone 5 - Busy State indicates memory organisation without interpretation", (t) => {
  const appState = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      processingStage: "organising"
    }
  };

  const rendered = renderDreamCapture(appState);
  assert.ok(rendered.includes("Organising your memories…"), "Must show organising memories headline");
  assert.ok(rendered.includes("Structuring chronology without inventing any dream events"), "Must emphasize no event invention");
});

test("Milestone 5 - Error State provides non-destructive retry and continue with original", (t) => {
  const appState = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      processingStage: "error",
      errorMessage: "AI service connection error. Notes preserved.",
      rawInput: "I remember flying above mountains."
    }
  };

  const rendered = renderDreamCapture(appState);
  assert.ok(rendered.includes("Organisation Unsuccessful"), "Should show error heading");
  assert.ok(rendered.includes("data-action=\"dream-organise-retry\""), "Should provide retry button");
  assert.ok(rendered.includes("data-action=\"dream-continue-original\""), "Should provide continue with original button");
});

test("Milestone 5 - Review Dream displays organised narrative and lightweight entity pills", (t) => {
  const appState = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      processingStage: "review",
      rawInput: "I saw something that might have been a dog or a wolf at school. Felt scared.",
      structuredDraft: "I saw something that might have been a dog or a wolf at school. Felt scared.",
      editedDraft: "I saw something that might have been a dog or a wolf at school. Felt scared.",
      reviewView: "organised",
      organisedData: {
        narrative: "I saw something that might have been a dog or a wolf at school. Felt scared.",
        people: [],
        places: ["school"],
        symbolsOrObjects: ["dog or wolf (uncertain)"],
        emotions: ["scared"],
        sensoryDetails: [],
        memorableMoments: [],
        endingOrWakingFeeling: "",
        uncertainDetails: ["identity of animal (dog or a wolf)"],
        warnings: []
      },
      revisionHistory: [
        { narrative: "Draft 1", organisedData: null, timestamp: Date.now() - 1000 }
      ]
    }
  };

  const rendered = renderDreamCapture(appState);

  // Tabs
  assert.ok(rendered.includes("data-view=\"organised\""));
  assert.ok(rendered.includes("data-view=\"original\""));

  // Textarea
  assert.ok(rendered.includes("id=\"dreamReviewEditedDraft\""));
  assert.ok(rendered.includes("dog or a wolf"));

  // Extracted AI preserved & Uncertain details
  assert.ok(rendered.includes("AI preserved:"), "Should show AI preserved heading");
  assert.ok(rendered.includes("school"), "Should show school place");
  assert.ok(rendered.includes("scared"), "Should show scared emotion");
  assert.ok(rendered.includes("Uncertain details:"), "Should show Uncertain details heading");
  assert.ok(rendered.includes("identity of animal (dog or a wolf)"), "Should show uncertain item");

  // Actions
  assert.ok(rendered.includes("Restore Original"), "Should show Restore Original button");
  assert.ok(rendered.includes("data-action=\"dream-review-restore-original\""), "Should have Restore Original action");
  assert.ok(rendered.includes("data-action=\"dream-review-reorganise\""), "Should have re-organise action");
  assert.ok(rendered.includes("data-action=\"dream-review-approve\""), "Should have approve action");
  assert.ok(rendered.includes("editable organised text"), "Should show editor caption");
});

test("Milestone 5 - Review Dream Original View displays verbatim source as read-only", (t) => {
  const verbatimSource = "Raw fragmented: saw dog? or wolf... maybe at school... scary";
  const appState = {
    dreamCapture: {
      ...createDefaultDreamCaptureState(),
      processingStage: "review",
      rawInput: verbatimSource,
      reviewView: "original"
    }
  };

  const rendered = renderDreamCapture(appState);
  assert.ok(rendered.includes("Original Verbatim Source (Read-only record)"));
  assert.ok(rendered.includes(verbatimSource));
});
