import test from "node:test";
import assert from "node:assert";
import { createMoodLogPayload, parseMoodNote, renderMoodStudio } from "../src/features/mood-studio.js";

test("mood studio", async (t) => {
  await t.test("renders the 1-10 slider and local Magnific artwork", () => {
    const markup = renderMoodStudio({
      dashboard: { moodScore: 8 },
      data: { moodHistory: [] }
    });

    assert.match(markup, /data-form="mood"/);
    assert.match(markup, /type="range" min="1" max="10" step="1" value="8"/);
    assert.match(markup, /data-role="mood-slider"/);
    assert.match(markup, /8\/10/);
    assert.match(markup, /assets\/images\/magnific-mood-studio\.png/);
    assert.match(markup, /class="mood-chip active" type="button" data-action="set-mood-score" data-score="7"/);
  });

  await t.test("parses saved factor tags without exposing metadata in the clean note", () => {
    assert.deepStrictEqual(
      parseMoodNote("[Factors: Energy, Sleep] Took a walk after lunch"),
      {
        factors: ["Energy", "Sleep"],
        cleanNote: "Took a walk after lunch"
      }
    );

    assert.deepStrictEqual(
      parseMoodNote("Plain note"),
      {
        factors: [],
        cleanNote: "Plain note"
      }
    );
  });

  await t.test("creates API payloads with selected factors and strips checkbox fields", () => {
    const payload = createMoodLogPayload({
      score: "9",
      note: "Finished a difficult task",
      factor_energy: "on",
      factor_sleep: "on",
      factor_people: "",
      factor_space: undefined
    });

    assert.deepStrictEqual(payload, {
      score: "9",
      note: "[Factors: Energy, Sleep] Finished a difficult task"
    });
  });
});
