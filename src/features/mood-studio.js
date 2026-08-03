import { escapeHtml, html } from "../utils/dom.js";

const MOOD_POINTS = [
  [1, "ph-cloud-rain", "Heavy"],
  [3, "ph-waves", "Tender"],
  [5, "ph-leaf", "Steady"],
  [7, "ph-sun-horizon", "Bright"],
  [10, "ph-rocket-launch", "Expansive"]
];

const FACTORS = [
  ["energy", "ph-coffee", "Energy"],
  ["people", "ph-users-three", "People"],
  ["sleep", "ph-bed", "Sleep"],
  ["space", "ph-tree", "Space"]
];

// Generated in Magnific for the Mood Studio concept and saved locally to avoid signed-CDN expiry.
const MOOD_STUDIO_ART = "assets/images/magnific-mood-studio.png";

export function renderMoodStudio({ dashboard, data }) {
  const moodState = getMoodStudioState({ dashboard, data });

  return html`
    <form class="dashboard-card span-12 mood-studio" data-form="mood" style="--mood-level:${moodState.baseScore};">
      <input type="hidden" id="moodScore" name="score" value="${moodState.baseScore}" />
      ${FACTORS.map(([key,, label]) => `
        <input type="checkbox" name="factor_${key}" id="factor_${key}" style="display: none;" ${moodState.activeFactors.includes(label) ? "checked" : ""} />
      `).join("")}

      <div class="mood-studio-header">
        <div>
          <h3><i class="ph-fill ph-sparkle"></i> Mood Studio</h3>
          <p>Map today as a signal, not a scorecard.</p>
        </div>
        <div class="mood-orb" aria-hidden="true">
          <img src="${MOOD_STUDIO_ART}" alt="" />
          <span>${moodState.baseScore}</span>
        </div>
      </div>

      <div class="mood-intensity-card">
        <div class="mood-spectrum" aria-label="Choose mood intensity">
          ${MOOD_POINTS.map(([score, icon, label]) => `
            <button class="mood-chip ${moodState.anchorScore === score ? "active" : ""}" type="button" data-action="set-mood-score" data-score="${score}" aria-label="${score} out of 10: ${label}">
              <i class="ph-fill ${icon}"></i>
              <strong>${score}</strong>
              <span>${label}</span>
            </button>
          `).join("")}
        </div>

        <div class="mood-intensity-control">
          <div class="mood-intensity-header">
            <label for="moodIntensity"><i class="ph-fill ph-sliders-horizontal"></i> Intensity dial</label>
            <output for="moodIntensity" data-role="mood-output">${moodState.baseScore}/10</output>
          </div>
          <input id="moodIntensity" type="range" min="1" max="10" step="1" value="${moodState.baseScore}" data-role="mood-slider" aria-label="Mood intensity from 1 to 10" />
          <div class="mood-scale" aria-hidden="true">
            ${Array.from({ length: 10 }, (_, index) => `<span>${index + 1}</span>`).join("")}
          </div>
        </div>
      </div>

      <div class="mood-infographic" aria-hidden="true">
        <div class="mood-wave-container">
          ${renderMoodBars(moodState.graphPoints)}
        </div>
        <div class="mood-infographic-right">
          <div class="mood-compass">
            ${renderCompassRow("ph-brain", "Mind", moodState.mindPercent, "var(--color-coral)")}
            ${renderCompassRow("ph-heartbeat", "Body", moodState.bodyPercent, "#2b6cb0")}
            ${renderCompassRow("ph-moon-stars", "Rest", moodState.restPercent, "#805ad5")}
          </div>

          <div class="mood-prompt-section">
            <label class="studio-sub-label">Context Factors</label>
            <div class="mood-prompt-row">
              ${FACTORS.map(([key, icon, label]) => `
                <button class="prompt-chip ${moodState.activeFactors.includes(label) ? "active" : ""}" type="button" data-action="toggle-mood-factor" data-factor="${key}">
                  <i class="ph ${icon}"></i> ${label}
                </button>
              `).join("")}
            </div>
          </div>
        </div>
      </div>

      <div class="field mood-note-field">
        <label for="moodNote">What shifted the signal?</label>
        <textarea id="moodNote" name="note" placeholder="A meeting, a memory, a walk, a win..." rows="3"></textarea>
      </div>
      <button class="btn primary mood-save-btn" type="submit"><i class="ph-bold ph-check-circle"></i> Save Mood</button>
    </form>
  `;
}

export function bindMoodStudioForm(form, { api, getFormData, toast, render }) {
  form.querySelectorAll("[data-action='set-mood-score']").forEach((button) => {
    button.addEventListener("click", () => {
      const score = Number(button.dataset.score || 5);
      updateMoodScore(form, score);
      updateRealtimeMetrics(form);
      pulseMoodStudio(form);
    });
  });

  const slider = form.querySelector("[data-role='mood-slider']");
  slider?.addEventListener("input", () => {
    updateMoodScore(form, Number(slider.value || 5));
    updateRealtimeMetrics(form);
  });
  slider?.addEventListener("change", () => {
    pulseMoodStudio(form);
  });

  form.querySelectorAll("[data-action='toggle-mood-factor']").forEach((button) => {
    button.addEventListener("click", () => {
      const input = form.querySelector(`#factor_${button.dataset.factor}`);
      if (!input) return;
      input.checked = !input.checked;
      button.classList.toggle("active", input.checked);
      updateRealtimeMetrics(form);
      pulseMoodStudio(form);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = createMoodLogPayload(getFormData(form));

    try {
      await api.logMood(payload);
      toast("Mood saved.");
      form.classList.add("is-saved");
      const note = form.querySelector("textarea[name='note']");
      if (note) note.value = "";
      form.querySelectorAll(".prompt-chip").forEach((chip) => chip.classList.remove("active"));
      form.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
        checkbox.checked = false;
      });

      setTimeout(async () => {
        form.classList.remove("is-saved");
        await render();
      }, 650);
    } catch (error) {
      toast(error.message || "Mood log failed.", "error");
    }
  });
}

function getMoodStudioState({ dashboard, data }) {
  const baseScore = Number(dashboard.moodScore || 5);
  const latestMood = data.moodHistory && data.moodHistory.length ? data.moodHistory[data.moodHistory.length - 1] : null;
  const latestParsed = latestMood ? parseMoodNote(latestMood.note) : { factors: [] };
  const activeFactors = latestParsed.factors;

  return {
    baseScore,
    anchorScore: nearestMoodPoint(baseScore),
    activeFactors,
    restPercent: metricPercent((activeFactors.includes("Sleep") ? 85 : 60) + (baseScore - 5) * 4),
    mindPercent: metricPercent(((activeFactors.includes("People") || activeFactors.includes("Space")) ? 80 : 65) + (baseScore - 5) * 3),
    bodyPercent: metricPercent((activeFactors.includes("Energy") ? 78 : 55) + (baseScore - 5) * 5),
    graphPoints: getMoodGraphPoints(baseScore, data.moodHistory || [])
  };
}

export function parseMoodNote(noteStr) {
  const match = (noteStr || "").match(/^\[Factors:\s*([^\]]+)\]\s*(.*)$/);
  return match ? {
    factors: match[1].split(",").map((factor) => factor.trim()),
    cleanNote: match[2]
  } : {
    factors: [],
    cleanNote: noteStr || ""
  };
}

function getMoodGraphPoints(baseScore, moodHistory) {
  const graphPoints = [
    { label: "M", score: 6 },
    { label: "T", score: 8 },
    { label: "W", score: 5 },
    { label: "T", score: 9 },
    { label: "Today", score: baseScore }
  ];
  const sortedLogs = [...moodHistory].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-5);

  for (let i = 0; i < sortedLogs.length; i += 1) {
    const log = sortedLogs[sortedLogs.length - 1 - i];
    const targetIdx = graphPoints.length - 1 - i;
    if (targetIdx >= 0) {
      graphPoints[targetIdx].score = Number(log.score);
      if (targetIdx < graphPoints.length - 1) {
        graphPoints[targetIdx].label = new Date(log.createdAt).toLocaleDateString("en-US", { weekday: "narrow" });
      }
    }
  }

  return graphPoints;
}

function renderMoodBars(graphPoints) {
  const positions = [60, 135, 210, 285, 360];
  const labels = [69, 144, 219, 294, 369];
  const gradients = ["bar1Grad", "bar2Grad", "bar3Grad", "bar4Grad", "barActiveGrad"];

  return html`
    <svg class="mood-wave-svg" viewBox="0 0 420 220">
      <defs>
        ${renderGradient("bar1Grad", "#4a5568", "0.8")}
        ${renderGradient("bar2Grad", "#319795", "0.8")}
        ${renderGradient("bar3Grad", "#48bb78", "0.8")}
        ${renderGradient("bar4Grad", "#dd6b20", "0.8")}
        ${renderGradient("barActiveGrad", "var(--color-coral)", "0.95")}
      </defs>
      <text x="22" y="33" text-anchor="end" font-size="9" font-family="var(--font-sans)" font-weight="600" fill="#a0aec0">10</text>
      <text x="22" y="103" text-anchor="end" font-size="9" font-family="var(--font-sans)" font-weight="600" fill="#a0aec0">5</text>
      <text x="22" y="173" text-anchor="end" font-size="9" font-family="var(--font-sans)" font-weight="600" fill="#a0aec0">0</text>
      ${[30, 100, 170].map((y) => `<line x1="30" y1="${y}" x2="400" y2="${y}" stroke="rgba(0,0,0,0.03)" stroke-width="1" stroke-dasharray="3" />`).join("")}
      ${graphPoints.map((point, index) => renderMoodBar({
        point,
        index,
        x: positions[index],
        labelX: labels[index],
        gradientId: gradients[index],
        isActive: index === graphPoints.length - 1
      })).join("")}
    </svg>
  `;
}

function renderGradient(id, color, opacity) {
  return `
    <linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.1"></stop>
      <stop offset="100%" stop-color="${color}" stop-opacity="${opacity}"></stop>
    </linearGradient>
  `;
}

function renderMoodBar({ point, index, x, labelX, gradientId, isActive }) {
  const height = Number(point.score) * 14;
  const y = 170 - height;
  const hitboxX = x - 10;
  const tooltipX = x - 4;
  const textX = x + 9;
  const labelColor = isActive ? "var(--color-coral)" : "#a0aec0";

  return `
    <g class="chart-bar-group ${isActive ? "active" : ""}">
      <rect class="chart-bar-hitbox" x="${hitboxX}" y="20" width="38" height="150" fill="transparent" />
      <rect class="chart-bar bar-day-${index + 1}" x="${x}" y="${y}" width="18" height="${height}" rx="9" fill="url(#${gradientId})" ${isActive ? `filter="drop-shadow(0 2px 8px rgba(224, 106, 78, 0.15))"` : ""} />
      <g class="chart-bar-tooltip">
        <rect class="tooltip-bg" x="${tooltipX}" y="${y - 24}" width="26" height="18" rx="5" fill="${isActive ? "var(--color-coral)" : "#1e1e24"}" />
        <text class="tooltip-text" x="${textX}" y="${y - 12}" text-anchor="middle" fill="white" font-size="9" font-family="var(--font-sans)" font-weight="700">${point.score}</text>
      </g>
      <text x="${labelX}" y="196" text-anchor="middle" font-size="10" font-family="var(--font-sans)" font-weight="${isActive ? "700" : "600"}" fill="${labelColor}">${escapeHtml(point.label)}</text>
    </g>
  `;
}

function renderCompassRow(icon, label, percent, color) {
  return `
    <div class="compass-row">
      <span class="compass-label"><i class="ph-fill ${icon}"></i> ${label}</span>
      <div class="compass-bar-wrapper">
        <div class="compass-bar" style="width: ${percent}%; background: ${color};"></div>
      </div>
      <span class="compass-percent">${percent}%</span>
    </div>
  `;
}

function updateMoodScore(form, score) {
  const normalizedScore = clampMoodScore(score);
  const scoreInput = form.querySelector("input[name='score']");
  const slider = form.querySelector("[data-role='mood-slider']");
  const sliderOutput = form.querySelector("[data-role='mood-output']");
  const orbValue = form.querySelector(".mood-orb span");
  const todayBar = form.querySelector(".bar-day-5");
  const metricValue = document.querySelector(".mood-metric-value");

  if (scoreInput) scoreInput.value = String(normalizedScore);
  if (slider) slider.value = String(normalizedScore);
  if (sliderOutput) sliderOutput.textContent = `${normalizedScore}/10`;
  if (orbValue) orbValue.textContent = String(normalizedScore);
  if (metricValue) metricValue.textContent = `${normalizedScore}/10`;

  form.style.setProperty("--mood-level", normalizedScore);
  form.querySelectorAll(".mood-chip").forEach((chip) => {
    chip.classList.toggle("active", Number(chip.dataset.score) === nearestMoodPoint(normalizedScore));
  });
  updateTodayBar(todayBar, normalizedScore);
}

function updateTodayBar(todayBar, score) {
  if (!todayBar) return;
  const barHeight = score * 14;
  const barY = 170 - barHeight;
  todayBar.setAttribute("y", String(barY));
  todayBar.setAttribute("height", String(barHeight));

  const tooltipGroup = todayBar.parentNode.querySelector(".chart-bar-tooltip");
  const tooltipBg = tooltipGroup?.querySelector(".tooltip-bg");
  const tooltipText = tooltipGroup?.querySelector(".tooltip-text");
  if (tooltipBg) tooltipBg.setAttribute("y", String(barY - 24));
  if (tooltipText) {
    tooltipText.setAttribute("y", String(barY - 12));
    tooltipText.textContent = String(score);
  }
}

function updateRealtimeMetrics(form) {
  const currentScore = Number(form.querySelector("input[name='score']").value || 5);
  const values = [
    metricPercent(((isFactorActive(form, "people") || isFactorActive(form, "space")) ? 80 : 65) + (currentScore - 5) * 3),
    metricPercent((isFactorActive(form, "energy") ? 78 : 55) + (currentScore - 5) * 5),
    metricPercent((isFactorActive(form, "sleep") ? 85 : 60) + (currentScore - 5) * 4)
  ];

  form.querySelectorAll(".mood-compass .compass-row").forEach((row, index) => {
    const bar = row.querySelector(".compass-bar");
    const percent = row.querySelector(".compass-percent");
    if (bar) bar.style.width = `${values[index]}%`;
    if (percent) percent.textContent = `${values[index]}%`;
  });
}

function isFactorActive(form, factor) {
  return Boolean(form.querySelector(`#factor_${factor}`)?.checked);
}

function pulseMoodStudio(form) {
  form.classList.remove("is-pulsing");
  void form.offsetWidth;
  form.classList.add("is-pulsing");
}

export function createMoodLogPayload(payload) {
  const selectedFactors = FACTORS
    .filter(([key]) => payload[`factor_${key}`])
    .map(([, , label]) => label);
  const note = payload.note || "";
  const nextPayload = { ...payload, note: selectedFactors.length ? `[Factors: ${selectedFactors.join(", ")}] ${note}` : note };

  FACTORS.forEach(([key]) => {
    delete nextPayload[`factor_${key}`];
  });

  return nextPayload;
}

function metricPercent(value) {
  return Math.min(98, Math.max(20, value));
}

function clampMoodScore(score) {
  return Math.min(10, Math.max(1, Math.round(Number(score) || 5)));
}

function nearestMoodPoint(score) {
  return MOOD_POINTS.reduce((nearest, [point]) => {
    return Math.abs(point - score) < Math.abs(nearest - score) ? point : nearest;
  }, MOOD_POINTS[0][0]);
}
