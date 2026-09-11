/**
 * MindHeal Clinical Assessment Flow Module
 * Implements Prompt 4: Complete Questionnaire Navigation, Review/Edit, and Submission.
 * 
 * Features:
 * - Pre-test explanation (purpose, recall period, privacy notice).
 * - Stable item IDs storage (answers stored by item.id).
 * - Back and Next navigation with zero answer loss.
 * - Visible progress indicator ("Question X of Y" + percentage bar).
 * - Explicit Answer Review screen before final submission.
 * - In-place Answer Editing (modifying any item immediately recalculates score).
 * - Rapid tap debouncing (locks during navigation to prevent skipping questions or double counting).
 * - Duplicate submission prevention (isSubmitting lock + idempotent submission).
 * - Graceful exit without forced disclosure.
 * - Strict in-memory draft lifecycle.
 */

import { ASSESSMENT_REGISTRY, scoreAssessment } from "../data/assessment-registry.js";
import { t } from "../utils/i18n.js";
import { html, escapeHtml } from "../utils/dom.js";

export function createAssessmentState(instrumentId = "phq9", testIndex = 0) {
  const def = ASSESSMENT_REGISTRY[instrumentId] || ASSESSMENT_REGISTRY.phq9;
  return {
    instrumentId: def.id,
    testIndex,
    step: "intro", // "intro" | "questionnaire" | "review" | "context" | "result"
    currentQuestionIndex: 0,
    answers: {}, // map of item.id -> number score (0-3)
    answersArray: [], // array of numbers matching test questions length for backward-compatibility
    functionalImpact: null, // unscored functional impact answer: null | number (0-3)
    intakeContext: {
      onsetDuration: "",
      dailyDifficulties: [],
      healthChanges: "",
      previousSupport: "",
      personalGoals: ""
    },
    isSubmitting: false,
    submissionResult: null,
    navigationLocked: false,
    lastInteractionTime: 0,
    isGuest: true,
    serverScreeningId: null,
    shareToken: null
  };
}

export class AssessmentController {
  constructor(state = null) {
    this.state = state || createAssessmentState("phq9", 0);
    this._listeners = [];
  }

  onChange(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    // Sync answersArray for backward compatibility with external test suites
    const def = this.getDefinition();
    this.state.answersArray = def.items.map(it => (this.state.answers[it.id] !== undefined ? this.state.answers[it.id] : 0));

    for (const cb of this._listeners) {
      try {
        cb(this.state);
      } catch (err) {
        console.error("AssessmentController listener error:", err);
      }
    }
  }

  getDefinition() {
    return ASSESSMENT_REGISTRY[this.state.instrumentId] || ASSESSMENT_REGISTRY.phq9;
  }

  setInstrument(instrumentId, testIndex = 0) {
    const def = ASSESSMENT_REGISTRY[instrumentId] || ASSESSMENT_REGISTRY.phq9;
    this.state.instrumentId = def.id;
    this.state.testIndex = testIndex;
    this.state.step = "intro";
    this.state.currentQuestionIndex = 0;
    this.state.answers = {};
    this.state.answersArray = [];
    this.state.isSubmitting = false;
    this.state.submissionResult = null;
    this.state.navigationLocked = false;
    this.notify();
  }

  startTest() {
    this.state.step = "questionnaire";
    this.state.currentQuestionIndex = 0;
    this.notify();
  }

  exitTest() {
    this.state.step = "intro";
    this.state.currentQuestionIndex = 0;
    this.state.answers = {};
    this.state.answersArray = [];
    this.state.submissionResult = null;
    this.state.isSubmitting = false;
    this.notify();
  }

  selectOption(score, bypassDebounce = false) {
    const now = Date.now();
    if (!bypassDebounce && (this.state.navigationLocked || (now - this.state.lastInteractionTime < 200))) {
      return false; // Debounce rapid taps
    }
    this.state.lastInteractionTime = now;
    this.state.navigationLocked = true;

    const def = this.getDefinition();
    const currentItem = def.items[this.state.currentQuestionIndex];
    if (!currentItem) {
      this.state.navigationLocked = false;
      return false;
    }

    // Save/replace answer by stable item ID
    this.state.answers[currentItem.id] = Number(score);

    // If more questions exist, proceed to next question
    if (this.state.currentQuestionIndex < def.items.length - 1) {
      this.state.currentQuestionIndex++;
      this.state.navigationLocked = false;
      this.notify();
      return true;
    }

    // Finished last question -> navigate to review screen
    this.state.step = "review";
    this.state.navigationLocked = false;
    this.notify();
    return true;
  }

  goBack() {
    if (this.state.navigationLocked) return false;
    if (this.state.step === "review") {
      const def = this.getDefinition();
      this.state.step = "questionnaire";
      this.state.currentQuestionIndex = def.items.length - 1;
      this.notify();
      return true;
    }
    if (this.state.step === "questionnaire" && this.state.currentQuestionIndex > 0) {
      this.state.currentQuestionIndex--;
      this.notify();
      return true;
    }
    if (this.state.step === "questionnaire" && this.state.currentQuestionIndex === 0) {
      this.state.step = "intro";
      this.notify();
      return true;
    }
    return false;
  }

  goNext() {
    if (this.state.navigationLocked) return false;
    const def = this.getDefinition();
    const currentItem = def.items[this.state.currentQuestionIndex];
    
    // Cannot proceed if current question is unanswered
    if (this.state.answers[currentItem.id] === undefined) {
      return false;
    }

    if (this.state.currentQuestionIndex < def.items.length - 1) {
      this.state.currentQuestionIndex++;
      this.notify();
      return true;
    } else {
      this.state.step = "review";
      this.notify();
      return true;
    }
  }

  jumpToQuestion(index) {
    const def = this.getDefinition();
    if (index >= 0 && index < def.items.length) {
      this.state.step = "questionnaire";
      this.state.currentQuestionIndex = index;
      this.notify();
      return true;
    }
    return false;
  }

  editAnswer(itemId, newScore) {
    const def = this.getDefinition();
    const item = def.items.find(it => it.id === itemId);
    if (!item) return false;
    if (!item.allowedValues.includes(Number(newScore))) return false;

    this.state.answers[itemId] = Number(newScore);
    this.notify();
    return true;
  }

  setFunctionalImpact(value) {
    if (value === null || value === undefined || value === "") {
      this.state.functionalImpact = null;
    } else {
      const num = Number(value);
      if (Number.isInteger(num) && num >= 0 && num <= 3) {
        this.state.functionalImpact = num;
      }
    }
    this.notify();
    return true;
  }

  updateIntakeContext(field, value) {
    if (!this.state.intakeContext) {
      this.state.intakeContext = {};
    }
    if (field === "dailyDifficulties") {
      this.state.intakeContext.dailyDifficulties = Array.isArray(value) ? value.slice(0, 10) : [];
    } else if (typeof value === "string") {
      // Limit to 500 characters
      this.state.intakeContext[field] = value.slice(0, 500);
    } else {
      this.state.intakeContext[field] = value;
    }
    this.notify();
    return true;
  }

  clearIntakeContext() {
    this.state.intakeContext = {
      onsetDuration: "",
      dailyDifficulties: [],
      healthChanges: "",
      previousSupport: "",
      personalGoals: ""
    };
    this.notify();
  }

  submitAssessment() {
    if (this.state.isSubmitting) {
      return false; // Prevent duplicate submissions
    }
    this.state.isSubmitting = true;
    this.notify();

    const def = this.getDefinition();
    
    // Prepare answers payload with strictly isolated functional impact and context
    const payload = { ...this.state.answers };
    if (this.state.functionalImpact !== null && this.state.functionalImpact !== undefined) {
      payload.functionalImpact = this.state.functionalImpact;
    }
    if (this.state.intakeContext) {
      payload.intakeContext = {
        onsetDuration: this.state.intakeContext.onsetDuration || "",
        dailyDifficulties: Array.isArray(this.state.intakeContext.dailyDifficulties) ? [...this.state.intakeContext.dailyDifficulties] : [],
        healthChanges: this.state.intakeContext.healthChanges || "",
        previousSupport: this.state.intakeContext.previousSupport || "",
        personalGoals: this.state.intakeContext.personalGoals || ""
      };
    }

    const result = scoreAssessment(def.id, payload);

    if (!result.isValid) {
      this.state.isSubmitting = false;
      this.notify();
      return result;
    }

    this.state.step = "result";
    this.state.submissionResult = result;
    this.state.isSubmitting = false;
    this.notify();
    return result;
  }

  retake() {
    this.state.step = "intro";
    this.state.currentQuestionIndex = 0;
    this.state.answers = {};
    this.state.answersArray = [];
    this.state.functionalImpact = null;
    this.state.intakeContext = {
      onsetDuration: "",
      dailyDifficulties: [],
      healthChanges: "",
      previousSupport: "",
      personalGoals: ""
    };
    this.state.isSubmitting = false;
    this.state.submissionResult = null;
    this.state.serverScreeningId = null;
    this.state.shareToken = null;
    this.state.isGuest = true;
    this.notify();
  }
}

