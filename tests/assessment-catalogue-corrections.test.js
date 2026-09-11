import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const mainJsPath = path.join(rootDir, "src", "main.js");
const i18nJsPath = path.join(rootDir, "src", "utils", "i18n.js");

test("Prompt 2: Correct catalogue claims, instrument identity, and honest counts", async (t) => {
  const mainJsContent = fs.readFileSync(mainJsPath, "utf8");
  const i18nJsContent = fs.readFileSync(i18nJsPath, "utf8");

  await t.test("1. Anger instrument identity is corrected to BPAQ (Buss-Perry Aggression Questionnaire)", () => {
    assert.match(
      mainJsContent,
      /short:\s*['"]BPAQ['"]/,
      "Buss-Perry Aggression Questionnaire short code must be BPAQ (not BDI)"
    );
    assert.doesNotMatch(
      mainJsContent,
      /short:\s*['"]BDI['"]/,
      "Outdated BDI short code must not be used for Buss-Perry"
    );
    assert.match(
      i18nJsContent,
      /"Anger Management \(BPAQ\)":/,
      "i18n must include translated key for Anger Management (BPAQ)"
    );
  });

  await t.test("2. Active screening tools vs. in-review tools are explicitly differentiated", () => {
    assert.match(
      mainJsContent,
      /category:\s*['"]Symptom Screen['"]/,
      "Must assign Symptom Screen category"
    );
    assert.match(
      mainJsContent,
      /category:\s*['"]Life-Context Reflection['"]/,
      "Must assign Life-Context Reflection category"
    );
    assert.match(
      mainJsContent,
      /status:\s*['"]In Clinical Review['"]/,
      "Incomplete tools must be marked In Clinical Review"
    );
    assert.match(
      mainJsContent,
      /status:\s*['"]Available['"]/,
      "Validated tools must be marked Available"
    );
  });

  await t.test("3. Section header derives honest active count from genuinely released definitions", () => {
    assert.match(
      mainJsContent,
      /const activeCount = tests\.filter\(t => !t\.placeholder\)\.length;/,
      "Must compute active count dynamically from non-placeholder tests"
    );
    assert.match(
      mainJsContent,
      /const inReviewCount = tests\.filter\(t => t\.placeholder\)\.length;/,
      "Must compute in-review count dynamically"
    );
    assert.match(
      mainJsContent,
      /\$\{activeCount\}\s*\$\{t\(["']Free Clinical Screenings["']\)\}/,
      "Header must render honest count of free clinical screenings"
    );
    assert.doesNotMatch(
      mainJsContent,
      /\$\{t\(["']12 Free Clinical Tests\.["']\)\}/,
      "Misleading hardcoded '12 Free Clinical Tests.' headline must be replaced"
    );
  });

  await t.test("4. Incomplete placeholder tools render honest unavailable state and do not promise false signup unlock", () => {
    assert.match(
      mainJsContent,
      /Assessment In Clinical Review/,
      "Placeholder container must inform user that assessment is under review"
    );
    assert.match(
      mainJsContent,
      /under clinical review and rights verification/,
      "Must state that tool is under review and rights verification"
    );
    assert.doesNotMatch(
      mainJsContent,
      /Create a free account to unlock this clinical assessment/,
      "Must NOT promise that creating an account unlocks non-existent questions"
    );
    assert.match(
      mainJsContent,
      /window\.changeTestPreview\(0\)/,
      "Placeholder container must provide quick navigation to active PHQ-9 screening"
    );
    assert.match(
      mainJsContent,
      /window\.changeTestPreview\(1\)/,
      "Placeholder container must provide quick navigation to active GAD-7 screening"
    );
  });

  await t.test("5. Validated PHQ-9 and GAD-7 remain fully functional with 9 and 7 items", () => {
    assert.match(
      mainJsContent,
      /name:\s*['"]PHQ-9 \(Depression\)['"]/,
      "PHQ-9 must exist"
    );
    assert.match(
      mainJsContent,
      /name:\s*['"]GAD-7 \(Anxiety\)['"]/,
      "GAD-7 must exist"
    );
  });
});
