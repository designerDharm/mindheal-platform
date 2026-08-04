import { html, escapeHtml, toast, formatInr } from "../utils/dom.js";
import { t } from "../utils/i18n.js";
import { api } from "../services/mock-api.js?v=5";

export function renderInsightLab(state, dashboard, data) {
  const activeTab = state.insightLabTab || "scan";

  return html`
    <div class="insight-lab-wrapper" style="display:flex;flex-direction:column;gap:32px;">
      <!-- Header Banner & Credit Wallet Bar -->
      <div class="panel-hero" style="background:linear-gradient(135deg, #1A1A18 0%, #2D2A26 100%);color:white;padding:32px;border-radius:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <span class="status-pill warning" style="background:rgba(224,90,71,0.2);color:#E05A47;border:1px solid rgba(224,90,71,0.4);font-weight:700;">18+ NON-DIAGNOSTIC LAB</span>
            <span style="font-size:12px;color:rgba(255,255,255,0.6);">SSoT Rule-Governed Engine</span>
          </div>
          <h1 class="page-title" style="font-family:var(--font-serif);font-size:32px;margin:0 0 8px 0;color:white;">MindHeal Insight Lab</h1>
          <p class="page-subtitle" style="margin:0;color:rgba(255,255,255,0.7);max-width:650px;font-size:14px;line-height:1.5;">
            Engaging AI-assisted self-reflection, wellness screenings, and care navigation. Designed for personal awareness — <strong>not clinical diagnosis</strong>.
          </p>
        </div>

        <!-- AI Credit Wallet Badge -->
        <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);padding:16px 24px;border-radius:16px;display:flex;align-items:center;gap:16px;">
          <div style="width:44px;height:44px;border-radius:50%;background:var(--color-coral);display:flex;align-items:center;justify-content:center;font-size:22px;color:white;">
            <i class="ph-bold ph-lightning"></i>
          </div>
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.05em;font-weight:700;">AI Credit Wallet</div>
            <div style="font-size:24px;font-weight:800;color:white;line-height:1.1;">
              ${state.aiCredits !== undefined ? state.aiCredits : 25} <span style="font-size:13px;font-weight:400;color:rgba(255,255,255,0.7);">Credits</span>
            </div>
          </div>
          <button class="btn primary" onclick="window.openCreditRechargeModal()" style="height:36px;padding:0 16px;font-size:13px;">Recharge</button>
        </div>
      </div>

      <!-- Feature Tabs Navigation -->
      <div style="display:flex;gap:8px;border-bottom:1px solid var(--color-border);padding-bottom:12px;overflow-x:auto;white-space:nowrap;">
        <button class="filter-tab ${activeTab === 'scan' ? 'active' : ''}" onclick="window.switchInsightLabTab('scan')">
          <i class="ph-bold ph-lightning" style="margin-right:6px;"></i> 60s Scan
        </button>
        <button class="filter-tab ${activeTab === 'screenings' ? 'active' : ''}" onclick="window.switchInsightLabTab('screenings')">
          <i class="ph-bold ph-clipboard-text" style="margin-right:6px;"></i> Wellness Screenings
        </button>
        <button class="filter-tab ${activeTab === 'creative' ? 'active' : ''}" onclick="window.switchInsightLabTab('creative')">
          <i class="ph-bold ph-sparkles" style="margin-right:6px;"></i> Reflective Tools
        </button>
        <button class="filter-tab ${activeTab === 'timeline' ? 'active' : ''}" onclick="window.switchInsightLabTab('timeline')">
          <i class="ph-bold ph-path" style="margin-right:6px;"></i> Life Map & Future
        </button>
        <button class="filter-tab ${activeTab === 'earn' ? 'active' : ''}" onclick="window.switchInsightLabTab('earn')">
          <i class="ph-bold ph-gift" style="margin-right:6px;"></i> Earn Credits
        </button>
      </div>

      <!-- Tab Content Area -->
      <div id="insight-lab-content">
        ${renderTabContent(activeTab, state)}
      </div>
    </div>
  `;
}

function renderTabContent(tab, state) {
  if (tab === 'scan') {
    return html`
      <div class="dashboard-card" style="padding:32px;display:flex;flex-direction:column;gap:24px;background:white;border-radius:16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <span class="status-pill info" style="margin-bottom:8px;display:inline-block;">Fast Wellness Snapshot</span>
            <h2 style="font-family:var(--font-serif);font-size:24px;margin:0 0 4px 0;">60-Second Mental Wellness Scan</h2>
            <p style="color:var(--color-text-muted);font-size:14px;margin:0;">Assess mood, stress, energy, overthinking, and rest in 60 seconds.</p>
          </div>
          <span style="font-size:13px;font-weight:700;color:var(--color-coral);"><i class="ph-bold ph-lightning"></i> Costs 2 Credits</span>
        </div>

        <form id="wellness-scan-form" onsubmit="window.handleWellnessScanSubmit(event)" style="display:flex;flex-direction:column;gap:20px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <div class="field">
              <label>1. Energy & Fatigue Level</label>
              <select name="energy" required style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--color-border);">
                <option value="high">High Energy & Rested</option>
                <option value="moderate" selected>Moderate / Occasional Tiredness</option>
                <option value="low">Low Energy / Constant Fatigue</option>
              </select>
            </div>
            <div class="field">
              <label>2. Stress & Tension</label>
              <select name="stress" required style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--color-border);">
                <option value="low">Low / Manageable</option>
                <option value="moderate" selected>Moderate Stress</option>
                <option value="high">High Stress / Overwhelmed</option>
              </select>
            </div>
            <div class="field">
              <label>3. Sleep Quality (Last 7 Days)</label>
              <select name="sleep" required style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--color-border);">
                <option value="good">Restful (7+ Hours)</option>
                <option value="fair" selected>Restless / Interrupted</option>
                <option value="poor">Insomnia / Severe Waking</option>
              </select>
            </div>
            <div class="field">
              <label>4. Overthinking & Worry Loops</label>
              <select name="overthinking" required style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--color-border);">
                <option value="minimal">Minimal / Rare</option>
                <option value="frequent" selected>Frequent Racing Thoughts</option>
                <option value="constant">Constant Worry Loops</option>
              </select>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:12px;">
            <button type="submit" class="btn primary" style="padding:12px 28px;">Run 60s Reflection Scan</button>
          </div>
        </form>

        <div id="wellness-scan-result" style="display:none;background:var(--color-cream);padding:24px;border-radius:12px;border-left:4px solid var(--color-coral);margin-top:16px;">
          <!-- Dynamically filled by submission handler -->
        </div>
      </div>
    `;
  }

  if (tab === 'screenings') {
    return html`
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:24px;">
        <div class="dashboard-card" style="padding:24px;background:white;border-radius:16px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;">
            <span class="status-pill success">Deterministic Screening</span>
            <span style="font-size:12px;color:var(--color-coral);font-weight:700;"><i class="ph-bold ph-lightning"></i> 3 Credits</span>
          </div>
          <h3 style="font-family:var(--font-serif);font-size:20px;margin:0;">Low-Mood & Energy Screen</h3>
          <p style="font-size:13px;color:var(--color-text-muted);margin:0;">Validated symptom check for persistent low energy and mood patterns.</p>
          <button class="btn secondary" onclick="toast('Low-Mood Screening session initiated.')" style="margin-top:auto;">Start Screening</button>
        </div>

        <div class="dashboard-card" style="padding:24px;background:white;border-radius:16px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;">
            <span class="status-pill info">Anxiety Check</span>
            <span style="font-size:12px;color:var(--color-coral);font-weight:700;"><i class="ph-bold ph-lightning"></i> 3 Credits</span>
          </div>
          <h3 style="font-family:var(--font-serif);font-size:20px;margin:0;">Anxiety & Overthinking Check</h3>
          <p style="font-size:13px;color:var(--color-text-muted);margin:0;">Evaluate restlessness, worry loops, and functional impact.</p>
          <button class="btn secondary" onclick="toast('Anxiety Check session initiated.')" style="margin-top:auto;">Start Check</button>
        </div>

        <div class="dashboard-card" style="padding:24px;background:white;border-radius:16px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;">
            <span class="status-pill warning">Work & Life</span>
            <span style="font-size:12px;color:var(--color-coral);font-weight:700;"><i class="ph-bold ph-lightning"></i> 2 Credits</span>
          </div>
          <h3 style="font-family:var(--font-serif);font-size:20px;margin:0;">Burnout & Exhaustion Reflection</h3>
          <p style="font-size:13px;color:var(--color-text-muted);margin:0;">Reflect on work detachment, emotional exhaustion, and recovery gaps.</p>
          <button class="btn secondary" onclick="toast('Burnout Reflection initiated.')" style="margin-top:auto;">Start Reflection</button>
        </div>

        <div class="dashboard-card" style="padding:24px;background:white;border-radius:16px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;">
            <span class="status-pill success">Match Engine</span>
            <span style="font-size:12px;color:var(--color-coral);font-weight:700;"><i class="ph-bold ph-lightning"></i> FREE</span>
          </div>
          <h3 style="font-family:var(--font-serif);font-size:20px;margin:0;">Therapy Readiness & Match</h3>
          <p style="font-size:13px;color:var(--color-text-muted);margin:0;">Match transparently with verified clinical experts based on your goals.</p>
          <button class="btn primary" onclick="window.location.hash='#/panel/user?section=counsellors'" style="margin-top:auto;">Match Counsellor</button>
        </div>
      </div>
    `;
  }

  if (tab === 'creative') {
    const activeToolModal = state && state.reflectiveToolOpen;
    const thoughtMirrorStep = (state && state.thoughtMirrorStep) || 0;
    const thoughtMirrorData = state && state.thoughtMirrorData;
    const unsentLetters = (state && state.unsentLetters) || [];
    const voiceMirrorPhase = (state && state.voiceMirrorPhase) || 'idle'; // idle | recording | result
    const voiceMirrorTranscript = (state && state.voiceMirrorTranscript) || '';

    // Distortions list for Thought Mirror
    const DISTORTIONS = [
      { id: 'all_or_nothing', label: 'All-or-Nothing Thinking', desc: 'Seeing things in black and white, with no middle ground.' },
      { id: 'overgeneralization', label: 'Overgeneralization', desc: 'Drawing broad conclusions from a single event.' },
      { id: 'catastrophizing', label: 'Catastrophizing', desc: 'Assuming the worst possible outcome will happen.' },
      { id: 'mind_reading', label: 'Mind Reading', desc: 'Assuming you know what others are thinking.' },
      { id: 'emotional_reasoning', label: 'Emotional Reasoning', desc: 'Believing something is true because it feels true.' },
      { id: 'should_statements', label: 'Should Statements', desc: 'Rigid rules about how you or others must behave.' },
      { id: 'personalization', label: 'Personalization', desc: 'Blaming yourself for things outside your control.' },
      { id: 'filtering', label: 'Mental Filter', desc: 'Focusing exclusively on negatives, ignoring positives.' },
    ];

    return html`
      <!-- Tool Cards Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:24px;">

        <!-- Thought Mirror Card -->
        <div class="dashboard-card" style="padding:28px;background:white;border-radius:20px;display:flex;flex-direction:column;gap:14px;border:1px solid var(--color-border);transition:box-shadow 0.2s;">
          <div style="width:44px;height:44px;border-radius:12px;background:rgba(224,106,78,0.1);display:flex;align-items:center;justify-content:center;">
            <i class="ph-bold ph-quotes" style="font-size:22px;color:var(--color-coral);"></i>
          </div>
          <div>
            <h3 style="font-family:var(--font-serif);font-size:20px;margin:0 0 6px 0;color:var(--color-charcoal);">Thought Mirror</h3>
            <p style="font-size:13px;color:var(--color-text-muted);margin:0;line-height:1.5;">Reframe automatic thoughts and identify cognitive distortions through guided CBT reflection.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <span class="status-pill info" style="font-size:11px;">CBT-Based</span>
            <span class="status-pill warning" style="font-size:11px;">4 Steps</span>
            <span style="font-size:11px;color:var(--color-coral);font-weight:700;"><i class="ph-bold ph-lightning"></i> 2 Credits</span>
          </div>
          <button class="btn primary" onclick="window.openReflectiveTool('thought-mirror')" style="margin-top:auto;background:var(--color-coral);border-radius:12px;display:flex;align-items:center;justify-content:center;gap:8px;">
            <i class="ph-bold ph-brain"></i> Reflect Now
          </button>
        </div>

        <!-- Unsent Letters Card -->
        <div class="dashboard-card" style="padding:28px;background:white;border-radius:20px;display:flex;flex-direction:column;gap:14px;border:1px solid var(--color-border);">
          <div style="width:44px;height:44px;border-radius:12px;background:rgba(59,130,246,0.1);display:flex;align-items:center;justify-content:center;">
            <i class="ph-bold ph-paper-plane-tilt" style="font-size:22px;color:#3b82f6;"></i>
          </div>
          <div>
            <h3 style="font-family:var(--font-serif);font-size:20px;margin:0 0 6px 0;color:var(--color-charcoal);">Unsent Letters</h3>
            <p style="font-size:13px;color:var(--color-text-muted);margin:0;line-height:1.5;">Express unsaid needs, boundaries, and closure in a safe, completely private, unshared space.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <span class="status-pill success" style="font-size:11px;">🔒 Private</span>
            <span class="status-pill info" style="font-size:11px;">Never Sent</span>
            <span style="font-size:11px;color:var(--color-coral);font-weight:700;"><i class="ph-bold ph-lightning"></i> 1 Credit</span>
          </div>
          <button class="btn primary" onclick="window.openReflectiveTool('unsent-letters')" style="margin-top:auto;background:#3b82f6;border:none;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:8px;">
            <i class="ph-bold ph-envelope"></i> Write Letter
          </button>
        </div>

        <!-- VoiceMirror Card -->
        <div class="dashboard-card" style="padding:28px;background:white;border-radius:20px;display:flex;flex-direction:column;gap:14px;border:1px solid var(--color-border);">
          <div style="width:44px;height:44px;border-radius:12px;background:rgba(16,185,129,0.1);display:flex;align-items:center;justify-content:center;">
            <i class="ph-bold ph-microphone" style="font-size:22px;color:#10b981;"></i>
          </div>
          <div>
            <h3 style="font-family:var(--font-serif);font-size:20px;margin:0 0 6px 0;color:var(--color-charcoal);">VoiceMirror</h3>
            <p style="font-size:13px;color:var(--color-text-muted);margin:0;line-height:1.5;">Speak freely for 60 seconds and receive a structured emotion & theme summary of your journal.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <span class="status-pill success" style="font-size:11px;">60s Record</span>
            <span class="status-pill info" style="font-size:11px;">AI Summary</span>
            <span style="font-size:11px;color:var(--color-coral);font-weight:700;"><i class="ph-bold ph-lightning"></i> 2 Credits</span>
          </div>
          <button class="btn primary" onclick="window.openReflectiveTool('voice-mirror')" style="margin-top:auto;background:#10b981;border:none;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:8px;">
            <i class="ph-bold ph-microphone-stage"></i> Speak Journal
          </button>
        </div>
      </div>

      <!-- Saved Unsent Letters List (shown inline) -->
      ${unsentLetters.length > 0 ? html`
        <div style="margin-top:8px;">
          <h4 style="font-family:var(--font-serif);font-size:18px;margin:0 0 16px 0;color:var(--color-charcoal);">📬 My Private Letters <span style="font-size:13px;font-weight:400;color:var(--color-text-muted);">(stored locally, never shared)</span></h4>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${unsentLetters.map((letter, idx) => `
              <div style="background:white;border:1px solid var(--color-border);border-radius:16px;padding:20px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                <div>
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                    <strong style="font-size:15px;color:var(--color-charcoal);">To: ${escapeHtml(letter.recipient)}</strong>
                    <span class="status-pill ${letter.category === 'Forgiveness' ? 'success' : letter.category === 'Closure' ? 'info' : letter.category === 'Anger' ? 'danger' : 'warning'}" style="font-size:11px;">${escapeHtml(letter.category)}</span>
                  </div>
                  <p style="font-size:13px;color:var(--color-text-muted);margin:0;line-height:1.5;max-width:600px;">${escapeHtml(letter.body.substring(0, 120))}${letter.body.length > 120 ? '...' : ''}</p>
                  <span style="font-size:11px;color:var(--color-text-muted);margin-top:8px;display:block;">${new Date(letter.savedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>
                </div>
                <button onclick="window.deleteUnsentLetter(${idx})" style="background:transparent;border:none;color:var(--color-text-muted);cursor:pointer;padding:4px;flex-shrink:0;" title="Delete letter">
                  <i class="ph ph-trash" style="font-size:18px;"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- ══════════════ MODAL OVERLAY ══════════════ -->
      ${activeToolModal === 'thought-mirror' ? html`
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:1100;padding:20px;" onclick="if(event.target===this)window.closeReflectiveTool()">
          <div style="width:100%;max-width:600px;background:white;border-radius:24px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,0.2);max-height:90vh;overflow-y:auto;">

            <!-- Modal Header -->
            <div style="background:linear-gradient(135deg,#1A1A18,#2D2A26);padding:24px 28px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <h3 style="font-family:var(--font-serif);font-size:22px;margin:0 0 4px 0;color:white;"><i class="ph-bold ph-quotes" style="color:var(--color-coral);margin-right:8px;"></i>Thought Mirror</h3>
                <p style="font-size:12px;color:rgba(255,255,255,0.6);margin:0;">CBT-based cognitive reframing · Step ${(thoughtMirrorStep||0)+1} of 4</p>
              </div>
              <button onclick="window.closeReflectiveTool()" style="background:rgba(255,255,255,0.1);border:none;color:white;width:36px;height:36px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;"><i class="ph ph-x" style="font-size:18px;"></i></button>
            </div>

            <!-- Progress Bar -->
            <div style="height:4px;background:rgba(224,106,78,0.15);">
              <div style="height:100%;background:var(--color-coral);width:${((thoughtMirrorStep||0)+1)*25}%;transition:width 0.4s ease;"></div>
            </div>

            <!-- Step Content -->
            <div style="padding:28px;">
              ${(thoughtMirrorStep === 0) ? html`
                <div style="display:flex;flex-direction:column;gap:20px;">
                  <div>
                    <h4 style="font-size:17px;font-weight:700;margin:0 0 6px 0;color:var(--color-charcoal);">Step 1 — What's the automatic thought?</h4>
                    <p style="font-size:13px;color:var(--color-text-muted);margin:0;">Write the exact thought that's bothering you, exactly as it crossed your mind.</p>
                  </div>
                  <textarea id="tm-thought" placeholder='e.g. "I always mess everything up. Nobody trusts me."' rows="4" style="width:100%;padding:14px;border:1px solid var(--color-border);border-radius:12px;font-size:14px;resize:none;line-height:1.6;"></textarea>
                  <div>
                    <h4 style="font-size:17px;font-weight:700;margin:0 0 6px 0;color:var(--color-charcoal);">How strongly do you believe this? <span id="tm-belief-label" style="color:var(--color-coral);">50%</span></h4>
                    <input type="range" id="tm-belief" min="0" max="100" value="50" oninput="document.getElementById('tm-belief-label').textContent=this.value+'%'" style="width:100%;accent-color:var(--color-coral);">
                    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-muted);margin-top:4px;"><span>Not at all</span><span>Completely</span></div>
                  </div>
                  <div style="display:flex;justify-content:flex-end;">
                    <button onclick="window.thoughtMirrorNext(0)" class="btn primary" style="background:var(--color-coral);border-radius:12px;">Next Step →</button>
                  </div>
                </div>
              ` : ''}

              ${(thoughtMirrorStep === 1) ? html`
                <div style="display:flex;flex-direction:column;gap:20px;">
                  <div>
                    <div style="background:rgba(224,106,78,0.06);border-left:3px solid var(--color-coral);padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:4px;">
                      <span style="font-size:12px;color:var(--color-text-muted);display:block;margin-bottom:2px;">Your thought:</span>
                      <strong style="font-size:14px;color:var(--color-charcoal);">"${escapeHtml((thoughtMirrorData && thoughtMirrorData.thought) || '')}"</strong>
                    </div>
                    <h4 style="font-size:17px;font-weight:700;margin:16px 0 6px 0;color:var(--color-charcoal);">Step 2 — Identify cognitive distortions</h4>
                    <p style="font-size:13px;color:var(--color-text-muted);margin:0;">Select all thinking patterns you notice in this thought:</p>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    ${DISTORTIONS.map(d => `
                      <label style="display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid var(--color-border);border-radius:12px;cursor:pointer;transition:all 0.15s;" class="distortion-label" data-id="${d.id}">
                        <input type="checkbox" name="distortion" value="${d.id}" style="margin-top:3px;accent-color:var(--color-coral);flex-shrink:0;" onchange="window.toggleDistortionCard(this)">
                        <div>
                          <strong style="font-size:13px;display:block;color:var(--color-charcoal);">${d.label}</strong>
                          <span style="font-size:11px;color:var(--color-text-muted);">${d.desc}</span>
                        </div>
                      </label>
                    `).join('')}
                  </div>
                  <div style="display:flex;justify-content:space-between;">
                    <button onclick="window.thoughtMirrorBack()" class="btn secondary" style="border-radius:12px;">← Back</button>
                    <button onclick="window.thoughtMirrorNext(1)" class="btn primary" style="background:var(--color-coral);border-radius:12px;">Next Step →</button>
                  </div>
                </div>
              ` : ''}

              ${(thoughtMirrorStep === 2) ? html`
                <div style="display:flex;flex-direction:column;gap:20px;">
                  <div>
                    <h4 style="font-size:17px;font-weight:700;margin:0 0 6px 0;color:var(--color-charcoal);">Step 3 — Challenge the evidence</h4>
                    <p style="font-size:13px;color:var(--color-text-muted);margin:0;">Think critically about the thought. Answer both sides honestly.</p>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:14px;">
                    <div class="field">
                      <label style="font-weight:600;color:#e53e3e;">Evidence <em>for</em> this thought being true:</label>
                      <textarea id="tm-evidence-for" placeholder="What facts support this thought?" rows="2" style="width:100%;resize:none;"></textarea>
                    </div>
                    <div class="field">
                      <label style="font-weight:600;color:#38a169;">Evidence <em>against</em> this thought being true:</label>
                      <textarea id="tm-evidence-against" placeholder="What facts contradict or don't support this thought?" rows="2" style="width:100%;resize:none;"></textarea>
                    </div>
                    <div class="field">
                      <label style="font-weight:600;color:var(--color-charcoal);">What would you tell a close friend having this thought?</label>
                      <textarea id="tm-friend-advice" placeholder="Write as if giving compassionate advice..." rows="2" style="width:100%;resize:none;"></textarea>
                    </div>
                  </div>
                  <div style="display:flex;justify-content:space-between;">
                    <button onclick="window.thoughtMirrorBack()" class="btn secondary" style="border-radius:12px;">← Back</button>
                    <button onclick="window.thoughtMirrorNext(2)" class="btn primary" style="background:var(--color-coral);border-radius:12px;">Next Step →</button>
                  </div>
                </div>
              ` : ''}

              ${(thoughtMirrorStep === 3) ? html`
                <div style="display:flex;flex-direction:column;gap:20px;">
                  <div>
                    <h4 style="font-size:17px;font-weight:700;margin:0 0 6px 0;color:var(--color-charcoal);">Step 4 — Build a balanced thought</h4>
                    <p style="font-size:13px;color:var(--color-text-muted);margin:0;">Write a more balanced, realistic version of the original thought.</p>
                  </div>
                  <div style="background:rgba(224,106,78,0.06);border:1px solid rgba(224,106,78,0.2);padding:16px;border-radius:12px;">
                    <span style="font-size:12px;color:var(--color-text-muted);display:block;margin-bottom:4px;">Original thought:</span>
                    <em style="font-size:13px;color:var(--color-charcoal);">"${escapeHtml((thoughtMirrorData && thoughtMirrorData.thought) || '')}"</em>
                  </div>
                  <div class="field">
                    <label style="font-weight:600;">Your reframed balanced thought:</label>
                    <textarea id="tm-reframe" placeholder='e.g. "I made a mistake this time, but I have succeeded before and can learn from this."' rows="4" style="width:100%;resize:none;"></textarea>
                  </div>
                  <div>
                    <h4 style="font-size:14px;font-weight:700;margin:0 0 6px 0;color:var(--color-charcoal);">How much do you now believe the original thought? <span id="tm-belief-after-label" style="color:#38a169;">30%</span></h4>
                    <input type="range" id="tm-belief-after" min="0" max="100" value="30" oninput="document.getElementById('tm-belief-after-label').textContent=this.value+'%'" style="width:100%;accent-color:#38a169;">
                  </div>
                  <div style="display:flex;justify-content:space-between;">
                    <button onclick="window.thoughtMirrorBack()" class="btn secondary" style="border-radius:12px;">← Back</button>
                    <button onclick="window.thoughtMirrorSubmit()" class="btn primary" style="background:#38a169;border:none;border-radius:12px;display:flex;align-items:center;gap:6px;"><i class="ph-bold ph-check-circle"></i> Save Reflection</button>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- ══════════════ UNSENT LETTERS MODAL ══════════════ -->
      ${activeToolModal === 'unsent-letters' ? html`
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:1100;padding:20px;" onclick="if(event.target===this)window.closeReflectiveTool()">
          <div style="width:100%;max-width:600px;background:white;border-radius:24px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,0.2);max-height:90vh;overflow-y:auto;">

            <!-- Header -->
            <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:24px 28px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <h3 style="font-family:var(--font-serif);font-size:22px;margin:0 0 4px 0;color:white;"><i class="ph-bold ph-envelope" style="margin-right:8px;"></i>Unsent Letters</h3>
                <p style="font-size:12px;color:rgba(255,255,255,0.7);margin:0;">🔒 This letter is stored locally only · Never sent · Never shared</p>
              </div>
              <button onclick="window.closeReflectiveTool()" style="background:rgba(255,255,255,0.15);border:none;color:white;width:36px;height:36px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;"><i class="ph ph-x" style="font-size:18px;"></i></button>
            </div>

            <form onsubmit="window.saveUnsentLetter(event)" style="padding:28px;display:flex;flex-direction:column;gap:18px;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="field">
                  <label style="font-weight:600;">To (Recipient):</label>
                  <input id="ul-recipient" name="recipient" placeholder='e.g. "My younger self", "Mom", "Ex-boss"' required style="width:100%;">
                </div>
                <div class="field">
                  <label style="font-weight:600;">Category:</label>
                  <select id="ul-category" name="category" required style="width:100%;">
                    <option value="Closure">Closure</option>
                    <option value="Forgiveness">Forgiveness</option>
                    <option value="Anger">Anger</option>
                    <option value="Gratitude">Gratitude</option>
                    <option value="Grief">Grief</option>
                    <option value="Unsaid Words">Unsaid Words</option>
                    <option value="Boundaries">Boundaries</option>
                  </select>
                </div>
              </div>

              <div class="field">
                <label style="font-weight:600;">Subject / Opening:</label>
                <input id="ul-subject" name="subject" placeholder='What this letter is about...' style="width:100%;">
              </div>

              <div class="field">
                <label style="font-weight:600;">Your Letter:</label>
                <textarea id="ul-body" name="body" placeholder="Write freely. No one will ever read this. Say everything you've been holding inside..." rows="10" required style="width:100%;resize:vertical;line-height:1.7;font-size:14px;"></textarea>
              </div>

              <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:12px;padding:14px;display:flex;align-items:flex-start;gap:10px;">
                <i class="ph-bold ph-lock" style="color:#3b82f6;font-size:18px;flex-shrink:0;margin-top:2px;"></i>
                <p style="font-size:12px;color:var(--color-text-muted);margin:0;line-height:1.5;">This letter is saved only in your browser's local storage. It is never uploaded, transmitted, or accessible to anyone else. You can delete it any time.</p>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;">
                <button type="button" onclick="window.closeReflectiveTool()" class="btn secondary" style="border-radius:12px;">Cancel</button>
                <button type="submit" class="btn primary" style="background:#2563eb;border:none;border-radius:12px;display:flex;align-items:center;gap:8px;"><i class="ph-bold ph-floppy-disk"></i> Save Letter Privately</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}

      <!-- ══════════════ VOICE MIRROR MODAL ══════════════ -->
      ${activeToolModal === 'voice-mirror' ? html`
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:1100;padding:20px;" onclick="if(event.target===this)window.closeReflectiveTool()">
          <div style="width:100%;max-width:540px;background:white;border-radius:24px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,0.2);">

            <!-- Header -->
            <div style="background:linear-gradient(135deg,#064e3b,#10b981);padding:24px 28px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <h3 style="font-family:var(--font-serif);font-size:22px;margin:0 0 4px 0;color:white;"><i class="ph-bold ph-microphone-stage" style="margin-right:8px;"></i>VoiceMirror</h3>
                <p style="font-size:12px;color:rgba(255,255,255,0.7);margin:0;">Speak for up to 60 seconds · Receive an AI-style content summary</p>
              </div>
              <button onclick="window.closeReflectiveTool()" style="background:rgba(255,255,255,0.15);border:none;color:white;width:36px;height:36px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;"><i class="ph ph-x" style="font-size:18px;"></i></button>
            </div>

            <div style="padding:32px;display:flex;flex-direction:column;gap:24px;align-items:center;text-align:center;">

              ${voiceMirrorPhase === 'idle' ? html`
                <div style="width:120px;height:120px;border-radius:50%;background:rgba(16,185,129,0.1);border:3px solid #10b981;display:flex;align-items:center;justify-content:center;">
                  <i class="ph-bold ph-microphone" style="font-size:52px;color:#10b981;"></i>
                </div>
                <div>
                  <h4 style="font-size:18px;font-weight:700;margin:0 0 8px 0;color:var(--color-charcoal);">Ready to Journal by Voice?</h4>
                  <p style="font-size:13px;color:var(--color-text-muted);margin:0;max-width:360px;line-height:1.5;">Click Start Recording, then speak freely for up to 60 seconds. Share what's on your mind — your feelings, worries, wins, or anything in between.</p>
                </div>
                <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:14px 20px;text-align:left;width:100%;">
                  <p style="font-size:12px;color:var(--color-text-muted);margin:0;line-height:1.5;"><strong>Tip:</strong> Your browser will ask for microphone permission. Your voice is processed locally in real-time and never stored or uploaded.</p>
                </div>
                <button onclick="window.startVoiceMirror()" class="btn primary" style="background:#10b981;border:none;border-radius:12px;padding:14px 32px;font-size:16px;display:flex;align-items:center;gap:10px;">
                  <i class="ph-bold ph-record" style="font-size:20px;"></i> Start Recording
                </button>
              ` : ''}

              ${voiceMirrorPhase === 'recording' ? html`
                <div style="width:120px;height:120px;border-radius:50%;background:rgba(239,68,68,0.1);border:3px solid #ef4444;display:flex;align-items:center;justify-content:center;position:relative;">
                  <div style="position:absolute;inset:-8px;border-radius:50%;border:3px solid rgba(239,68,68,0.3);animation:pulse-ring 1.5s cubic-bezier(0.215,0.61,0.355,1) infinite;"></div>
                  <i class="ph-bold ph-microphone" style="font-size:52px;color:#ef4444;"></i>
                </div>
                <div>
                  <div style="font-size:42px;font-weight:800;color:var(--color-charcoal);font-variant-numeric:tabular-nums;" id="vm-timer-display">0:60</div>
                  <p style="font-size:13px;color:#ef4444;font-weight:600;margin:4px 0 0 0;">🔴 Recording...</p>
                </div>
                <div style="width:100%;background:rgba(0,0,0,0.06);border-radius:999px;height:6px;overflow:hidden;">
                  <div id="vm-progress-bar" style="height:100%;background:#ef4444;width:0%;transition:width 1s linear;border-radius:999px;"></div>
                </div>
                <div style="background:var(--color-cream);border-radius:12px;padding:14px 20px;text-align:left;width:100%;min-height:80px;">
                  <p style="font-size:11px;color:var(--color-text-muted);margin:0 0 6px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Live Transcript:</p>
                  <p id="vm-live-text" style="font-size:13px;color:var(--color-charcoal);margin:0;line-height:1.5;min-height:40px;font-style:italic;">${voiceMirrorTranscript || 'Listening...'}</p>
                </div>
                <button onclick="window.stopVoiceMirror()" class="btn" style="background:#ef4444;color:white;border:none;border-radius:12px;padding:12px 28px;display:flex;align-items:center;gap:8px;">
                  <i class="ph-bold ph-stop-circle"></i> Stop & Summarize
                </button>
              ` : ''}

              ${voiceMirrorPhase === 'result' ? html`
                <div style="width:100%;display:flex;flex-direction:column;gap:20px;text-align:left;">
                  <div style="text-align:center;">
                    <div style="width:64px;height:64px;border-radius:50%;background:rgba(16,185,129,0.1);border:3px solid #10b981;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">
                      <i class="ph-bold ph-check" style="font-size:28px;color:#10b981;"></i>
                    </div>
                    <h4 style="font-size:18px;font-weight:700;margin:0 0 6px 0;color:var(--color-charcoal);">Voice Journal Complete!</h4>
                    <p style="font-size:13px;color:var(--color-text-muted);margin:0;">Here's your structured reflection summary:</p>
                  </div>

                  <div style="background:var(--color-cream);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:14px;">
                    <div>
                      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--color-text-muted);display:block;margin-bottom:6px;">Your Words:</span>
                      <p style="font-size:14px;color:var(--color-charcoal);margin:0;line-height:1.6;font-style:italic;">"${escapeHtml(voiceMirrorTranscript || 'No speech detected.')}"</p>
                    </div>
                    <div style="height:1px;background:var(--color-border);"></div>
                    <div id="vm-analysis-block">
                      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--color-text-muted);display:block;margin-bottom:8px;">Reflection Analysis:</span>
                      <div style="display:flex;flex-direction:column;gap:8px;" id="vm-analysis-content">
                        <!-- Filled by window.renderVoiceMirrorAnalysis() -->
                      </div>
                    </div>
                  </div>

                  <div style="display:flex;justify-content:space-between;gap:12px;">
                    <button onclick="window.resetVoiceMirror()" class="btn secondary" style="border-radius:12px;flex:1;">Record Again</button>
                    <button onclick="window.closeReflectiveTool()" class="btn primary" style="background:#10b981;border:none;border-radius:12px;flex:1;">Done</button>
                  </div>
                  <p style="font-size:11px;color:var(--color-text-muted);text-align:center;margin:0;"><em>Disclaimer: This is a reflective exercise for personal self-awareness only, not a clinical assessment.</em></p>
                </div>
              ` : ''}

            </div>
          </div>
        </div>
      ` : ''}
    `;
  }

  if (tab === 'timeline') {
    const events = (state && state.lifeMapEvents) || [
      { id: 1, title: "Graduated College", year: "2020", category: "Achievement", impact: "positive", note: "Felt empowered and confident about career prospects." },
      { id: 2, title: "Relocated to New City", year: "2022", category: "Transition", impact: "neutral", note: "Initial anxiety mixed with excitement of independence." },
      { id: 3, title: "Started MindHeal Wellness Journey", year: "2024", category: "Self-care", impact: "positive", note: "Consistent CBT reflection and mood tracking." }
    ];

    const isModalOpen = state && state.showAddLifeEventModal;

    return html`
      <div class="dashboard-card" style="padding:32px;background:white;border-radius:24px;display:flex;flex-direction:column;gap:24px;border:1px solid var(--color-border);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
          <div>
            <h2 style="font-family:var(--font-serif);font-size:26px;margin:0 0 6px 0;color:var(--color-charcoal);">My Life Map & Timeline</h2>
            <p style="color:var(--color-text-muted);font-size:14px;margin:0;">Understand how major life transitions, achievements, and relationships map to your emotional wellbeing.</p>
          </div>
          <button class="btn primary" onclick="window.toggleAddLifeEventModal(true)" style="display:flex;align-items:center;gap:8px;background:var(--color-coral);border-radius:999px;">
            <i class="ph-bold ph-plus-circle" style="font-size:18px;"></i> Add Life Event
          </button>
        </div>

        <!-- Timeline Graphic Visualization -->
        <div style="position:relative;padding:24px 0 24px 32px;border-left:3px dashed var(--color-coral);margin-left:12px;display:flex;flex-direction:column;gap:28px;">
          ${events.map(item => `
            <div style="position:relative;background:linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(253,248,246,1) 100%);border:1px solid var(--color-border);border-radius:16px;padding:20px;box-shadow:0 4px 14px rgba(0,0,0,0.03);display:flex;flex-direction:column;gap:8px;">
              <div style="position:absolute;left:-44px;top:22px;width:20px;height:20px;border-radius:50%;background:var(--color-coral);border:4px solid white;box-shadow:0 0 0 2px var(--color-coral);"></div>
              
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="font-size:12px;font-weight:800;background:rgba(224,106,78,0.1);color:var(--color-coral);padding:4px 10px;border-radius:8px;">${escapeHtml(item.year)}</span>
                  <strong style="font-size:17px;color:var(--color-charcoal);">${escapeHtml(item.title)}</strong>
                </div>
                <span class="status-pill ${item.impact === 'positive' ? 'success' : item.impact === 'challenging' ? 'danger' : 'warning'}" style="font-size:11px;text-transform:capitalize;">
                  ${item.category} • ${item.impact}
                </span>
              </div>
              
              ${item.note ? `<p style="font-size:13px;color:var(--color-text-muted);margin:4px 0 0 0;line-height:1.5;">${escapeHtml(item.note)}</p>` : ''}
            </div>
          `).join("")}
        </div>

        <!-- Add Event Modal Overlay -->
        ${isModalOpen ? html`
          <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:1100;padding:20px;">
            <div class="dashboard-card" style="width:100%;max-width:520px;background:white;border-radius:24px;padding:32px;display:flex;flex-direction:column;gap:20px;box-shadow:var(--shadow-3);position:relative;">
              <button onclick="window.toggleAddLifeEventModal(false)" style="position:absolute;top:20px;right:20px;background:transparent;border:none;font-size:22px;color:var(--color-text-muted);cursor:pointer;">
                <i class="ph ph-x"></i>
              </button>
              
              <h3 style="font-family:var(--font-serif);font-size:22px;margin:0;color:var(--color-charcoal);display:flex;align-items:center;gap:10px;">
                <i class="ph-bold ph-path" style="color:var(--color-coral);"></i> Log New Life Event
              </h3>
              
              <form onsubmit="window.handleAddLifeEventSubmit(event)" style="display:flex;flex-direction:column;gap:16px;">
                <div class="field">
                  <label for="event-title">Event Title</label>
                  <input id="event-title" name="title" placeholder="e.g. Started New Job, Marriage, Loss" required style="width:100%;" />
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                  <div class="field">
                    <label for="event-year">Year / Date</label>
                    <input id="event-year" name="year" placeholder="e.g. 2024" required style="width:100%;" />
                  </div>
                  <div class="field">
                    <label for="event-category">Category</label>
                    <select id="event-category" name="category" required style="width:100%;">
                      <option value="Transition">Transition</option>
                      <option value="Achievement">Achievement</option>
                      <option value="Relationship">Relationship</option>
                      <option value="Loss/Challenge">Loss/Challenge</option>
                      <option value="Self-care">Self-care</option>
                    </select>
                  </div>
                </div>
                <div class="field">
                  <label for="event-impact">Emotional Impact</label>
                  <select id="event-impact" name="impact" required style="width:100%;">
                    <option value="positive">Positive Growth</option>
                    <option value="neutral">Neutral Transition</option>
                    <option value="challenging">Challenging / Stressful</option>
                  </select>
                </div>
                <div class="field">
                  <label for="event-note">Reflection Notes</label>
                  <textarea id="event-note" name="note" placeholder="How did this event affect your emotional wellbeing?" rows="3" style="width:100%;"></textarea>
                </div>
                
                <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:8px;">
                  <button type="button" class="btn secondary" onclick="window.toggleAddLifeEventModal(false)">Cancel</button>
                  <button type="submit" class="btn primary" style="background:var(--color-coral);">Save to Life Map</button>
                </div>
              </form>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  if (tab === 'earn') {
    return html`
      <div class="dashboard-card" style="padding:32px;background:white;border-radius:16px;display:flex;flex-direction:column;gap:20px;">
        <h2 style="font-family:var(--font-serif);font-size:24px;margin:0;">Earn AI Credits</h2>
        <p style="color:var(--color-text-muted);font-size:14px;margin:0;">Complete healthy onboarding and self-reflection milestones to earn usage credits.</p>

        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;border:1px solid var(--color-border);border-radius:12px;">
            <div>
              <strong style="display:block;font-size:15px;">Complete Profile Preferences</strong>
              <span style="font-size:13px;color:var(--color-text-muted);">Set language and wellness goals</span>
            </div>
            <button class="btn secondary" onclick="toast('Earned 5 AI Credits!')">+5 Credits</button>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;border:1px solid var(--color-border);border-radius:12px;">
            <div>
              <strong style="display:block;font-size:15px;">First 60s Wellness Scan</strong>
              <span style="font-size:13px;color:var(--color-text-muted);">Complete your first reflection scan</span>
            </div>
            <button class="btn secondary" onclick="toast('Earned 10 AI Credits!')">+10 Credits</button>
          </div>
        </div>
      </div>
    `;
  }

  return "";
}

window.switchInsightLabTab = function(tab) {
  if (window.currentAppState) {
    window.currentAppState.insightLabTab = tab;
  }
  if (typeof window.triggerAppRender === "function") {
    window.triggerAppRender();
  }
};

window.handleWellnessScanSubmit = function(e) {
  e.preventDefault();
  const resultDiv = document.getElementById("wellness-scan-result");
  if (!resultDiv) return;

  resultDiv.style.display = "block";
  resultDiv.innerHTML = `
    <h3 style="font-family:var(--font-serif);font-size:18px;margin:0 0 8px 0;color:var(--color-charcoal);">Reflection Summary</h3>
    <p style="font-size:14px;margin:0 0 12px 0;">Based on your responses, your current stress is moderate with subtle sleep restlessness.</p>
    <div style="display:flex;gap:12px;align-items:center;">
      <span class="status-pill success">Going well: High self-awareness</span>
      <span class="status-pill warning">Focus area: Sleep hygiene</span>
    </div>
    <p style="font-size:12px;color:var(--color-text-muted);margin-top:12px;"><em>Disclaimer: This output is for personal self-reflection and care navigation only. It is not a clinical diagnosis.</em></p>
  `;
  toast("Wellness Scan completed. 2 AI Credits deducted.");
};



window.openCreditRechargeModal = function() {
  toast("AI Credit Recharge modal opened. Select pack to top-up.");
};

window.toggleAddLifeEventModal = function(show) {
  if (window.currentAppState) {
    window.currentAppState.showAddLifeEventModal = show;
  }
  if (typeof window.triggerAppRender === "function") {
    window.triggerAppRender();
  }
};

window.handleAddLifeEventSubmit = function(e) {
  e.preventDefault();
  const form = e.target;
  const title = form.title.value;
  const year = form.year.value;
  const category = form.category.value;
  const impact = form.impact.value;
  const note = form.note.value;

  if (!window.currentAppState.lifeMapEvents) {
    window.currentAppState.lifeMapEvents = [
      { id: 1, title: "Graduated College", year: "2020", category: "Achievement", impact: "positive", note: "Felt empowered and confident about career prospects." },
      { id: 2, title: "Relocated to New City", year: "2022", category: "Transition", impact: "neutral", note: "Initial anxiety mixed with excitement of independence." },
      { id: 3, title: "Started MindHeal Wellness Journey", year: "2024", category: "Self-care", impact: "positive", note: "Consistent CBT reflection and mood tracking." }
    ];
  }

  const newEvent = {
    id: Date.now(),
    title,
    year,
    category,
    impact,
    note
  };

  window.currentAppState.lifeMapEvents.push(newEvent);
  window.currentAppState.showAddLifeEventModal = false;
  toast("New Life Event saved to Life Map & Timeline!");
  
  if (typeof window.triggerAppRender === "function") {
    window.triggerAppRender();
  }
};

// ═══════════════════════════════════════════════
// REFLECTIVE TOOLS — Shared Modal Management
// ═══════════════════════════════════════════════

window.openReflectiveTool = function(toolId) {
  if (!window.currentAppState) return;
  window.currentAppState.reflectiveToolOpen = toolId;
  // Reset tool state when opening
  if (toolId === 'thought-mirror') {
    window.currentAppState.thoughtMirrorStep = 0;
    window.currentAppState.thoughtMirrorData = {};
  }
  if (toolId === 'voice-mirror') {
    window.currentAppState.voiceMirrorPhase = 'idle';
    window.currentAppState.voiceMirrorTranscript = '';
  }
  if (typeof window.triggerAppRender === "function") window.triggerAppRender();
};

window.closeReflectiveTool = function() {
  if (!window.currentAppState) return;
  // Stop any active voice recording
  if (window._vmRecognition) {
    try { window._vmRecognition.stop(); } catch(e) {}
    window._vmRecognition = null;
  }
  if (window._vmTimerInterval) {
    clearInterval(window._vmTimerInterval);
    window._vmTimerInterval = null;
  }
  window.currentAppState.reflectiveToolOpen = null;
  window.currentAppState.voiceMirrorPhase = 'idle';
  if (typeof window.triggerAppRender === "function") window.triggerAppRender();
};

// ═══════════════════════════════════════════════
// THOUGHT MIRROR — CBT Reframing (4-Step)
// ═══════════════════════════════════════════════

window.toggleDistortionCard = function(checkbox) {
  const label = checkbox.closest('label');
  if (!label) return;
  if (checkbox.checked) {
    label.style.background = 'rgba(224,106,78,0.07)';
    label.style.borderColor = 'var(--color-coral)';
  } else {
    label.style.background = '';
    label.style.borderColor = '';
  }
};

window.thoughtMirrorNext = function(currentStep) {
  const state = window.currentAppState;
  if (!state) return;
  if (!state.thoughtMirrorData) state.thoughtMirrorData = {};

  if (currentStep === 0) {
    const thoughtEl = document.getElementById('tm-thought');
    const beliefEl = document.getElementById('tm-belief');
    if (!thoughtEl || !thoughtEl.value.trim()) {
      toast('Please write your automatic thought first.', 'error');
      return;
    }
    state.thoughtMirrorData.thought = thoughtEl.value.trim();
    state.thoughtMirrorData.beliefBefore = beliefEl ? parseInt(beliefEl.value) : 50;
  }

  if (currentStep === 1) {
    const checked = Array.from(document.querySelectorAll('input[name="distortion"]:checked'));
    state.thoughtMirrorData.distortions = checked.map(c => c.value);
  }

  if (currentStep === 2) {
    state.thoughtMirrorData.evidenceFor = document.getElementById('tm-evidence-for')?.value?.trim() || '';
    state.thoughtMirrorData.evidenceAgainst = document.getElementById('tm-evidence-against')?.value?.trim() || '';
    state.thoughtMirrorData.friendAdvice = document.getElementById('tm-friend-advice')?.value?.trim() || '';
  }

  state.thoughtMirrorStep = currentStep + 1;
  if (typeof window.triggerAppRender === "function") window.triggerAppRender();
};

window.thoughtMirrorBack = function() {
  const state = window.currentAppState;
  if (!state || state.thoughtMirrorStep <= 0) return;
  state.thoughtMirrorStep = state.thoughtMirrorStep - 1;
  if (typeof window.triggerAppRender === "function") window.triggerAppRender();
};

window.thoughtMirrorSubmit = function() {
  const state = window.currentAppState;
  if (!state || !state.thoughtMirrorData) return;

  const reframeEl = document.getElementById('tm-reframe');
  const beliefAfterEl = document.getElementById('tm-belief-after');
  if (!reframeEl || !reframeEl.value.trim()) {
    toast('Please write your balanced reframed thought.', 'error');
    return;
  }
  state.thoughtMirrorData.reframe = reframeEl.value.trim();
  state.thoughtMirrorData.beliefAfter = beliefAfterEl ? parseInt(beliefAfterEl.value) : 30;
  state.thoughtMirrorData.savedAt = new Date().toISOString();

  // Persist to localStorage
  try {
    const existing = JSON.parse(localStorage.getItem('mindheal-thought-mirror-sessions') || '[]');
    existing.unshift(state.thoughtMirrorData);
    localStorage.setItem('mindheal-thought-mirror-sessions', JSON.stringify(existing.slice(0, 20)));
  } catch(e) {}

  const beliefDrop = (state.thoughtMirrorData.beliefBefore || 50) - (state.thoughtMirrorData.beliefAfter || 30);
  toast(`Reflection saved! Belief in that thought dropped by ${Math.max(0, beliefDrop)}%.`);

  state.reflectiveToolOpen = null;
  state.thoughtMirrorStep = 0;
  state.thoughtMirrorData = {};
  if (typeof window.triggerAppRender === "function") window.triggerAppRender();
};

// ═══════════════════════════════════════════════
// UNSENT LETTERS — Private Local Letter Writing
// ═══════════════════════════════════════════════

window.saveUnsentLetter = function(e) {
  e.preventDefault();
  const form = e.target;
  const state = window.currentAppState;

  const letter = {
    id: Date.now(),
    recipient: form.recipient.value.trim(),
    category: form.category.value,
    subject: form.subject ? form.subject.value.trim() : '',
    body: form.body.value.trim(),
    savedAt: new Date().toISOString()
  };

  if (!state.unsentLetters) state.unsentLetters = [];
  state.unsentLetters.unshift(letter);

  // Persist to localStorage (never transmitted)
  try {
    localStorage.setItem('mindheal-unsent-letters', JSON.stringify(state.unsentLetters));
  } catch(e) {}

  state.reflectiveToolOpen = null;
  toast('Letter saved privately to your device only. 🔒');
  if (typeof window.triggerAppRender === "function") window.triggerAppRender();
};

window.deleteUnsentLetter = function(index) {
  const state = window.currentAppState;
  if (!state || !state.unsentLetters) return;
  state.unsentLetters.splice(index, 1);
  try {
    localStorage.setItem('mindheal-unsent-letters', JSON.stringify(state.unsentLetters));
  } catch(e) {}
  toast('Letter deleted permanently.');
  if (typeof window.triggerAppRender === "function") window.triggerAppRender();
};

// Load saved letters from localStorage into state on first load
(function loadSavedLetters() {
  try {
    const saved = JSON.parse(localStorage.getItem('mindheal-unsent-letters') || '[]');
    if (saved.length > 0 && window.currentAppState && !window.currentAppState.unsentLetters) {
      window.currentAppState.unsentLetters = saved;
    }
  } catch(e) {}
})();

// ═══════════════════════════════════════════════
// VOICEMIRROR — Web Speech API 60s Journal
// ═══════════════════════════════════════════════

window.startVoiceMirror = function() {
  const state = window.currentAppState;
  if (!state) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    toast('VoiceMirror requires a browser with Speech Recognition support (Chrome recommended).', 'error');
    return;
  }

  state.voiceMirrorPhase = 'recording';
  state.voiceMirrorTranscript = '';
  if (typeof window.triggerAppRender === "function") window.triggerAppRender();

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-IN';
  window._vmRecognition = recognition;

  let finalTranscript = '';
  let elapsedSeconds = 0;
  const LIMIT = 60;

  recognition.onresult = function(event) {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += t + ' ';
      else interim = t;
    }
    const full = (finalTranscript + interim).trim();
    state.voiceMirrorTranscript = full;
    const liveEl = document.getElementById('vm-live-text');
    if (liveEl) liveEl.textContent = full || 'Listening...';
  };

  recognition.onerror = function(event) {
    if (event.error !== 'aborted') {
      toast('Microphone error: ' + event.error, 'error');
      window.stopVoiceMirror();
    }
  };

  recognition.start();

  // Start countdown timer
  window._vmTimerInterval = setInterval(() => {
    elapsedSeconds++;
    const remaining = LIMIT - elapsedSeconds;
    const timerEl = document.getElementById('vm-timer-display');
    const progressEl = document.getElementById('vm-progress-bar');
    if (timerEl) timerEl.textContent = `0:${remaining.toString().padStart(2, '0')}`;
    if (progressEl) progressEl.style.width = `${(elapsedSeconds / LIMIT) * 100}%`;
    if (elapsedSeconds >= LIMIT) {
      window.stopVoiceMirror();
    }
  }, 1000);
};

window.stopVoiceMirror = function() {
  const state = window.currentAppState;

  if (window._vmTimerInterval) {
    clearInterval(window._vmTimerInterval);
    window._vmTimerInterval = null;
  }
  if (window._vmRecognition) {
    try { window._vmRecognition.stop(); } catch(e) {}
    window._vmRecognition = null;
  }

  if (state) {
    state.voiceMirrorPhase = 'result';
    if (typeof window.triggerAppRender === "function") window.triggerAppRender();

    // Render analysis after DOM updates
    setTimeout(() => window.renderVoiceMirrorAnalysis(state.voiceMirrorTranscript || ''), 150);
  }
};

window.resetVoiceMirror = function() {
  const state = window.currentAppState;
  if (!state) return;
  state.voiceMirrorPhase = 'idle';
  state.voiceMirrorTranscript = '';
  if (typeof window.triggerAppRender === "function") window.triggerAppRender();
};

window.renderVoiceMirrorAnalysis = function(transcript) {
  const container = document.getElementById('vm-analysis-content');
  if (!container) return;

  const text = (transcript || '').toLowerCase();
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  // Heuristic emotion detection
  const emotions = [];
  if (/\b(anxious|worry|worried|nervous|scared|fear|stress|panic)\b/.test(text)) emotions.push({ label: 'Anxiety / Worry', color: '#f59e0b', icon: 'ph-warning' });
  if (/\b(sad|depress|low|hopeless|empty|grief|cry|tears)\b/.test(text)) emotions.push({ label: 'Sadness / Low Mood', color: '#6366f1', icon: 'ph-cloud-rain' });
  if (/\b(angry|frustrat|annoy|rage|furious|irritat)\b/.test(text)) emotions.push({ label: 'Frustration / Anger', color: '#ef4444', icon: 'ph-lightning' });
  if (/\b(happy|grateful|joy|excit|positive|love|hope|better|good)\b/.test(text)) emotions.push({ label: 'Positivity / Gratitude', color: '#10b981', icon: 'ph-sun' });
  if (/\b(tired|exhaust|overwhelm|burden|heavy|drain|burnout)\b/.test(text)) emotions.push({ label: 'Exhaustion / Overwhelm', color: '#8b5cf6', icon: 'ph-battery-low' });
  if (emotions.length === 0) emotions.push({ label: 'Neutral / Reflective', color: '#6b7280', icon: 'ph-brain' });

  // Themes detection
  const themes = [];
  if (/\b(work|job|boss|colleague|office|career|project)\b/.test(text)) themes.push('Work & Career');
  if (/\b(family|parent|mom|dad|sibling|child|relationship|partner)\b/.test(text)) themes.push('Relationships & Family');
  if (/\b(health|sleep|body|pain|eat|exercise|rest)\b/.test(text)) themes.push('Health & Wellbeing');
  if (/\b(money|finance|bill|debt|afford|spend)\b/.test(text)) themes.push('Financial Stress');
  if (/\b(future|goal|plan|dream|hope|change|growth)\b/.test(text)) themes.push('Goals & Future');
  if (/\b(myself|self|feel|think|mind|thought|inner)\b/.test(text)) themes.push('Self-Reflection');
  if (themes.length === 0) themes.push('General Wellbeing');

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:12px;font-weight:600;color:var(--color-text-muted);">Detected emotions:</span>
        ${emotions.map(e => `
          <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:${e.color}18;border:1px solid ${e.color}40;font-size:12px;font-weight:600;color:${e.color};">
            <i class="ph-bold ${e.icon}"></i> ${e.label}
          </span>
        `).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:12px;font-weight:600;color:var(--color-text-muted);">Key themes:</span>
        ${themes.map(t => `<span class="status-pill info" style="font-size:11px;">${t}</span>`).join('')}
      </div>
      <div style="display:flex;gap:16px;margin-top:4px;">
        <div style="text-align:center;">
          <strong style="font-size:22px;color:var(--color-charcoal);">${wordCount}</strong>
          <span style="font-size:11px;color:var(--color-text-muted);display:block;">Words spoken</span>
        </div>
        <div style="text-align:center;">
          <strong style="font-size:22px;color:var(--color-charcoal);">${emotions.length}</strong>
          <span style="font-size:11px;color:var(--color-text-muted);display:block;">Emotions found</span>
        </div>
        <div style="text-align:center;">
          <strong style="font-size:22px;color:var(--color-charcoal);">${themes.length}</strong>
          <span style="font-size:11px;color:var(--color-text-muted);display:block;">Themes identified</span>
        </div>
      </div>
    </div>
  `;
  toast('Voice journal analysed. 2 AI Credits deducted.');
};
