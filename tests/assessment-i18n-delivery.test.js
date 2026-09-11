import test from "node:test";
import assert from "node:assert/strict";
import { dict, t } from "../src/utils/i18n.js";
import { ASSESSMENT_REGISTRY, ANCHORS_4_POINT } from "../src/data/assessment-registry.js";

// Mock localStorage for test environment
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
}

test("Prompt 7 - Assessment i18n & Hindi Delivery", async (tSuite) => {
  // Test 1: Both English and Hindi dictionaries exist and are populated
  await tSuite.test("English and Hindi translation dictionaries are populated", () => {
    assert.ok(dict["en"], "English dictionary exists");
    assert.ok(dict["hi"], "Hindi dictionary exists");
    assert.ok(Object.keys(dict["hi"]).length > 100, "Hindi dictionary has extensive key coverage");
  });

  // Test 2: PHQ-9 and GAD-7 questions and anchor scales have valid Hindi translations
  await tSuite.test("Clinical tools have Hindi translations for all standard items and options", () => {
    const phq9 = ASSESSMENT_REGISTRY.phq9;
    assert.ok(phq9, "PHQ-9 exists");

    localStorage.setItem("mindheal-language", "Hindi");
    for (const q of phq9.items) {
      const translated = t(q.text);
      assert.ok(translated && translated !== "", `Question '${q.text}' should translate`);
      assert.notEqual(translated, q.text, `Question '${q.text}' should have distinct Hindi translation`);
    }

    for (const opt of ANCHORS_4_POINT) {
      const translated = t(opt.label);
      assert.ok(translated && translated !== "", `Option '${opt.label}' should translate`);
      assert.notEqual(translated, opt.label, `Option '${opt.label}' should have distinct Hindi translation`);
    }

    const gad7 = ASSESSMENT_REGISTRY.gad7;
    for (const q of gad7.items) {
      const translated = t(q.text);
      assert.ok(translated && translated !== "", `GAD-7 Question '${q.text}' should translate`);
      assert.notEqual(translated, q.text, `GAD-7 Question '${q.text}' should have distinct Hindi translation`);
    }
    localStorage.setItem("mindheal-language", "English");
  });

  // Test 3: Functional impact question and options have Hindi translations
  await tSuite.test("Functional impact questions and choices translate to Hindi", () => {
    localStorage.setItem("mindheal-language", "Hindi");
    const funcQuestion = "How difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?";
    const funcTrans = t(funcQuestion);
    assert.ok(funcTrans.includes("कठिन"), "Functional question contains expected Hindi vocabulary ('कठिन')");

    const funcOptions = [
      "Not difficult at all",
      "Somewhat difficult",
      "Very difficult",
      "Extremely difficult"
    ];
    for (const opt of funcOptions) {
      const trans = t(opt);
      assert.notEqual(trans, opt, `Functional option '${opt}' should have Hindi translation`);
    }
    localStorage.setItem("mindheal-language", "English");
  });

  // Test 4: Crisis protocol alert string formats cleanly with score interpolation in Hindi
  await tSuite.test("Crisis protocol string in Hindi interpolates score without untranslated text", () => {
    localStorage.setItem("mindheal-language", "Hindi");
    const template = "You indicated having thoughts that you would be better off dead or of hurting yourself. Regardless of your total depression score (which is currently {score}), your life, safety, and well-being are our highest priority. Free, confidential support is available 24/7 right now.";
    const translated = t(template).replace("{score}", 14);
    assert.ok(translated.includes("14"), "Score is properly interpolated into Hindi text");
    assert.ok(translated.includes("मर जाना बेहतर होगा"), "Contains Hindi crisis text");
    assert.ok(!translated.includes("Regardless of your total"), "English text is not present");
    localStorage.setItem("mindheal-language", "English");
  });

  // Test 5: Helplines and urgent guidance headings translate to Hindi
  await tSuite.test("Emergency guidance headers and helplines translate to Hindi", () => {
    localStorage.setItem("mindheal-language", "Hindi");
    assert.equal(t("Urgent Safety Guidance"), "अति आवश्यक सुरक्षा मार्गदर्शन");
    assert.equal(t("Clinician-Approved Crisis Protocol"), "चिकित्सक-अनुमोदित संकट प्रोटोकॉल");
    assert.ok(t("Call AASRA Suicide Helpline: 9820466726").includes("AASRA"));
    assert.ok(t("Call Tele-MANAS (Govt of India, 24/7 Toll-Free): 14416 / 1800-891-4416").includes("Tele-MANAS"));
    localStorage.setItem("mindheal-language", "English");
  });

  // Test 6: Fallback behavior for unknown keys safely defaults to original text
  await tSuite.test("Missing key safely falls back without throws", () => {
    localStorage.setItem("mindheal-language", "Hindi");
    const unknown = "Unique Unset String Key 12345";
    assert.equal(t(unknown), unknown, "Fallback returns input string");
    localStorage.setItem("mindheal-language", "English");
  });
});
