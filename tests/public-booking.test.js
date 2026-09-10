import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.localStorage = new MockStorage();
globalThis.sessionStorage = new MockStorage();
globalThis.window = {
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
  location: { origin: "http://localhost:3000", hash: "" }
};

const { api } = await import("../src/services/mock-api.js");

test("MH-15: Connect public booking button and preserve counsellor through booking lifecycle", async (t) => {
  const mainJsPath = path.resolve("src/main.js");
  const mainJsContent = fs.readFileSync(mainJsPath, "utf-8");
  const mockApiJsPath = path.resolve("src/services/mock-api.js");
  const mockApiJsContent = fs.readFileSync(mockApiJsPath, "utf-8");

  t.beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
    globalThis.window.location.hash = "";
  });

  await t.test("1. No arbitrary fallback provider ID (such as cns_priya) exists in frontend code", () => {
    assert.strictEqual(
      mainJsContent.includes('"cns_priya"'),
      false,
      "src/main.js must not contain arbitrary fallback provider ID 'cns_priya'"
    );
    assert.strictEqual(
      mockApiJsContent.includes('"cns_priya"'),
      false,
      "src/services/mock-api.js must not contain arbitrary fallback provider ID 'cns_priya'"
    );
  });

  await t.test("2. api.bookSession rejects when counsellorId is missing and preserves exact counsellorId in remote payload", async () => {
    await assert.rejects(
      async () => {
        await api.bookSession({
          sessionDate: "2026-06-05",
          sessionTime: "16:00",
          sessionType: "video",
          amount: 1200
        });
      },
      /Please select a counsellor to book a session/i,
      "api.bookSession must reject requests without a counsellorId"
    );
  });

  await t.test("3. api.getCounsellorSlots method exists and targets /counsellors/:id/slots", async () => {
    assert.strictEqual(
      typeof api.getCounsellorSlots,
      "function",
      "api.getCounsellorSlots must be defined"
    );
    assert.match(
      mockApiJsContent,
      /getCounsellorSlots\s*\(\s*counsellorId\s*\)\s*\{[\s\S]*?request\(`\/counsellors\/\$\{encodeURIComponent\(counsellorId\)\}\/slots`\)/,
      "api.getCounsellorSlots must make a request to /counsellors/:id/slots"
    );
  });

  await t.test("4. Counsellor card renders dynamic data-counsellor-id without hardcoded fallback", () => {
    assert.match(
      mainJsContent,
      /const bookingCounsellorId = counsellor\.id \|\| counsellor\._id \|\| "";/,
      "counsellorCard must extract counsellor ID dynamically without hardcoding"
    );
    assert.match(
      mainJsContent,
      /data-action="open-booking-modal"\s+data-counsellor-id="\$\{escapeHtml\(bookingCounsellorId\)\}"/,
      "counsellorCard must render button with data-action='open-booking-modal' and dynamic counsellor ID"
    );
  });

  await t.test("5. Click handler for open-booking-modal preserves counsellor and redirects unauthenticated users", () => {
    assert.match(
      mainJsContent,
      /document\.querySelectorAll\("\[data-action='open-booking-modal'\]"\)/,
      "main.js must attach click handler to [data-action='open-booking-modal']"
    );
    assert.match(
      mainJsContent,
      /state\.pendingBooking\s*=\s*bookingTarget;[\s\S]*?sessionStorage\.setItem\("pending_booking",\s*JSON\.stringify\(bookingTarget\)\);[\s\S]*?window\.location\.hash\s*=\s*"#\/auth\/user-login";/,
      "Unauthenticated user clicking Request Session must save pending booking and redirect to user login"
    );
  });

  await t.test("6. Authentication flows restore pending booking and open modal for the exact chosen counsellor", () => {
    // Check password login restoration
    assert.match(
      mainJsContent,
      /if \(pending && role === "user"\) \{\s*state\.pendingBooking = null;\s*try \{\s*sessionStorage\.removeItem\("pending_booking"\);\s*\} catch \(e\) \{\}\s*toast\(`Continuing booking with \$\{pending\.name\}\.\.\.`\);\s*navigate\("\/panel\/user\?section=counsellors"\);\s*await openBookingForCounsellor\(pending\);\s*return;\s*\}/,
      "Password login must restore pending booking and call openBookingForCounsellor without switching provider"
    );

    // Check OTP verification restoration
    assert.match(
      mainJsContent,
      /if \(pending && state\.otpRole === "user"\) \{\s*state\.pendingBooking = null;\s*try \{\s*sessionStorage\.removeItem\("pending_booking"\);\s*\} catch \(e\) \{\}\s*toast\(`Continuing booking with \$\{pending\.name\}\.\.\.`\);\s*navigate\("\/panel\/user\?section=counsellors"\);\s*await openBookingForCounsellor\(pending\);\s*return;\s*\}/,
      "OTP verification must restore pending booking and call openBookingForCounsellor without switching provider"
    );

    // Check Google Auth restoration
    assert.match(
      mainJsContent,
      /if \(pending && role === "user"\) \{\s*state\.pendingBooking = null;\s*try \{\s*sessionStorage\.removeItem\("pending_booking"\);\s*\} catch \(e\) \{\}\s*toast\(`Continuing booking with \$\{pending\.name\}\.\.\.`\);\s*navigate\("\/panel\/user\?section=counsellors"\);\s*await openBookingForCounsellor\(pending\);\s*return;\s*\}/,
      "Google OAuth must restore pending booking and call openBookingForCounsellor without switching provider"
    );
  });

  await t.test("7. openBookingForCounsellor fetches slots and sets modal state", () => {
    assert.match(
      mainJsContent,
      /async function openBookingForCounsellor\(target\) \{\s*if \(!target \|\| !target\.id\) return;\s*let slots = \[\];\s*try \{\s*slots = await api\.getCounsellorSlots\(target\.id\);\s*\} catch \(e\) \{/,
      "openBookingForCounsellor must load slots for the specific target.id"
    );
    assert.match(
      mainJsContent,
      /state\.bookingModalTarget = target;\s*state\.bookingModalSlots = Array\.isArray\(slots\) \? slots\.filter\(s => !s\.isBooked\) : \[\];\s*state\.bookingModalOpen = true;/,
      "openBookingForCounsellor must populate modal target and unbooked slots"
    );
  });

  await t.test("8. renderBookingModal renders target counsellor and dynamic availability slot selector", () => {
    assert.match(
      mainJsContent,
      /function renderBookingModal\(\) \{[\s\S]*?<form data-form="booking"[\s\S]*?<input type="hidden" name="counsellorId" value="\$\{escapeHtml\(target\.id\)\}" \/>/,
      "renderBookingModal must bind counsellorId to target.id"
    );
    assert.match(
      mainJsContent,
      /id="booking-slot-select"/,
      "renderBookingModal must include slot select dropdown"
    );
    assert.match(
      mainJsContent,
      /data-action="close-booking-modal"/,
      "renderBookingModal must provide close button"
    );
  });

  await t.test("9. Booking submit handler validates counsellorId, syncs slot details, and calls api.bookSession", () => {
    assert.match(
      mainJsContent,
      /document\.querySelectorAll\("\[data-form='booking'\]"\)\.forEach\(\(form\) => \{[\s\S]*?if \(!payload\.counsellorId\) \{\s*throw new Error\("Please select a counsellor to book a session\."\);[\s\S]*?await api\.bookSession\(payload\);/,
      "Booking submission handler must validate counsellorId and call api.bookSession"
    );
  });
});
