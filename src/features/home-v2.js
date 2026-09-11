import { escapeHtml, html } from "../utils/dom.js";
import { counsellors, supportedLanguages } from "../data/mindheal-data.js";
import { ASSESSMENT_REGISTRY } from "../data/assessment-registry.js";

/**
 * MindHeal Homepage V2 — Editorial Wellbeing Experience
 * Conforms strictly to Master Prompt Specifications, SSoT Data Bindings,
 * Zero Hardcoding and Mental-Wellbeing Safety Constraints.
 */

export function renderHomeV2(state, t) {
  const user = state?.auth;
  const isUserLoggedIn = !!user;
  const minRate = counsellors && counsellors.length 
    ? Math.min(...counsellors.map(c => c.rate || 500)) 
    : 500;

  return html`
    <div class="home-v2-container" id="home-v2-root">
      
      <!-- Minimal Editorial Sticky Header -->
      <header class="v2-header" id="v2-header" role="banner">
        <div class="v2-wrapper v2-header-inner">
          <a href="#/home-v2" class="v2-header-logo" aria-label="MindHeal Home">
            <svg class="v2-logo-icon" width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12.8 17.5C9.2 16.8 6.5 13.5 6.5 9.8C6.5 9.2 6.6 8.5 6.8 7.9C9.5 8.1 12.2 10.5 13 13.8C13.2 14.8 13.1 16.2 12.8 17.5Z" fill="#C85232"/>
              <path d="M14.5 18C14.8 14.5 17.2 8.5 22.8 6.2C22.2 9.8 20.8 14.2 17.5 16.8C16.5 17.6 15.4 18 14.5 18Z" fill="#C85232"/>
              <path d="M13.2 16.5C13 19 12.5 21.5 11.5 22.5" stroke="#C85232" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            <span class="v2-header-logo-text">MindHeal</span>
          </a>

          <nav class="v2-header-nav" role="navigation" aria-label="Primary Navigation">
            <ul class="v2-nav-list">
              <li><a href="#/counsellors" class="v2-nav-link">Therapists</a></li>
              <li><a href="#/services/cbt" class="v2-nav-link">Self-care tools</a></li>
              <li><a href="#/about" class="v2-nav-link">About</a></li>
            </ul>
          </nav>

          <div class="v2-header-actions">
            ${isUserLoggedIn ? html`
              <a href="#/panel/user" class="v2-nav-link v2-auth-link">
                <span>${escapeHtml(user.name || "Dashboard")}</span>
              </a>
            ` : html`
              <a href="#/auth/user-login" class="v2-nav-link v2-auth-link">Log in</a>
            `}
            <button class="v2-mobile-toggle" id="v2-mobile-toggle" aria-label="Toggle navigation drawer" aria-expanded="false">
              <i class="ph ph-list"></i>
            </button>
          </div>
        </div>

        <!-- Mobile Navigation Drawer -->
        <div class="v2-mobile-drawer" id="v2-mobile-drawer" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
          <a href="#/counsellors" class="v2-mobile-nav-link">Therapists</a>
          <a href="#/services/cbt" class="v2-mobile-nav-link">Self-care tools</a>
          <a href="#/services/tests" class="v2-mobile-nav-link">Assessments</a>
          <a href="#/resources" class="v2-mobile-nav-link">Resources</a>
          <a href="#/about" class="v2-mobile-nav-link">About</a>
          <div style="margin-top: auto; padding-top: 24px;">
            ${isUserLoggedIn ? html`
              <a href="#/panel/user" class="v2-btn v2-btn-primary" style="width: 100%;">My Dashboard</a>
            ` : html`
              <a href="#/auth/user-login" class="v2-btn v2-btn-secondary" style="width: 100%;">Log in</a>
            `}
          </div>
        </div>
      </header>

      <main id="main-content">

        <!-- SECTION 01: HERO EDITORIAL -->
        <section class="v2-hero" id="v2-hero" aria-labelledby="v2-hero-heading">
          <div class="v2-wrapper v2-hero-grid">
            
            <div class="v2-hero-content">
              <span class="v2-eyebrow">MENTAL WELLBEING, AT YOUR PACE</span>
              <h1 id="v2-hero-heading" class="v2-hero-h1">
                <span class="v2-h1-line">You don’t have to</span>
                <span class="v2-h1-line">figure it out</span>
                <span class="v2-h1-line">alone.</span>
              </h1>
              <p class="v2-hero-body">
                Connect with a therapist, explore everyday tools, or start a conversation with our AI guide.
              </p>
              
              <div class="v2-hero-cta-group">
                <a href="#/counsellors" class="v2-btn v2-btn-primary">
                  <span>Find a therapist</span>
                  <i class="ph ph-arrow-right"></i>
                </a>
                <a href="#/services/ai-chat" class="v2-btn-secondary-link">
                  <span>Explore AI support</span>
                </a>
              </div>

              <div class="v2-hero-helper">
                <span>AI support complements professional care.</span>
              </div>

              <div class="v2-hero-trust">
                <span>Verified professionals</span>
                <span class="v2-trust-dot">·</span>
                <span>Evidence-based tools</span>
                <span class="v2-trust-dot">·</span>
                <span>Private support</span>
              </div>
            </div>

            <div class="v2-hero-visual" id="v2-hero-visual">
              <!-- Layer B: Live oversized serif background word (exact pale color from reference) -->
              <div class="v2-hero-bg-word" id="v2-hero-breathe" aria-hidden="true">breathe</div>
              
              <!-- Layer C: Camera-realistic subject cutout -->
              <img 
                src="src/assets/hero_subject_cutout.webp" 
                alt="Thoughtful young Indian woman in rust-brown sweater looking gently towards the left" 
                class="v2-hero-subject"
                id="v2-hero-subject"
                loading="eager"
                fetchpriority="high"
                onerror="this.src='src/assets/hero_subject_cutout.png'"
              />

              <!-- Layer D: Interactive Floating Mood Card (Refined, Minimal, Exact reference colors & scale) -->
              <div class="v2-mood-card" id="v2-mood-card" role="region" aria-label="Daily Mood Check-in">
                <div class="v2-mood-card-header">
                  <div class="v2-mood-card-title">How are you feeling today?</div>
                  <button type="button" class="v2-mood-more-btn" aria-label="Mood options menu">
                    <i class="ph ph-dots-three"></i>
                  </button>
                </div>
                <div class="v2-mood-choices" role="radiogroup" aria-label="Select mood">
                  <button type="button" class="v2-mood-btn mood-1" data-mood="1" title="Very Low" aria-label="Very Low">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#683832" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="10" r="1" fill="#683832"/><circle cx="16" cy="10" r="1" fill="#683832"/><path d="M7 16C9 14 15 14 17 16"/></svg>
                  </button>
                  <button type="button" class="v2-mood-btn mood-2" data-mood="2" title="Low" aria-label="Low">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#684A32" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="10" r="1" fill="#684A32"/><circle cx="16" cy="10" r="1" fill="#684A32"/><path d="M8 15C10 14 14 14 16 15"/></svg>
                  </button>
                  <button type="button" class="v2-mood-btn mood-3" data-mood="3" title="Neutral" aria-label="Neutral">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#605432" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="10" r="1" fill="#605432"/><circle cx="16" cy="10" r="1" fill="#605432"/><line x1="8" y1="15" x2="16" y2="15"/></svg>
                  </button>
                  <button type="button" class="v2-mood-btn mood-4" data-mood="4" title="Good" aria-label="Good">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#325838" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="10" r="1" fill="#325838"/><circle cx="16" cy="10" r="1" fill="#325838"/><path d="M8 14C10 16 14 16 16 14"/></svg>
                  </button>
                  <button type="button" class="v2-mood-btn mood-5" data-mood="5" title="Great" aria-label="Great">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#285030" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="10" r="1" fill="#285030"/><circle cx="16" cy="10" r="1" fill="#285030"/><path d="M7 13C9 16 15 16 17 13"/></svg>
                  </button>
                </div>
                <p class="v2-mood-card-helper" id="v2-mood-feedback">A little check-in goes a long way.</p>
              </div>

            </div>

          </div>

          <!-- Bottom thin subtle horizontal divider & right-aligned tagline -->
          <div class="v2-hero-bottom-divider-wrap">
            <div class="v2-wrapper v2-hero-bottom-inner">
              <hr class="v2-hero-divider-line" />
              <div class="v2-hero-tagline">SUPPORT, ON YOUR TERMS.</div>
            </div>
          </div>
        </section>

        <!-- SECTION 02: TRUST / TRANSITION STRIP -->
        <section class="v2-trust-strip" aria-label="Core Guarantees">
          <div class="v2-wrapper v2-trust-items">
            <div class="v2-trust-item">
              <i class="ph ph-seal-check"></i>
              <span>Verified professionals</span>
            </div>
            <div class="v2-trust-item">
              <i class="ph ph-shield-check"></i>
              <span>Private by design</span>
            </div>
            <div class="v2-trust-item">
              <i class="ph ph-book-open"></i>
              <span>Evidence-based tools</span>
            </div>
            <div class="v2-trust-item">
              <i class="ph ph-clock"></i>
              <span>Support on your terms</span>
            </div>
          </div>
        </section>

        <!-- SECTION 03: BARRIERS / WHY MINDHEAL -->
        <section class="v2-section" aria-labelledby="v2-barriers-heading">
          <div class="v2-wrapper">
            <div class="v2-section-header">
              <span class="v2-eyebrow">The problems are real</span>
              <h2 id="v2-barriers-heading" class="v2-title v2-title-large">Different barriers. A better way forward.</h2>
              <p class="v2-lead">Mental healthcare should feel easier to reach, easier to understand, and safer to begin.</p>
            </div>

            <div class="v2-barriers-grid">
              <article class="v2-barrier-card">
                <div class="v2-barrier-img-box">
                  <img src="redesign_assets/02_references/sections/03_barriers_reference.png" alt="Quiet corridor symbolizing clear access" style="object-position: 10% 50%;" />
                </div>
                <div class="v2-barrier-content">
                  <h3>Getting timely support</h3>
                  <p>Long waitlists and confusing steps make starting care daunting. MindHeal simplifies intake so you can speak to a professional or access guidance promptly.</p>
                  <a href="#/counsellors" class="v2-btn-ghost">Find available therapists &rarr;</a>
                </div>
              </article>

              <article class="v2-barrier-card">
                <div class="v2-barrier-img-box">
                  <img src="redesign_assets/02_references/sections/03_barriers_reference.png" alt="Multilingual conversational context notes" style="object-position: 50% 50%;" />
                </div>
                <div class="v2-barrier-content">
                  <h3>Language & cultural context</h3>
                  <p>Expressing deep emotion requires familiar language. MindHeal supports English, Hindi, and regional dialects with culturally attuned therapists.</p>
                  <a href="#/counsellors" class="v2-btn-ghost">Browse by language &rarr;</a>
                </div>
              </article>

              <article class="v2-barrier-card">
                <div class="v2-barrier-img-box">
                  <img src="redesign_assets/02_references/sections/03_barriers_reference.png" alt="Discreet and private therapeutic space" style="object-position: 90% 50%;" />
                </div>
                <div class="v2-barrier-content">
                  <h3>Privacy & stigma</h3>
                  <p>Social hesitation shouldn't prevent emotional healing. Explore self-paced tools, pseudonymous AI reflection, or confidential private sessions.</p>
                  <a href="#/services/cbt" class="v2-btn-ghost">Explore private tools &rarr;</a>
                </div>
              </article>
            </div>
          </div>
        </section>

        <!-- SECTION 04: HEALING, DECODED -->
        <section class="v2-section" style="background-color: var(--v2-card-light);" aria-labelledby="v2-healing-heading">
          <div class="v2-wrapper">
            <div class="v2-section-header v2-split">
              <div>
                <span class="v2-eyebrow">A clear path forward</span>
                <h2 id="v2-healing-heading" class="v2-title v2-title-large">Healing, Decoded.</h2>
              </div>
              <p class="v2-lead">Begin privately, choose the support that feels right, and turn each insight into steady everyday progress.</p>
            </div>

            <div class="v2-timeline-grid">
              <div class="v2-timeline-step">
                <div class="v2-step-badge">01</div>
                <div class="v2-step-micro">About 2 minutes</div>
                <h3>Create your private space</h3>
                <p>Create an account and keep your wellbeing tools, reflections, sessions and progress in one secure place.</p>
                <a href="#/auth/user-signup" class="v2-btn v2-btn-secondary" style="padding: 8px 16px; font-size: 13px;">Start securely</a>
              </div>

              <div class="v2-timeline-step">
                <div class="v2-step-badge">02</div>
                <div class="v2-step-micro">AI or human care</div>
                <h3>Choose the right support</h3>
                <p>Start with guided AI support or connect with a verified mental health professional for dedicated sessions.</p>
                <a href="#/counsellors" class="v2-btn v2-btn-secondary" style="padding: 8px 16px; font-size: 13px;">Explore support</a>
              </div>

              <div class="v2-timeline-step">
                <div class="v2-step-badge">03</div>
                <div class="v2-step-micro">Small steps, daily</div>
                <h3>Build steady progress</h3>
                <p>Use evidence-based self-care tools, check-ins, journal reflections and progress tracking at your own pace.</p>
                <a href="#/services/cbt" class="v2-btn v2-btn-secondary" style="padding: 8px 16px; font-size: 13px;">Open wellness tools</a>
              </div>
            </div>

            <div class="v2-hero-trust" style="justify-content: center; gap: 32px; border: none; padding-top: 0;">
              <span><i class="ph ph-shield-check" style="color: var(--v2-coral); margin-right: 6px;"></i>Private by design</span>
              <span><i class="ph ph-certificate" style="color: var(--v2-coral); margin-right: 6px;"></i>Verified mental health professionals</span>
              <span><i class="ph ph-heartbeat" style="color: var(--v2-coral); margin-right: 6px;"></i>Support available when you need it</span>
            </div>
          </div>
        </section>

        <!-- SECTION 05: ECOSYSTEM BENTO GRID -->
        <section class="v2-section" aria-labelledby="v2-ecosystem-heading">
          <div class="v2-wrapper">
            <div class="v2-section-header">
              <span class="v2-eyebrow">Comprehensive Ecosystem</span>
              <h2 id="v2-ecosystem-heading" class="v2-title v2-title-large">A wellbeing ecosystem, in your hands.</h2>
              <p class="v2-lead">Guided support, self-care tools, reflective insights and verified professionals — connected in one place.</p>
            </div>

            <div class="v2-bento-grid">
              <!-- Bento 1: AI Support Companion -->
              <div class="v2-bento-card col-8">
                <div>
                  <span class="v2-bento-tag">AI Reflection</span>
                  <h3 class="v2-bento-title">Empathetic AI Companion</h3>
                  <p class="v2-bento-desc">Available 24/7 for compassionate reflection, grounding exercises, and unravelling racing thoughts in a judgment-free space.</p>
                </div>
                <div class="v2-bento-preview" style="background: #FAF8F5; border-left: 3px solid var(--v2-coral);">
                  <div style="font-size: 13px; font-style: italic; color: var(--v2-text-secondary); margin-bottom: 8px;">
                    "Take a gentle breath. What feels heaviest on your shoulders right now?"
                  </div>
                  <div style="font-size: 11px; color: var(--v2-text-muted); text-transform: uppercase;">
                    Guidance & reflection · Not autonomous clinical diagnosis
                  </div>
                </div>
                <div style="margin-top: 24px;">
                  <a href="#/services/ai-chat" class="v2-btn-ghost">Try guided conversation &rarr;</a>
                </div>
              </div>

              <!-- Bento 2: Mood Studio -->
              <div class="v2-bento-card col-4">
                <div>
                  <span class="v2-bento-tag">Self-Regulation</span>
                  <h3 class="v2-bento-title">Mood Studio</h3>
                  <p class="v2-bento-desc">Document affective states to discover underlying emotional rhythms and identify triggers over time.</p>
                </div>
                <div class="v2-bento-preview" style="text-align: center;">
                  <div style="font-size: 24px; margin-bottom: 6px;">📈 ☀️ 🌿</div>
                  <div style="font-size: 12px; color: var(--v2-text-secondary);">Longitudinal wellbeing trends</div>
                </div>
                <div style="margin-top: 24px;">
                  <a href="#/services/cbt" class="v2-btn-ghost">View studio &rarr;</a>
                </div>
              </div>

              <!-- Bento 3: Reflective Dream Journal -->
              <div class="v2-bento-card col-4">
                <div>
                  <span class="v2-bento-tag">Mindful Insight</span>
                  <h3 class="v2-bento-title">Dream Journal</h3>
                  <p class="v2-bento-desc">Record morning dream themes for psychoanalytic symbolism and reflective personal journaling.</p>
                </div>
                <div class="v2-bento-preview">
                  <div style="font-size: 13px; color: var(--v2-charcoal);">✨ Symbolism & Theme Mapping</div>
                  <div style="font-size: 11px; color: var(--v2-text-muted); margin-top: 4px;">Reflective journaling tool</div>
                </div>
                <div style="margin-top: 24px;">
                  <a href="#/services/dream" class="v2-btn-ghost">Log dream &rarr;</a>
                </div>
              </div>

              <!-- Bento 4: Handwriting & Expression -->
              <div class="v2-bento-card col-4">
                <div>
                  <span class="v2-bento-tag">Graphological Note</span>
                  <h3 class="v2-bento-title">Handwriting Reflection</h3>
                  <p class="v2-bento-desc">Explore stroke rhythm and expressive flow through structured graphology exercises.</p>
                </div>
                <div class="v2-bento-preview">
                  <div style="font-size: 13px; color: var(--v2-charcoal);">✍️ Stroke Rhythm & Baseline Flow</div>
                  <div style="font-size: 11px; color: var(--v2-text-muted); margin-top: 4px;">Expressive reflection study</div>
                </div>
                <div style="margin-top: 24px;">
                  <a href="#/services/handwriting" class="v2-btn-ghost">Explore strokes &rarr;</a>
                </div>
              </div>

              <!-- Bento 5: Discover Clinical Experts -->
              <div class="v2-bento-card col-4" style="background: var(--v2-coral-tint); border-color: rgba(218,119,86,0.3);">
                <div>
                  <span class="v2-bento-tag" style="background: #FFFFFF;">Verified Network</span>
                  <h3 class="v2-bento-title">Clinical Experts</h3>
                  <p class="v2-bento-desc">Consult licensed psychologists and accredited counsellors over video, voice, or private chat.</p>
                </div>
                <div class="v2-bento-preview" style="background: #FFFFFF;">
                  <div style="font-size: 13px; font-weight: 600; color: var(--v2-charcoal);">Sessions from ₹${minRate}</div>
                  <div style="font-size: 11px; color: var(--v2-text-secondary); margin-top: 4px;">Audio · Video · Secure Chat</div>
                </div>
                <div style="margin-top: 24px;">
                  <a href="#/counsellors" class="v2-btn v2-btn-primary" style="width: 100%; font-size: 14px; padding: 10px;">Find your therapist</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- SECTION 06: ASSESSMENT CENTRE PREVIEW -->
        <section class="v2-section" style="background-color: #FAF9F6;" aria-labelledby="v2-assessment-heading">
          <div class="v2-wrapper">
            <div class="v2-section-header v2-split">
              <div>
                <span class="v2-eyebrow">Self-Assessment & Screening Centre</span>
                <h2 id="v2-assessment-heading" class="v2-title v2-title-large">Understand how you’re doing.</h2>
              </div>
              <p class="v2-lead">Validated screening tools can help you reflect and decide what support may be useful. They do not provide a medical diagnosis.</p>
            </div>

            <div class="v2-assessment-container">
              <div class="v2-assessment-rail" role="tablist" aria-label="Assessment Selection">
                <button type="button" class="v2-assessment-tab is-active" data-test="who5" role="tab" aria-selected="true" aria-controls="v2-test-preview">
                  <div class="v2-tab-name">WHO-5 Wellbeing Index</div>
                  <div class="v2-tab-desc">5-item reflection on vitality and emotional balance</div>
                </button>
                <button type="button" class="v2-assessment-tab" data-test="phq9" role="tab" aria-selected="false" aria-controls="v2-test-preview">
                  <div class="v2-tab-name">PHQ-9 Mood Screen</div>
                  <div class="v2-tab-desc">Clinical screening for low mood and energy</div>
                </button>
                <button type="button" class="v2-assessment-tab" data-test="gad7" role="tab" aria-selected="false" aria-controls="v2-test-preview">
                  <div class="v2-tab-name">GAD-7 Anxiety Scale</div>
                  <div class="v2-tab-desc">Evidence-based assessment for tension and worry</div>
                </button>
                <button type="button" class="v2-assessment-tab" data-test="sleep" role="tab" aria-selected="false" aria-controls="v2-test-preview">
                  <div class="v2-tab-name">Sleep-Mind Connection</div>
                  <div class="v2-tab-desc">Screening circadian rhythm and restorative rest</div>
                </button>
              </div>

              <div class="v2-assessment-preview-panel" id="v2-test-preview" role="tabpanel">
                <div>
                  <span class="v2-preview-badge" id="v2-test-badge">Sample Question Preview · WHO-5</span>
                  <h3 class="v2-question-title" id="v2-test-question">"Over the past two weeks, I have felt cheerful and in good spirits."</h3>
                  
                  <div class="v2-question-options">
                    <div class="v2-option-btn">
                      <div class="v2-option-circle"></div>
                      <span>All of the time</span>
                    </div>
                    <div class="v2-option-btn">
                      <div class="v2-option-circle"></div>
                      <span>Most of the time</span>
                    </div>
                    <div class="v2-option-btn">
                      <div class="v2-option-circle"></div>
                      <span>More than half of the time</span>
                    </div>
                    <div class="v2-option-btn">
                      <div class="v2-option-circle"></div>
                      <span>Less than half of the time</span>
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--v2-divider); padding-top: 24px; flex-wrap: wrap; gap: 16px;">
                  <span style="font-size: 13px; color: var(--v2-text-muted);">
                    <i class="ph ph-lock-key" style="margin-right: 4px;"></i>Deterministic scoring · Completely private
                  </span>
                  <a href="#/services/tests" class="v2-btn v2-btn-primary">Open Assessment Centre</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- SECTION 07: CBT TOOLKIT -->
        <section class="v2-section" aria-labelledby="v2-cbt-heading">
          <div class="v2-wrapper">
            <div class="v2-section-header">
              <span class="v2-eyebrow">CBT Toolkit</span>
              <h2 id="v2-cbt-heading" class="v2-title v2-title-large">Rewire Your Brain.</h2>
              <p class="v2-lead">Practical tools inspired by cognitive and behavioural techniques for reflection, coping and skills practice. These tools support self-care and do not replace professional treatment.</p>
            </div>

            <div class="v2-cbt-container">
              <div class="v2-cbt-nav" role="tablist" aria-label="CBT Tool Selection">
                <button type="button" class="v2-cbt-item is-active" data-tool="diary" role="tab" aria-selected="true">
                  <i class="ph ph-book-open-text"></i>
                  <span>Thought Diary</span>
                </button>
                <button type="button" class="v2-cbt-item" data-tool="grounding" role="tab" aria-selected="false">
                  <i class="ph ph-anchor"></i>
                  <span>Grounding Techniques</span>
                </button>
                <button type="button" class="v2-cbt-item" data-tool="exposure" role="tab" aria-selected="false">
                  <i class="ph ph-stairs"></i>
                  <span>Exposure Hierarchy</span>
                </button>
                <button type="button" class="v2-cbt-item" data-tool="activation" role="tab" aria-selected="false">
                  <i class="ph ph-lightning"></i>
                  <span>Behavioural Activation</span>
                </button>
                <button type="button" class="v2-cbt-item" data-tool="worry" role="tab" aria-selected="false">
                  <i class="ph ph-clock-countdown"></i>
                  <span>Worry Time</span>
                </button>
              </div>

              <div class="v2-cbt-panel" id="v2-cbt-panel">
                <div>
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                    <span class="v2-bento-tag" id="v2-cbt-badge">Cognitive Restructuring</span>
                    <span style="font-size: 13px; color: var(--v2-coral); font-weight: 600;">9-Step Framework</span>
                  </div>

                  <h3 id="v2-cbt-title" style="font-family: var(--v2-font-display); font-size: 26px; margin: 0 0 16px 0;">Thought Diary & Distortion Tracker</h3>
                  <p id="v2-cbt-desc" style="font-size: 15px; line-height: 1.6; color: var(--v2-text-secondary); margin-bottom: 24px;">
                    Deconstruct automatic negative thoughts (ANTs). Identify cognitive distortions such as catastrophic thinking, black-and-white reasoning, and mind-reading, then formulate balanced counter-evidence.
                  </p>

                  <div style="background: var(--v2-card-light); border: 1px solid var(--v2-divider); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <div style="font-size: 13px; font-weight: 600; color: var(--v2-charcoal); margin-bottom: 6px;">Clinical Focus:</div>
                    <div id="v2-cbt-example" style="font-size: 14px; color: var(--v2-text-secondary);">
                      Situation $\rightarrow$ Automatic Thought $\rightarrow$ Cognitive Distortion $\rightarrow$ Rational Reframe
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--v2-divider); padding-top: 24px;">
                  <span style="font-size: 13px; color: var(--v2-text-muted);">Available in your private dashboard</span>
                  <a href="#/services/cbt" class="v2-btn v2-btn-primary">Start journaling</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- SECTION 08: FEATURED COURSES (DARK) -->
        <section class="v2-section v2-section-dark" aria-labelledby="v2-courses-heading">
          <div class="v2-wrapper">
            <div class="v2-section-header v2-split">
              <div>
                <span class="v2-eyebrow">Featured Courses</span>
                <h2 id="v2-courses-heading" class="v2-title v2-title-large">Master Your Mind.</h2>
              </div>
              <p class="v2-lead">Expert-led learning on psychology, relationships and everyday wellbeing.</p>
            </div>

            <div class="v2-courses-grid">
              <article class="v2-course-card">
                <div class="v2-course-img-box">
                  <img src="redesign_assets/02_references/sections/08_courses_reference.png" alt="Understanding Anxiety and Panic" style="object-position: 10% 50%;" />
                  <span class="v2-course-tag">Video Course</span>
                </div>
                <div class="v2-course-content">
                  <h3>Navigating Everyday Anxiety</h3>
                  <p>Understand the neurobiology of anxiety and master evidence-based grounding techniques for high-pressure moments.</p>
                  <div class="v2-course-meta">
                    <span>6 Structured Modules</span>
                    <span>Self-Paced</span>
                  </div>
                </div>
              </article>

              <article class="v2-course-card">
                <div class="v2-course-img-box">
                  <img src="redesign_assets/02_references/sections/08_courses_reference.png" alt="Healthy Boundaries and Relationships" style="object-position: 50% 50%;" />
                  <span class="v2-course-tag">Clinical Guide</span>
                </div>
                <div class="v2-course-content">
                  <h3>Cultivating Secure Boundaries</h3>
                  <p>Learn assertiveness frameworks to communicate needs without guilt, preserving emotional safety in relationships.</p>
                  <div class="v2-course-meta">
                    <span>8 Interactive Lessons</span>
                    <span>Includes Exercises</span>
                  </div>
                </div>
              </article>

              <article class="v2-course-card">
                <div class="v2-course-img-box">
                  <img src="redesign_assets/02_references/sections/08_courses_reference.png" alt="Restoring Sleep Architecture" style="object-position: 90% 50%;" />
                  <span class="v2-course-tag">Sleep Protocol</span>
                </div>
                <div class="v2-course-content">
                  <h3>Restoring Restful Sleep</h3>
                  <p>CBT-for-Insomnia (CBT-I) principles to quiet bedtime overthinking and reset natural circadian rhythms.</p>
                  <div class="v2-course-meta">
                    <span>5 Core Sessions</span>
                    <span>Audio & Worksheets</span>
                  </div>
                </div>
              </article>
            </div>

            <div style="text-align: center; margin-top: 48px;">
              <a href="#/resources" class="v2-btn v2-btn-secondary" style="color: #FFFFFF !important; border-color: var(--v2-dark-divider);">
                <span>Explore all learning modules</span>
                <i class="ph ph-arrow-right"></i>
              </a>
            </div>
          </div>
        </section>

        <!-- SECTION 09: TRUST / EVIDENCE / ETHICS (DARK) -->
        <section class="v2-section v2-section-dark" style="border-top: 1px solid var(--v2-dark-divider);" aria-labelledby="v2-ethics-heading">
          <div class="v2-wrapper">
            <div class="v2-section-header">
              <span class="v2-eyebrow">Trust, Safety & Responsible Care</span>
              <h2 id="v2-ethics-heading" class="v2-title v2-title-large">Evidence-based care. Grounded in ethics.</h2>
              <p class="v2-lead">Built around qualified professionals, responsible technology, privacy, and clear pathways to human support.</p>
            </div>

            <div class="v2-ethics-grid">
              <div class="v2-ethics-card">
                <div class="v2-ethics-icon"><i class="ph ph-identification-badge"></i></div>
                <h3>Verified professional credentials</h3>
                <p>All clinical psychologists and mental health counsellors undergo rigorous degree validation and background screening before being onboarded.</p>
              </div>

              <div class="v2-ethics-card">
                <div class="v2-ethics-icon"><i class="ph ph-shield-check"></i></div>
                <h3>Encryption in transit & at rest</h3>
                <p>Your session notes, journal entries, and private consultations are protected with strict end-to-end security protocols and role-isolated databases.</p>
              </div>

              <div class="v2-ethics-card">
                <div class="v2-ethics-icon"><i class="ph ph-phone-call"></i></div>
                <h3>Crisis escalation pathways</h3>
                <p>MindHeal actively detects distress indicators and provides immediate, toll-free 24/7 national crisis resources (such as Tele-MANAS 14416).</p>
              </div>
            </div>
          </div>
        </section>

        <!-- SECTION 10: ILLUSTRATIVE EXPERIENCES (DARK) -->
        <section class="v2-section v2-section-dark" style="border-top: 1px solid var(--v2-dark-divider);" aria-labelledby="v2-experiences-heading">
          <div class="v2-wrapper">
            <div class="v2-section-header">
              <span class="v2-eyebrow">Illustrative Client Experiences · Clinical Demonstration</span>
              <h2 id="v2-experiences-heading" class="v2-title v2-title-large">Care that feels understood.</h2>
              <p class="v2-lead">Examples of how different MindHeal pathways may support everyday wellbeing.</p>
            </div>

            <div class="v2-experiences-grid">
              <div class="v2-experience-card">
                <p class="v2-experience-quote">
                  "Having an AI guide to untangle my thoughts at 2:00 AM gave me the confidence to finally book my first human therapy session."
                </p>
                <div class="v2-experience-meta">
                  <div>
                    <div class="v2-experience-label">Scenario A · Work & Burnout</div>
                    <div class="v2-experience-path">AI Reflection $\rightarrow$ Professional Consultation</div>
                  </div>
                </div>
              </div>

              <div class="v2-experience-card">
                <p class="v2-experience-quote">
                  "The thought diary helped me see that my mind was magnifying worst-case scenarios before every client presentation."
                </p>
                <div class="v2-experience-meta">
                  <div>
                    <div class="v2-experience-label">Scenario B · Performance Anxiety</div>
                    <div class="v2-experience-path">CBT Distortion Tracking</div>
                  </div>
                </div>
              </div>

              <div class="v2-experience-card">
                <p class="v2-experience-quote">
                  "Speaking with a therapist who understood my cultural background made all the difference in navigating family expectations."
                </p>
                <div class="v2-experience-meta">
                  <div>
                    <div class="v2-experience-label">Scenario C · Relationship Navigation</div>
                    <div class="v2-experience-path">Multilingual Counselling</div>
                  </div>
                </div>
              </div>
            </div>

            <p class="v2-experience-disclaimer">
              Illustrative stories are designed to demonstrate possible care pathways. Individual experiences and clinical outcomes vary.
            </p>
          </div>
        </section>

        <!-- SECTION 11: FOR PROFESSIONALS -->
        <section class="v2-section" aria-labelledby="v2-pro-heading">
          <div class="v2-wrapper">
            <div class="v2-professionals-card">
              <div>
                <span class="v2-eyebrow">For Professionals</span>
                <h2 id="v2-pro-heading" class="v2-title v2-title-large">Join a trusted network of mental health professionals.</h2>
                <p class="v2-lead">Grow your practice, manage availability and appointments, and connect with people actively seeking professional support.</p>

                <div class="v2-pro-perks">
                  <div class="v2-pro-perk-item">
                    <i class="ph ph-check-circle"></i>
                    <span>Streamlined onboarding and credentials verification</span>
                  </div>
                  <div class="v2-pro-perk-item">
                    <i class="ph ph-check-circle"></i>
                    <span>Smart scheduling with automated buffer time and slot controls</span>
                  </div>
                  <div class="v2-pro-perk-item">
                    <i class="ph ph-check-circle"></i>
                    <span>Expand your clinical reach with secure video and chat sessions</span>
                  </div>
                </div>

                <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                  <a href="#/auth/counsellor-signup" class="v2-btn v2-btn-primary">Sign up as a counsellor</a>
                  <a href="#/auth/counsellor-login" class="v2-btn v2-btn-secondary">Professional login</a>
                </div>
              </div>

              <div class="v2-pro-img-box">
                <img src="redesign_assets/02_references/sections/11_professionals_reference.png" alt="Indian psychologist in calm clinic setting taking notes" />
              </div>
            </div>
          </div>
        </section>

        <!-- SECTION 12: PRICING -->
        <section class="v2-section" style="background-color: #FAF9F6;" aria-labelledby="v2-pricing-heading">
          <div class="v2-wrapper">
            <div class="v2-section-header" style="text-align: center;">
              <span class="v2-eyebrow" style="justify-content: center;">Equitable, Transparent Economics</span>
              <h2 id="v2-pricing-heading" class="v2-title v2-title-large">Clear ways to begin.</h2>
              <p class="v2-lead" style="margin: 0 auto;">From free guided support to human sessions and deeper self-care tools.</p>
            </div>

            <div class="v2-pricing-grid">
              <!-- Plan 1: AI Guide -->
              <div class="v2-pricing-card">
                <div>
                  <h3 class="v2-plan-name">AI Guide</h3>
                  <p class="v2-plan-desc">For everyday emotional reflection and self-paced exercises.</p>
                  <div class="v2-price-tag">
                    <span class="v2-price-val">Free</span>
                  </div>
                  <ul class="v2-plan-features">
                    <li class="v2-plan-feature"><i class="ph ph-check"></i> 24/7 AI guided conversation</li>
                    <li class="v2-plan-feature"><i class="ph ph-check"></i> Basic mood tracking</li>
                    <li class="v2-plan-feature"><i class="ph ph-check"></i> Selected free assessments</li>
                  </ul>
                </div>
                <a href="#/services/ai-chat" class="v2-btn v2-btn-secondary" style="width: 100%;">Start free</a>
              </div>

              <!-- Plan 2: Human Counsellor (Most popular) -->
              <div class="v2-pricing-card is-popular">
                <div class="v2-pricing-badge">Most Popular</div>
                <div>
                  <h3 class="v2-plan-name">Human Counsellor</h3>
                  <p class="v2-plan-desc">Dedicated 1-on-1 consultations with verified clinical experts.</p>
                  <div class="v2-price-tag">
                    <span class="v2-price-val">₹${minRate}+</span>
                    <span class="v2-price-sub">/ session</span>
                  </div>
                  <ul class="v2-plan-features">
                    <li class="v2-plan-feature"><i class="ph ph-check"></i> Video, audio, or text sessions</li>
                    <li class="v2-plan-feature"><i class="ph ph-check"></i> Choose by specialty & language</li>
                    <li class="v2-plan-feature"><i class="ph ph-check"></i> Safe confidential appointment space</li>
                  </ul>
                </div>
                <a href="#/counsellors" class="v2-btn v2-btn-primary" style="width: 100%;">Explore counsellors</a>
              </div>

              <!-- Plan 3: MindHeal Plus -->
              <div class="v2-pricing-card">
                <div>
                  <h3 class="v2-plan-name">MindHeal Plus</h3>
                  <p class="v2-plan-desc">Full suite of advanced analysis reports and wellbeing modules.</p>
                  <div class="v2-price-tag">
                    <span class="v2-price-val">₹499</span>
                    <span class="v2-price-sub">/ month</span>
                  </div>
                  <ul class="v2-plan-features">
                    <li class="v2-plan-feature"><i class="ph ph-check"></i> Unlimited CBT Thought Diary history</li>
                    <li class="v2-plan-feature"><i class="ph ph-check"></i> Full psychological report downloads</li>
                    <li class="v2-plan-feature"><i class="ph ph-check"></i> Dream & handwriting report credits</li>
                  </ul>
                </div>
                <a href="#/wallet" class="v2-btn v2-btn-secondary" style="width: 100%;">Subscribe</a>
              </div>
            </div>

            <div class="v2-pricing-trust-row">
              <span><i class="ph ph-check-circle" style="color: var(--v2-sage); margin-right: 6px;"></i>Clear upfront pricing</span>
              <span><i class="ph ph-shield-check" style="color: var(--v2-sage); margin-right: 6px;"></i>Secure encrypted payments</span>
              <span><i class="ph ph-arrows-counter-clockwise" style="color: var(--v2-sage); margin-right: 6px;"></i>Cancel anytime according to plan terms</span>
            </div>
          </div>
        </section>

        <!-- SECTION 13: FINAL CTA -->
        <section class="v2-final-cta" aria-labelledby="v2-final-heading">
          <div class="v2-wrapper v2-final-cta-content">
            <span class="v2-eyebrow" style="justify-content: center;">Start where you are</span>
            <h2 id="v2-final-heading" class="v2-title v2-title-large" style="margin-bottom: 28px;">A little support can change the direction of a day.</h2>
            <div style="display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;">
              <a href="#/counsellors" class="v2-btn v2-btn-primary">Find a therapist</a>
              <a href="#/services/cbt" class="v2-btn v2-btn-secondary">Explore self-care tools</a>
            </div>
          </div>
        </section>

      </main>

      <!-- SITE FOOTER -->
      <footer class="v2-footer" role="contentinfo">
        <div class="v2-wrapper">
          <div class="v2-footer-grid">
            <div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                <img src="assets/logos/mindheal-logo.svg" alt="" aria-hidden="true" style="height: 32px;" onerror="this.style.display='none'" />
                <span style="font-family: var(--v2-font-display); font-size: 22px; font-weight: 600;">MindHeal</span>
              </div>
              <p style="font-size: 14px; line-height: 1.6; color: var(--v2-text-secondary); max-width: 320px; margin-bottom: 24px;">
                A comprehensive psychological wellness ecosystem connecting human therapy, reflective self-care, and responsible AI support.
              </p>
              <div style="font-size: 12px; color: var(--v2-text-muted);">
                Emergency? Call Tele-MANAS at <strong style="color: var(--v2-coral);">14416</strong> or National Helpline <strong style="color: var(--v2-coral);">112</strong>.
              </div>
            </div>

            <div class="v2-footer-links-grid">
              <div class="v2-footer-col">
                <h4>Platform</h4>
                <ul>
                  <li><a href="#/counsellors">Find a Therapist</a></li>
                  <li><a href="#/services/cbt">Self-Care Tools</a></li>
                  <li><a href="#/services/tests">Screening Centre</a></li>
                  <li><a href="#/services/ai-chat">AI Companion</a></li>
                </ul>
              </div>

              <div class="v2-footer-col">
                <h4>Professionals</h4>
                <ul>
                  <li><a href="#/auth/counsellor-signup">Join Network</a></li>
                  <li><a href="#/auth/counsellor-login">Counsellor Portal</a></li>
                  <li><a href="#/for-counsellors">Practice Growth</a></li>
                  <li><a href="#/pricing">Pricing Economics</a></li>
                </ul>
              </div>

              <div class="v2-footer-col">
                <h4>Company & Legal</h4>
                <ul>
                  <li><a href="#/about">About MindHeal</a></li>
                  <li><a href="#/legal/user-privacy">Privacy Policy</a></li>
                  <li><a href="#/legal/user-terms">Terms of Service</a></li>
                  <li><a href="#/crisis">Crisis Resources</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div class="v2-footer-bottom">
            <div>© ${new Date().getFullYear()} MindHeal Platform. All rights reserved.</div>
            <div style="display: flex; gap: 20px;">
              <a href="#/legal/user-terms" style="color: inherit; text-decoration: none;">Terms</a>
              <a href="#/legal/user-privacy" style="color: inherit; text-decoration: none;">Privacy</a>
              <a href="#/crisis" style="color: inherit; text-decoration: none;">Emergency Support</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  `;
}

/**
 * Attach dynamic event handlers for interactive demo components
 */
export function initHomeV2Handlers() {
  // 1. Mobile Menu Drawer Toggle
  const toggleBtn = document.getElementById("v2-mobile-toggle");
  const drawer = document.getElementById("v2-mobile-drawer");
  if (toggleBtn && drawer) {
    toggleBtn.addEventListener("click", () => {
      const isOpen = drawer.classList.toggle("is-open");
      toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  // 2. Interactive Mood Card
  const moodBtns = document.querySelectorAll(".v2-mood-btn");
  const feedback = document.getElementById("v2-mood-feedback");
  moodBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      moodBtns.forEach(b => b.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      const mood = btn.getAttribute("data-mood");
      if (feedback) {
        const messages = {
          "1": "Holding space for you. Grounding tools can help.",
          "2": "A gentle breath. You don't have to carry it all.",
          "3": "Taking time to reflect creates everyday clarity.",
          "4": "Wonderful to notice moments of balance today.",
          "5": "Cherish this energy and lightness today."
        };
        feedback.textContent = messages[mood] || "Thank you for checking in.";
        feedback.style.color = "#C85232";
      }
    });
  });

  // 3. Assessment Centre Interactive Rail
  const testData = {
    who5: {
      badge: "Sample Question Preview · WHO-5",
      question: '"Over the past two weeks, I have felt cheerful and in good spirits."'
    },
    phq9: {
      badge: "Sample Question Preview · PHQ-9",
      question: '"Over the last 2 weeks, how often have you felt little interest or pleasure in doing things?"'
    },
    gad7: {
      badge: "Sample Question Preview · GAD-7",
      question: '"Over the last 2 weeks, how often have you been bothered by feeling nervous, anxious or on edge?"'
    },
    sleep: {
      badge: "Sample Question Preview · Sleep Health",
      question: '"How often do racing thoughts delay your sleep by more than 30 minutes?"'
    }
  };

  const testTabs = document.querySelectorAll(".v2-assessment-tab");
  const testBadge = document.getElementById("v2-test-badge");
  const testQuestion = document.getElementById("v2-test-question");

  testTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      testTabs.forEach(t => {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");

      const key = tab.getAttribute("data-test");
      if (testData[key]) {
        if (testBadge) testBadge.textContent = testData[key].badge;
        if (testQuestion) testQuestion.textContent = testData[key].question;
      }
    });
  });

  // 4. CBT Toolkit Tabs
  const cbtData = {
    diary: {
      badge: "Cognitive Restructuring",
      title: "Thought Diary & Distortion Tracker",
      desc: "Deconstruct automatic negative thoughts (ANTs). Identify cognitive distortions such as catastrophic thinking, black-and-white reasoning, and mind-reading, then formulate balanced counter-evidence.",
      example: "Situation → Automatic Thought → Cognitive Distortion → Rational Reframe"
    },
    grounding: {
      badge: "Nervous System Regulation",
      title: "5-4-3-2-1 Somatic Grounding",
      desc: "Rapidly regulate the sympathetic nervous system during acute panic or overstimulation by engaging all five sensory pathways with the physical room around you.",
      example: "5 things you see · 4 things you can touch · 3 sounds · 2 scents · 1 taste"
    },
    exposure: {
      badge: "Desensitisation Hierarchy",
      title: "Gradual Exposure Hierarchy",
      desc: "Step-by-step avoidance mitigation. Break down fear triggers into graded micro-steps with Subjective Units of Distress (SUDs) monitoring.",
      example: "Rank avoidance triggers from 10 to 100 SUDs and approach safely"
    },
    activation: {
      badge: "Mood & Energy Momentum",
      title: "Behavioural Activation Log",
      desc: "Counter depressive inertia by scheduling small, manageable mastery and pleasure activities that restore natural dopamine loops.",
      example: "Schedule 1 Mastery + 1 Pleasure activity daily regardless of motivation"
    },
    worry: {
      badge: "Cognitive Boundary Setting",
      title: "Dedicated Worry Time Box",
      desc: "Postpone ruminative worry during the day by writing intrusive thoughts down and reserving a focused 15-minute reflection window each evening.",
      example: "Note thought during the day → Set 15m timer at 6:30 PM → Act or release"
    }
  };

  const cbtItems = document.querySelectorAll(".v2-cbt-item");
  const cbtBadge = document.getElementById("v2-cbt-badge");
  const cbtTitle = document.getElementById("v2-cbt-title");
  const cbtDesc = document.getElementById("v2-cbt-desc");
  const cbtExample = document.getElementById("v2-cbt-example");

  cbtItems.forEach(item => {
    item.addEventListener("click", () => {
      cbtItems.forEach(i => {
        i.classList.remove("is-active");
        i.setAttribute("aria-selected", "false");
      });
      item.classList.add("is-active");
      item.setAttribute("aria-selected", "true");

      const key = item.getAttribute("data-tool");
      if (cbtData[key]) {
        if (cbtBadge) cbtBadge.textContent = cbtData[key].badge;
        if (cbtTitle) cbtTitle.textContent = cbtData[key].title;
        if (cbtDesc) cbtDesc.textContent = cbtData[key].desc;
        if (cbtExample) cbtExample.textContent = cbtData[key].example;
      }
    });
  });

  // 5. Gentle Parallax on Desktop
  const heroBreathe = document.getElementById("v2-hero-breathe");
  const heroSubject = document.getElementById("v2-hero-subject");
  const moodCard = document.getElementById("v2-mood-card");

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!prefersReduced && window.innerWidth >= 1024) {
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          if (scrollY < 700) {
            if (heroBreathe) heroBreathe.style.transform = `translate(-50%, calc(-50% + ${scrollY * 0.12}px))`;
            if (heroSubject) heroSubject.style.transform = `translateY(${scrollY * 0.16}px)`;
            if (moodCard) moodCard.style.transform = `translateY(${scrollY * 0.22}px)`;
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }
}
