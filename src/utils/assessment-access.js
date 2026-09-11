/**
 * Central Assessment Access Resolver & Age Calculation Utility (SSoT)
 *
 * Implements three strictly independent assessment gates:
 * 1. Gate 1: Authentication Gate (guest visitors can browse catalogue / metadata,
 *    must sign in to take questionnaire).
 * 2. Gate 2: Age Eligibility Gate (computes chronological age from profile dateOfBirth
 *    accounting for exact day/month boundaries; checks against tool's verified age range).
 * 3. Gate 3: Clinical / Release / Rights Status Gate (discrete status values:
 *    available, clinical_review, clinician_only, rights_restricted, implementation_incomplete, not_found).
 */

import { ASSESSMENT_REGISTRY } from "../data/assessment-registry.js";

/**
 * Calculates accurate chronological age from a YYYY-MM-DD date string
 * against a reference date (defaulting to current date), accounting for leap years
 * and exact day-of-month boundaries.
 *
 * @param {string|Date} dobString - Date of birth in YYYY-MM-DD or parseable format
 * @param {Date} [referenceDate=new Date()] - Reference date for age calculation
 * @returns {number|null} Age in full years, or null if invalid / future date
 */
export function calculateAge(dobString, referenceDate = new Date()) {
  if (!dobString) return null;

  let year, month, day;
  if (typeof dobString === "string") {
    const str = dobString.trim();
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    year = parseInt(match[1], 10);
    month = parseInt(match[2], 10);
    day = parseInt(match[3], 10);
  } else if (dobString instanceof Date && !isNaN(dobString.getTime())) {
    year = dobString.getUTCFullYear();
    month = dobString.getUTCMonth() + 1;
    day = dobString.getUTCDate();
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const dobUtc = new Date(Date.UTC(year, month - 1, day));
  if (isNaN(dobUtc.getTime())) return null;
  // Ensure date did not overflow (e.g. Feb 30)
  if (dobUtc.getUTCFullYear() !== year || dobUtc.getUTCMonth() !== month - 1 || dobUtc.getUTCDate() !== day) {
    return null;
  }

  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date();
  const refUtc = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));

  if (dobUtc > refUtc) return null; // Future birth date is invalid

  let age = refUtc.getUTCFullYear() - dobUtc.getUTCFullYear();
  const monthDiff = refUtc.getUTCMonth() - dobUtc.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && refUtc.getUTCDate() < dobUtc.getUTCDate())) {
    age--;
  }

  if (age < 0) return null;
  return age;
}

/**
 * Evaluates access to an assessment for a given user and profile context.
 *
 * Evaluation Order:
 * 1. Existence Check: Does the assessment exist in the registry?
 *    -> If not: return { status: 'not_found', reason: 'Assessment Not Found' }
 * 2. Gate 1 - Authentication: Is the user logged in?
 *    -> If not: return { status: 'login_required', returnUrl, reason: 'Sign in to access this assessment' }
 * 3. Gate 2 - Profile & Age Eligibility:
 *    -> If profile.dateOfBirth is missing/invalid: return { status: 'profile_incomplete', reason: 'Complete your profile' }
 *    -> If age is outside [minimumAge, maximumAge]: return { status: 'age_restricted', age, minimumAge, maximumAge, reason: "This assessment isn't available for your age group." }
 * 4. Gate 3 - Release / Clinical / Rights Status:
 *    -> If status !== 'available': return { status: assessment.status, reason: ... }
 * 5. All gates passed: return { status: 'available', isAllowed: true }
 *
 * @param {Object} params
 * @param {Object|string} params.assessment - Assessment definition object or instrument ID
 * @param {Object|null} [params.authUser] - Currently logged-in user object or null
 * @param {Object|null} [params.profile] - User profile containing dateOfBirth
 * @param {Date} [params.referenceDate] - Optional reference date for age calculation
 * @returns {Object} Access result object
 */
export function getAssessmentAccess({ assessment, authUser, profile, referenceDate = new Date() } = {}) {
  // Resolve assessment definition
  let def = assessment;
  if (typeof assessment === "string") {
    def = ASSESSMENT_REGISTRY[assessment.toLowerCase()];
  }

  // 1. Existence Check
  if (!def || typeof def !== "object") {
    return {
      status: "not_found",
      isAllowed: false,
      reason: "Assessment Not Found",
      message: "The requested clinical assessment does not exist or has been removed."
    };
  }

  const instrumentId = def.id || def.shortName?.toLowerCase();
  const minimumAge = typeof def.minimumAge === "number" ? def.minimumAge : 18;
  const maximumAge = typeof def.maximumAge === "number" ? def.maximumAge : null;
  const requiresAuth = def.requiresAuth !== false;

  // 2. Gate 1: Authentication Gate (guest visitors see preview metadata and sign-in prompt for auth-required assessments)
  const isAuthenticated = Boolean(authUser && (authUser.id || authUser._id || authUser.token));
  if (!isAuthenticated) {
    if (!requiresAuth) {
      // Public validated screener: guest access allowed without login or signup
      return {
        status: "available",
        isAllowed: true,
        isGuest: true,
        instrumentId,
        minimumAge,
        maximumAge
      };
    }

    const returnHash = `#assessment/${encodeURIComponent(instrumentId)}`;
    return {
      status: "login_required",
      isAllowed: false,
      instrumentId,
      returnUrl: `#auth/user-login?returnUrl=${encodeURIComponent(returnHash)}`,
      reason: "Sign in to access this assessment",
      message: "Please sign in or create an account to access and complete this clinical assessment."
    };
  }

  // 3. Gate 3: Clinical / Release / Rights Status Gate
  const status = def.status || "available";
  if (status !== "available") {
    switch (status) {
      case "rights_restricted":
        return {
          status: "rights_restricted",
          isAllowed: false,
          instrumentId,
          reason: "Rights & Licensing Review",
          message: def.copyrightNotice || "This instrument is currently gated pending commercial licensing and rights verification. Self-administration is not yet enabled."
        };
      case "clinician_only":
        return {
          status: "clinician_only",
          isAllowed: false,
          instrumentId,
          reason: "Clinician-Administered Only",
          message: "This assessment must be administered directly by a qualified clinical psychologist during a consultation."
        };
      case "implementation_incomplete":
        return {
          status: "implementation_incomplete",
          isAllowed: false,
          instrumentId,
          reason: "Coming Soon",
          message: "This questionnaire is currently being digitized and validated for our platform."
        };
      case "clinical_review":
      case "in_review":
      default:
        return {
          status: "clinical_review",
          isAllowed: false,
          instrumentId,
          reason: "In Clinical Review",
          message: "This clinical inventory is currently under clinical review and rights verification. It is not yet available for self-administration."
        };
    }
  }

  // 3. Gate 2: Age Eligibility Gate
  const dob = profile?.dateOfBirth || authUser?.dateOfBirth;
  if (!dob) {
    if (!requiresAuth) {
      // Public screener: allowed without mandatory DOB profile completion
      return {
        status: "available",
        isAllowed: true,
        isGuest: !isAuthenticated,
        instrumentId,
        minimumAge,
        maximumAge
      };
    }

    return {
      status: "profile_incomplete",
      isAllowed: false,
      instrumentId,
      reason: "Complete your profile",
      message: "Please complete your profile with your date of birth to verify assessment eligibility.",
      actionUrl: "#account"
    };
  }

  const age = calculateAge(dob, referenceDate);
  if (age === null) {
    if (!requiresAuth) {
      return {
        status: "available",
        isAllowed: true,
        isGuest: !isAuthenticated,
        instrumentId,
        minimumAge,
        maximumAge
      };
    }
    return {
      status: "profile_incomplete",
      isAllowed: false,
      instrumentId,
      reason: "Invalid date of birth",
      message: "Your profile contains an invalid date of birth. Please update your profile.",
      actionUrl: "#account"
    };
  }

  if (age < minimumAge || (maximumAge !== null && age > maximumAge)) {
    return {
      status: "age_restricted",
      isAllowed: false,
      instrumentId,
      calculatedAge: age,
      minimumAge,
      maximumAge,
      reason: "This assessment isn't available for your age group.",
      message: maximumAge !== null
        ? `This assessment is validated for individuals aged ${minimumAge} to ${maximumAge}. Your verified age is ${age}.`
        : `This assessment is validated for individuals aged ${minimumAge} and older. Your verified age is ${age}.`
    };
  }

  // 5. All gates passed
  return {
    status: "available",
    isAllowed: true,
    instrumentId,
    minimumAge,
    maximumAge,
    calculatedAge: age
  };
}
