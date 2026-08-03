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
    return html`
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:24px;">
        <div class="dashboard-card" style="padding:24px;background:white;border-radius:16px;display:flex;flex-direction:column;gap:12px;">
          <h3 style="font-family:var(--font-serif);font-size:18px;margin:0;"><i class="ph-bold ph-quotes" style="color:var(--color-coral);"></i> Thought Mirror</h3>
          <p style="font-size:13px;color:var(--color-text-muted);margin:0;">Reframe automatic thoughts and identify cognitive distortions.</p>
          <button class="btn secondary" onclick="toast('Thought Mirror session opened.')" style="margin-top:auto;">Reflect Now</button>
        </div>

        <div class="dashboard-card" style="padding:24px;background:white;border-radius:16px;display:flex;flex-direction:column;gap:12px;">
          <h3 style="font-family:var(--font-serif);font-size:18px;margin:0;"><i class="ph-bold ph-paper-plane-tilt" style="color:var(--color-coral);"></i> Unsent Letters</h3>
          <p style="font-size:13px;color:var(--color-text-muted);margin:0;">Express unsaid needs, boundaries, and closure in a safe, unshared space.</p>
          <button class="btn secondary" onclick="toast('Unsent Letters exercise opened.')" style="margin-top:auto;">Write Letter</button>
        </div>

        <div class="dashboard-card" style="padding:24px;background:white;border-radius:16px;display:flex;flex-direction:column;gap:12px;">
          <h3 style="font-family:var(--font-serif);font-size:18px;margin:0;"><i class="ph-bold ph-microphone" style="color:var(--color-coral);"></i> VoiceMirror</h3>
          <p style="font-size:13px;color:var(--color-text-muted);margin:0;">Speak freely for 60 seconds and receive a structured content summary.</p>
          <button class="btn secondary" onclick="toast('VoiceMirror initialized.')" style="margin-top:auto;">Speak Journal</button>
        </div>
      </div>
    `;
  }

  if (tab === 'timeline') {
    return html`
      <div class="dashboard-card" style="padding:32px;background:white;border-radius:16px;display:flex;flex-direction:column;gap:20px;">
        <h2 style="font-family:var(--font-serif);font-size:24px;margin:0;">My Life Map & Timeline</h2>
        <p style="color:var(--color-text-muted);font-size:14px;margin:0;">Understand how major life transitions, achievements, and relationships map to your emotional wellbeing.</p>
        <div style="background:var(--color-cream);padding:24px;border-radius:12px;text-align:center;">
          <i class="ph-bold ph-path" style="font-size:40px;color:var(--color-coral);margin-bottom:12px;"></i>
          <p style="margin:0 0 16px 0;font-weight:600;">Interactive Timeline Builder Active</p>
          <button class="btn primary" onclick="toast('Timeline event added to Life Map.')">Add Life Event</button>
        </div>
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
