import { escapeHtml, html } from "../utils/dom.js";
import { api } from "../services/mock-api.js";

/**
 * Multimodal Dream Capture Feature Module
 *
 * Provides three seamless dream input modes:
 *  1. Type (with optional AI-organisation review)
 *  2. Speak (idle, recording, paused, transcribing, organising, error)
 *  3. Scan Notes (camera capture / image upload, preview, extraction states)
 *
 * Plus a unified Shared Review Dream component with Original vs Organised tabs,
 * uncertainty markers (e.g. [temple?]), draft editing, and explicit user approval.
 */

export function createDefaultDreamCaptureState() {
  return {
    inputMode: "type", // "type" | "voice" | "image"
    processingStage: "idle", // "idle" | "recording" | "paused" | "transcribing" | "extracting" | "organising" | "review" | "error"
    sourceType: "type", // "type" | "voice" | "image"

    // ARCHITECTURE CONTRACT: DreamCapture Entity
    // Rule: rawText is NEVER overwritten once captured.
    rawText: "", // Exact verbatim transcription, OCR handwriting, or initial typed text
    organisedText: "", // AI cleaned / structured version from editorial assistant
    approvedText: "", // Final user-reviewed and approved version frozen at submission
    wasAiOrganised: false, // Tracks if draft passed through AI Organiser
    wasUserEdited: false, // Tracks manual edits made by the user

    // Synchronized properties for editing and backwards-compatibility
    rawInput: "", // Synced with rawText
    structuredDraft: "", // Synced with organisedText
    editedDraft: "", // Actively edited draft in review
    approvedDraft: "", // Synced with approvedText

    reviewView: "organised", // "organised" | "original"
    organisedData: null, // Structured schema object { narrative, people, places, emotions, symbolsOrObjects, uncertainDetails, ... }
    revisionHistory: [], // Undo/redo stack: [{ narrative, organisedData, timestamp }]
    isApproved: false, // User explicitly clicked "Approve & Analyse Dream"
    isSubmitting: false, // Double-submission guard
    approvedAt: null, // ISO timestamp of approval
    voiceElapsedSeconds: 0,
    audioBlob: null, // Preserved recorded audio Blob for retry resilience
    audioMimeType: "audio/webm",
    selectedImage: null, // { file, previewUrl, name, size }
    errorMessage: "",
    uncertaintyMarkers: [] // e.g. ["[temple?]", "[blue light?]"]
  };
}

/**
 * Safely sets rawText ONCE during initial capture.
 * CRITICAL RULE: rawText must NEVER be overwritten once captured.
 */
function setInitialRawText(captureState, text) {
  if (!captureState) return;
  if (!captureState.rawText) {
    captureState.rawText = text;
    captureState.rawInput = text;
  }
}

let voiceTimerInterval = null;
let activeMediaStream = null;
let activeMediaRecorder = null;
let activeAudioChunks = [];

export function resetDreamCaptureTimer() {
  if (voiceTimerInterval) {
    clearInterval(voiceTimerInterval);
    voiceTimerInterval = null;
  }
}

export function stopActiveMediaStream() {
  if (activeMediaStream) {
    try {
      activeMediaStream.getTracks().forEach((track) => track.stop());
    } catch {
      // Ignore track stop errors
    }
    activeMediaStream = null;
  }
  if (activeMediaRecorder && activeMediaRecorder.state !== "inactive") {
    try {
      activeMediaRecorder.stop();
    } catch {
      // Ignore recorder stop errors
    }
  }
  activeMediaRecorder = null;
  activeAudioChunks = [];
}

export function resetDreamCaptureState(state) {
  resetDreamCaptureTimer();
  stopActiveMediaStream();
  if (state.dreamCapture?.selectedImage?.previewUrl) {
    try {
      URL.revokeObjectURL(state.dreamCapture.selectedImage.previewUrl);
    } catch {
      // Ignore URL revocation errors
    }
  }
  state.dreamCapture = createDefaultDreamCaptureState();
}

/**
 * Ensures media stream tracks and timers are closed on tab close/refresh
 */
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    stopActiveMediaStream();
    resetDreamCaptureTimer();
  });
}

export function focusDraftEditor() {
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(() => {
      const el = document.querySelector("#dreamReviewEditedDraft");
      if (el && typeof el.focus === "function") {
        el.focus();
      }
    });
  }
}

export function focusErrorAlert() {
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(() => {
      const el = document.querySelector(".dream-capture-error, .dream-capture-status-panel.error");
      if (el && typeof el.focus === "function") {
        el.focus();
      }
    });
  }
}

export function formatElapsedSeconds(totalSeconds = 0) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Render the full Multimodal Dream Capture component
 */
export function renderDreamCapture(state) {
  if (!state.dreamCapture) {
    state.dreamCapture = createDefaultDreamCaptureState();
  }

  const capture = state.dreamCapture;
  const isReview = capture.processingStage === "review";
  const isBusy = ["transcribing", "extracting", "organising"].includes(capture.processingStage);

  return html`
    <div class="dream-capture-root">
      <!-- Top Title & Subheading -->
      <div class="dream-capture-header">
        <h3 style="font-family: var(--font-serif); font-size: 26px; color: white; margin: 0 0 8px 0; font-weight: 600;">
          Describe Your Subconscious Journey
        </h3>
        <p style="font-size: 14px; color: rgba(255,255,255,0.65); margin: 0 0 24px 0; line-height: 1.5;">
          Tell us everything you remember — even small or incomplete details.
        </p>
      </div>

      <!-- Compact Segmented Mode Switcher -->
      ${!isReview ? html`
        <div class="dream-mode-segmented" role="tablist" aria-label="Dream Input Mode">
          <button
            type="button"
            role="tab"
            class="dream-mode-tab ${capture.inputMode === 'type' ? 'active' : ''}"
            data-action="dream-set-mode"
            data-mode="type"
            aria-selected="${capture.inputMode === 'type' ? 'true' : 'false'}"
            tabindex="${capture.inputMode === 'type' ? '0' : '-1'}"
            ${isBusy ? 'disabled' : ''}
          >
            <i class="ph-bold ph-keyboard" aria-hidden="true"></i>
            <span>Type</span>
          </button>
          
          <button
            type="button"
            role="tab"
            class="dream-mode-tab ${capture.inputMode === 'voice' ? 'active' : ''}"
            data-action="dream-set-mode"
            data-mode="voice"
            aria-selected="${capture.inputMode === 'voice' ? 'true' : 'false'}"
            tabindex="${capture.inputMode === 'voice' ? '0' : '-1'}"
            ${isBusy ? 'disabled' : ''}
          >
            <i class="ph-bold ph-microphone" aria-hidden="true"></i>
            <span>Speak</span>
          </button>

          <button
            type="button"
            role="tab"
            class="dream-mode-tab ${capture.inputMode === 'image' ? 'active' : ''}"
            data-action="dream-set-mode"
            data-mode="image"
            aria-selected="${capture.inputMode === 'image' ? 'true' : 'false'}"
            tabindex="${capture.inputMode === 'image' ? '0' : '-1'}"
            ${isBusy ? 'disabled' : ''}
          >
            <i class="ph-bold ph-camera" aria-hidden="true"></i>
            <span>Scan Notes</span>
          </button>
        </div>
      ` : ""}

      <!-- Error Banner -->
      ${capture.errorMessage ? html`
        <div class="dream-capture-error" role="alert">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="ph-bold ph-warning-circle" style="font-size: 20px;" aria-hidden="true"></i>
            <span>${escapeHtml(capture.errorMessage)}</span>
          </div>
          <button
            type="button"
            class="btn-reset-inline"
            data-action="dream-clear-error"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      ` : ""}

      <!-- Content Area based on Stage and Mode -->
      <div class="dream-capture-body">
        ${isReview
          ? renderReviewDream(capture)
          : isBusy
          ? renderBusyState(capture)
          : capture.processingStage === "error" && capture.inputMode !== "voice"
          ? renderOrganiseErrorState(capture)
          : capture.inputMode === "type"
          ? renderTypeMode(state, capture)
          : capture.inputMode === "voice"
          ? renderVoiceMode(capture)
          : renderScanNotesMode(capture)
        }
      </div>
    </div>
  `;
}

/**
 * 1. TYPE MODE
 */
function renderTypeMode(state, capture) {
  const currentText = capture.rawInput || state.dreamInput || "";

  return html`
    <form data-form="dream-type-form" style="display: flex; flex-direction: column; gap: 20px;">
      <div class="field" style="display: flex; flex-direction: column; gap: 8px;">
        <label for="dreamTypeInput" style="color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 500;">
          What events, symbols, or emotions stood out?
        </label>
        <textarea
          id="dreamTypeInput"
          name="description"
          placeholder="Describe the dream as you remember it. It doesn't need to be organised."
          style="min-height: 180px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 16px; padding: 20px; font-size: 15px; width: 100%; box-sizing: border-box; resize: vertical; outline: none; line-height: 1.6;"
          required
        >${escapeHtml(currentText)}</textarea>
      </div>

      <!-- Action Buttons Row -->
      <div class="dream-type-actions">
        <button
          type="button"
          class="btn secondary dream-secondary-btn hover-lift"
          data-action="dream-organise-typed"
          style="border: 1px solid rgba(255,255,255,0.15); color: white; background: rgba(255,255,255,0.04); height: 50px; padding: 0 20px; border-radius: 12px; font-weight: 500; font-size: 15px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
        >
          <i class="ph ph-sparkle" style="color: var(--color-coral);" aria-hidden="true"></i>
          <span>Organise my notes</span>
        </button>

        <button
          id="dream-analyze-submit-btn"
          class="btn primary submit-btn hover-lift"
          type="submit"
          style="flex: 1; background: var(--color-coral); color: white; border: none; height: 50px; font-size: 16px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 12px; cursor: pointer;"
        >
          <i class="ph ph-sparkle" aria-hidden="true"></i>
          <span>Analyse Subconscious Dream</span>
        </button>
      </div>
    </form>
  `;
}

/**
 * 2. SPEAK MODE (Voice UI States)
 */
function renderVoiceMode(capture) {
  const stage = capture.processingStage;

  if (stage === "recording" || stage === "paused") {
    const isPaused = stage === "paused";
    return html`
      <div class="dream-voice-active-panel">
        <div class="dream-voice-status" aria-live="polite">
          <div class="pulse-indicator ${isPaused ? 'paused' : 'live'}">
            <span class="pulse-dot"></span>
          </div>
          <div class="voice-status-text">
            <span class="status-title">${isPaused ? "Recording Paused" : "Listening..."}</span>
            <span class="status-timer">${formatElapsedSeconds(capture.voiceElapsedSeconds)}</span>
          </div>
        </div>

        <p class="voice-hint">
          ${isPaused
            ? "Take a breath. Click Resume to continue speaking or Finish when done."
            : "Speak naturally about symbols, people, emotions, and what happened in your dream."}
        </p>

        <div class="dream-voice-controls">
          ${isPaused ? html`
            <button
              type="button"
              class="btn secondary voice-btn hover-lift"
              data-action="dream-voice-resume"
              aria-label="Resume recording"
            >
              <i class="ph-bold ph-play" aria-hidden="true"></i>
              <span>Resume</span>
            </button>
          ` : html`
            <button
              type="button"
              class="btn secondary voice-btn hover-lift"
              data-action="dream-voice-pause"
              aria-label="Pause recording"
            >
              <i class="ph-bold ph-pause" aria-hidden="true"></i>
              <span>Pause</span>
            </button>
          `}

          <button
            type="button"
            class="btn primary voice-btn finish hover-lift"
            data-action="dream-voice-finish"
            aria-label="Finish and process recording"
          >
            <i class="ph-bold ph-check" aria-hidden="true"></i>
            <span>Finish Recording</span>
          </button>

          <button
            type="button"
            class="btn text voice-btn discard"
            data-action="dream-voice-discard"
            aria-label="Discard recording"
          >
            <i class="ph ph-trash" aria-hidden="true"></i>
            <span>Discard</span>
          </button>
        </div>
      </div>
    `;
  }

  if (stage === "error") {
    return html`
      <div class="dream-voice-error-panel" style="text-align: center; padding: 28px 20px;">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(224,106,78,0.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; color: var(--color-coral);">
          <i class="ph-bold ph-warning-circle" style="font-size: 28px;" aria-hidden="true"></i>
        </div>
        <h4 style="font-family: var(--font-serif); font-size: 20px; color: white; margin: 0 0 8px 0;">
          Transcription Unsuccessful
        </h4>
        <p style="color: rgba(255,255,255,0.7); font-size: 14px; max-width: 480px; margin: 0 auto 24px auto; line-height: 1.5;">
          ${escapeHtml(capture.errorMessage || "We could not transcribe your recording. Your audio is safely saved so you can retry immediately.")}
        </p>
        <div class="dream-voice-controls" style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          ${capture.audioBlob ? html`
            <button
              type="button"
              class="btn primary hover-lift"
              data-action="dream-voice-retry"
              style="background: var(--color-coral); color: white; border: none; height: 46px; padding: 0 24px; font-size: 15px; font-weight: 600; border-radius: 12px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer;"
            >
              <i class="ph-bold ph-arrow-counter-clockwise" aria-hidden="true"></i>
              <span>Retry Transcription</span>
            </button>
          ` : ""}
          <button
            type="button"
            class="btn secondary hover-lift"
            data-action="dream-voice-discard"
            style="border: 1px solid rgba(255,255,255,0.15); color: white; background: rgba(255,255,255,0.04); height: 46px; padding: 0 20px; border-radius: 12px; font-weight: 500; font-size: 15px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer;"
          >
            <i class="ph ph-microphone" aria-hidden="true"></i>
            <span>Record Again</span>
          </button>
        </div>
      </div>
    `;
  }

  // Idle state
  return html`
    <div class="dream-voice-idle-panel">
      <div class="voice-mic-circle">
        <i class="ph-fill ph-microphone" aria-hidden="true"></i>
      </div>
      <h4 style="font-family: var(--font-serif); font-size: 20px; color: white; margin: 0 0 8px 0;">
        Speak Your Dream Memories
      </h4>
      <p style="color: rgba(255,255,255,0.65); font-size: 14px; max-width: 480px; margin: 0 auto 24px auto; line-height: 1.5;">
        Recount your dream out loud as it comes to mind. We'll transcribe and organise your chronology before you review.
      </p>

      <button
        type="button"
        class="btn primary voice-start-btn hover-lift"
        data-action="dream-voice-start"
        style="background: var(--color-coral); color: white; border: none; height: 50px; padding: 0 32px; font-size: 16px; font-weight: 600; border-radius: 999px; display: inline-flex; align-items: center; gap: 10px; cursor: pointer; box-shadow: 0 8px 24px rgba(224,106,78,0.25);"
      >
        <i class="ph-bold ph-microphone" aria-hidden="true"></i>
        <span>Start Recording</span>
      </button>
    </div>
  `;
}

/**
 * 3. SCAN NOTES MODE (Photos / Scans UI)
 */
function renderScanNotesMode(capture) {
  const selected = capture.selectedImage;

  if (selected) {
    return html`
      <div class="dream-scan-preview-card">
        <div class="preview-media-container">
          <img src="${selected.previewUrl}" alt="Dream note preview" class="preview-thumbnail" />
        </div>
        <div class="preview-details">
          <div class="preview-file-meta">
            <span class="preview-filename">${escapeHtml(selected.name)}</span>
            <span class="preview-filesize">${selected.size ? `${Math.round(selected.size / 1024)} KB` : "Image selected"}</span>
          </div>
          <div class="preview-actions-row">
            <label for="dreamReplaceInput" class="btn secondary preview-btn-replace">
              <i class="ph ph-arrows-clockwise" aria-hidden="true"></i>
              <span>Replace</span>
            </label>
            <button type="button" class="btn text preview-btn-remove" data-action="dream-scan-remove">
              <i class="ph ph-trash" aria-hidden="true"></i>
              <span>Remove</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          class="btn primary hover-lift preview-process-btn"
          data-action="dream-scan-process"
        >
          <i class="ph ph-sparkle" aria-hidden="true"></i>
          <span>Read my notes</span>
        </button>

        <input
          id="dreamReplaceInput"
          type="file"
          accept="image/*"
          style="display: none;"
          data-action="dream-file-change"
        />
      </div>
    `;
  }

  // File Picker / Camera trigger options
  return html`
    <div class="dream-scan-picker-panel">
      <div class="scan-options-grid">
        <!-- Option 1: Mobile Camera / Take Photo -->
        <label for="dreamCameraTrigger" class="scan-option-card hover-lift">
          <div class="scan-icon-bubble">
            <i class="ph-bold ph-camera" aria-hidden="true"></i>
          </div>
          <span class="scan-card-title">Take Photo</span>
          <span class="scan-card-subtitle">Snap handwritten notes with camera</span>
          <input
            id="dreamCameraTrigger"
            type="file"
            accept="image/*"
            capture="environment"
            style="display: none;"
            data-action="dream-file-change"
          />
        </label>

        <!-- Option 2: Upload File -->
        <label for="dreamFileTrigger" class="scan-option-card hover-lift">
          <div class="scan-icon-bubble">
            <i class="ph-bold ph-upload-simple" aria-hidden="true"></i>
          </div>
          <span class="scan-card-title">Upload Image</span>
          <span class="scan-card-subtitle">Select photo, scan, or screenshot</span>
          <input
            id="dreamFileTrigger"
            type="file"
            accept="image/*"
            style="display: none;"
            data-action="dream-file-change"
          />
        </label>
      </div>

      <div class="scan-dragdrop-hint">
        <i class="ph ph-info" aria-hidden="true"></i>
        <span>Supports notebook sketches, diary handwriting, or phone memo screenshots.</span>
      </div>
    </div>
  `;
}

/**
 * 4. BUSY / PROCESSING STATE INDICATOR
 */
function renderBusyState(capture) {
  let message = "Processing your dream...";
  let hint = "Please keep this page open";

  if (capture.processingStage === "transcribing") {
    message = "Transcribing your dream…";
    hint = "Listening carefully to speech nuances and preserving every symbol";
  } else if (capture.processingStage === "extracting") {
    message = "Reading your notes…";
    hint = "Extracting handwriting and scanned text with clinical accuracy";
  } else if (capture.processingStage === "organising") {
    message = "Organising your memories…";
    hint = "Structuring chronology without inventing any dream events";
  }

  return html`
    <div class="dream-capture-busy" role="status" aria-live="polite">
      <div class="ph ph-spinner ph-spin busy-spinner" aria-hidden="true"></div>
      <h4 class="busy-title">${message}</h4>
      <p class="busy-hint">${hint}</p>
    </div>
  `;
}

/**
 * AI Organisation Error State with Non-destructive Retry / Continue
 */
function renderOrganiseErrorState(capture) {
  return html`
    <div class="dream-capture-error-panel" style="text-align: center; padding: 32px 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(224,106,78,0.25); border-radius: 18px;">
      <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(224,106,78,0.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; color: var(--color-coral);">
        <i class="ph-bold ph-warning-circle" style="font-size: 28px;" aria-hidden="true"></i>
      </div>
      <h4 style="font-family: var(--font-serif); font-size: 20px; color: white; margin: 0 0 8px 0;">
        Organisation Unsuccessful
      </h4>
      <p style="color: rgba(255,255,255,0.7); font-size: 14px; max-width: 480px; margin: 0 auto 24px auto; line-height: 1.5;">
        ${escapeHtml(capture.errorMessage || "We could not organise your dream memories right now. Your original words are safely preserved.")}
      </p>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <button
          type="button"
          class="btn primary hover-lift"
          data-action="dream-organise-retry"
          style="background: var(--color-coral); color: white; border: none; height: 46px; padding: 0 24px; font-size: 15px; font-weight: 600; border-radius: 12px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer;"
        >
          <i class="ph-bold ph-arrow-counter-clockwise" aria-hidden="true"></i>
          <span>Retry Organisation</span>
        </button>

        <button
          type="button"
          class="btn secondary hover-lift"
          data-action="dream-continue-original"
          style="border: 1px solid rgba(255,255,255,0.15); color: white; background: rgba(255,255,255,0.04); height: 46px; padding: 0 20px; border-radius: 12px; font-weight: 500; font-size: 15px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer;"
        >
          <i class="ph ph-file-text" aria-hidden="true"></i>
          <span>Continue with Original</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * 5. SHARED REVIEW DREAM COMPONENT
 *
 * Used by Voice, Scan Notes, and AI-organised typed input.
 * Provides two views:
 *   - Original: read-only verbatim source
 *   - Organised: editable textarea with uncertainty marker badges
 */
function renderReviewDream(capture) {
  const isOrganisedView = capture.reviewView === "organised";
  const sourceLabel = capture.sourceType === "voice"
    ? "Voice Recording"
    : capture.sourceType === "image"
    ? "Scanned Notes"
    : "Typed Notes";

  const sourceIcon = capture.sourceType === "voice"
    ? "ph-microphone"
    : capture.sourceType === "image"
    ? "ph-camera"
    : "ph-keyboard";

  // Build preserved details list
  const preservedItems = [];
  if (capture.organisedData) {
    if (Array.isArray(capture.organisedData.places)) {
      for (const p of capture.organisedData.places) {
        if (p && !preservedItems.includes(p)) preservedItems.push(p);
      }
    }
    if (Array.isArray(capture.organisedData.symbolsOrObjects)) {
      for (const s of capture.organisedData.symbolsOrObjects) {
        if (s && !preservedItems.includes(s)) preservedItems.push(s);
      }
    }
    if (Array.isArray(capture.organisedData.emotions)) {
      for (const e of capture.organisedData.emotions) {
        if (e && !preservedItems.includes(e)) preservedItems.push(e);
      }
    }
    if (Array.isArray(capture.organisedData.people)) {
      for (const pe of capture.organisedData.people) {
        if (pe && !preservedItems.includes(pe)) preservedItems.push(pe);
      }
    }
    if (Array.isArray(capture.organisedData.sensoryDetails)) {
      for (const sd of capture.organisedData.sensoryDetails) {
        if (sd && !preservedItems.includes(sd)) preservedItems.push(sd);
      }
    }
  }

  // Build uncertain details list
  const uncertainItems = [];
  if (capture.organisedData && Array.isArray(capture.organisedData.uncertainDetails)) {
    for (const u of capture.organisedData.uncertainDetails) {
      if (u && !uncertainItems.includes(u)) uncertainItems.push(u);
    }
  }
  if (Array.isArray(capture.uncertaintyMarkers)) {
    for (const m of capture.uncertaintyMarkers) {
      const clean = typeof m === "string" ? m.replace(/^\[|\?\]$/g, "").trim() : String(m).trim();
      if (clean && !uncertainItems.some((item) => item.toLowerCase().includes(clean.toLowerCase()))) {
        uncertainItems.push(`Unclear note: "${clean}"`);
      }
    }
  }

  return html`
    <div class="dream-review-card">
      <!-- Review Header -->
      <div class="dream-review-header">
        <div>
          <div class="review-source-pill">
            <i class="ph-fill ${sourceIcon}" aria-hidden="true"></i>
            <span>${sourceLabel}</span>
          </div>
          <h4 style="font-family: var(--font-serif); font-size: 24px; color: white; margin: 8px 0 4px 0;">
            Review Your Dream
          </h4>
          <p style="font-size: 13px; color: rgba(255,255,255,0.6); margin: 0;">
            Review, edit, and approve your dream content before starting clinical analysis.
          </p>
        </div>

        <!-- View Mode Sub-tabs: Original first, Organised second -->
        <div class="review-tabs-group" role="tablist" aria-label="Draft view switcher">
          <button
            type="button"
            role="tab"
            class="review-tab-btn ${!isOrganisedView ? 'active' : ''}"
            data-action="dream-review-set-view"
            data-view="original"
            aria-selected="${!isOrganisedView ? 'true' : 'false'}"
          >
            Original
          </button>
          <button
            type="button"
            role="tab"
            class="review-tab-btn ${isOrganisedView ? 'active' : ''}"
            data-action="dream-review-set-view"
            data-view="organised"
            aria-selected="${isOrganisedView ? 'true' : 'false'}"
          >
            Organised
          </button>
        </div>
      </div>

      <!-- Uncertainty Markers Callout (if present) -->
      ${capture.uncertaintyMarkers && capture.uncertaintyMarkers.length > 0 ? html`
        <div class="dream-uncertainty-banner" role="note">
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <i class="ph-fill ph-info" style="color: #f59e0b; font-size: 18px; margin-top: 2px;" aria-hidden="true"></i>
            <div>
              <span style="font-weight: 600; color: #fde68a;">Unclear Notes Flagged:</span>
              <span style="color: rgba(255,255,255,0.85); font-size: 13px; margin-left: 4px;">
                Words marked like
                ${capture.uncertaintyMarkers.map(m => `<span class="uncertainty-tag">${escapeHtml(m)}</span>`).join(" ")}
                could not be identified with 100% certainty. Feel free to edit or correct them.
              </span>
            </div>
          </div>
        </div>
      ` : ""}

      <!-- Main Editor / Preview Body -->
      <div class="dream-review-body">
        ${isOrganisedView ? html`
          <div class="field" style="display: flex; flex-direction: column; gap: 6px;">
            <div class="dream-editor-wrapper">
              <textarea
                id="dreamReviewEditedDraft"
                name="editedDraft"
                class="dream-review-textarea"
                placeholder="Edit your organised dream here..."
                aria-label="Editable organised dream text"
              >${escapeHtml(capture.editedDraft || capture.structuredDraft || capture.rawInput)}</textarea>
              <div class="dream-editor-caption">editable organised text</div>
            </div>
          </div>

          <!-- Structured Metadata: AI preserved & Uncertain details -->
          ${(preservedItems.length > 0 || uncertainItems.length > 0) ? html`
            <div class="dream-review-metadata-container" role="region" aria-label="Preserved details and uncertainties">
              ${preservedItems.length > 0 ? html`
                <div class="dream-metadata-section">
                  <div class="dream-metadata-header">AI preserved:</div>
                  <ul class="dream-bullet-list preserved-list">
                    ${preservedItems.map(item => html`
                      <li><span class="bullet-dot" aria-hidden="true">•</span> <span>${escapeHtml(item)}</span></li>
                    `).join("")}
                  </ul>
                </div>
              ` : ""}

              ${uncertainItems.length > 0 ? html`
                <div class="dream-metadata-section">
                  <div class="dream-metadata-header uncertain-header">Uncertain details:</div>
                  <ul class="dream-bullet-list uncertain-list">
                    ${uncertainItems.map(item => html`
                      <li><span class="bullet-dot" aria-hidden="true">•</span> <span>${escapeHtml(item)}</span></li>
                    `).join("")}
                  </ul>
                </div>
              ` : ""}
            </div>
          ` : ""}
        ` : html`
          <div class="field" style="display: flex; flex-direction: column; gap: 6px;">
            <label style="color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 500;">
              Original Verbatim Source (Read-only record):
            </label>
            <div class="dream-review-original" tabindex="0" role="region" aria-label="Original source record">
              ${escapeHtml(capture.rawInput || "No original text available.")}
            </div>
            <div class="dream-editor-caption">original verbatim text</div>
          </div>
        `}
      </div>

      <!-- Action Buttons Layout -->
      <div class="dream-review-actions-layout">
        <div class="dream-review-secondary-row">
          <button
            type="button"
            class="btn secondary hover-lift"
            data-action="dream-review-restore-original"
            aria-label="Restore original verbatim text"
            style="border: 1px solid rgba(255,255,255,0.18); color: white; background: rgba(255,255,255,0.04); height: 46px; padding: 0 20px; border-radius: 12px; font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; gap: 8px; cursor: pointer;"
          >
            <i class="ph ph-arrow-counter-clockwise" aria-hidden="true"></i>
            <span>Restore Original</span>
          </button>

          <button
            type="button"
            class="btn secondary hover-lift"
            data-action="dream-review-reorganise"
            aria-label="Re-organise dream memories with AI"
            style="border: 1px solid rgba(255,255,255,0.18); color: white; background: rgba(255,255,255,0.04); height: 46px; padding: 0 20px; border-radius: 12px; font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; gap: 8px; cursor: pointer;"
          >
            <i class="ph ph-arrows-clockwise" aria-hidden="true"></i>
            <span>Re-organise</span>
          </button>
        </div>

        <div class="dream-review-cta-row">
          <button
            type="button"
            class="btn primary hover-lift dream-approve-btn ${capture.isSubmitting ? 'busy' : ''}"
            data-action="dream-review-approve"
            ${capture.isSubmitting ? "disabled" : ""}
            style="background: var(--color-coral); color: white; border: none; height: 50px; width: 100%; max-width: 400px; font-size: 15px; font-weight: 600; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: ${capture.isSubmitting ? 'not-allowed' : 'pointer'}; opacity: ${capture.isSubmitting ? '0.7' : '1'}; box-shadow: 0 8px 24px rgba(224,106,78,0.32);"
          >
            ${capture.isSubmitting ? html`
              <i class="ph ph-spinner ph-spin" aria-hidden="true"></i>
              <span>Analysing Dream…</span>
            ` : html`
              <i class="ph-bold ph-check-circle" aria-hidden="true"></i>
              <span>Approve & Analyse Dream</span>
            `}
          </button>
        </div>

        <div style="display: flex; justify-content: center; margin-top: 8px;">
          <button
            type="button"
            class="dream-start-over-link"
            data-action="dream-review-start-over"
            style="background: transparent; border: none; color: rgba(255,255,255,0.4); font-size: 13px; padding: 4px 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; text-decoration: underline;"
          >
            <i class="ph ph-trash" aria-hidden="true"></i>
            <span>Start over</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Event Handlers Initialization
 */
export function initDreamCaptureHandlers(state, render, onApproveAnalysis) {
  if (!state.dreamCapture) {
    state.dreamCapture = createDefaultDreamCaptureState();
  }

  // 1. Segmented Mode Switcher Tabs
  document.querySelectorAll("[data-action='dream-set-mode']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode && state.dreamCapture.inputMode !== mode) {
        state.dreamCapture.inputMode = mode;
        state.dreamCapture.errorMessage = "";
        render();
      }
    });
  });

  // 2. Clear Error
  document.querySelectorAll("[data-action='dream-clear-error']").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.dreamCapture.errorMessage = "";
      render();
    });
  });

  // 3. Type Mode: Organise typed notes action
  document.querySelectorAll("[data-action='dream-organise-typed']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const textarea = document.querySelector("#dreamTypeInput");
      const text = textarea?.value?.trim() || state.dreamCapture.rawText || state.dreamCapture.rawInput || state.dreamInput || "";
      if (!text) {
        state.dreamCapture.errorMessage = "Please enter some notes about your dream before organising.";
        render();
        return;
      }

      setInitialRawText(state.dreamCapture, text);
      state.dreamCapture.sourceType = "type";
      state.dreamCapture.processingStage = "organising";
      state.dreamCapture.errorMessage = "";
      render();

      try {
        const result = await api.organiseDream(text, { sourceType: "type" });
        state.dreamCapture.organisedText = result.narrative;
        state.dreamCapture.structuredDraft = result.narrative;
        state.dreamCapture.editedDraft = result.narrative;
        state.dreamCapture.wasAiOrganised = true;
        state.dreamCapture.organisedData = result;
        state.dreamCapture.revisionHistory = [];
        state.dreamCapture.reviewView = "organised";
        state.dreamCapture.processingStage = "review";
        if (Array.isArray(result.uncertainDetails) && result.uncertainDetails.length > 0) {
          state.dreamCapture.uncertaintyMarkers = result.uncertainDetails;
        }
        render();
        focusDraftEditor();
      } catch (err) {
        state.dreamCapture.processingStage = "error";
        state.dreamCapture.errorMessage = err.message || "Failed to organise dream notes. Your original text is safely saved.";
        render();
        focusErrorAlert();
      }
    });
  });

  // 3b. AI Organisation Error: Retry
  document.querySelectorAll("[data-action='dream-organise-retry']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = state.dreamCapture.editedDraft || state.dreamCapture.organisedText || state.dreamCapture.rawText || state.dreamCapture.rawInput;
      if (!text) {
        state.dreamCapture.processingStage = "idle";
        render();
        return;
      }
      state.dreamCapture.processingStage = "organising";
      state.dreamCapture.errorMessage = "";
      render();

      try {
        const result = await api.organiseDream(text, { sourceType: state.dreamCapture.sourceType || "type" });
        state.dreamCapture.organisedText = result.narrative;
        state.dreamCapture.structuredDraft = result.narrative;
        state.dreamCapture.editedDraft = result.narrative;
        state.dreamCapture.wasAiOrganised = true;
        state.dreamCapture.organisedData = result;
        state.dreamCapture.reviewView = "organised";
        state.dreamCapture.processingStage = "review";
        render();
        focusDraftEditor();
      } catch (err) {
        state.dreamCapture.processingStage = "error";
        state.dreamCapture.errorMessage = err.message || "Failed to organise dream notes.";
        render();
        focusErrorAlert();
      }
    });
  });

  // 3c. AI Organisation Error: Continue with Original
  document.querySelectorAll("[data-action='dream-continue-original']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const raw = state.dreamCapture.rawText || state.dreamCapture.rawInput || "";
      state.dreamCapture.structuredDraft = raw;
      state.dreamCapture.editedDraft = raw;
      state.dreamCapture.organisedText = raw;
      state.dreamCapture.wasAiOrganised = false;
      state.dreamCapture.reviewView = "original";
      state.dreamCapture.processingStage = "review";
      state.dreamCapture.errorMessage = "";
      render();
      focusDraftEditor();
    });
  });

  // Helper to transcribe audio blob and transition to review or error
  async function handleAudioBlobTranscription(blob, duration) {
    state.dreamCapture.audioBlob = blob;
    try {
      const result = await api.transcribeDreamAudio(blob, {
        duration,
        filename: (blob.type || "").includes("mp4") ? "recording.m4a" : "recording.webm"
      });

      if (result.isSilent) {
        state.dreamCapture.processingStage = "idle";
        state.dreamCapture.errorMessage = "No clear speech detected in your recording. Please speak closer to your microphone and try again.";
        render();
        return;
      }

      const transcript = result.transcript || "";
      // Architecture Contract - Voice Case:
      // rawText = exact transcription (NEVER OVERWRITTEN)
      setInitialRawText(state.dreamCapture, transcript);
      state.dreamCapture.sourceType = "voice";
      state.dreamCapture.structuredDraft = transcript;
      state.dreamCapture.editedDraft = transcript;
      state.dreamCapture.uncertaintyMarkers = result.uncertaintyMarkers || [];
      state.dreamCapture.reviewView = "organised";
      state.dreamCapture.processingStage = "review";
      render();
      focusDraftEditor();
    } catch (err) {
      state.dreamCapture.processingStage = "error";
      state.dreamCapture.errorMessage = err.message || "Failed to transcribe dream audio. You can retry with your saved recording or record again.";
      render();
      focusErrorAlert();
    }
  }

  // 4. Voice Mode: Start recording
  document.querySelectorAll("[data-action='dream-voice-start']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.dreamCapture.errorMessage = "";
      state.dreamCapture.audioBlob = null;
      state.dreamCapture.voiceElapsedSeconds = 0;
      activeAudioChunks = [];
      resetDreamCaptureTimer();

      // Check browser MediaDevices support
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        try {
          activeMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
          state.dreamCapture.processingStage = "idle";
          state.dreamCapture.errorMessage = "Microphone access was denied. Please allow microphone permissions in your browser settings to speak your dream.";
          render();
          return;
        }

        let mimeType = "audio/webm";
        if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
          if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
            mimeType = "audio/webm;codecs=opus";
          } else if (MediaRecorder.isTypeSupported("audio/webm")) {
            mimeType = "audio/webm";
          } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
            mimeType = "audio/mp4";
          } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
            mimeType = "audio/ogg";
          }
        }

        try {
          activeMediaRecorder = new MediaRecorder(activeMediaStream, mimeType ? { mimeType } : undefined);
        } catch {
          activeMediaRecorder = new MediaRecorder(activeMediaStream);
        }

        activeMediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            activeAudioChunks.push(e.data);
          }
        };

        try {
          activeMediaRecorder.start(250);
          state.dreamCapture.audioMimeType = activeMediaRecorder.mimeType || mimeType;
        } catch {
          // Fallback if start fails
        }
      }

      state.dreamCapture.processingStage = "recording";
      voiceTimerInterval = setInterval(() => {
        state.dreamCapture.voiceElapsedSeconds += 1;
        const timerEl = document.querySelector(".status-timer");
        if (timerEl) {
          timerEl.textContent = formatElapsedSeconds(state.dreamCapture.voiceElapsedSeconds);
        }
      }, 1000);

      render();
    });
  });

  // 5. Voice Mode: Pause recording
  document.querySelectorAll("[data-action='dream-voice-pause']").forEach((btn) => {
    btn.addEventListener("click", () => {
      resetDreamCaptureTimer();
      if (activeMediaRecorder && activeMediaRecorder.state === "recording") {
        try { activeMediaRecorder.pause(); } catch {}
      }
      state.dreamCapture.processingStage = "paused";
      render();
    });
  });

  // 6. Voice Mode: Resume recording
  document.querySelectorAll("[data-action='dream-voice-resume']").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (activeMediaRecorder && activeMediaRecorder.state === "paused") {
        try { activeMediaRecorder.resume(); } catch {}
      }
      state.dreamCapture.processingStage = "recording";
      resetDreamCaptureTimer();

      voiceTimerInterval = setInterval(() => {
        state.dreamCapture.voiceElapsedSeconds += 1;
        const timerEl = document.querySelector(".status-timer");
        if (timerEl) {
          timerEl.textContent = formatElapsedSeconds(state.dreamCapture.voiceElapsedSeconds);
        }
      }, 1000);

      render();
    });
  });

  // 7. Voice Mode: Finish recording -> Transcribe -> Review
  document.querySelectorAll("[data-action='dream-voice-finish']").forEach((btn) => {
    btn.addEventListener("click", () => {
      resetDreamCaptureTimer();
      const duration = state.dreamCapture.voiceElapsedSeconds;
      state.dreamCapture.processingStage = "transcribing";
      state.dreamCapture.sourceType = "voice";
      state.dreamCapture.errorMessage = "";
      render();

      if (activeMediaRecorder && activeMediaRecorder.state !== "inactive") {
        activeMediaRecorder.onstop = async () => {
          const mimeType = state.dreamCapture.audioMimeType || activeMediaRecorder.mimeType || "audio/webm";
          const blob = new Blob(activeAudioChunks, { type: mimeType });
          stopActiveMediaStream();
          await handleAudioBlobTranscription(blob, duration);
        };
        try {
          activeMediaRecorder.stop();
        } catch {
          stopActiveMediaStream();
        }
      } else if (activeAudioChunks.length > 0) {
        const mimeType = state.dreamCapture.audioMimeType || "audio/webm";
        const blob = new Blob(activeAudioChunks, { type: mimeType });
        stopActiveMediaStream();
        handleAudioBlobTranscription(blob, duration);
      } else if (state.dreamCapture.audioBlob) {
        stopActiveMediaStream();
        handleAudioBlobTranscription(state.dreamCapture.audioBlob, duration);
      } else {
        stopActiveMediaStream();
        // Fallback for mock/test environments without live mediaRecorder
        const sampleRaw = "I had a dream where I was floating above an endless ocean. The water was glowing with soft blue light and everything felt quiet and calm...";
        state.dreamCapture.rawInput = sampleRaw;
        state.dreamCapture.structuredDraft = sampleRaw;
        state.dreamCapture.editedDraft = sampleRaw;
        state.dreamCapture.uncertaintyMarkers = [];
        state.dreamCapture.reviewView = "organised";
        state.dreamCapture.processingStage = "review";
        render();
      }
    });
  });

  // 7b. Voice Mode: Retry transcription using preserved audioBlob
  document.querySelectorAll("[data-action='dream-voice-retry']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!state.dreamCapture.audioBlob) {
        state.dreamCapture.processingStage = "idle";
        render();
        return;
      }
      state.dreamCapture.errorMessage = "";
      state.dreamCapture.processingStage = "transcribing";
      render();
      await handleAudioBlobTranscription(state.dreamCapture.audioBlob, state.dreamCapture.voiceElapsedSeconds);
    });
  });

  // 8. Voice Mode: Discard recording
  document.querySelectorAll("[data-action='dream-voice-discard']").forEach((btn) => {
    btn.addEventListener("click", () => {
      resetDreamCaptureTimer();
      stopActiveMediaStream();
      state.dreamCapture.audioBlob = null;
      state.dreamCapture.processingStage = "idle";
      state.dreamCapture.voiceElapsedSeconds = 0;
      state.dreamCapture.errorMessage = "";
      render();
    });
  });

  // 9. Scan Notes Mode: File input change
  document.querySelectorAll("[data-action='dream-file-change']").forEach((input) => {
    input.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (state.dreamCapture.selectedImage?.previewUrl) {
        try {
          URL.revokeObjectURL(state.dreamCapture.selectedImage.previewUrl);
        } catch {
          // ignore
        }
      }

      state.dreamCapture.selectedImage = {
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        size: file.size
      };
      state.dreamCapture.errorMessage = "";
      render();
    });
  });

  // 10. Scan Notes Mode: Remove selected image
  document.querySelectorAll("[data-action='dream-scan-remove']").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.dreamCapture.selectedImage?.previewUrl) {
        try {
          URL.revokeObjectURL(state.dreamCapture.selectedImage.previewUrl);
        } catch {
          // ignore
        }
      }
      state.dreamCapture.selectedImage = null;
      render();
    });
  });

  // 11. Scan Notes Mode: Process image -> extracting -> review
  document.querySelectorAll("[data-action='dream-scan-process']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!state.dreamCapture.selectedImage?.file) return;

      state.dreamCapture.processingStage = "extracting";
      state.dreamCapture.sourceType = "image";
      state.dreamCapture.errorMessage = "";
      render();

      try {
        const file = state.dreamCapture.selectedImage.file;
        const result = await api.extractDreamNotes(file);

        if (result.warnings && result.warnings.includes("NO_TEXT_DETECTED")) {
          state.dreamCapture.processingStage = "idle";
          state.dreamCapture.errorMessage = "No clear text or handwriting could be detected in this image. Please try retaking the photo with better lighting or focus.";
          render();
          return;
        }

        if (!result.extractedText || !result.extractedText.trim()) {
          state.dreamCapture.processingStage = "idle";
          state.dreamCapture.errorMessage = "We couldn't detect readable text on this page. Please try another image.";
          render();
          return;
        }

        const extracted = result.extractedText;
        // Architecture Contract - Image Case:
        // rawText = extracted handwriting (NEVER OVERWRITTEN)
        setInitialRawText(state.dreamCapture, extracted);
        state.dreamCapture.structuredDraft = extracted;
        state.dreamCapture.editedDraft = extracted;

        const markers = Array.isArray(result.uncertainSegments)
          ? result.uncertainSegments.map((s) => {
              if (typeof s === "string") return s.startsWith("[") && s.endsWith("?]") ? s : `[${s}?]`;
              if (s && s.text) return `[${s.text}?]`;
              return String(s);
            })
          : [];
        state.dreamCapture.uncertaintyMarkers = markers;

        // Free image preview URL and memory immediately once text is extracted
        if (state.dreamCapture.selectedImage?.previewUrl) {
          try {
            URL.revokeObjectURL(state.dreamCapture.selectedImage.previewUrl);
          } catch {}
        }
        state.dreamCapture.selectedImage = null;

        state.dreamCapture.reviewView = "organised";
        state.dreamCapture.processingStage = "review";
        render();
        focusDraftEditor();
      } catch (err) {
        state.dreamCapture.processingStage = "idle";
        state.dreamCapture.errorMessage = err.message || "Failed to read dream notes. Please check the image and try again.";
        render();
        focusErrorAlert();
      }
    });
  });

  // 12. Review Component: Switch between Organised and Original tabs
  document.querySelectorAll("[data-action='dream-review-set-view']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (view) {
        // Save current textarea edits before switching view
        const textarea = document.querySelector("#dreamReviewEditedDraft");
        if (textarea) {
          state.dreamCapture.editedDraft = textarea.value;
        }
        state.dreamCapture.reviewView = view;
        render();
      }
    });
  });

  // 13. Review Component: Restore Original or Undo previous version
  const handleRestoreOriginal = () => {
    const raw = state.dreamCapture.rawInput || "";
    if (raw) {
      if (!Array.isArray(state.dreamCapture.revisionHistory)) {
        state.dreamCapture.revisionHistory = [];
      }
      const currentDraft = state.dreamCapture.editedDraft || state.dreamCapture.structuredDraft || "";
      if (currentDraft && currentDraft !== raw) {
        state.dreamCapture.revisionHistory.push({
          narrative: currentDraft,
          organisedData: state.dreamCapture.organisedData ? JSON.parse(JSON.stringify(state.dreamCapture.organisedData)) : null,
          timestamp: Date.now()
        });
      }
      state.dreamCapture.editedDraft = raw;
      state.dreamCapture.structuredDraft = raw;
      state.dreamCapture.reviewView = "organised";
      render();
      focusDraftEditor();
    }
  };

  document.querySelectorAll("[data-action='dream-review-restore-original']").forEach((btn) => {
    btn.addEventListener("click", handleRestoreOriginal);
  });

  document.querySelectorAll("[data-action='dream-review-reset']").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (Array.isArray(state.dreamCapture.revisionHistory) && state.dreamCapture.revisionHistory.length > 0) {
        const previous = state.dreamCapture.revisionHistory.pop();
        state.dreamCapture.editedDraft = previous.narrative;
        state.dreamCapture.structuredDraft = previous.narrative;
        state.dreamCapture.organisedData = previous.organisedData;
        render();
        focusDraftEditor();
      } else {
        handleRestoreOriginal();
      }
    });
  });

  // 13b. Review Component: Start over
  document.querySelectorAll("[data-action='dream-review-start-over']").forEach((btn) => {
    btn.addEventListener("click", () => {
      resetDreamCaptureState(state);
      render();
    });
  });

  // 14. Review Component: Re-organise
  document.querySelectorAll("[data-action='dream-review-reorganise']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const textarea = document.querySelector("#dreamReviewEditedDraft");
      const currentText = (textarea ? textarea.value : state.dreamCapture.editedDraft || "").trim();
      if (!currentText) {
        state.dreamCapture.errorMessage = "Dream draft cannot be empty.";
        render();
        return;
      }

      // Preserve previous version in revisionHistory for undo
      if (!Array.isArray(state.dreamCapture.revisionHistory)) {
        state.dreamCapture.revisionHistory = [];
      }
      state.dreamCapture.revisionHistory.push({
        narrative: state.dreamCapture.editedDraft || state.dreamCapture.structuredDraft || state.dreamCapture.rawInput,
        organisedData: state.dreamCapture.organisedData ? JSON.parse(JSON.stringify(state.dreamCapture.organisedData)) : null,
        timestamp: Date.now()
      });

      state.dreamCapture.editedDraft = currentText;
      state.dreamCapture.processingStage = "organising";
      state.dreamCapture.errorMessage = "";
      render();

      try {
        const result = await api.organiseDream(currentText, { sourceType: state.dreamCapture.sourceType || "type" });
        // Update organisedText, keeping rawText strictly untouched
        state.dreamCapture.organisedText = result.narrative;
        state.dreamCapture.structuredDraft = result.narrative;
        state.dreamCapture.editedDraft = result.narrative;
        state.dreamCapture.wasAiOrganised = true;
        state.dreamCapture.organisedData = result;
        state.dreamCapture.reviewView = "organised";
        state.dreamCapture.processingStage = "review";
        if (Array.isArray(result.uncertainDetails) && result.uncertainDetails.length > 0) {
          state.dreamCapture.uncertaintyMarkers = result.uncertainDetails;
        }
        render();
        focusDraftEditor();
      } catch (err) {
        state.dreamCapture.processingStage = "error";
        state.dreamCapture.errorMessage = err.message || "Failed to re-organise dream memories.";
        render();
        focusErrorAlert();
      }
    });
  });

  // 15. Review Component: Approve & Analyse Dream
  document.querySelectorAll("[data-action='dream-review-approve']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      // Prevent accidental double clicks / concurrent requests
      if (state.dreamCapture.isSubmitting) return;

      const textarea = document.querySelector("#dreamReviewEditedDraft");
      const finalDraft = textarea ? textarea.value.trim() : (state.dreamCapture.editedDraft || "").trim();

      if (!finalDraft) {
        state.dreamCapture.errorMessage = "Dream draft cannot be empty. Please enter your dream memories.";
        render();
        return;
      }

      const baseline = state.dreamCapture.organisedText || state.dreamCapture.structuredDraft || state.dreamCapture.rawText || "";
      const isEdited = Boolean(state.dreamCapture.wasUserEdited || (baseline && finalDraft !== baseline));

      // ARCHITECTURE CONTRACT:
      // approvedText = final user-reviewed / edited version
      state.dreamCapture.isApproved = true;
      state.dreamCapture.approvedText = finalDraft;
      state.dreamCapture.approvedDraft = finalDraft;
      state.dreamCapture.editedDraft = finalDraft;
      state.dreamCapture.wasUserEdited = isEdited;
      state.dreamCapture.approvedAt = new Date().toISOString();
      state.dreamCapture.isSubmitting = true;
      state.dreamCapture.errorMessage = "";
      state.dreamInput = finalDraft;
      render();

      const metadata = {
        sourceType: state.dreamCapture.sourceType || "typed",
        rawText: state.dreamCapture.rawText || state.dreamCapture.rawInput || "",
        organisedText: state.dreamCapture.organisedText || state.dreamCapture.structuredDraft || "",
        approvedText: finalDraft,
        wasAiOrganised: Boolean(state.dreamCapture.wasAiOrganised || state.dreamCapture.organisedData),
        wasUserEdited: isEdited,
        approvedAt: state.dreamCapture.approvedAt
      };

      if (typeof onApproveAnalysis === "function") {
        try {
          // CRITICAL ARCHITECTURE RULE:
          // Analysis pipeline receives ONLY approvedText (finalDraft)
          await onApproveAnalysis(finalDraft, metadata);
        } catch (err) {
          state.dreamCapture.isSubmitting = false;
          state.dreamCapture.errorMessage = err.message || "Dream analysis failed. You can retry with your approved draft.";
          render();
        }
      }
    });
  });

  // 16. Real-time textarea input sync
  const editedTextarea = document.querySelector("#dreamReviewEditedDraft");
  if (editedTextarea) {
    editedTextarea.addEventListener("input", (e) => {
      state.dreamCapture.editedDraft = e.target.value;
      const compareText = state.dreamCapture.organisedText || state.dreamCapture.structuredDraft || state.dreamCapture.rawText;
      if (compareText && e.target.value !== compareText) {
        state.dreamCapture.wasUserEdited = true;
      }
    });
  }
}
