import test from "node:test";
import assert from "node:assert";
import { calculateAge, getAssessmentAccess } from "../src/utils/assessment-access.js";
import { calculateAge as backendCalculateAge } from "../backend/src/services/questionnaire.service.js";
import { ASSESSMENT_REGISTRY } from "../src/data/assessment-registry.js";

test("Assessment Access Resolver & Age Gate Test Suite", async (t) => {

  await t.test("1. calculateAge edge cases and boundary correctness", () => {
    // Normal adult birthday
    const refDate = new Date("2026-09-11T00:00:00.000Z");
    assert.strictEqual(calculateAge("1990-05-15", refDate), 36);

    // Exact birthday today (born on 2008-09-11, exactly 18 today)
    assert.strictEqual(calculateAge("2008-09-11", refDate), 18);

    // Birthday tomorrow (born on 2008-09-12, turns 18 tomorrow, currently 17)
    assert.strictEqual(calculateAge("2008-09-12", refDate), 17);

    // Birthday yesterday (born on 2008-09-10, turned 18 yesterday)
    assert.strictEqual(calculateAge("2008-09-10", refDate), 18);

    // Leap year birthday: Feb 29, 2000 on Feb 28, 2018 (should be 17 until March 1)
    const refLeapNonLeapYear = new Date("2018-02-28T00:00:00.000Z");
    assert.strictEqual(calculateAge("2000-02-29", refLeapNonLeapYear), 17);

    const refLeapMarch1 = new Date("2018-03-01T00:00:00.000Z");
    assert.strictEqual(calculateAge("2000-02-29", refLeapMarch1), 18);

    // Future date returns null
    assert.strictEqual(calculateAge("2030-01-01", refDate), null);

    // Invalid dates
    assert.strictEqual(calculateAge("", refDate), null);
    assert.strictEqual(calculateAge(null, refDate), null);
    assert.strictEqual(calculateAge("invalid-date", refDate), null);
    assert.strictEqual(calculateAge("2020-02-31", refDate), null); // non-existent day

    // Parity with backend calculateAge
    assert.strictEqual(backendCalculateAge("2008-09-11", refDate), 18);
    assert.strictEqual(backendCalculateAge("2008-09-12", refDate), 17);
  });

  await t.test("2. Gate 1: Authentication Gate (PHQ-9 and GAD-7 public guest screener vs auth-required inventories)", () => {
    // Unauthenticated guest user accessing PHQ-9 (no login or signup required)
    const phq9GuestAccess = getAssessmentAccess({
      assessment: "phq9",
      authUser: null,
      profile: null
    });
    assert.strictEqual(phq9GuestAccess.status, "available");
    assert.strictEqual(phq9GuestAccess.isAllowed, true);
    assert.strictEqual(phq9GuestAccess.isGuest, true);

    // Unauthenticated guest user accessing GAD-7 (no login or signup required)
    const gad7GuestAccess = getAssessmentAccess({
      assessment: "gad7",
      authUser: null,
      profile: null
    });
    assert.strictEqual(gad7GuestAccess.status, "available");
    assert.strictEqual(gad7GuestAccess.isAllowed, true);
    assert.strictEqual(gad7GuestAccess.isGuest, true);

    // Instrument requiring authentication when unauthenticated guest tries to access
    const customGatedDef = {
      id: "clinical_inventory_x",
      canonicalName: "Clinical Inventory X",
      status: "available",
      requiresAuth: true,
      minimumAge: 18
    };
    const gatedAccess = getAssessmentAccess({
      assessment: customGatedDef,
      authUser: null,
      profile: null
    });

    assert.strictEqual(gatedAccess.status, "login_required");
    assert.strictEqual(gatedAccess.isAllowed, false);
    assert.strictEqual(gatedAccess.reason, "Sign in to access this assessment");
    assert.match(gatedAccess.returnUrl, /returnUrl=%23assessment%2Fclinical_inventory_x/);
    assert.doesNotMatch(gatedAccess.reason, /Clinical Review/i);
    assert.doesNotMatch(gatedAccess.reason, /Premium/i);
  });

  await t.test("3. Gate 2: Age Eligibility Gate", () => {
    const authUser = { id: "usr_123", email: "user@example.com" };
    const refDate = new Date("2026-09-11T00:00:00.000Z");

    // Profile missing DOB for an assessment with requiresAuth: true
    const customGatedDef = {
      id: "clinical_inventory_x",
      canonicalName: "Clinical Inventory X",
      status: "available",
      requiresAuth: true,
      minimumAge: 18
    };
    const incompleteAccess = getAssessmentAccess({
      assessment: customGatedDef,
      authUser,
      profile: {},
      referenceDate: refDate
    });
    assert.strictEqual(incompleteAccess.status, "profile_incomplete");
    assert.strictEqual(incompleteAccess.isAllowed, false);
    assert.strictEqual(incompleteAccess.reason, "Complete your profile");
    assert.doesNotMatch(incompleteAccess.reason, /Clinical Review/i);

    // Underage user (17 years old attempting PHQ-9 with minimumAge: 18)
    const underageAccess = getAssessmentAccess({
      assessment: "phq9",
      authUser,
      profile: { dateOfBirth: "2008-09-12" }, // 17 years old
      referenceDate: refDate
    });
    assert.strictEqual(underageAccess.status, "age_restricted");
    assert.strictEqual(underageAccess.isAllowed, false);
    assert.strictEqual(underageAccess.calculatedAge, 17);
    assert.strictEqual(underageAccess.reason, "This assessment isn't available for your age group.");
    assert.doesNotMatch(underageAccess.reason, /Clinical Review/i);

    // Eligible adult user (18 years old on birthday today)
    const eligibleAccess = getAssessmentAccess({
      assessment: "phq9",
      authUser,
      profile: { dateOfBirth: "2008-09-11" }, // exactly 18 years old
      referenceDate: refDate
    });
    assert.strictEqual(eligibleAccess.status, "available");
    assert.strictEqual(eligibleAccess.isAllowed, true);
  });

  await t.test("4. Gate 3: Clinical / Rights / Implementation / Not-Found Status Gates", () => {
    const authUser = { id: "usr_123", email: "user@example.com" };
    const adultProfile = { dateOfBirth: "1995-01-01" }; // 31 years old

    // Non-existent assessment ID
    const notFoundAccess = getAssessmentAccess({
      assessment: "non_existent_tool_xyz",
      authUser,
      profile: adultProfile
    });
    assert.strictEqual(notFoundAccess.status, "not_found");
    assert.strictEqual(notFoundAccess.isAllowed, false);
    assert.strictEqual(notFoundAccess.reason, "Assessment Not Found");

    // Rights restricted assessment (custom / mock definition)
    const rightsAccess = getAssessmentAccess({
      assessment: { id: "test_rights", status: "rights_restricted", copyrightNotice: "Rights restricted." },
      authUser,
      profile: adultProfile
    });
    assert.strictEqual(rightsAccess.status, "rights_restricted");
    assert.strictEqual(rightsAccess.isAllowed, false);
    assert.strictEqual(rightsAccess.reason, "Rights & Licensing Review");

    // Clinical review assessment (custom / mock definition)
    const reviewAccess = getAssessmentAccess({
      assessment: { id: "test_review", status: "clinical_review" },
      authUser,
      profile: adultProfile
    });
    assert.strictEqual(reviewAccess.status, "clinical_review");
    assert.strictEqual(reviewAccess.isAllowed, false);
    assert.strictEqual(reviewAccess.reason, "In Clinical Review");

    // Implementation incomplete assessment (custom / mock definition)
    const incompleteToolAccess = getAssessmentAccess({
      assessment: { id: "test_incomplete", status: "implementation_incomplete" },
      authUser,
      profile: adultProfile
    });
    assert.strictEqual(incompleteToolAccess.status, "implementation_incomplete");
    assert.strictEqual(incompleteToolAccess.isAllowed, false);
    assert.strictEqual(incompleteToolAccess.reason, "Coming Soon");

    // Released assessment with requiresAuth: true (e.g. WHO-5, ASRS, ECR) is available for authenticated adult
    const who5Access = getAssessmentAccess({
      assessment: "who5",
      authUser,
      profile: adultProfile
    });
    assert.strictEqual(who5Access.status, "available");
    assert.strictEqual(who5Access.isAllowed, true);
  });
});
