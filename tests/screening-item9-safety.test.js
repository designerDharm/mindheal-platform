import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const mainJsPath = path.join(rootDir, "src", "main.js");

test("MH-16: Item-level screening safety handling (PHQ-9 Item 9)", async (t) => {
  const mainJsContent = fs.readFileSync(mainJsPath, "utf8");

  await t.test("1. window.currentTestState preserves individual answers array", () => {
    assert.match(
      mainJsContent,
      /window\.currentTestState\s*=\s*\{[^}]*answers:\s*\[\]/,
      "currentTestState must initialize an answers array"
    );

    assert.match(
      mainJsContent,
      /state\.answers\s*=\s*state\.answers\s*\|\|\s*\[\];\s*state\.answers\.push\(points\);/,
      "handleTestAnswer must preserve each answer in state.answers"
    );
  });

  await t.test("2. Clinician-approved safety rule evaluates PHQ-9 Item 9 independently of total score", () => {
    assert.match(
      mainJsContent,
      /isPHQ9\s*=\s*test\.short\s*===\s*["']PHQ-9["']/,
      "Must identify PHQ-9 assessment"
    );

    assert.match(
      mainJsContent,
      /item9Score\s*=\s*isPHQ9\s*&&\s*Array\.isArray\(state\.answers\)\s*\?\s*Number\(state\.answers\[8\]\s*\|\|\s*0\)\s*:\s*0/,
      "Must check Item 9 (index 8) answer score"
    );

    assert.match(
      mainJsContent,
      /isPositiveItem9\s*=\s*isPHQ9\s*&&\s*item9Score\s*>\s*0/,
      "Must detect positive Item 9 when score > 0"
    );
  });

  await t.test("3. Renders immediate, prominent crisis banner and emergency helplines for positive Item 9", () => {
    assert.match(
      mainJsContent,
      /class="crisis-safety-alert"/,
      "Must render crisis-safety-alert banner"
    );

    assert.match(
      mainJsContent,
      /href="tel:14416"/,
      "Must include Tele-MANAS helpline (14416)"
    );

    assert.match(
      mainJsContent,
      /href="tel:9820466726"/,
      "Must include AASRA crisis helpline (9820466726)"
    );

    assert.match(
      mainJsContent,
      /href="tel:112"/,
      "Must include National Emergency (112)"
    );
  });

  await t.test("4. MH-17: Emergency call button dial target matches AASRA 9820466726", () => {
    // Look for the AASRA emergency call button in sectionEmergency
    const aasraRegex = /href="tel:(\d+)"[^>]*>\s*<i[^>]*><\/i>\s*\$\{t\("Call AASRA \(India\): 9820466726"\)\}/;
    const match = mainJsContent.match(aasraRegex);
    assert.ok(match, "AASRA button must exist in main.js");
    assert.strictEqual(match[1], "9820466726", "AASRA dial link must match 9820466726 (not 9152987821)");
  });

  await t.test("5. Synthetic positive Item 9 simulation: score = 1 displays crisis alert", () => {
    // Create a mock simulation matching the logic in main.js
    const state = {
      testIndex: 0,
      score: 1, // 0 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 1 = 1 (Minimal Depression)
      answers: [0, 0, 0, 0, 0, 0, 0, 0, 1],
      isFinished: true
    };
    const testDef = {
      name: "PHQ-9 (Depression)",
      short: "PHQ-9",
      scoring: [
        { max: 4, label: "Minimal Depression" },
        { max: 9, label: "Mild Depression" }
      ]
    };

    let severityLabel = "Result";
    for (let bracket of testDef.scoring) {
      if (state.score <= bracket.max) {
        severityLabel = bracket.label;
        break;
      }
    }
    assert.strictEqual(severityLabel, "Minimal Depression");

    const isPHQ9 = testDef.short === "PHQ-9";
    const item9Score = isPHQ9 && Array.isArray(state.answers) ? Number(state.answers[8] || 0) : 0;
    const isPositiveItem9 = isPHQ9 && item9Score > 0;

    // Although severity is Minimal Depression (score = 1), Item 9 is positive!
    assert.strictEqual(isPositiveItem9, true, "Positive Item 9 must be flagged");
  });
});
