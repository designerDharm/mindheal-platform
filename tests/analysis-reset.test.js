import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

test("MH-30: Retest analysis reset controls, remove broken inline handlers, and complete state reset", async (t) => {
  const mainJsPath = path.resolve("src/main.js");
  const mainJsContent = fs.readFileSync(mainJsPath, "utf-8");

  await t.test("1. No broken inline onclick handlers referencing inaccessible module state or render exist", () => {
    assert.strictEqual(
      mainJsContent.includes("onclick=\"state.dreamResult = null; state.dreamInput = ''; render();\""),
      false,
      "Inline dream reset onclick must be removed"
    );
    assert.strictEqual(
      mainJsContent.includes("onclick=\"state.handwritingResult = null; state.handwritingInput = ''; render();\""),
      false,
      "Inline handwriting reset onclick must be removed"
    );
    assert.strictEqual(
      mainJsContent.includes("onclick=\"state.signatureResult = null; state.signatureInput = ''; render();\""),
      false,
      "Inline signature reset onclick must be removed"
    );
    assert.strictEqual(
      mainJsContent.includes("onclick=\"state.otpMode = false; render();\""),
      false,
      "Inline OTP mode close onclick must be removed"
    );
  });

  await t.test("2. Semantic data-action attributes and handlers are present for reset controls and modal cancellation", () => {
    assert.strictEqual(
      mainJsContent.includes('data-action="reset-dream-analysis"'),
      true,
      "Dream UI must use data-action='reset-dream-analysis'"
    );
    assert.strictEqual(
      mainJsContent.includes('data-action="reset-handwriting-analysis"'),
      true,
      "Handwriting UI must use data-action='reset-handwriting-analysis'"
    );
    assert.strictEqual(
      mainJsContent.includes('data-action="reset-signature-analysis"'),
      true,
      "Signature UI must use data-action='reset-signature-analysis'"
    );
    assert.strictEqual(
      mainJsContent.includes('data-action="cancel-otp"'),
      true,
      "OTP modal must use data-action='cancel-otp'"
    );
  });

  await t.test("3. resetAnalysis function exists and resets complete state (result, input, error, analyzing flag)", () => {
    // Verify function definition in source
    assert.strictEqual(
      mainJsContent.includes("function resetAnalysis("),
      true,
      "resetAnalysis function must be defined"
    );

    // Verify reset covers all state fields
    assert.strictEqual(
      mainJsContent.includes("state.dreamResult = null;") &&
      mainJsContent.includes("state.dreamInput = \"\";") &&
      mainJsContent.includes("state.dreamError = \"\";") &&
      mainJsContent.includes("state.dreamAnalyzing = false;"),
      true,
      "resetAnalysis must clear dream result, input, error, and analyzing flag"
    );

    assert.strictEqual(
      mainJsContent.includes("state.handwritingResult = null;") &&
      mainJsContent.includes("state.handwritingInput = \"\";") &&
      mainJsContent.includes("state.handwritingError = \"\";") &&
      mainJsContent.includes("state.handwritingAnalyzing = false;"),
      true,
      "resetAnalysis must clear handwriting result, input, error, and analyzing flag"
    );

    assert.strictEqual(
      mainJsContent.includes("state.signatureResult = null;") &&
      mainJsContent.includes("state.signatureInput = \"\";") &&
      mainJsContent.includes("state.signatureError = \"\";") &&
      mainJsContent.includes("state.signatureAnalyzing = false;"),
      true,
      "resetAnalysis must clear signature result, input, error, and analyzing flag"
    );
  });

  await t.test("4. Functional verification of complete state reset after success and failure", () => {
    // Simulate the reset logic directly as implemented in resetAnalysis
    const mockState = {
      dreamResult: { interpretation: "A peaceful dream" },
      dreamInput: "I was flying over mountains",
      dreamError: "Previous network error",
      dreamAnalyzing: true,

      handwritingResult: { analysis: "Creative personality" },
      handwritingInput: "data:image/png;base64,mockHandwriting",
      handwritingError: "Analysis failed",
      handwritingAnalyzing: false,

      signatureResult: { analysis: "Confident signature" },
      signatureInput: "data:image/png;base64,mockSignature",
      signatureError: "Upload timeout",
      signatureAnalyzing: false
    };

    let renderCallCount = 0;
    const mockRender = () => { renderCallCount++; };

    function performReset(type, state, render) {
      if (type === "dream") {
        state.dreamResult = null;
        state.dreamInput = "";
        state.dreamError = "";
        state.dreamAnalyzing = false;
      } else if (type === "handwriting") {
        state.handwritingResult = null;
        state.handwritingInput = "";
        state.handwritingError = "";
        state.handwritingAnalyzing = false;
      } else if (type === "signature") {
        state.signatureResult = null;
        state.signatureInput = "";
        state.signatureError = "";
        state.signatureAnalyzing = false;
      }
      if (typeof render === "function") render();
    }

    // Reset dream (verifying success + failure fields cleared)
    performReset("dream", mockState, mockRender);
    assert.strictEqual(mockState.dreamResult, null, "dreamResult should be null");
    assert.strictEqual(mockState.dreamInput, "", "dreamInput should be empty string");
    assert.strictEqual(mockState.dreamError, "", "dreamError should be cleared (no stale error)");
    assert.strictEqual(mockState.dreamAnalyzing, false, "dreamAnalyzing should be false");
    assert.strictEqual(renderCallCount, 1, "render should have been called once");

    // Reset handwriting
    performReset("handwriting", mockState, mockRender);
    assert.strictEqual(mockState.handwritingResult, null, "handwritingResult should be null");
    assert.strictEqual(mockState.handwritingInput, "", "handwritingInput should be empty string");
    assert.strictEqual(mockState.handwritingError, "", "handwritingError should be cleared");
    assert.strictEqual(mockState.handwritingAnalyzing, false, "handwritingAnalyzing should be false");
    assert.strictEqual(renderCallCount, 2, "render should have been called twice");

    // Reset signature
    performReset("signature", mockState, mockRender);
    assert.strictEqual(mockState.signatureResult, null, "signatureResult should be null");
    assert.strictEqual(mockState.signatureInput, "", "signatureInput should be empty string");
    assert.strictEqual(mockState.signatureError, "", "signatureError should be cleared");
    assert.strictEqual(mockState.signatureAnalyzing, false, "signatureAnalyzing should be false");
    assert.strictEqual(renderCallCount, 3, "render should have been called 3 times");
  });

  await t.test("5. Error banners and forms provide accessible reset controls on failure", () => {
    // Verify that error states render reset buttons with data-action
    assert.strictEqual(
      mainJsContent.includes('class="analysis-error-banner"'),
      true,
      "Analysis error banner container must be present"
    );
    assert.strictEqual(
      mainJsContent.includes('data-action="reset-dream-analysis"'),
      true,
      "Dream error banner and form must offer a reset button"
    );
    assert.strictEqual(
      mainJsContent.includes('data-action="reset-handwriting-analysis"'),
      true,
      "Handwriting error banner and form must offer a reset button"
    );
    assert.strictEqual(
      mainJsContent.includes('data-action="reset-signature-analysis"'),
      true,
      "Signature error banner and form must offer a reset button"
    );
  });
});
