import test from "node:test";
import assert from "node:assert";
import {
  organiseDreamText,
  buildFaithfulDreamOrganisation,
  DREAM_ORGANISER_SYSTEM_INSTRUCTION
} from "../src/services/ai.service.js";
import { organiseDream } from "../src/controllers/ai.controller.js";

test("Milestone 5 - Dream Organiser System Instruction Guardrails", (t) => {
  assert.ok(DREAM_ORGANISER_SYSTEM_INSTRUCTION.includes("editorial assistant"), "Must define editorial assistant role");
  assert.ok(DREAM_ORGANISER_SYSTEM_INSTRUCTION.includes("Faithfulness to the user's memory is more important than grammatical perfection"), "Must emphasize faithfulness rule");
  assert.ok(DREAM_ORGANISER_SYSTEM_INSTRUCTION.includes("You are NOT interpreting the dream"), "Must forbid dream interpretation");
  assert.ok(DREAM_ORGANISER_SYSTEM_INSTRUCTION.includes("You are NOT diagnosing the user"), "Must forbid diagnosis");
  assert.ok(DREAM_ORGANISER_SYSTEM_INSTRUCTION.includes("preserve that uncertainty"), "Must mandate uncertainty preservation");
  assert.ok(DREAM_ORGANISER_SYSTEM_INSTRUCTION.includes("Keep the user's natural language"), "Must mandate natural language retention");
});

test("Milestone 5 - Adversarial Test 1: Uncertainty between Dog or Wolf", async (t) => {
  const input = "I saw something that might have been a dog or a wolf.";
  const result = await organiseDreamText({ text: input, mockTest: "adversarial_1" });

  // STRICT ADVERSARIAL ASSERTION:
  // FAIL if AI says: "I saw a wolf." or converts uncertainty into a single definite animal
  assert.notEqual(result.narrative.trim(), "I saw a wolf.", "FAIL: AI must NOT resolve uncertainty to 'I saw a wolf.'");
  assert.notEqual(result.narrative.trim(), "I saw a dog.", "FAIL: AI must NOT resolve uncertainty to 'I saw a dog.'");
  
  // Must preserve both or the uncertainty
  const lowerNarrative = result.narrative.toLowerCase();
  assert.ok(
    (lowerNarrative.includes("dog") && lowerNarrative.includes("wolf")) || lowerNarrative.includes("might have been"),
    "Narrative must preserve the 'dog or wolf' disjunction or 'might have been' uncertainty"
  );
  assert.ok(result.uncertainDetails.length > 0, "Must record the uncertainty in uncertainDetails");
});

test("Milestone 5 - Adversarial Test 2: Unremembered Location", async (t) => {
  const input = "I don't remember where I was.";
  const result = await organiseDreamText({ text: input, mockTest: "adversarial_2" });

  // STRICT ADVERSARIAL ASSERTION:
  // FAIL if AI creates a location
  assert.deepStrictEqual(result.places, [], "FAIL: places array must remain empty when input states location was unremembered");
  assert.ok(
    !result.narrative.toLowerCase().includes("in a room") &&
    !result.narrative.toLowerCase().includes("at a house") &&
    !result.narrative.toLowerCase().includes("in a forest"),
    "FAIL: AI must NOT invent a fabricated location"
  );
  assert.ok(result.uncertainDetails.length > 0, "Unremembered location must be noted in uncertainDetails");
});

test("Milestone 5 - Adversarial Test 3: Uncertain Presence of Person (Brother)", async (t) => {
  const input = "Maybe my brother was there.";
  const result = await organiseDreamText({ text: input, mockTest: "adversarial_3" });

  // STRICT ADVERSARIAL ASSERTION:
  // FAIL if AI writes: "My brother was there."
  assert.notEqual(result.narrative.trim(), "My brother was there.", "FAIL: AI must NOT convert 'Maybe my brother was there' into 'My brother was there.'");
  assert.ok(
    result.narrative.toLowerCase().includes("maybe") || result.narrative.toLowerCase().includes("perhaps") || result.people.some(p => p.includes("uncertain")),
    "Must preserve the uncertainty regarding brother's presence"
  );
  assert.ok(result.uncertainDetails.length > 0, "Must flag uncertainty in uncertainDetails");
});

test("Milestone 5 - Adversarial Test 4: Abrupt Transition to School", async (t) => {
  const input = "then... I don't know... suddenly school";
  const result = await organiseDreamText({ text: input, mockTest: "adversarial_4" });

  // STRICT ADVERSARIAL ASSERTION:
  // AI may say: "The next part I remember took place at a school."
  // It must not invent how the transition occurred (e.g. "I walked to school" or "I drove to school")
  const lowerNarrative = result.narrative.toLowerCase();
  assert.ok(
    !lowerNarrative.includes("walked") &&
    !lowerNarrative.includes("drove") &&
    !lowerNarrative.includes("traveled") &&
    !lowerNarrative.includes("teleported") &&
    !lowerNarrative.includes("arrived by bus"),
    "FAIL: AI must not invent a fabricated method of transition"
  );
  assert.ok(result.places.includes("school"), "Places should include school as explicitly mentioned");
});

test("Milestone 5 - Schema Completeness & Empty Field Rules", async (t) => {
  const input = "I woke up feeling calm after seeing bright blue light.";
  const result = await organiseDreamText({ text: input });

  // All 10 schema fields must be present
  const requiredKeys = [
    "narrative",
    "people",
    "places",
    "symbolsOrObjects",
    "emotions",
    "sensoryDetails",
    "memorableMoments",
    "endingOrWakingFeeling",
    "uncertainDetails",
    "warnings"
  ];

  for (const key of requiredKeys) {
    assert.ok(key in result, `Schema missing key: ${key}`);
  }

  assert.strictEqual(typeof result.narrative, "string");
  assert.ok(Array.isArray(result.people));
  assert.ok(Array.isArray(result.places));
  assert.ok(Array.isArray(result.symbolsOrObjects));
  assert.ok(Array.isArray(result.emotions));
  assert.ok(Array.isArray(result.sensoryDetails));
  assert.ok(Array.isArray(result.memorableMoments));
  assert.strictEqual(typeof result.endingOrWakingFeeling, "string");
  assert.ok(Array.isArray(result.uncertainDetails));
  assert.ok(Array.isArray(result.warnings));

  // No people mentioned -> must be empty array
  assert.deepStrictEqual(result.people, []);
});

test("Milestone 5 - Language Preservation: Hindi Input", async (t) => {
  const input = "रात के सपने में मैं एक मंदिर के पास था। बहुत शांति महसूस हो रही थी।";
  const result = await organiseDreamText({ text: input });

  // Must retain Hindi in Devanagari script without unwanted English translation
  assert.ok(/[\u0900-\u097F]/.test(result.narrative), "Hindi input must produce Hindi narrative in Devanagari");
  assert.ok(result.places.includes("मंदिर"), "Should extract Hindi place name");
  assert.ok(result.emotions.includes("शांति"), "Should extract Hindi emotion");
});

test("Milestone 5 - Controller Access & Clinical Age Gate", async (t) => {
  // 1. Unauthenticated request -> 401
  const unauthRes = await organiseDream({ body: { text: "Walking on water" }, user: null });
  assert.strictEqual(unauthRes.status, 401);

  // 2. Minor account (< 18) -> 403 Forbidden
  const minorUser = { id: "usr_minor", role: "user", dateOfBirth: "2012-05-15" };
  const minorRes = await organiseDream({ body: { text: "Flying in space" }, user: minorUser });
  assert.strictEqual(minorRes.status, 403);
  assert.ok(minorRes.body.error.message.includes("minor accounts"));

  // 3. Empty text -> 400 Bad Request
  const adultUser = { id: "usr_adult", role: "user", dateOfBirth: "1995-03-20" };
  const emptyRes = await organiseDream({ body: { text: "   " }, user: adultUser });
  assert.strictEqual(emptyRes.status, 400);

  // 4. Authorized adult (>= 18) -> 200 OK
  const validRes = await organiseDream({
    body: { text: "I saw something that might have been a dog or a wolf.", sourceType: "type" },
    user: adultUser
  });
  assert.strictEqual(validRes.status, 200);
  assert.ok(validRes.body.data.narrative);
  assert.ok(validRes.body.data.symbolsOrObjects);
});
