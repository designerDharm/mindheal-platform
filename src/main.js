import {
  adminFeatures,
  apiConfigRows,
  appConfig,
  counsellorFeatures,
  counsellors,
  publicNav,
  roadmap,
  serviceCategories,
  services,
  supportedLanguages,
  userFeatures,
  howItWorks,
  testimonials,
  blogs,
  team,
  videos
} from "./data/mindheal-data.js";
import { api } from "./services/mock-api.js?v=5";
import { escapeHtml, formatInr, getFormData, html, toast } from "./utils/dom.js";
import { bindMoodStudioForm, parseMoodNote, renderMoodStudio } from "./features/mood-studio.js";
import { renderWalletTransactionsTable } from "./features/wallet-transactions.js";

const app = document.querySelector("#app");

const state = {
  route: parseRoute(),
  navOpen: false,
  panelSection: "overview",
  serviceFilter: "all",
  counsellorFilter: "all",
  aiMessages: loadAiMessages(),
  sidebarCollapsed: localStorage.getItem("sidebar-collapsed") === "true",
  safetySidebarCollapsed: localStorage.getItem("safety-sidebar-collapsed") === "true",
  dreamInput: "",
  dreamAnalyzing: false,
  dreamResult: null,
  dreamError: "",
  showDreamAuthModal: false,
  dreamAuthMode: "signup",
  handwritingInput: "",
  handwritingAnalyzing: false,
  handwritingResult: null,
  handwritingError: "",
  signatureInput: "",
  signatureAnalyzing: false,
  signatureResult: null,
  signatureError: "",
  // CBT Toolkit Interactive Sub-features state
  cbtActiveTab: "thought", // "thought", "exposure", "activation", "grounding", "worry"
  cbtDailyDiaryEntries: JSON.parse(localStorage.getItem("cbt-daily-diary") || "[]"),
  cbtThoughtEntries: JSON.parse(localStorage.getItem("cbt-thought-diary") || "[]"),
  cbtExposures: JSON.parse(localStorage.getItem("cbt-exposure-hierarchy") || `[
    { "id": "exp_1", "step": "Say hello to a cashier at the grocery store", "anxiety": 30, "status": "completed" },
    { "id": "exp_2", "step": "Ask a stranger for directions", "anxiety": 50, "status": "pending" },
    { "id": "exp_3", "step": "Sit in a crowded cafe for 15 minutes", "anxiety": 70, "status": "pending" },
    { "id": "exp_4", "step": "Attend a crowded social gathering", "anxiety": 90, "status": "pending" }
  ]`),
  cbtActivities: JSON.parse(localStorage.getItem("cbt-behavioral-activation") || `[
    { "id": "act_1", "title": "Go for a 10-minute morning walk", "category": "Physical", "scheduledFor": "Tomorrow 8:00 AM", "status": "pending" },
    { "id": "act_2", "title": "Call a friend for 5 minutes", "category": "Social", "scheduledFor": "Wednesday 6:00 PM", "status": "pending" }
  ]`),
  cbtWorryLogs: JSON.parse(localStorage.getItem("cbt-worry-time") || `[
    { "id": "wor_1", "thought": "What if I fail my presentation tomorrow?", "postponedTo": "6:00 PM", "createdAt": "${new Date().toISOString()}" }
  ]`),
  cbtDailyDiaryOpen: false
};

window.filterCounsellors = (category) => {
  state.counsellorFilter = category;
  
  document.querySelectorAll('.filter-pill').forEach(pill => {
    if (pill.dataset.filter === category) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  document.querySelectorAll('.counsellor-profile').forEach(item => {
    if (category === 'all' || item.dataset.category === category) {
      item.style.display = 'block';
      item.style.animation = 'none';
      void item.offsetWidth;
      item.style.animation = 'revealUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    } else {
      item.style.display = 'none';
    }
  });
};

window.filterServices = (category) => {
  state.serviceFilter = category;
  
  // Update active tab styling
  document.querySelectorAll('.filter-tab').forEach(tab => {
    if (tab.dataset.filter === category) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update grid items visibility
  document.querySelectorAll('#services-bento-grid > div').forEach(item => {
    if (category === 'all' || item.dataset.category === category) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
};

function initScrollObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  // Give DOM a tick to render before observing
  setTimeout(() => {
    document.querySelectorAll('.reveal-up').forEach(el => observer.observe(el));
  }, 100);
}

window.addEventListener("hashchange", () => {
  state.route = parseRoute();
  state.navOpen = false;
  render();
});

function parseRoute() {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = hash.split("?");
  return { path, query: new URLSearchParams(query) };
}

function navigate(path) {
  window.location.hash = path;
}

let appSocket = null;

function loadAiMessages() {
  try {
    const saved = JSON.parse(localStorage.getItem("mindheal-ai-chat") || "[]");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {}

  return [
    { role: "ai", text: "I'm here. Take your time. What feels most present for you today?", safety: "low" },
    { role: "user", text: "I feel anxious about work and sleep." },
    { role: "ai", text: "That sounds heavy. Let's slow it down and separate what happened, what you felt, and what your mind predicted.", safety: "low" }
  ];
}

function saveAiMessages() {
  try {
    localStorage.setItem("mindheal-ai-chat", JSON.stringify(state.aiMessages.slice(-20)));
  } catch {}
}

async function render() {
  const page = await resolvePage(state.route.path);
  const isAuthOrPanel = state.route.path.startsWith("/panel") || state.route.path.startsWith("/auth") || state.route.path.startsWith("/services/ai");
  
  app.innerHTML = html`
    <div class="app-shell">
      ${!isAuthOrPanel ? siteHeader() : ""}
      ${page}
      ${shouldShowFooter(state.route.path) ? siteFooter() : ""}
    </div>
  `;
  attachGlobalHandlers();
  attachPageHandlers();
  initScrollObserver();
  window.scrollTo({ top: 0, behavior: "instant" });

  if (state.route.path.startsWith("/panel/user") && state.panelSection === "counsellors") {
    initGoogleMap();
  }

  if (!appSocket && (state.route.path.startsWith("/panel/user") || state.route.path.startsWith("/panel/counsellor"))) {
    appSocket = api.initSocket(
      (notif) => { toast(`🔔 ${notif.title}: ${notif.message}`); },
      (msg) => { console.log("New message:", msg); }
    );
  }
}

async function initGoogleMap() {
  const mapContainer = document.getElementById("counsellor-map");
  if (!mapContainer) return;

  try {
    const config = await api.getConfig();
    if (!config.mapsApiKey) {
      mapContainer.innerHTML = '<div style="padding: 24px; text-align: center;">Google Maps API key not configured in CMS.</div>';
      return;
    }

    if (!window.google || !window.google.maps) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${config.mapsApiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const map = new window.google.maps.Map(mapContainer, {
      center: { lat: 20.5937, lng: 78.9629 }, // Default to India
      zoom: 5,
      mapTypeControl: false
    });

    const listings = await api.getMapListings();
    
    listings.forEach(listing => {
      const lat = listing.locationLat || listing.location_lat;
      const lng = listing.locationLng || listing.location_lng;
      if (lat && lng) {
        new window.google.maps.Marker({
          position: { lat: parseFloat(lat), lng: parseFloat(lng) },
          map,
          title: listing.displayName || listing.name
        });
      }
    });

  } catch (err) {
    console.error("Failed to load map:", err);
    mapContainer.innerHTML = '<div style="padding: 24px; text-align: center;">Failed to load map.</div>';
  }
}

function shouldShowFooter(path) {
  const normalized = String(path || "").toLowerCase();
  return !normalized.startsWith("/panel") && !normalized.startsWith("/auth") && !normalized.includes("login") && !normalized.includes("signup");
}

async function resolvePage(path) {
  const data = await api.getState().catch(() => null);
  const loggedIn = !!(data && data.auth);

  if (loggedIn && path.startsWith("/services/")) {
    if (path === "/services/ai-counselling" || path === "/services/ai-chat") {
      state.panelSection = "ai";
      return userPanel();
    }
    if (path === "/services/group") {
      state.panelSection = "counsellors";
      return userPanel();
    }
    if (path === "/services/games") {
      state.panelSection = "cbt";
      return userPanel();
    }
    if (path === "/services/focus") {
      state.panelSection = "cbt";
      return userPanel();
    }
    if (path === "/services/map") {
      state.panelSection = "counsellors";
      return userPanel();
    }
    if (path === "/services/tests") {
      state.panelSection = "cbt";
      return userPanel();
    }
    if (path === "/services/diary") {
      state.panelSection = "cbt";
      return userPanel();
    }
    if (path === "/services/courses") {
      state.panelSection = "cbt";
      return userPanel();
    }
  }

  if (path === "/" || path === "") return homePage();
  if (path === "/services") return servicesPage();
  if (path === "/services/ai-counselling" || path === "/services/ai-chat") {
    toast("Authentication required: Please log in with a user account.", "error");
    return authPage("user", "login");
  }
  if (path === "/services/dream" || path === "/services/dreams") return serviceDreamAnalysis();
  if (path === "/services/handwriting") return serviceHandwritingAnalysis();
  if (path === "/services/signature") return serviceSignatureAnalysis();
  if (path === "/services/group") return serviceGroupHealing();
  if (path === "/services/games") return serviceMindGames();
  if (path === "/services/focus") return serviceFocusTools();
  if (path === "/services/map") return serviceHealingMap();
  if (path === "/services/tests") return servicePsychologicalTests();
  if (path === "/services/diary") return serviceCBTDiary();
  if (path === "/services/courses") return servicePsychologyCourses();

  if (path === "/counsellors") return publicCounsellorsPage();
  if (path === "/for-counsellors") return counsellorLandingPage();
  if (path === "/resources" || path === "/blog") return resourcesPage();
  if (path === "/resources/guides") return guidesPage();
  if (path === "/resources/cbt") return cbtResourcePage();
  if (path === "/crisis") return crisisPage();
  if (path === "/about") return aboutPage();
  if (path === "/pricing") return pricingPage();
  if (path === "/careers") return careersPage();
  if (path === "/press") return pressPage();
  if (path === "/contact") return contactPage();
  if (path === "/auth/user-login") return authPage("user", "login");
  if (path === "/auth/user-signup") return authPage("user", "signup");
  if (path === "/auth/counsellor-login") return authPage("counsellor", "login");
  if (path === "/auth/counsellor-signup") return authPage("counsellor", "signup");
  if (path === "/auth/admin-login") return authPage("admin", "login");
  
  if (path.startsWith("/panel/user")) {
    if (!loggedIn || data.auth.role !== "user") {
      toast("Authentication required: Please log in with a user account.", "error");
      return authPage("user", "login");
    }
    if (path === "/panel/user/ai") state.panelSection = "ai";
    return userPanel();
  }
  if (path.startsWith("/panel/counsellor")) {
    if (!loggedIn || data.auth.role !== "counsellor") {
      toast("Authentication required: Please log in with a counsellor account.", "error");
      return authPage("counsellor", "login");
    }
    return counsellorPanel();
  }
  if (path.startsWith("/panel/admin")) {
    if (!loggedIn || data.auth.role !== "admin") {
      toast("Authentication required: Please log in with an admin account.", "error");
      return authPage("admin", "login");
    }
    return adminPanel();
  }
  return notFoundPage();
}

function publicCounsellorsPage() {
  return html`
    <section class="bg-charcoal" style="padding:160px 0 80px 0;text-align:center;">
      <div class="container reveal-up">
        <h1 style="font-family:var(--font-serif);font-size:48px;color:var(--color-cream);margin-bottom:24px;">Find Human Counsellors</h1>
        <p style="font-size:20px;color:rgba(255,255,255,0.7);max-width:800px;margin:0 auto;">Browse our directory of verified RCI clinical psychologists and therapists.</p>
      </div>
    </section>
    <section class="bg-cream" style="padding:80px 0;">
      <div class="container card-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:32px;">
        ${counsellors.map(counsellorCard).join("")}
      </div>
    </section>
  `;
}

function siteHeader() {
  const activePath = state.route.path;
  const isDarkTop = activePath === '/counsellors' || activePath === '/services/dream' || activePath === '/services/dreams';
  
  // To handle the glass effect on scroll, we'll attach an event listener in the mount phase.
  // We can add a simple script to toggle the "glass" class on scroll.
  setTimeout(() => {
    const header = document.getElementById("main-header");
    if(header) {
      window.addEventListener("scroll", () => {
        if (window.scrollY > 80) header.classList.add("glass");
        else header.classList.remove("glass");
      });
    }
  }, 100);

  return html`
    <header class="site-header ${isDarkTop ? 'dark-theme' : ''}" id="main-header">
      <nav class="nav" aria-label="Primary navigation">
        
        <!-- LEFT: LOGO -->
        <a class="brand" href="#/" aria-label="MindHeal home" style="color:var(--header-text-color);display:flex;align-items:center;gap:12px;text-decoration:none;">
          <i class="ph-fill ph-plant" style="font-size:32px;color:var(--color-coral);"></i>
          <div style="display:flex;flex-direction:column;line-height:1;">
            <span style="font-family:var(--font-serif);font-size:24px;color:var(--header-text-color);">MindHeal</span>
            <span style="font-size:10px;font-family:var(--font-sans);letter-spacing:0.05em;color:var(--header-text-color);opacity:0.6;margin-top:2px;">Your Mind. Your Healing.</span>
          </div>
        </a>

        <!-- CENTER: LINKS -->
        <div class="nav-links ${state.navOpen ? "open" : ""}" id="primary-menu" style="display:flex;align-items:center;gap:32px;">
          <a href="#/" class="nav-link ${activePath === '/' ? 'active' : ''}" style="color:var(--header-text-color);text-decoration:none;font-weight:500;">Home</a>
          
          <div class="nav-item">
            <a href="#/services" class="nav-link ${activePath === '/services' ? 'active' : ''}" style="color:var(--header-text-color);text-decoration:none;font-weight:500;display:flex;align-items:center;gap:4px;">Services <i class="ph-bold ph-caret-down" style="font-size:12px;"></i></a>
            <!-- MEGA DROPDOWN -->
            <div class="mega-dropdown">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
                <a href="#/services/ai-chat" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-chat-teardrop-text" style="color:var(--color-coral);font-size:20px;"></i> AI Counselling Chat</a>
                <a href="#/counsellors" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-users" style="color:var(--color-coral);font-size:20px;"></i> Find Human Counsellors</a>
                <a href="#/services/dream" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-moon-stars" style="color:var(--color-coral);font-size:20px;"></i> Dream Analysis</a>
                <a href="#/services/handwriting" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-pen-nib" style="color:var(--color-coral);font-size:20px;"></i> Handwriting Analysis</a>
                <a href="#/services/signature" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-signature" style="color:var(--color-coral);font-size:20px;"></i> Signature Analysis</a>
                <a href="#/services/group" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-users-three" style="color:var(--color-coral);font-size:20px;"></i> Group Healing Sessions</a>
                <a href="#/services/games" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-brain" style="color:var(--color-coral);font-size:20px;"></i> Mind Training Games</a>
                <a href="#/services/focus" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-target" style="color:var(--color-coral);font-size:20px;"></i> Focus Tools</a>
                <a href="#/services/map" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-map-pin" style="color:var(--color-coral);font-size:20px;"></i> Healing Location Map</a>
                <a href="#/services/tests" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-clipboard-text" style="color:var(--color-coral);font-size:20px;"></i> Psychological Tests</a>
                <a href="#/services/diary" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-book-open" style="color:var(--color-coral);font-size:20px;"></i> CBT Thought Diary</a>
                <a href="#/services/courses" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-graduation-cap" style="color:var(--color-coral);font-size:20px;"></i> Psychology Courses</a>
              </div>
              <div style="background:var(--color-cream);padding:24px;border-radius:12px;display:flex;flex-direction:column;justify-content:center;">
                <div style="width:48px;height:48px;background:white;border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--color-coral);font-size:24px;margin-bottom:16px;">
                  <i class="ph-fill ph-moon-stars"></i>
                </div>
                <h4 style="font-family:var(--font-serif);font-size:20px;color:var(--color-charcoal);margin-bottom:8px;">Try Dream Analysis</h4>
                <p style="font-size:14px;color:var(--color-text-muted);margin-bottom:24px;">Get a free psychological summary of your subconscious dreams.</p>
                <a href="#/services/dream" class="btn primary" style="width:100%;text-align:center;">Analyse Dream</a>
              </div>
            </div>
          </div>
          
          <a href="#/counsellors" class="nav-link ${activePath === '/counsellors' ? 'active' : ''}" style="color:var(--header-text-color);text-decoration:none;font-weight:500;">Find Counsellors</a>
          
          <div class="nav-item">
            <a href="#/resources" class="nav-link ${activePath === '/resources' ? 'active' : ''}" style="color:var(--header-text-color);text-decoration:none;font-weight:500;display:flex;align-items:center;gap:4px;">Resources <i class="ph-bold ph-caret-down" style="font-size:12px;"></i></a>
            <!-- RESOURCES DROPDOWN -->
            <div class="mega-dropdown resources">
              <a href="#/blog" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-article" style="color:var(--color-coral);font-size:20px;"></i> Blog</a>
              <a href="#/resources/guides" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-books" style="color:var(--color-coral);font-size:20px;"></i> Mental Health Guides</a>
              <a href="#/resources/cbt" style="display:flex;align-items:center;gap:12px;color:var(--color-charcoal);text-decoration:none;"><i class="ph-fill ph-brain" style="color:var(--color-coral);font-size:20px;"></i> CBT Explained</a>
              <div style="height:1px;background:rgba(0,0,0,0.1);margin:8px 0;"></div>
              <a href="#/crisis" style="display:flex;align-items:center;gap:12px;color:#E06A4E;text-decoration:none;font-weight:700;"><i class="ph-fill ph-phone-call" style="font-size:20px;"></i> Crisis Helplines</a>
            </div>
          </div>
          
          <a href="#/about" class="nav-link ${activePath === '/about' ? 'active' : ''}" style="color:var(--header-text-color);text-decoration:none;font-weight:500;">About Us</a>
        </div>

        <!-- RIGHT: ACTIONS -->
        <div class="nav-actions" style="display:flex;align-items:center;gap:16px;">
          <!-- Language Selector -->
          <div class="nav-item" style="color:var(--header-text-color);cursor:pointer;display:flex;align-items:center;gap:4px;font-size:14px;">
            <i class="ph ph-globe" style="font-size:20px;"></i> EN
            <div class="mega-dropdown" style="width:200px;grid-template-columns:1fr;padding:16px;left:auto;right:0;transform:translateX(0) translateY(10px);">
              <div style="font-weight:700;color:var(--color-charcoal);margin-bottom:12px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Select Language</div>
              <a href="#" style="color:var(--color-charcoal);text-decoration:none;padding:8px 0;">🇬🇧 English</a>
              <a href="#" style="color:var(--color-charcoal);text-decoration:none;padding:8px 0;">🇮🇳 Hindi</a>
              <a href="#" style="color:var(--color-charcoal);text-decoration:none;padding:8px 0;">🇮🇳 Tamil</a>
              <a href="#" style="color:var(--color-charcoal);text-decoration:none;padding:8px 0;">🇮🇳 Telugu</a>
            </div>
          </div>
          
          <a class="btn ghost" href="#/auth/user-login" style="height:44px;padding:0 24px;color:var(--color-coral);border-color:var(--color-coral);background:transparent;">Login</a>
          <a class="btn primary" href="#/auth/user-signup" style="height:44px;padding:0 24px;background:var(--color-coral);color:white;border:none;">Get Started</a>
          <button class="icon-button mobile-menu-button" type="button" data-action="toggle-menu" aria-label="Toggle menu" style="color:var(--header-text-color);display:none;">☰</button>
        </div>
      </nav>
    </header>
  `;
}

function siteFooter() {
  return html`
    <footer class="bg-charcoal" style="padding:80px 0 40px 0;border-top:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);">
      <div class="container grid-4" style="margin-bottom:64px;">
        <div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;color:white;">
            <i class="ph-fill ph-leaf" style="font-size:32px;color:var(--color-coral);"></i>
            <span style="font-family:var(--font-serif);font-size:24px;">MindHeal</span>
          </div>
          <p style="font-size:14px;line-height:1.6;margin-bottom:24px;">Your Mind. Your Healing.<br>A trusted space for therapy, AI counselling, and emotional well-being.</p>
          <div style="display:flex;gap:16px;">
            <a href="#" style="color:white;opacity:0.6;font-size:24px;" class="hover-opacity"><i class="ph-fill ph-instagram-logo"></i></a>
            <a href="#" style="color:white;opacity:0.6;font-size:24px;" class="hover-opacity"><i class="ph-fill ph-twitter-logo"></i></a>
            <a href="#" style="color:white;opacity:0.6;font-size:24px;" class="hover-opacity"><i class="ph-fill ph-linkedin-logo"></i></a>
          </div>
        </div>
        
        <div>
          <h4 style="color:white;font-weight:700;margin-bottom:24px;letter-spacing:0.05em;text-transform:uppercase;font-size:14px;">Services</h4>
          <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px;">
            <li><a href="#/services/ai-counselling" style="color:rgba(255,255,255,0.6);text-decoration:none;" class="hover-opacity">AI Counselling</a></li>
            <li><a href="#/counsellors" style="color:rgba(255,255,255,0.6);text-decoration:none;" class="hover-opacity">Human Therapists</a></li>
            <li><a href="#/services/tests" style="color:rgba(255,255,255,0.6);text-decoration:none;" class="hover-opacity">Clinical Tests</a></li>
            <li><a href="#/services/diary" style="color:rgba(255,255,255,0.6);text-decoration:none;" class="hover-opacity">Thought Diary</a></li>
            <li><a href="#/services/dream" style="color:rgba(255,255,255,0.6);text-decoration:none;" class="hover-opacity">Dream Analysis</a></li>
          </ul>
        </div>

        <div>
          <h4 style="color:white;font-weight:700;margin-bottom:24px;letter-spacing:0.05em;text-transform:uppercase;font-size:14px;">Company</h4>
          <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px;">
            <li><a href="#/about" style="color:rgba(255,255,255,0.6);text-decoration:none;" class="hover-opacity">About Us</a></li>
            <li><a href="#/careers" style="color:rgba(255,255,255,0.6);text-decoration:none;" class="hover-opacity">Careers</a></li>
            <li><a href="#/press" style="color:rgba(255,255,255,0.6);text-decoration:none;" class="hover-opacity">Press</a></li>
            <li><a href="#/contact" style="color:rgba(255,255,255,0.6);text-decoration:none;" class="hover-opacity">Contact</a></li>
          </ul>
        </div>

        <div>
          <h4 style="color:white;font-weight:700;margin-bottom:24px;letter-spacing:0.05em;text-transform:uppercase;font-size:14px;">Stay Updated</h4>
          <p style="font-size:14px;margin-bottom:16px;">Subscribe to our newsletter for mental health tips.</p>
          <div style="display:flex;gap:8px;">
            <input type="email" placeholder="Your email address" style="flex:1;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);padding:12px;border-radius:8px;color:white;outline:none;" />
            <button style="background:var(--color-coral);color:white;border:none;padding:12px 16px;border-radius:8px;cursor:pointer;font-weight:700;"><i class="ph-bold ph-paper-plane-right"></i></button>
          </div>
        </div>
      </div>
      <div class="container" style="border-top:1px solid rgba(255,255,255,0.1);padding-top:32px;display:flex;justify-content:space-between;align-items:center;font-size:14px;">
        <div>&copy; 2026 MindHeal. All rights reserved.</div>
        <div style="display:flex;gap:24px;">
          <a href="#" style="color:rgba(255,255,255,0.6);text-decoration:none;" class="hover-opacity">Privacy Policy</a>
          <a href="#" style="color:rgba(255,255,255,0.6);text-decoration:none;" class="hover-opacity">Terms of Service</a>
          <a href="#" style="color:rgba(255,255,255,0.6);text-decoration:none;" class="hover-opacity">Cookie Policy</a>
        </div>
      </div>
    </footer>
  `;
}

function homePage() {
  return html`
    <main>
      ${sectionHero()}
      ${sectionTrustStrip()}
      ${sectionProblemStatement()}
      ${sectionServices()}
      ${sectionHowItWorks()}
      ${sectionTests()}
      ${sectionToolkit()}
      ${sectionCourses()}
      ${sectionCounsellors()}
      ${sectionTestimonials()}
      ${sectionCounsellorCTA()}
      ${sectionPricing()}
      ${sectionEmergency()}
      ${sectionAppPromo()}
      ${sectionBlog()}
      ${sectionFinalCTA()}
    </main>
    ${globalFloatingWidgets()}
  `;
}

function sectionHero() {
  return html`
    <section class="bg-cream hero-banner-section" style="min-height:100vh;position:relative;overflow:hidden;display:flex;align-items:center;padding-top:120px;padding-bottom:80px;">
      <div class="orb-breathe" style="position:absolute;width:800px;height:800px;background:rgba(224,106,78,0.1);border-radius:50%;bottom:-200px;left:-200px;filter:blur(100px);"></div>
      <div class="orb-breathe delay-1" style="position:absolute;width:600px;height:600px;background:rgba(255,255,255,0.5);border-radius:50%;top:0;right:-100px;filter:blur(100px);"></div>
      <div class="orb-breathe delay-2" style="position:absolute;width:400px;height:400px;background:rgba(182,166,204,0.15);border-radius:50%;top:40%;left:20%;filter:blur(100px);"></div>
      
      <div class="container split-55-45" style="position:relative;z-index:10;align-items:center;">
        <!-- Left column -->
        <div class="reveal-up">
          <span style="display:inline-flex;align-items:center;gap:8px;background:rgba(224,106,78,0.1);padding:8px 16px;border-radius:999px;color:var(--color-coral);font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:32px;"><i class="ph-fill ph-sparkle"></i> India's First AI-Guided Mental Wellness Platform</span>
          <h1 style="font-family:var(--font-serif);font-size:72px;line-height:1.1;color:var(--color-charcoal);margin-bottom:32px;">
            Rewire Your Mind.<br/>
            <span style="color:var(--color-coral);font-style:italic;">Reclaim Your Life.</span>
          </h1>
          <p style="font-size:20px;line-height:1.6;color:var(--color-text-muted);margin-bottom:48px;max-width:90%;">
            Stop waiting months for therapy. Access our free clinical AI instantly, use evidence-based CBT tools, or book the top 1% of human experts today.
          </p>
          <div style="display:flex;gap:16px;align-items:center;">
            <a href="#/auth/user-signup" class="btn primary hover-lift" style="background:var(--color-coral);color:white;border-radius:999px;height:56px;padding:0 32px;font-size:18px;border:none;">Start Free with AI</a>
            <span style="color:rgba(0,0,0,0.4);font-weight:600;">or</span>
            <a href="#/counsellors" class="btn ghost hover-lift" style="border:1px solid rgba(0,0,0,0.4);color:var(--color-charcoal);border-radius:999px;height:56px;padding:0 32px;font-size:18px;background:transparent;">Book a Therapist</a>
          </div>
          
          <div style="margin-top:64px;display:flex;gap:32px;align-items:center;">
            <div style="display:flex;align-items:center;gap:16px;">
              <div style="display:flex;">
                <img src="https://i.pravatar.cc/100?img=1" style="width:40px;height:40px;border-radius:50%;border:2px solid var(--color-cream);position:relative;z-index:5;" />
                <img src="https://i.pravatar.cc/100?img=2" style="width:40px;height:40px;border-radius:50%;border:2px solid var(--color-cream);margin-left:-12px;position:relative;z-index:4;" />
                <img src="https://i.pravatar.cc/100?img=3" style="width:40px;height:40px;border-radius:50%;border:2px solid var(--color-cream);margin-left:-12px;position:relative;z-index:3;" />
                <img src="https://i.pravatar.cc/100?img=4" style="width:40px;height:40px;border-radius:50%;border:2px solid var(--color-cream);margin-left:-12px;position:relative;z-index:2;" />
                <div style="width:40px;height:40px;border-radius:50%;border:2px solid var(--color-cream);margin-left:-12px;position:relative;z-index:1;background:white;color:var(--color-charcoal);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">+50k</div>
              </div>
              <div style="font-size:14px;color:var(--color-text-muted);">Active Users<br/>Healing Daily</div>
            </div>
            <div style="width:1px;height:40px;background:rgba(0,0,0,0.1);"></div>
            <div>
              <div style="font-family:var(--font-serif);font-size:32px;color:var(--color-coral);line-height:1;">500+</div>
              <div style="font-size:14px;color:var(--color-text-muted);margin-top:4px;">Verified Experts</div>
            </div>
          </div>
        </div>
        
        <!-- Empty right column -->
        <div style="position:relative;"></div>
      </div>

      <!-- Absolutely positioned image flush with bottom -->
      <div class="reveal-up delay-200" style="position:absolute; bottom:0; right:max(0px, calc(50vw - 720px)); width:50%; max-width:800px; z-index:5; pointer-events:none;">
         <img src="assets/images/Hero_Image.png" alt="Calm wellness" style="width:100%; max-height:85vh; object-fit:contain; object-position:bottom right; display:block;" />
      </div>
    </section>
  `;
}

function sectionTrustStrip() {
  return html`
    <div class="marquee-container">
      <div class="marquee-content">
        ${[...Array(4)].map(() => `
          <span style="color:rgba(255,255,255,0.6);font-family:var(--font-serif);font-size:18px;font-style:italic;margin-right:64px;"><i class="ph-fill ph-check-circle" style="color:var(--color-coral);margin-right:8px;"></i> HIPAA Compliant</span>
          <span style="color:rgba(255,255,255,0.6);font-family:var(--font-serif);font-size:18px;font-style:italic;margin-right:64px;"><i class="ph-fill ph-check-circle" style="color:var(--color-coral);margin-right:8px;"></i> DPDP Act Ready</span>
          <span style="color:rgba(255,255,255,0.6);font-family:var(--font-serif);font-size:18px;font-style:italic;margin-right:64px;"><i class="ph-fill ph-check-circle" style="color:var(--color-coral);margin-right:8px;"></i> 256-bit Encryption</span>
          <span style="color:rgba(255,255,255,0.6);font-family:var(--font-serif);font-size:18px;font-style:italic;margin-right:64px;"><i class="ph-fill ph-check-circle" style="color:var(--color-coral);margin-right:8px;"></i> Verified RCI Experts</span>
          <span style="color:rgba(255,255,255,0.6);font-family:var(--font-serif);font-size:18px;font-style:italic;margin-right:64px;"><i class="ph-fill ph-check-circle" style="color:var(--color-coral);margin-right:8px;"></i> 100% Confidential</span>
        `).join('')}
      </div>
    </div>
  `;
}

function sectionProblemStatement() {
  return html`
    <section class="bg-cream" style="padding:160px 0;">
      <div class="container text-center mb-64 reveal-up">
        <h2 style="font-family:var(--font-serif);font-size:48px;color:var(--color-charcoal);margin-bottom:24px;">The System is Broken. We Fixed It.</h2>
      </div>
      <div class="container" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:32px;">
        <div class="card-problem reveal-up hover-lift">
          <div style="font-size:48px;color:var(--color-coral);margin-bottom:24px;animation:svg-fade 4s infinite;"><i class="ph-fill ph-clock-countdown"></i></div>
          <h3 style="font-size:24px;font-family:var(--font-serif);margin-bottom:16px;">The Waiting List Trap</h3>
          <p style="color:var(--color-text-muted);font-size:16px;line-height:1.6;">Average wait time for a good therapist in India is 6 weeks. Panic attacks don't wait. Our AI is available in 6 seconds.</p>
        </div>
        <div class="card-problem reveal-up delay-100 hover-lift">
          <div style="font-size:48px;color:var(--color-coral);margin-bottom:24px;animation:svg-fade 4s infinite 1s;"><i class="ph-fill ph-translate"></i></div>
          <h3 style="font-size:24px;font-family:var(--font-serif);margin-bottom:16px;">The Language Barrier</h3>
          <p style="color:var(--color-text-muted);font-size:16px;line-height:1.6;">Therapy isn't effective if you can't express yourself. We offer support in English, Hindi, Tamil, and Telugu.</p>
        </div>
        <div class="card-problem reveal-up delay-200 hover-lift">
          <div style="font-size:48px;color:var(--color-coral);margin-bottom:24px;animation:svg-fade 4s infinite 2s;"><i class="ph-fill ph-eye-slash"></i></div>
          <h3 style="font-size:24px;font-family:var(--font-serif);margin-bottom:16px;">The Stigma Tax</h3>
          <p style="color:var(--color-text-muted);font-size:16px;line-height:1.6;">Walking into a clinic is terrifying for many. Get completely anonymous, encrypted support from your bedroom.</p>
        </div>
      </div>
    </section>
  `;
}

function sectionServices() {
  const filter = state.serviceFilter || "all";
  return html`
    <section class="bg-charcoal" style="padding:160px 0;">
      <div class="container text-center mb-64 reveal-up">
        <h2 style="font-family:var(--font-serif);font-size:48px;color:var(--color-cream);margin-bottom:48px;">An Entire Clinic in Your Pocket.</h2>
      </div>
      <div id="services-bento-grid" class="container bento-grid" style="display:grid;grid-template-columns:repeat(3, 1fr);grid-auto-rows:minmax(380px, auto);gap:32px;">
        
        <!-- Card 1: AI Clinical Companion (Blue theme with floating chat bubbles) -->
        <div data-category="ai" class="reveal-up bento-card-custom" onclick="location.hash='#/auth/user-signup'" style="background:#d4e7f7;color:#1e293b;min-height:460px;${filter !== 'all' && filter !== 'ai' ? 'display:none;' : ''}">
          <div style="z-index:2;margin-bottom:24px;">
            <div style="width:56px;height:56px;background:rgba(235,94,40,0.1);border-radius:14px;display:flex;align-items:center;justify-content:center;color:var(--color-coral);font-size:28px;margin-bottom:24px;"><i class="ph-fill ph-robot"></i></div>
            <h3 style="font-family:var(--font-serif);font-size:28px;line-height:1.2;margin-bottom:12px;color:#0f172a;">AI Clinical Companion</h3>
            <p style="font-size:15px;color:#475569;line-height:1.6;">Experience evidence-based CBT support instantly. Our clinical AI guide is fine-tuned to assist with anxiety, stress, and mood tracking 24/7.</p>
          </div>
          
          <div style="position:relative;height:180px;width:100%;overflow:visible;margin-top:auto;">
            <!-- Floating Chat Bubble -->
            <div class="bento-chat-bubble" style="position:absolute;left:0;top:10px;background:white;border-radius:16px;padding:16px;box-shadow:0 8px 24px rgba(0,0,0,0.06);width:85%;transform:rotate(-3deg);transition:all 0.4s cubic-bezier(0.16,1,0.3,1);border:1px solid rgba(0,0,0,0.02);">
              <span style="font-size:13px;color:#334155;font-weight:500;line-height:1.4;display:block;">I'm here. Take your time. What feels most present for you today?</span>
              <div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#94a3b8;font-weight:600;">
                <span>MindHeal Guide</span>
                <span style="background:rgba(43,108,176,0.06);color:#2b6cb0;padding:2px 6px;border-radius:99px;font-size:10px;">Safety: active</span>
              </div>
            </div>
            
            <!-- Overlapping Mood Badge -->
            <div class="bento-glass-badge" style="position:absolute;right:10px;bottom:20px;background:rgba(255,255,255,0.75);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.6);border-radius:12px;padding:10px 14px;box-shadow:0 8px 20px rgba(0,0,0,0.05);transform:rotate(4deg);display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;color:#1e293b;transition:all 0.4s cubic-bezier(0.16,1,0.3,1);">
              <i class="ph-fill ph-smiley" style="color:var(--color-coral);font-size:18px;"></i>
              <span>Mood Logged</span>
            </div>
          </div>
        </div>

        <!-- Card 2: Real-Time Mood Analytics (Teal/Navy theme with mini graphs) -->
        <div data-category="self-care" class="reveal-up delay-100 bento-card-custom" onclick="location.hash='#/auth/user-signup'" style="background:#093a3e;color:white;min-height:460px;${filter !== 'all' && filter !== 'self-care' ? 'display:none;' : ''}">
          <div style="z-index:2;margin-bottom:24px;">
            <div style="width:56px;height:56px;background:rgba(255,255,255,0.1);border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:28px;margin-bottom:24px;"><i class="ph-fill ph-chart-line-up"></i></div>
            <h3 style="font-family:var(--font-serif);font-size:28px;line-height:1.2;margin-bottom:12px;">Mood Studio Analytics</h3>
            <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.6;">Log mood factors and visualize trends instantly with dynamic diagnostic indicators tracking your mind, body, and rest metrics.</p>
          </div>
          
          <div style="display:flex;gap:16px;justify-content:space-between;align-items:flex-end;margin-top:auto;width:100%;height:160px;overflow:visible;">
            <!-- Mini Card Left (Horizontal Bars) -->
            <div class="bento-mini-card left" style="background:white;border-radius:16px;padding:14px;width:48%;box-shadow:0 8px 24px rgba(0,0,0,0.15);transform:translateY(10px) rotate(-2deg);transition:all 0.4s cubic-bezier(0.16,1,0.3,1);">
              <div style="font-size:10px;font-weight:800;color:#94a3b8;margin-bottom:10px;letter-spacing:0.05em;">SPECTRUM</div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                <div>
                  <div style="display:flex;justify-content:space-between;font-size:9px;color:#64748b;font-weight:600;margin-bottom:2px;"><span>Energy</span><span>80%</span></div>
                  <div style="width:100%;height:4px;background:#f1f5f9;border-radius:2px;"><div class="progress-fill-energy" style="height:100%;background:var(--color-coral);border-radius:2px;"></div></div>
                </div>
                <div>
                  <div style="display:flex;justify-content:space-between;font-size:9px;color:#64748b;font-weight:600;margin-bottom:2px;"><span>Sleep</span><span>65%</span></div>
                  <div style="width:100%;height:4px;background:#f1f5f9;border-radius:2px;"><div class="progress-fill-sleep" style="height:100%;background:#805ad5;border-radius:2px;"></div></div>
                </div>
              </div>
            </div>
            
            <!-- Mini Card Right (Overlapping circular bubble metrics) -->
            <div class="bento-mini-card right" style="background:white;border-radius:16px;padding:14px;width:48%;box-shadow:0 8px 24px rgba(0,0,0,0.15);transform:translateY(20px) rotate(2deg);transition:all 0.4s cubic-bezier(0.16,1,0.3,1);height:115px;display:flex;flex-direction:column;justify-content:space-between;">
              <div style="font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:0.05em;">DIAGNOSTICS</div>
              <div style="position:relative;height:64px;width:100%;display:flex;justify-content:center;align-items:center;">
                <!-- SVG Overlapping Bubble Chart -->
                <svg viewBox="0 0 100 60" style="width:80px;height:50px;">
                  <circle cx="35" cy="30" r="22" fill="#319795" fill-opacity="0.75" class="diag-circle-1" />
                  <circle cx="65" cy="30" r="18" fill="var(--color-coral)" fill-opacity="0.8" class="diag-circle-2" />
                  <circle cx="50" cy="22" r="14" fill="#2b6cb0" fill-opacity="0.7" class="diag-circle-3" />
                  <text x="35" y="33" font-size="7" font-weight="700" fill="white" text-anchor="middle">39%</text>
                  <text x="65" y="33" font-size="7" font-weight="700" fill="white" text-anchor="middle">26%</text>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 3A: CBT Toolkit (Dream Analysis module with cutout) -->
        <div data-category="self-care" class="reveal-up delay-200 bento-card-custom" onclick="location.hash='#/auth/user-signup'" style="background:#eae3d2;color:#1e293b;min-height:380px;justify-content:flex-start;${filter !== 'all' && filter !== 'self-care' ? 'display:none;' : ''}">
          <div style="z-index:2;margin-bottom:24px;max-width:85%;">
            <div style="width:56px;height:56px;background:rgba(0,0,0,0.04);border-radius:14px;display:flex;align-items:center;justify-content:center;color:var(--color-charcoal);font-size:28px;margin-bottom:24px;"><i class="ph-fill ph-moon-stars"></i></div>
            <h3 style="font-family:var(--font-serif);font-size:28px;line-height:1.2;margin-bottom:12px;color:#1e293b;">Dream Analysis</h3>
            <p style="font-size:15px;color:#475569;line-height:1.6;">Explore clinical-grade dream journaling to decode subconscious symbols and archetypes using Jungian frameworks.</p>
          </div>
          
          <!-- Realistic Image Cutout -->
          <img class="bento-cutout-img" src="assets/images/dream_cutout.png" alt="Dream Analysis illustration" style="bottom:-10px;right:-15px;width:62%;opacity:0.92;z-index:1;" />
          
          <div style="display:flex;flex-direction:column;gap:16px;width:70%;margin-top:auto;z-index:2;position:relative;">
            <div class="bento-sidebar-item-card" style="padding:12px 16px;background:rgba(255,255,255,0.9);backdrop-filter:blur(8px);">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="width:6px;height:6px;border-radius:50%;background:#3182ce;"></span>
                <i class="ph-bold ph-moon-stars" style="font-size:16px;color:#4a5568;"></i>
                <span style="font-size:13px;color:#2d3748;font-weight:700;">Dream Analysis</span>
              </div>
              <i class="ph ph-caret-right" style="font-size:12px;color:#cbd5e1;margin-left:8px;"></i>
            </div>
          </div>
        </div>

        <!-- Card 3B: Psychological Reports (Signature & Handwriting module with cutout) -->
        <div data-category="self-care" class="reveal-up delay-200 bento-card-custom" onclick="location.hash='#/auth/user-signup'" style="background:#e5ded2;color:#1e293b;min-height:380px;justify-content:flex-start;${filter !== 'all' && filter !== 'self-care' ? 'display:none;' : ''}">
          <div style="z-index:2;margin-bottom:24px;max-width:85%;">
            <div style="width:56px;height:56px;background:rgba(0,0,0,0.04);border-radius:14px;display:flex;align-items:center;justify-content:center;color:var(--color-charcoal);font-size:28px;margin-bottom:24px;"><i class="ph-fill ph-signature"></i></div>
            <h3 style="font-family:var(--font-serif);font-size:28px;line-height:1.2;margin-bottom:12px;color:#1e293b;">Signature & Script</h3>
            <p style="font-size:15px;color:#475569;line-height:1.6;">Access detailed stroke metrics and handwriting signature reports to discover core personality indicators.</p>
          </div>
          
          <!-- Realistic Image Cutout -->
          <img class="bento-cutout-img" src="assets/images/signature_cutout.png" alt="Handwriting Analysis illustration" style="bottom:-20px;right:-15px;width:58%;opacity:0.95;z-index:1;" />
          
          <div style="display:flex;flex-direction:column;gap:16px;width:70%;margin-top:auto;z-index:2;position:relative;">
            <div class="bento-sidebar-item-card" style="padding:12px 16px;background:rgba(255,255,255,0.9);backdrop-filter:blur(8px);">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="width:6px;height:6px;border-radius:50%;background:#805ad5;"></span>
                <i class="ph-bold ph-signature" style="font-size:16px;color:#4a5568;"></i>
                <span style="font-size:13px;color:#2d3748;font-weight:700;">Signature Profiling</span>
              </div>
              <i class="ph ph-caret-right" style="font-size:12px;color:#cbd5e1;margin-left:8px;"></i>
            </div>
          </div>
        </div>

        <!-- Card 4: Meet your collaborators (Wide bottom card with real camera image) -->
        <div data-category="human" class="reveal-up delay-100 bento-card-wide" onclick="location.hash='#/counsellors'" style="cursor:pointer;grid-column:span 2;background:#f8f9fa;border:1px solid rgba(0,0,0,0.05);border-radius:24px;display:flex;overflow:hidden;position:relative;min-height:320px;align-items:stretch;${filter !== 'all' && filter !== 'human' ? 'display:none;' : ''}">
          <div style="flex:1.2;padding:48px;display:flex;flex-direction:column;justify-content:center;gap:16px;z-index:2;">
            <div style="width:48px;height:48px;background:rgba(235,94,40,0.06);border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--color-coral);font-size:24px;margin-bottom:8px;"><i class="ph-fill ph-users"></i></div>
            <h3 style="font-family:var(--font-serif);font-size:28px;line-height:1.2;color:#1e293b;">Meet Verified Counsellors</h3>
            <p style="font-size:15px;color:#64748b;line-height:1.6;max-width:90%;">Book consultations with certified clinical psychologists. Seamlessly hand off from AI guidance to dedicated human experts whenever you choose.</p>
            <span style="display:inline-flex;align-items:center;gap:8px;color:var(--color-coral);font-weight:700;text-decoration:none;font-size:15px;margin-top:8px;">View active counsellors <i class="ph-bold ph-arrow-right"></i></span>
          </div>
          
          <!-- Camera-realistic image container occupying the right side -->
          <div style="flex:0.8;position:relative;overflow:hidden;background:#cbd5e1;">
            <img class="bento-counsellor-img" src="assets/images/real_hero.png" alt="Verified professional psychologists" style="width:100%;height:100%;object-fit:cover;" />
            <!-- Soft gradient layout matching the laptop photo styling -->
            <div style="position:absolute;inset:0;background:linear-gradient(to right, #f8f9fa 0%, rgba(248,249,250,0.5) 20%, transparent 100%);"></div>
          </div>
        </div>

      </div>
    </section>
  `;
}

function sectionHowItWorks() {
  return html`
    <section class="bg-white" style="padding:160px 0;">
      <div class="container text-center mb-64 reveal-up">
        <span style="color:var(--color-coral);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Simple Process</span>
        <h2 style="font-family:var(--font-serif);font-size:48px;color:var(--color-charcoal);margin-top:16px;">Healing, Decoded.</h2>
      </div>
      <div class="container" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:48px;position:relative;">
        <div class="timeline-connector"></div>
        
        <div class="timeline-step reveal-up">
          <div style="position:absolute;top:-40px;left:0;font-size:120px;font-family:var(--font-serif);font-weight:900;color:rgba(0,0,0,0.03);z-index:-1;">01</div>
          <div style="width:48px;height:48px;background:var(--color-cream);border:2px solid var(--color-coral);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--color-coral);margin-bottom:32px;">1</div>
          <h3 style="font-family:var(--font-serif);font-size:24px;margin-bottom:16px;">Create Free Account</h3>
          <p style="color:var(--color-text-muted);font-size:16px;line-height:1.6;">Sign up instantly. Your data is encrypted and completely confidential.</p>
        </div>
        
        <div class="timeline-step reveal-up delay-100">
          <div style="position:absolute;top:-40px;left:0;font-size:120px;font-family:var(--font-serif);font-weight:900;color:rgba(0,0,0,0.03);z-index:-1;">02</div>
          <div style="width:48px;height:48px;background:var(--color-coral);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:24px;margin-bottom:32px;"><i class="ph-bold ph-git-branch"></i></div>
          <h3 style="font-family:var(--font-serif);font-size:24px;margin-bottom:16px;">Choose Your Path</h3>
          <p style="color:var(--color-text-muted);font-size:16px;line-height:1.6;">Start a free session with our clinical AI, or browse our directory of human experts.</p>
        </div>
        
        <div class="timeline-step reveal-up delay-200">
          <div style="position:absolute;top:-40px;left:0;font-size:120px;font-family:var(--font-serif);font-weight:900;color:rgba(0,0,0,0.03);z-index:-1;">03</div>
          <div style="width:48px;height:48px;background:var(--color-charcoal);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:24px;margin-bottom:32px;"><i class="ph-bold ph-heartbeat"></i></div>
          <h3 style="font-family:var(--font-serif);font-size:24px;margin-bottom:16px;">Begin Healing</h3>
          <p style="color:var(--color-text-muted);font-size:16px;line-height:1.6;">Use the CBT diary, take psych tests, and track your mood daily to see real progress.</p>
        </div>
      </div>
    </section>
  `;
}

window.clinicalTestsData = [
  { 
    name: 'PHQ-9 (Depression)', short: 'PHQ-9', full: 'Patient Health Questionnaire', desc: 'Standardized clinical assessment for depression severity.',
    questions: [
      "Little interest or pleasure in doing things?",
      "Feeling down, depressed, or hopeless?",
      "Trouble falling or staying asleep, or sleeping too much?",
      "Feeling tired or having little energy?",
      "Poor appetite or overeating?",
      "Feeling bad about yourself - or that you are a failure or have let yourself or your family down?",
      "Trouble concentrating on things, such as reading the newspaper or watching television?",
      "Moving or speaking so slowly that other people could have noticed? Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual?",
      "Thoughts that you would be better off dead, or of hurting yourself in some way?"
    ],
    options: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
    scoring: [
      { max: 4, label: "Minimal Depression" },
      { max: 9, label: "Mild Depression" },
      { max: 14, label: "Moderate Depression" },
      { max: 19, label: "Moderately Severe Depression" },
      { max: 27, label: "Severe Depression" }
    ]
  },
  { 
    name: 'GAD-7 (Anxiety)', short: 'GAD-7', full: 'Generalized Anxiety Disorder Assessment', desc: 'Standardized clinical assessment for anxiety severity.',
    questions: [
      "Feeling nervous, anxious, or on edge?",
      "Not being able to stop or control worrying?",
      "Worrying too much about different things?",
      "Trouble relaxing?",
      "Being so restless that it is hard to sit still?",
      "Becoming easily annoyed or irritable?",
      "Feeling afraid as if something awful might happen?"
    ],
    options: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
    scoring: [
      { max: 4, label: "Minimal Anxiety" },
      { max: 9, label: "Mild Anxiety" },
      { max: 14, label: "Moderate Anxiety" },
      { max: 21, label: "Severe Anxiety" }
    ]
  },
  { name: 'Adult ADHD (ASRS)', short: 'ASRS', full: 'Adult ADHD Self-Report Scale', desc: 'Screening tool for Attention Deficit Hyperactivity Disorder.', placeholder: true },
  { name: 'PTSD Checklist (PCL-5)', short: 'PCL-5', full: 'PTSD Checklist for DSM-5', desc: 'Clinical assessment for Post-Traumatic Stress Disorder.', placeholder: true },
  { name: 'Bipolar Spectrum', short: 'MDQ', full: 'Mood Disorder Questionnaire', desc: 'Screening tool for bipolar spectrum disorders.', placeholder: true },
  { name: 'OCD Screening', short: 'OCI-R', full: 'Obsessive-Compulsive Inventory', desc: 'Assessment for symptoms of Obsessive-Compulsive Disorder.', placeholder: true },
  { name: 'Attachment Style', short: 'ECR', full: 'Experiences in Close Relationships', desc: 'Assessment of adult attachment styles in relationships.', placeholder: true },
  { name: 'Burnout Inventory', short: 'MBI', full: 'Maslach Burnout Inventory', desc: 'Standardized measure of occupational burnout.', placeholder: true },
  { name: 'Self-Esteem Index', short: 'RSES', full: 'Rosenberg Self-Esteem Scale', desc: 'Measure of global self-worth and self-esteem.', placeholder: true },
  { name: 'Anger Management', short: 'BDI', full: 'Buss-Perry Aggression Questionnaire', desc: 'Clinical measure of aggressive and angry behavior.', placeholder: true },
  { name: 'Relationship Satisfaction', short: 'CSI', full: 'Couples Satisfaction Index', desc: 'Measure of satisfaction in romantic relationships.', placeholder: true },
  { name: 'Sleep Quality', short: 'PSQI', full: 'Pittsburgh Sleep Quality Index', desc: 'Clinical assessment of sleep quality and patterns.', placeholder: true }
];

window.currentTestState = { testIndex: 0, questionIndex: 0, score: 0, isFinished: false };

window.changeTestPreview = function(index, el) {
  if (el) {
    document.querySelectorAll('.test-list-item').forEach(item => item.classList.remove('active'));
    el.classList.add('active');
  }
  window.currentTestState = { testIndex: index, questionIndex: 0, score: 0, isFinished: false };
  window.renderTestContent();
};

window.handleTestAnswer = function(points) {
  const state = window.currentTestState;
  const test = window.clinicalTestsData[state.testIndex];
  state.score += points;
  state.questionIndex++;
  
  if (state.questionIndex >= test.questions.length) {
    state.isFinished = true;
  }
  window.renderTestContent(true);
};

window.renderTestContent = function(isNextQuestion = false) {
  const state = window.currentTestState;
  const test = window.clinicalTestsData[state.testIndex];
  const card = document.getElementById('test-preview-card');
  const container = document.getElementById('test-interactive-container');
  if (!card || !container) return;
  
  if (isNextQuestion) {
    container.style.transition = 'transform 0.5s ease-out, opacity 0.4s ease-out';
    container.style.transform = 'translateY(150%) rotate(-4deg)';
    container.style.opacity = '0';
  } else {
    card.style.opacity = '0';
    card.style.transform = 'translateY(10px)';
  }
  
  setTimeout(() => {
    document.getElementById('test-preview-tag').innerText = test.short;
    document.getElementById('test-preview-title').innerText = test.full;
    document.getElementById('test-preview-desc').innerText = test.desc;
    
    if (test.placeholder) {
      container.innerHTML = `
        <div style="text-align:center;padding:48px 0;">
          <div style="font-size:48px;color:var(--color-coral);margin-bottom:16px;"><i class="ph-fill ph-lock-key"></i></div>
          <h4 style="font-family:var(--font-serif);font-size:24px;margin-bottom:8px;">Premium Assessment</h4>
          <p style="color:var(--color-text-muted);margin-bottom:24px;">Create a free account to unlock this clinical assessment and track your results.</p>
          <a href="#/auth/user-signup" class="btn primary">Unlock Assessment</a>
        </div>
      `;
    } else if (state.isFinished) {
      let severityLabel = "Result";
      for (let bracket of test.scoring) {
        if (state.score <= bracket.max) {
          severityLabel = bracket.label;
          break;
        }
      }
      container.innerHTML = `
        <div style="text-align:center;padding:32px 0;">
          <div style="font-size:16px;color:var(--color-text-muted);margin-bottom:8px;">Assessment Complete</div>
          <div style="font-size:64px;font-family:var(--font-serif);color:var(--color-coral);line-height:1;">${state.score}</div>
          <h4 style="font-family:var(--font-serif);font-size:24px;margin-top:16px;margin-bottom:8px;">${severityLabel}</h4>
          <p style="color:var(--color-text-muted);margin-bottom:32px;">This is a screening tool, not a diagnosis. To discuss these results, please consult a clinical psychologist.</p>
          <a href="#/counsellors" class="btn primary" style="background:var(--color-charcoal);color:white;width:100%;justify-content:center;margin-bottom:12px;">Discuss with a Counsellor</a>
          <button onclick="window.changeTestPreview(${state.testIndex})" class="btn" style="background:var(--color-cream);width:100%;justify-content:center;border:1px solid rgba(0,0,0,0.1);">Retake Assessment</button>
        </div>
      `;
    } else {
      const progress = ((state.questionIndex) / test.questions.length) * 100;
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <p style="font-weight:700;margin:0;">Question ${state.questionIndex + 1} of ${test.questions.length}</p>
          <span style="font-size:12px;color:var(--color-text-muted);">Over the last 2 weeks</span>
        </div>
        <div style="width:100%;height:4px;background:rgba(0,0,0,0.05);border-radius:2px;margin-bottom:24px;overflow:hidden;">
          <div style="height:100%;background:var(--color-coral);width:${progress}%;transition:width 0.3s ease;"></div>
        </div>
        <p style="font-size:18px;font-family:var(--font-serif);margin-bottom:32px;">"${test.questions[state.questionIndex]}"</p>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${test.options.map((opt, i) => `
            <button onclick="window.handleTestAnswer(${i})" class="test-option-btn">${opt}</button>
          `).join('')}
        </div>
      `;
    }
    
    if (isNextQuestion) {
      container.style.transition = 'none';
      container.style.transform = 'translateY(-150%) rotate(4deg)';
      void container.offsetWidth; // Force reflow
      container.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease';
      container.style.transform = 'translateY(0) rotate(0deg)';
      container.style.opacity = '1';
    } else {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }
  }, 400);
};

function sectionTests() {
  // Ensure state matches the first test initially
  window.currentTestState = { testIndex: 0, questionIndex: 0, score: 0, isFinished: false };
  const tests = window.clinicalTestsData;
  const initialTest = tests[0];

  return html`
    <section class="bg-charcoal" style="padding:160px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
      <div class="container text-center mb-64 reveal-up">
        <span style="color:var(--color-coral);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Know Thyself</span>
        <h2 style="font-family:var(--font-serif);font-size:48px;color:white;margin-top:16px;">12 Free Clinical Tests.</h2>
      </div>
      <div class="container split-30-70">
        <div class="reveal-up" style="border-right:1px solid rgba(255,255,255,0.1);padding-right:32px;">
          <h3 style="font-family:var(--font-serif);color:white;font-size:24px;margin-bottom:24px;">Available Assessments</h3>
          <ul style="list-style:none;padding:0;margin:0;">
            ${tests.map((test, index) => `
              <li style="margin-bottom:4px;">
                <a onclick="window.changeTestPreview(${index}, this); return false;" class="test-list-item ${index === 0 ? 'active' : ''}">
                  <i class="ph-bold ph-caret-right" style="font-size:12px;"></i> ${test.name}
                </a>
              </li>
            `).join('')}
          </ul>
        </div>
        <div class="reveal-up delay-100">
          <div style="background:#2A2A28;border-radius:24px;padding:48px;position:relative;overflow:hidden;">
            <div id="test-preview-card" class="test-preview-card" style="opacity: 1; transform: translateY(0);">
              <div style="margin-bottom:32px;">
                <span id="test-preview-tag" style="background:rgba(255,255,255,0.1);color:white;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;">${initialTest.short}</span>
                <h3 id="test-preview-title" style="font-family:var(--font-serif);color:white;font-size:32px;margin-top:16px;">${initialTest.full}</h3>
                <p id="test-preview-desc" style="color:rgba(255,255,255,0.6);font-size:16px;margin-top:8px;">${initialTest.desc}</p>
              </div>
              <div id="test-interactive-container" style="background:white;border-radius:16px;padding:32px;color:var(--color-charcoal);box-shadow:0 24px 48px rgba(0,0,0,0.2);">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                  <p style="font-weight:700;margin:0;">Question 1 of ${initialTest.questions.length}</p>
                  <span style="font-size:12px;color:var(--color-text-muted);">Over the last 2 weeks</span>
                </div>
                <div style="width:100%;height:4px;background:rgba(0,0,0,0.05);border-radius:2px;margin-bottom:24px;overflow:hidden;">
                  <div style="height:100%;background:var(--color-coral);width:0%;transition:width 0.3s ease;"></div>
                </div>
                <p style="font-size:18px;font-family:var(--font-serif);margin-bottom:32px;">"${initialTest.questions[0]}"</p>
                <div style="display:flex;flex-direction:column;gap:12px;">
                  ${initialTest.options.map((opt, i) => `
                    <button onclick="window.handleTestAnswer(${i})" class="test-option-btn">${opt}</button>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

window.cbtToolkitData = [
  {
    icon: "ph-book-open", name: "Thought Diary",
    title: "The Thought Record", desc: "Identify cognitive distortions and challenge negative thoughts before they spiral into panic.",
    leftBoxName: "Situation", leftBoxDesc: "My manager asked for a quick meeting.",
    rightBoxName: "Automatic Thought", rightBoxDesc: '"I am going to be fired. I\'m a failure."',
    ctaText: "Open Diary", ctaLink: "#/auth/user-signup"
  },
  {
    icon: "ph-target", name: "Exposure Hierarchy",
    title: "Fear Ladder", desc: "Gradually face your fears in a structured, safe manner to desensitize your anxiety.",
    leftBoxName: "Goal", leftBoxDesc: "Attend a crowded social gathering.",
    rightBoxName: "Step 1", rightBoxDesc: "Say hello to a cashier at the grocery store.",
    ctaText: "Build Ladder", ctaLink: "#/auth/user-signup"
  },
  {
    icon: "ph-chart-polar", name: "Behavioral Activation",
    title: "Activity Scheduling", desc: "Break the cycle of depression by scheduling small, rewarding activities.",
    leftBoxName: "Current State", leftBoxDesc: "Staying in bed all weekend feeling unmotivated.",
    rightBoxName: "Action", rightBoxDesc: "Go for a 10-minute walk outside in the morning.",
    ctaText: "Schedule Activity", ctaLink: "#/auth/user-signup"
  },
  {
    icon: "ph-leaf", name: "Grounding Techniques",
    title: "The 5-4-3-2-1 Method", desc: "Anchor yourself in the present moment when experiencing severe anxiety or dissociation.",
    leftBoxName: "Panic Trigger", leftBoxDesc: "Heart racing, feeling completely detached from reality.",
    rightBoxName: "Grounding Action", rightBoxDesc: "Name 5 things you can see, 4 you can touch...",
    ctaText: "Start Grounding", ctaLink: "#/auth/user-signup"
  },
  {
    icon: "ph-clock-counter-clockwise", name: "Worry Time",
    title: "Scheduled Worrying", desc: "Postpone your anxious thoughts to a dedicated 15-minute window each day.",
    leftBoxName: "Intrusive Thought", leftBoxDesc: '"What if I fail my presentation tomorrow?"',
    rightBoxName: "Action", rightBoxDesc: "Write it down and delay worrying until 6:00 PM.",
    ctaText: "Set Worry Time", ctaLink: "#/auth/user-signup"
  }
];

window.changeToolkitPreview = function(index, el) {
  if (el) {
    document.querySelectorAll('.cbt-tab').forEach(item => item.classList.remove('active'));
    el.classList.add('active');
  }
  
  const tool = window.cbtToolkitData[index];
  const card = document.getElementById('toolkit-preview-card');
  if (!card) return;
  
  card.style.opacity = '0';
  card.style.transform = 'translateY(10px)';
  
  setTimeout(() => {
    document.getElementById('toolkit-title').innerText = tool.title;
    document.getElementById('toolkit-desc').innerText = tool.desc;
    document.getElementById('toolkit-left-name').innerText = tool.leftBoxName;
    document.getElementById('toolkit-left-desc').innerText = tool.leftBoxDesc;
    document.getElementById('toolkit-right-name').innerText = tool.rightBoxName;
    document.getElementById('toolkit-right-desc').innerText = tool.rightBoxDesc;
    
    const ctaBtn = document.getElementById('toolkit-cta-btn');
    ctaBtn.innerText = tool.ctaText;
    ctaBtn.href = tool.ctaLink;
    
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  }, 300);
};

function sectionToolkit() {
  const tools = window.cbtToolkitData;
  const initialTool = tools[0];

  return html`
    <section class="bg-cream" style="padding:160px 0;">
      <div class="container text-center mb-64 reveal-up">
        <span style="color:var(--color-coral);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">CBT Toolkit</span>
        <h2 style="font-family:var(--font-serif);font-size:48px;color:var(--color-charcoal);margin-top:16px;">Rewire Your Brain.</h2>
      </div>
      <div class="container split-30-70">
        <div class="reveal-up" style="display:flex;flex-direction:column;gap:16px;">
          ${tools.map((tool, index) => `
            <div onclick="window.changeToolkitPreview(${index}, this)" class="cbt-tab ${index === 0 ? 'active' : ''}" style="cursor:pointer;transition:all 0.3s ease;">
              <i class="ph-fill ${tool.icon}"></i> ${tool.name}
            </div>
          `).join('')}
        </div>
        <div class="reveal-up delay-100">
          <div id="toolkit-preview-card" style="background:white;border-radius:24px;padding:48px;box-shadow:0 32px 64px rgba(0,0,0,0.05);border:1px solid var(--color-border);transition:opacity 0.3s ease, transform 0.3s ease;opacity:1;transform:translateY(0);">
            <h3 id="toolkit-title" style="font-family:var(--font-serif);font-size:32px;color:var(--color-charcoal);margin-bottom:16px;">${initialTool.title}</h3>
            <p id="toolkit-desc" style="color:var(--color-text-muted);margin-bottom:32px;line-height:1.6;">${initialTool.desc}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;">
              <div style="background:var(--color-cream);padding:24px;border-radius:12px;">
                <div id="toolkit-left-name" style="font-weight:700;font-size:12px;text-transform:uppercase;color:var(--color-coral);margin-bottom:8px;">${initialTool.leftBoxName}</div>
                <p id="toolkit-left-desc" style="font-size:14px;color:var(--color-charcoal);">${initialTool.leftBoxDesc}</p>
              </div>
              <div style="background:#FFF0ED;padding:24px;border-radius:12px;">
                <div id="toolkit-right-name" style="font-weight:700;font-size:12px;text-transform:uppercase;color:var(--color-coral);margin-bottom:8px;">${initialTool.rightBoxName}</div>
                <p id="toolkit-right-desc" style="font-size:14px;color:var(--color-charcoal);">${initialTool.rightBoxDesc}</p>
              </div>
            </div>
            <a id="toolkit-cta-btn" href="${initialTool.ctaLink}" class="btn primary" style="background:var(--color-charcoal);color:white;">${initialTool.ctaText}</a>
          </div>
        </div>
      </div>
    </section>
  `;
}

function sectionCourses() {
  return html`
    <section class="bg-charcoal" style="padding:160px 0;overflow:hidden;">
      <div class="container text-center mb-64 reveal-up">
        <h2 style="font-family:var(--font-serif);font-size:48px;color:white;margin-bottom:24px;">Master Your Mind.</h2>
        <p style="color:rgba(255,255,255,0.6);font-size:18px;">Expert-led video courses on psychology and self-improvement.</p>
      </div>
      <div class="horizontal-scroll" style="padding-left:max(32px, calc((100vw - var(--max-page)) / 2));">
        ${[
          {t: "Overcoming Social Anxiety", d: "6 Modules", c: "Dr. Sharma", i: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800"},
          {t: "Healing from Toxic Relationships", d: "8 Modules", c: "Dr. Verma", i: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800"},
          {t: "The Science of Deep Sleep", d: "4 Modules", c: "Dr. Iyer", i: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=800"},
          {t: "Emotional Regulation 101", d: "5 Modules", c: "Dr. Singh", i: "https://images.unsplash.com/photo-1528716321680-815a8cdb8cbe?w=800"}
        ].map(c => `
          <div class="scroll-item hover-lift" style="background:#1A1A18;border-radius:24px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;position:relative;">
            <img src="${c.i}" style="width:100%;height:240px;object-fit:cover;opacity:0.7;border-bottom:1px solid rgba(255,255,255,0.1);" />
            <div style="position:absolute;top:24px;right:24px;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);color:white;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;"><i class="ph-fill ph-play-circle"></i> Video Course</div>
            <div style="padding:32px;">
              <h3 style="font-family:var(--font-serif);color:white;font-size:24px;margin-bottom:16px;">${c.t}</h3>
              <div style="display:flex;align-items:center;gap:16px;color:rgba(255,255,255,0.6);font-size:14px;">
                <span><i class="ph-bold ph-stack"></i> ${c.d}</span>
                <span><i class="ph-bold ph-chalkboard-teacher"></i> ${c.c}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function sectionCounsellors() {
  const filter = state.counsellorFilter || 'all';
  return html`
    <section class="bg-white" style="padding:160px 0;">
      <div class="container text-center mb-64 reveal-up">
        <span style="color:var(--color-coral);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">The Top 1%</span>
        <h2 style="font-family:var(--font-serif);font-size:48px;color:var(--color-charcoal);margin-top:16px;margin-bottom:32px;">Meet Your Match.</h2>
        <div class="filter-pills">
          <span class="filter-pill ${filter === 'all' ? 'active' : ''}" onclick="window.filterCounsellors('all')" data-filter="all" style="cursor:pointer;">All Experts</span>
          <span class="filter-pill ${filter === 'clinical' ? 'active' : ''}" onclick="window.filterCounsellors('clinical')" data-filter="clinical" style="cursor:pointer;">Clinical Psychologists</span>
          <span class="filter-pill ${filter === 'trauma' ? 'active' : ''}" onclick="window.filterCounsellors('trauma')" data-filter="trauma" style="cursor:pointer;">Trauma Specialists</span>
          <span class="filter-pill ${filter === 'relationship' ? 'active' : ''}" onclick="window.filterCounsellors('relationship')" data-filter="relationship" style="cursor:pointer;">Relationship Counsellors</span>
          <span class="filter-pill ${filter === 'child' ? 'active' : ''}" onclick="window.filterCounsellors('child')" data-filter="child" style="cursor:pointer;">Child Psychologists</span>
        </div>
      </div>
      <div class="container grid-4">
        ${[
          {cat: "clinical", n: "Dr. Anjali Sharma", t: "CLINICAL PSYCHOLOGIST", e: "12+ Years Exp", l: "English, Hindi", r: "4.9", rv: "120", p: "800", img: "https://i.pravatar.cc/300?img=47"},
          {cat: "relationship", n: "Dr. Rohan Verma", t: "RELATIONSHIP COUNSELLOR", e: "8+ Years Exp", l: "English", r: "4.8", rv: "85", p: "1200", img: "https://i.pravatar.cc/300?img=11"},
          {cat: "trauma", n: "Ms. Priya Iyer", t: "TRAUMA SPECIALIST", e: "5+ Years Exp", l: "English, Tamil", r: "5.0", rv: "200", p: "500", img: "https://i.pravatar.cc/300?img=32"},
          {cat: "child", n: "Dr. Kabir Singh", t: "CHILD PSYCHOLOGIST", e: "15+ Years Exp", l: "English, Hindi, Punjabi", r: "4.7", rv: "340", p: "1500", img: "https://i.pravatar.cc/300?img=68"}
        ].map((doc, i) => `
          <div data-category="${doc.cat}" class="counsellor-profile hover-lift reveal-up delay-${i*100}" style="text-align:center;padding:32px;background:var(--color-cream);border-radius:24px;border:1px solid var(--color-border);position:relative;${filter !== 'all' && filter !== doc.cat ? 'display:none;' : ''}">
            <div style="position:absolute;top:16px;right:16px;background:white;padding:4px 8px;border-radius:8px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:4px;box-shadow:0 4px 12px rgba(0,0,0,0.05);"><i class="ph-fill ph-star" style="color:#FFBD2E;"></i> ${doc.r}</div>
            <img src="${doc.img}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;margin:0 auto 24px auto;border:4px solid white;box-shadow:0 12px 24px rgba(0,0,0,0.1);" />
            <h3 style="font-family:var(--font-serif);font-size:20px;color:var(--color-charcoal);margin-bottom:8px;">${doc.n}</h3>
            <div style="font-size:12px;color:var(--color-coral);font-weight:700;margin-bottom:16px;letter-spacing:0.05em;">${doc.t}</div>
            <div style="display:flex;justify-content:center;gap:16px;font-size:14px;color:var(--color-text-muted);margin-bottom:24px;">
              <span><i class="ph-bold ph-briefcase"></i> ${doc.e}</span>
            </div>
            <button class="btn" style="width:100%;background:white;color:var(--color-charcoal);border:1px solid rgba(0,0,0,0.1);">Book ₹${doc.p}</button>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function sectionTestimonials() {
  return html`
    <section class="bg-charcoal" style="padding:160px 0;position:relative;overflow:hidden;">
      <!-- Aurora Animated Background -->
      <div style="position:absolute;top:-20%;left:-10%;width:50vw;height:100%;background:radial-gradient(circle, rgba(235,94,40,0.15) 0%, transparent 70%);filter:blur(60px);animation:float1 15s ease-in-out infinite alternate;z-index:0;"></div>
      <div style="position:absolute;bottom:-20%;right:-10%;width:60vw;height:120%;background:radial-gradient(circle, rgba(255,189,46,0.1) 0%, transparent 70%);filter:blur(80px);animation:float2 20s ease-in-out infinite alternate;z-index:0;"></div>
      
      <div class="container text-center mb-64 reveal-up" style="position:relative;z-index:1;">
        <h2 style="font-family:var(--font-serif);font-size:48px;color:white;margin-bottom:64px;">Real People. Real Healing.</h2>
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:32px;margin-bottom:80px;">
          <!-- Stat 1 -->
          <div style="position:relative;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);padding:48px 40px;border-radius:32px;backdrop-filter:blur(24px);overflow:hidden;text-align:left;transition:all 0.4s cubic-bezier(0.4, 0, 0.2, 1);box-shadow:inset 0 1px 1px rgba(255,255,255,0.1), 0 24px 48px rgba(0,0,0,0.2);" class="hover-lift hover-glow">
            <i class="ph-fill ph-star" style="position:absolute;right:-10%;bottom:-20%;font-size:200px;color:var(--color-coral);opacity:0.04;transform:rotate(-15deg);transition:all 0.5s ease;z-index:0;" class="bg-icon"></i>
            <div style="position:relative;z-index:1;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
                <div style="width:48px;height:48px;border-radius:50%;background:rgba(235,94,40,0.1);display:flex;align-items:center;justify-content:center;color:var(--color-coral);"><i class="ph-bold ph-star" style="font-size:24px;"></i></div>
              </div>
              <div style="font-size:64px;font-family:var(--font-serif);color:var(--color-coral);line-height:1;margin-bottom:8px;font-weight:400;">4.9<span style="font-size:24px;color:rgba(255,255,255,0.3);font-weight:300;">/5</span></div>
              <div style="color:rgba(255,255,255,0.7);font-size:15px;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">Average App Rating</div>
            </div>
          </div>
          <!-- Stat 2 -->
          <div style="position:relative;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);padding:48px 40px;border-radius:32px;backdrop-filter:blur(24px);overflow:hidden;text-align:left;transition:all 0.4s cubic-bezier(0.4, 0, 0.2, 1);box-shadow:inset 0 1px 1px rgba(255,255,255,0.1), 0 24px 48px rgba(0,0,0,0.2);" class="hover-lift hover-glow delay-100">
            <i class="ph-fill ph-chat-teardrop-text" style="position:absolute;right:-10%;bottom:-20%;font-size:200px;color:var(--color-coral);opacity:0.04;transform:rotate(10deg);transition:all 0.5s ease;z-index:0;" class="bg-icon"></i>
            <div style="position:relative;z-index:1;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
                <div style="width:48px;height:48px;border-radius:50%;background:rgba(235,94,40,0.1);display:flex;align-items:center;justify-content:center;color:var(--color-coral);"><i class="ph-bold ph-chat-centered-text" style="font-size:24px;"></i></div>
              </div>
              <div style="font-size:64px;font-family:var(--font-serif);color:var(--color-coral);line-height:1;margin-bottom:8px;font-weight:400;">2M<span style="font-size:40px;">+</span></div>
              <div style="color:rgba(255,255,255,0.7);font-size:15px;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">Messages Exchanged</div>
            </div>
          </div>
          <!-- Stat 3 -->
          <div style="position:relative;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);padding:48px 40px;border-radius:32px;backdrop-filter:blur(24px);overflow:hidden;text-align:left;transition:all 0.4s cubic-bezier(0.4, 0, 0.2, 1);box-shadow:inset 0 1px 1px rgba(255,255,255,0.1), 0 24px 48px rgba(0,0,0,0.2);" class="hover-lift hover-glow delay-200">
            <i class="ph-fill ph-trend-down" style="position:absolute;right:-10%;bottom:-20%;font-size:200px;color:var(--color-coral);opacity:0.04;transform:rotate(5deg);transition:all 0.5s ease;z-index:0;" class="bg-icon"></i>
            <div style="position:relative;z-index:1;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
                <div style="width:48px;height:48px;border-radius:50%;background:rgba(235,94,40,0.1);display:flex;align-items:center;justify-content:center;color:var(--color-coral);"><i class="ph-bold ph-trend-down" style="font-size:24px;"></i></div>
              </div>
              <div style="font-size:64px;font-family:var(--font-serif);color:var(--color-coral);line-height:1;margin-bottom:8px;font-weight:400;">94<span style="font-size:40px;">%</span></div>
              <div style="color:rgba(255,255,255,0.7);font-size:15px;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">Report Reduced Anxiety</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Testimonials Grid -->
      <div class="container grid-3" style="position:relative;z-index:1;">
        ${[
          {t: "I struggled with severe anxiety for years. The CBT tools and my therapist on MindHeal completely changed my life.", n: "Kavya S.", a: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100"},
          {t: "The AI companion is incredible for late-night panic attacks. It grounds me instantly.", n: "Rahul M.", a: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100"},
          {t: "Finally, a platform that understands Indian cultural context. My therapist here gets exactly what I mean without me over-explaining.", n: "Priya T.", a: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
        ].map((testimonial, i) => `
          <div class="testimonial-card hover-lift reveal-up delay-${(i+1)*100}" style="background:white;border-radius:32px;padding:48px;border:1px solid rgba(0,0,0,0.05);text-align:left;position:relative;box-shadow:0 24px 48px rgba(0,0,0,0.05);transition:all 0.4s ease;">
            <i class="ph-fill ph-quotes" style="font-size:48px;color:var(--color-coral);opacity:0.1;position:absolute;top:32px;right:32px;"></i>
            <p style="font-size:24px;font-family:var(--font-serif);color:var(--color-charcoal);font-style:italic;line-height:1.5;margin-bottom:40px;position:relative;z-index:2;">"${testimonial.t}"</p>
            <div style="display:flex;align-items:center;gap:16px;">
              <img src="${testimonial.a}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid var(--color-coral);" />
              <div style="font-weight:700;font-size:16px;color:var(--color-charcoal);letter-spacing:0.05em;">${testimonial.n}</div>
            </div>
          </div>
        `).join('')}
      </div>
      
      <style>
        @keyframes float1 { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(5%, 10%) scale(1.1); } }
        @keyframes float2 { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(-5%, -10%) scale(1.2); } }
        .testimonial-card:hover { transform: translateY(-8px) scale(1.02); border-color: var(--color-coral); }
        .hover-glow:hover { box-shadow: 0 0 32px rgba(235,94,40,0.2), inset 0 0 0 1px rgba(235,94,40,0.5) !important; background: rgba(255,255,255,0.05) !important; }
        .hover-lift:hover .bg-icon { transform: scale(1.1) rotate(0deg) !important; opacity: 0.08 !important; }
      </style>
    </section>
  `;
}
function sectionCounsellorCTA() {
  return html`
    <section class="bg-white" style="padding:120px 0;position:relative;overflow:hidden;border-top:1px solid rgba(0,0,0,0.05);">
      <!-- Background Accents -->
      <div style="position:absolute;top:0;left:0;width:100%;height:100%;background:radial-gradient(circle at 80% 20%, rgba(235,94,40,0.1) 0%, transparent 50%);pointer-events:none;z-index:0;"></div>
      <div style="position:absolute;bottom:-20%;left:-10%;width:50vw;height:50vw;background:radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 60%);pointer-events:none;z-index:0;"></div>
      
      <div class="container" style="position:relative;z-index:1;">
        <div style="background:var(--color-coral);border-radius:32px;padding:80px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:48px;box-shadow:0 32px 64px rgba(235,94,40,0.3);">
          <div style="flex:1;min-width:320px;">
            <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.2);padding:8px 16px;border-radius:999px;color:white;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:24px;border:1px solid rgba(255,255,255,0.4);">
              <i class="ph-bold ph-stethoscope"></i> For Professionals
            </div>
            <h2 style="font-family:var(--font-serif);font-size:48px;color:white;margin-bottom:24px;line-height:1.1;">Join India's Top Network of Mental Health Experts</h2>
            <p style="font-size:18px;color:rgba(255,255,255,0.9);margin-bottom:40px;max-width:500px;line-height:1.6;">
              Expand your practice, manage appointments seamlessly, and help thousands of users on MindHeal. Our streamlined onboarding takes less than 10 minutes.
            </p>
            <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
              <a href="#/auth/counsellor-signup" class="btn hover-lift" style="background:white;color:var(--color-coral);border-radius:999px;height:56px;padding:0 32px;font-size:16px;border:none;display:flex;align-items:center;font-weight:600;text-decoration:none;">Sign Up as Counsellor</a>
              <a href="#/auth/counsellor-login" class="btn hover-lift" style="border:1px solid rgba(255,255,255,0.4);color:white;border-radius:999px;height:56px;padding:0 32px;font-size:16px;background:transparent;display:flex;align-items:center;font-weight:600;text-decoration:none;">Login</a>
            </div>
          </div>
          <div style="flex:1;min-width:320px;display:flex;justify-content:center;">
            <div style="position:relative;width:100%;max-width:400px;">
              <div style="background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:32px;position:relative;backdrop-filter:blur(16px);">
                <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:24px;">
                  <li style="display:flex;gap:16px;align-items:flex-start;">
                    <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;"><i class="ph-bold ph-rocket-launch" style="font-size:20px;"></i></div>
                    <div>
                      <div style="color:white;font-weight:600;font-size:16px;margin-bottom:4px;">Quick Onboarding</div>
                      <div style="color:rgba(255,255,255,0.8);font-size:14px;line-height:1.5;">Verify your RCI credentials and set your availability instantly.</div>
                    </div>
                  </li>
                  <li style="display:flex;gap:16px;align-items:flex-start;">
                    <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;"><i class="ph-bold ph-calendar-check" style="font-size:20px;"></i></div>
                    <div>
                      <div style="color:white;font-weight:600;font-size:16px;margin-bottom:4px;">Smart Scheduling</div>
                      <div style="color:rgba(255,255,255,0.8);font-size:14px;line-height:1.5;">Manage bookings and reminders with our built-in calendar.</div>
                    </div>
                  </li>
                  <li style="display:flex;gap:16px;align-items:flex-start;">
                    <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;"><i class="ph-bold ph-chart-line-up" style="font-size:20px;"></i></div>
                    <div>
                      <div style="color:white;font-weight:600;font-size:16px;margin-bottom:4px;">Grow Your Practice</div>
                      <div style="color:rgba(255,255,255,0.8);font-size:14px;line-height:1.5;">Get connected with users actively seeking your expertise.</div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}


function sectionPricing() {
  return html`
    <section class="bg-cream" style="padding:160px 0;">
      <div class="container text-center mb-64 reveal-up">
        <span style="color:var(--color-coral);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Transparent Pricing</span>
        <h2 style="font-family:var(--font-serif);font-size:48px;color:var(--color-charcoal);margin-top:16px;">Therapy For Everyone.</h2>
      </div>
      <div class="container grid-3">
        <!-- Free Tier -->
        <div class="reveal-up hover-lift" style="background:white;border-radius:24px;padding:48px;border:1px solid var(--color-border);">
          <h3 style="font-size:24px;font-family:var(--font-serif);margin-bottom:8px;">Basic Access</h3>
          <div style="font-size:48px;font-weight:700;color:var(--color-charcoal);margin-bottom:24px;">₹0</div>
          <ul style="list-style:none;padding:0;margin:0 0 32px 0;text-align:left;">
            <li style="margin-bottom:16px;color:var(--color-text-muted);"><i class="ph-bold ph-check" style="color:var(--color-coral);margin-right:8px;"></i> 24/7 AI Clinical Chat</li>
            <li style="margin-bottom:16px;color:var(--color-text-muted);"><i class="ph-bold ph-check" style="color:var(--color-coral);margin-right:8px;"></i> Basic Mood Tracker</li>
            <li style="margin-bottom:16px;color:var(--color-text-muted);"><i class="ph-bold ph-check" style="color:var(--color-coral);margin-right:8px;"></i> 5 Psychological Tests</li>
          </ul>
          <a href="#/auth/user-signup" class="btn" style="width:100%;border:1px solid var(--color-charcoal);color:var(--color-charcoal);">Sign Up Free</a>
        </div>
        
        <!-- Wallet Tier -->
        <div class="reveal-up delay-100 hover-lift" style="background:var(--color-charcoal);color:white;border-radius:24px;padding:48px;position:relative;transform:scale(1.05);box-shadow:0 32px 64px rgba(0,0,0,0.1);">
          <div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);background:var(--color-coral);color:white;padding:4px 16px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Most Popular</div>
          <h3 style="font-size:24px;font-family:var(--font-serif);margin-bottom:8px;">Wallet Top-Up</h3>
          <div style="font-size:48px;font-weight:700;color:white;margin-bottom:24px;">Pay As You Go</div>
          <ul style="list-style:none;padding:0;margin:0 0 32px 0;text-align:left;">
            <li style="margin-bottom:16px;color:rgba(255,255,255,0.7);"><i class="ph-bold ph-check" style="color:var(--color-coral);margin-right:8px;"></i> Book Human Counsellors</li>
            <li style="margin-bottom:16px;color:rgba(255,255,255,0.7);"><i class="ph-bold ph-check" style="color:var(--color-coral);margin-right:8px;"></i> Pay per session (₹500+)</li>
            <li style="margin-bottom:16px;color:rgba(255,255,255,0.7);"><i class="ph-bold ph-check" style="color:var(--color-coral);margin-right:8px;"></i> Group Session Access</li>
          </ul>
          <a href="#/counsellors" class="btn primary" style="width:100%;background:var(--color-coral);border:none;">Find a Therapist</a>
        </div>
        
        <!-- Plus Tier -->
        <div class="reveal-up delay-200 hover-lift" style="background:white;border-radius:24px;padding:48px;border:1px solid var(--color-border);">
          <h3 style="font-size:24px;font-family:var(--font-serif);margin-bottom:8px;">MindHeal Plus</h3>
          <div style="font-size:48px;font-weight:700;color:var(--color-charcoal);margin-bottom:24px;">₹499<span style="font-size:16px;color:var(--color-text-muted);font-weight:400;">/mo</span></div>
          <ul style="list-style:none;padding:0;margin:0 0 32px 0;text-align:left;">
            <li style="margin-bottom:16px;color:var(--color-text-muted);"><i class="ph-bold ph-check" style="color:var(--color-coral);margin-right:8px;"></i> All Free Features</li>
            <li style="margin-bottom:16px;color:var(--color-text-muted);"><i class="ph-bold ph-check" style="color:var(--color-coral);margin-right:8px;"></i> Full CBT Toolkit Access</li>
            <li style="margin-bottom:16px;color:var(--color-text-muted);"><i class="ph-bold ph-check" style="color:var(--color-coral);margin-right:8px;"></i> Unlimited AI Dream Analysis</li>
          </ul>
          <a href="#/pricing" class="btn" style="width:100%;border:1px solid var(--color-charcoal);color:var(--color-charcoal);">Subscribe</a>
        </div>
      </div>
    </section>
  `;
}

function sectionEmergency() {
  return html`
    <section class="bg-charcoal" style="padding:120px 0;border-top:1px solid rgba(255,255,255,0.05);background-image:radial-gradient(circle at 50% 0%, #301010 0%, var(--color-charcoal) 70%);">
      <div class="container text-center reveal-up">
        <i class="ph-fill ph-warning-circle" style="font-size:48px;color:#FF4D4D;margin-bottom:24px;"></i>
        <h2 style="font-family:var(--font-serif);font-size:40px;color:white;margin-bottom:16px;">Are you in an emergency?</h2>
        <p style="color:rgba(255,255,255,0.7);font-size:18px;max-width:600px;margin:0 auto 40px auto;">If you are feeling suicidal, or are in immediate danger of harming yourself or others, please use the following resources.</p>
        <div style="display:flex;justify-content:center;gap:24px;flex-wrap:wrap;">
          <a href="tel:9152987821" class="btn hover-lift" style="background:#FF4D4D;color:white;border:none;font-size:18px;padding:16px 32px;"><i class="ph-bold ph-phone" style="margin-right:8px;"></i> Call AASRA (India): 9820466726</a>
          <a href="tel:112" class="btn hover-lift" style="background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);font-size:18px;padding:16px 32px;"><i class="ph-bold ph-ambulance" style="margin-right:8px;"></i> National Emergency: 112</a>
        </div>
      </div>
    </section>
  `;
}

function sectionAppPromo() {
  return html`
    <section class="bg-white" style="padding:160px 0;overflow:hidden;">
      <div class="container split-55-45">
        <div class="reveal-up" style="display:flex;flex-direction:column;justify-content:center;">
          <span style="color:var(--color-coral);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Download The App</span>
          <h2 style="font-family:var(--font-serif);font-size:56px;color:var(--color-charcoal);margin-top:16px;line-height:1.1;margin-bottom:24px;">Healing in Your Pocket.</h2>
          <p style="font-size:18px;color:var(--color-text-muted);margin-bottom:40px;max-width:480px;line-height:1.6;">Get 24/7 AI chat, daily mood tracking, and instant SOS breathing exercises with the MindHeal mobile app.</p>
          <div style="display:flex;gap:24px;align-items:center;">
            <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" alt="App Store" style="height:48px;cursor:pointer;" class="hover-lift" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Play Store" style="height:48px;cursor:pointer;" class="hover-lift" />
          </div>
        </div>
        <div class="reveal-up delay-100" style="position:relative;">
          <div style="width:300px;height:600px;background:var(--color-charcoal);border-radius:40px;border:12px solid #111;margin:0 auto;position:relative;overflow:hidden;box-shadow:0 32px 64px rgba(0,0,0,0.2);">
            <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300" style="width:100%;height:100%;object-fit:cover;opacity:0.5;" />
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%, -50%);text-align:center;width:100%;">
              <i class="ph-fill ph-leaf" style="font-size:48px;color:var(--color-coral);margin-bottom:16px;"></i>
              <div style="font-family:var(--font-serif);font-size:24px;color:white;">MindHeal App</div>
            </div>
          </div>
          <!-- Decorative orbs -->
          <div class="orb" style="width:200px;height:200px;background:var(--color-coral);top:10%;right:-10%;opacity:0.2;"></div>
          <div class="orb" style="width:150px;height:150px;background:#FFBD2E;bottom:10%;left:0;opacity:0.2;animation-delay:-2s;"></div>
        </div>
      </div>
    </section>
  `;
}

function sectionBlog() {
  return html`
    <section class="bg-cream" style="padding:160px 0;">
      <div class="container text-center mb-64 reveal-up">
        <span style="color:var(--color-coral);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Insights & Articles</span>
        <h2 style="font-family:var(--font-serif);font-size:48px;color:var(--color-charcoal);margin-top:16px;">Learn About Your Mind.</h2>
      </div>
      <div class="container grid-3">
        ${[
          {c: "Anxiety", t: "5 Grounding Techniques for Panic Attacks", a: "Dr. A. Sharma", i: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400"},
          {c: "Relationships", t: "Understanding Anxious Attachment", a: "Dr. R. Verma", i: "https://images.unsplash.com/photo-1516585427167-9f4af9627e6c?w=400"},
          {c: "Self-Care", t: "The Neuroscience of Good Sleep", a: "Dr. P. Iyer", i: "https://images.unsplash.com/photo-1511295742362-92c96b5ade36?w=400"}
        ].map((article, i) => `
          <div class="hover-lift reveal-up delay-${i*100}" style="background:white;border-radius:24px;overflow:hidden;box-shadow:0 16px 32px rgba(0,0,0,0.05);border:1px solid var(--color-border);">
            <img src="${article.i}" style="width:100%;height:200px;object-fit:cover;" />
            <div style="padding:32px;">
              <span style="color:var(--color-coral);font-weight:700;font-size:12px;text-transform:uppercase;">${article.c}</span>
              <h3 style="font-family:var(--font-serif);font-size:24px;color:var(--color-charcoal);margin-top:12px;margin-bottom:16px;">${article.t}</h3>
              <div style="color:var(--color-text-muted);font-size:14px;"><i class="ph-bold ph-pencil-simple"></i> ${article.a}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="container text-center mt-64 reveal-up">
        <a href="#/resources" class="btn" style="border:1px solid var(--color-charcoal);color:var(--color-charcoal);">Read All Articles</a>
      </div>
    </section>
  `;
}

function sectionFinalCTA() {
  return html`
    <section class="bg-charcoal" style="padding:160px 0;position:relative;overflow:hidden;">
      <div class="orb" style="width:600px;height:600px;background:var(--color-coral);top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.1;filter:blur(100px);"></div>
      <div class="container text-center reveal-up" style="position:relative;z-index:2;max-width:800px;">
        <h2 style="font-family:var(--font-serif);font-size:64px;color:white;margin-bottom:24px;line-height:1.1;">Your Healing Journey Begins Now.</h2>
        <p style="color:rgba(255,255,255,0.7);font-size:20px;margin-bottom:48px;">Join thousands who have found peace, clarity, and growth with MindHeal.</p>
        <div style="display:flex;justify-content:center;gap:24px;">
          <a href="#/auth/user-signup" class="btn primary hover-lift" style="font-size:18px;padding:20px 48px;background:var(--color-coral);color:white;border:none;">Start Free with AI</a>
          <a href="#/counsellors" class="btn hover-lift" style="font-size:18px;padding:20px 48px;background:white;color:var(--color-charcoal);">Find a Counsellor</a>
        </div>
      </div>
    </section>
  `;
}

function globalFloatingWidgets() {
  return html`
    <!-- Sticky CTA Button -->
    <a href="#/auth/user-signup" class="floating-cta hover-lift" style="position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:var(--color-charcoal);color:white;padding:16px 40px;border-radius:999px;font-family:var(--font-serif);font-size:20px;box-shadow:0 16px 32px rgba(0,0,0,0.2);z-index:90;text-decoration:none;border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;gap:12px;">
      Start Free with AI <i class="ph-bold ph-arrow-right"></i>
    </a>

    <!-- AI Chat Widget -->
    <div class="chat-widget hover-lift" style="position:fixed;bottom:32px;right:32px;width:64px;height:64px;background:var(--color-coral);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 16px 32px rgba(255,107,107,0.4);cursor:pointer;z-index:95;color:white;font-size:32px;">
      <i class="ph-fill ph-chat-teardrop-text"></i>
      <div style="position:absolute;top:-8px;right:-8px;background:#FFBD2E;width:16px;height:16px;border-radius:50%;border:2px solid var(--color-coral);"></div>
    </div>
  `;
}

function audienceCard(title, copy, features, link) {
  return html`
    <article class="card">
      <h3>${title}</h3>
      <p>${copy}</p>
      <ul class="list">
        ${features.map((item) => `<li class="list-item"><span>${item}</span></li>`).join("")}
      </ul>
      <div class="section-actions"><a class="btn primary" href="${link}">Open ${title}</a></div>
    </article>
  `;
}

function serviceCard(service) {
  return html`
    <article class="service-card">
      <div class="service-icon">${service.icon}</div>
      <div class="tag-list">
        <span class="tag">${service.category}</span>
        <span class="status-pill ai">${service.price}</span>
      </div>
      <h3>${service.title}</h3>
      <p>${service.summary}</p>
      <ul class="list">
        ${service.details.slice(0, 2).map((detail) => `<li class="list-item"><span>${detail}</span></li>`).join("")}
      </ul>
    </article>
  `;
}

function timelineCard(item) {
  return html`
    <article class="timeline-card">
      <span class="status-pill success">${item.duration}</span>
      <h3>${item.title}</h3>
      <ul class="list">${item.items.map((task) => `<li class="list-item"><span>${task}</span></li>`).join("")}</ul>
    </article>
  `;
}

function servicesPage() {
  return html`
    <main class="page">
      <div class="eyebrow">All services</div>
      <h1 class="page-title">MindHeal services for web users.</h1>
      <p class="page-subtitle">Each service is designed to be admin-configurable, priced dynamically, connected to backend workflows, and available through the user panel.</p>
      <div class="chip-row" style="margin:24px 0">
        ${serviceCategories.map((category) => `<span class="chip">${category}</span>`).join("")}
      </div>
      <div class="service-grid" style="width:100%;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));">${services.map(serviceCard).join("")}</div>
    </main>
  `;
}

function resourcesPage() {
  return html`
    <main>
      <section class="page" style="padding-bottom:80px;">
        <div class="eyebrow">Resources</div>
        <h1 class="page-title">Mental wellness resources, guides, and articles.</h1>
        <p class="page-subtitle">Browse practical education around anxiety, CBT, self-care, therapy readiness, and crisis support.</p>
        <div class="card-grid" style="margin-top:32px;">
          ${resourceLinkCard("Mental Health Guides", "Plain-language guides for common emotional patterns and care options.", "#/resources/guides", "ph-books")}
          ${resourceLinkCard("CBT Explained", "A structured overview of thoughts, feelings, behavior, and reflection tools.", "#/resources/cbt", "ph-brain")}
          ${resourceLinkCard("Crisis Helplines", "Fast access to emergency guidance and helpline links.", "#/crisis", "ph-phone-call")}
        </div>
      </section>
      ${sectionBlog()}
    </main>
  `;
}

function guidesPage() {
  const guides = [
    ["Anxiety", "Grounding, worry tracking, breathing, and when to ask for human support."],
    ["Sleep", "Gentle routines, thought unloading, and signs that sleep issues need clinical help."],
    ["Relationships", "Patterns around attachment, conflict repair, boundaries, and communication."],
    ["Burnout", "Energy mapping, recovery windows, workload signals, and support planning."],
    ["Therapy Readiness", "What to expect from counselling and how to prepare for a first session."],
    ["Self-Care", "Small repeatable practices for mood, focus, and emotional regulation."]
  ];

  return html`
    <main class="page">
      <div class="eyebrow">Mental health guides</div>
      <h1 class="page-title">Understand what you are feeling, one clear guide at a time.</h1>
      <p class="page-subtitle">These guides are educational and not a diagnosis. For clinical concerns, book a verified counsellor.</p>
      <div class="card-grid" style="margin-top:32px;">
        ${guides.map(([title, body]) => `<article class="card"><h3>${title}</h3><p>${body}</p><a class="btn secondary" href="#/auth/user-signup">Save to Dashboard</a></article>`).join("")}
      </div>
    </main>
  `;
}

function cbtResourcePage() {
  return html`
    <main>
      <section class="page" style="padding-bottom:80px;">
        <div class="eyebrow">CBT explained</div>
        <h1 class="page-title">A practical map for thoughts, feelings, and behavior.</h1>
        <p class="page-subtitle">CBT tools help users notice patterns, name cognitive distortions, test assumptions, and choose kinder next actions.</p>
      </section>
      ${sectionToolkit()}
      ${sectionTests()}
    </main>
  `;
}

function crisisPage() {
  return html`
    <main>
      ${sectionEmergency()}
      <section class="page">
        <div class="eyebrow">Immediate support</div>
        <h1 class="page-title">Use emergency services when there is immediate danger.</h1>
        <p class="page-subtitle">MindHeal can support reflection and care planning, but it is not an emergency response service.</p>
        <div class="card-grid" style="margin-top:32px;">
          <article class="card"><h3>India emergency</h3><p>Call 112 for urgent police, ambulance, or emergency support.</p><a class="btn primary" href="tel:112">Call 112</a></article>
          <article class="card"><h3>AASRA</h3><p>Reach a suicide-prevention helpline if you are in severe emotional distress.</p><a class="btn secondary" href="tel:9820466726">Call AASRA</a></article>
          <article class="card"><h3>Human handoff</h3><p>For non-emergency support, find a verified counsellor and request a session.</p><a class="btn secondary" href="#/counsellors">Find Counsellors</a></article>
        </div>
      </section>
    </main>
  `;
}

function aboutPage() {
  return html`
    <main>
      <section class="page" style="padding-bottom:80px;">
        <div class="eyebrow">About MindHeal</div>
        <h1 class="page-title">A web-first psychological wellness platform for India and multilingual users.</h1>
        <p class="page-subtitle">MindHeal combines AI-guided reflection, verified counsellor access, CBT tools, reports, wallet payments, and admin-governed safety controls.</p>
        <div class="card-grid" style="margin-top:32px;">
          <article class="card"><h3>Mission</h3><p>Make emotional support easier to reach while keeping clinical care, consent, and human escalation central.</p></article>
          <article class="card"><h3>Model</h3><p>Blend self-help, AI assistance, and verified professional sessions without presenting AI as emergency or diagnostic care.</p></article>
          <article class="card"><h3>Company</h3><p>${appConfig.company}<br>${appConfig.address}</p></article>
        </div>
      </section>
      ${sectionHowItWorks()}
      ${sectionCounsellorCTA()}
    </main>
  `;
}

function pricingPage() {
  return html`
    <main>
      ${sectionPricing()}
      ${sectionFinalCTA()}
    </main>
  `;
}

function careersPage() {
  return html`
    <main class="page">
      <div class="eyebrow">Careers</div>
      <h1 class="page-title">Build thoughtful mental wellness technology.</h1>
      <p class="page-subtitle">MindHeal is preparing roles across counselling operations, product, engineering, safety, content, and partnerships.</p>
      <div class="card-grid" style="margin-top:32px;">
        ${["Clinical Operations", "Product & Design", "Engineering", "Content & Community", "Partnerships", "Trust & Safety"].map((role) => `<article class="card"><h3>${role}</h3><p>Openings will be published as the platform moves from prototype to production.</p><a class="btn secondary" href="#/contact">Register Interest</a></article>`).join("")}
      </div>
    </main>
  `;
}

function pressPage() {
  return html`
    <main class="page">
      <div class="eyebrow">Press</div>
      <h1 class="page-title">MindHeal press and company enquiries.</h1>
      <p class="page-subtitle">For media kits, interviews, partnership questions, or launch updates, contact the MindHeal team.</p>
      <div class="card-grid" style="margin-top:32px;">
        <article class="card"><h3>Company</h3><p>${appConfig.company}</p></article>
        <article class="card"><h3>Contact</h3><p>${appConfig.supportEmail}<br>${appConfig.phone}</p></article>
        <article class="card"><h3>Platform</h3><p>AI support, verified counsellors, CBT tools, wallet workflows, and admin-managed service configuration.</p></article>
      </div>
      <div class="section-actions" style="margin-top:32px;">
        <a class="btn primary" href="#/contact">Contact Press Team</a>
      </div>
    </main>
  `;
}

function resourceLinkCard(title, body, href, icon) {
  return html`
    <article class="card">
      <h3><i class="ph ${icon}"></i> ${title}</h3>
      <p>${body}</p>
      <a class="btn secondary" href="${href}">Open</a>
    </article>
  `;
}

function counsellorLandingPage() {
  return html`
    <main>
      <section class="section-band">
        <div class="section-heading">
          <div class="eyebrow">For counsellors and organisations</div>
          <h2>Run a verified digital mental wellness practice.</h2>
          <p>MindHeal gives professionals booking, chat, calls, report reviews, content publishing, group sessions, map listings, earnings, and payout tools.</p>
          <div class="section-actions">
            <a class="btn primary" href="#/auth/counsellor-signup">Apply as Counsellor</a>
            <a class="btn secondary" href="#/auth/counsellor-login">Counsellor Login</a>
          </div>
          <div class="section-image" style="flex:1;max-width:400px;margin-left:auto;">
            <img src="assets/images/counsellor_hero.png" alt="Counsellor online" style="width:100%;height:auto;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,0.1);"/>
          </div>
        </div>
        <div class="card-grid" style="margin-top:32px;">${counsellorFeatures.slice(0, 6).map((feature) => `<article class="card"><h3>${feature}</h3><p>Managed through the counsellor panel with admin-reviewed access where required.</p></article>`).join("")}</div>
      </section>
    </main>
  `;
}



function contactPage() {
  return html`
    <main class="page">
      <div class="eyebrow">Contact</div>
      <h1 class="page-title">Tell us what you want to build with MindHeal.</h1>
      <p class="page-subtitle">Use this form for user support, counsellor partnership, organisation onboarding, or investor/business enquiries.</p>
      <div class="dashboard-grid">
        <form class="auth-card span-8" data-form="contact">
          <div class="form-grid">
            <div class="field"><label for="name">Full name</label><input id="name" name="name" required autocomplete="name" /></div>
            <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required autocomplete="email" /></div>
            <div class="field"><label for="topic">Topic</label><select id="topic" name="topic"><option>User support</option><option>Counsellor partnership</option><option>Organisation onboarding</option><option>Business enquiry</option></select></div>
            <div class="field"><label for="message">Message</label><textarea id="message" name="message" required></textarea></div>
            <button class="btn primary" type="submit">Send Message</button>
          </div>
        </form>
        <aside class="panel-card span-4">
          <h2>MindHeal office</h2>
          <p>${appConfig.address}</p>
          <p>${appConfig.supportEmail}</p>
          <p>${appConfig.phone}</p>
          <div class="alert warning">
            <strong>Emergency note</strong>
            <p>MindHeal is not an emergency service. In a crisis, contact local emergency services or a national helpline immediately.</p>
          </div>
        </aside>
      </div>
    </main>
  `;
}

function authPage(role, mode) {
  const roleTitle = role === "admin" ? "Admin" : role === "counsellor" ? "Counsellor" : "User";
  const isSignup = mode === "signup";
  const panelPath = role === "admin" ? "/panel/admin" : role === "counsellor" ? "/panel/counsellor" : "/panel/user";
  return html`
    <div class="auth-split-layout">
      <div class="auth-split-left">
        <img src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=800&q=80" alt="Therapy Session" class="auth-hero-img" />
        <div class="auth-hero-text">
          <h2>Your Healing Journey Begins Here</h2>
          <p>Join MindHeal to access professional counselling, private AI support, and a supportive community dedicated to mental wellness.</p>
        </div>
      </div>
      <div class="auth-split-right">
        <a href="#/" class="auth-close-btn" aria-label="Close form">
          <i class="ph ph-x"></i>
        </a>
        <main class="auth-wrap">
          <form class="auth-card" data-form="auth" data-role="${role}" data-mode="${mode}" data-panel="${panelPath}">
            <div class="eyebrow">${roleTitle} ${isSignup ? "signup" : "login"}</div>
            <h1>${isSignup ? `Create ${roleTitle.toLowerCase()} account` : `Welcome back, ${roleTitle.toLowerCase()}`}</h1>
            <p class="page-subtitle">${authCopy(role, mode)}</p>
            <div class="form-grid">
              ${isSignup ? `<div class="field"><label for="name">Full name</label><input id="name" name="name" required autocomplete="name" /></div>` : ""}
              <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required autocomplete="email" /></div>
              ${role !== "admin" ? `<div class="field"><label for="mobile">Mobile number</label><input id="mobile" name="mobile" autocomplete="tel" /></div>` : ""}
              ${role === "counsellor" && isSignup ? counsellorSignupFields() : ""}
              ${role === "user" && isSignup ? userSignupFields() : ""}
              <div class="field full-width"><label for="password">Password</label><input id="password" name="password" type="password" required autocomplete="${isSignup ? "new-password" : "current-password"}" /></div>
              ${role === "admin" ? `<div class="field full-width"><label for="totp">2FA code</label><input id="totp" name="totp" inputmode="numeric" placeholder="123456" /></div>` : ""}
              <button class="btn primary full-width" type="submit">${isSignup ? "Create Account" : "Login"}</button>
            </div>
            <p>
              ${isSignup ? "Already registered?" : "New here?"}
              <a class="ghost-link" href="#/auth/${role}-${isSignup ? "login" : "signup"}">${isSignup ? "Login" : "Create account"}</a>
            </p>
          </form>
        </main>
      </div>
    </div>
  `;
}

function authCopy(role, mode) {
  if (role === "admin") return "Admin access controls users, counsellors, services, AI configuration, payments, content, and analytics.";
  if (role === "counsellor") return mode === "signup" ? "Apply as an individual professional or organisation. Your profile stays pending until admin verification." : "Manage sessions, availability, expert reviews, content, and payouts.";
  return mode === "signup" ? "Start with private AI support, CBT tools, counsellor booking, reports, wallet, and multilingual settings." : "Continue your sessions, reports, wallet, CBT tools, and AI chat history.";
}

function counsellorSignupFields() {
  return html`
    <div class="field"><label for="accountType">Account type</label><select id="accountType" name="accountType"><option>Individual</option><option>Organisation</option></select></div>
    <div class="field"><label for="speciality">Primary speciality</label><input id="speciality" name="speciality" placeholder="CBT, trauma, anxiety..." required /></div>
    <div class="field"><label for="license">License or registration number</label><input id="license" name="license" required /></div>
    <div class="field"><label for="languages">Languages spoken</label><input id="languages" name="languages" value="English, Hindi" /></div>
  `;
}

function userSignupFields() {
  return html`
    <div class="field">
      <label for="language">Preferred language</label>
      <select id="language" name="language">${supportedLanguages.map((language) => `<option>${language}</option>`).join("")}</select>
    </div>
  `;
}

function notFoundPage() {
  return html`
    <main class="page">
      <h1 class="page-title">We couldn't find that page.</h1>
      <p class="page-subtitle">The page may have moved, or the link may be incomplete.</p>
      <a class="btn primary" href="#/">Go Home</a>
    </main>
  `;
}

async function userPanel() {
  const data = await api.getState();
  const dashboard = data.dashboard.user;
  return panelShell(
    "user",
    "User Panel",
    "Your private space for support, sessions, CBT tools, reports, and wallet activity.",
    [
      ["overview", "Overview"],
      ["ai", "AI Chat"],
      ["counsellors", "Counsellors"],
      ["cbt", "CBT Tools"],
      ["reports", "Reports"],
      ["wallet", "Wallet"]
    ],
    userPanelContent(state.panelSection, dashboard, data),
    data.backendStatus
  );
}

function userPanelContent(section, dashboard, data) {
  const liveSessions = data.sessions || [];
  const upcomingSessions = liveSessions.length
    ? liveSessions
        .filter((session) => !["cancelled", "declined"].includes(session.status))
        .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0))
        .map((session) => ({
          type: session.sessionType || "Session",
          counsellor: session.counsellorName || session.counsellorId || "Counsellor",
          time: session.scheduledAt,
          cost: session.amountInr || session.amountPaise / 100 || 0,
          status: session.status
        }))
    : dashboard.upcomingSessions;

  if (section === "ai") {
    return html`
      <div class="ai-chat-layout">
        <main class="ai-chat-main">
          <header class="ai-chat-header">
            <div class="ai-chat-header-icon">
              <i class="ph-bold ph-robot"></i>
            </div>
            <div class="ai-chat-header-info">
              <h2>MindHeal AI Guide</h2>
              <p>Active now • Trained on Clinical Guidelines</p>
            </div>
            <div class="ai-chat-header-actions">
              <div class="wallet-badge" title="Available Balance">
                <i class="ph ph-wallet"></i>
                <span class="wallet-amount">${formatInr(dashboard.walletBalance || 0)}</span>
              </div>
              <button class="btn secondary ai-btn-action" type="button" data-action="ai-restart-chat" title="Restart Chat">
                <i class="ph ph-arrows-clockwise"></i>
                <span class="btn-label">Restart Chat</span>
              </button>
              <button class="btn primary ai-btn-action dark-btn" type="button" data-action="ai-handover" title="Handover to Human">
                <i class="ph ph-user-focus"></i>
                <span class="btn-label">Handover to Human</span>
              </button>
              <button class="btn secondary ai-btn-action ${state.safetySidebarCollapsed ? 'active' : ''}" type="button" data-action="toggle-safety" title="Toggle Safety Sidebar">
                <i class="ph-bold ${state.safetySidebarCollapsed ? 'ph-shield-slash' : 'ph-shield-check'}"></i>
                <span class="btn-label">${state.safetySidebarCollapsed ? 'Show Safety' : 'Hide Safety'}</span>
              </button>
            </div>
          </header>
          
          <div class="ai-chat-messages" id="ai-chat-messages-container">
            <div style="text-align:center;color:var(--color-text-muted);font-size:14px;margin-bottom:16px;">Today</div>
            ${state.aiMessages.map((message) => {
              const safety = message.safety === "high" 
                ? `<span class="status-pill danger" style="margin-top:8px;display:inline-block;"><i class="ph-bold ph-warning-circle"></i> Crisis support</span>` 
                : message.safety 
                  ? `<span class="status-pill success" style="margin-top:8px;display:inline-block;">Safety: ${message.safety}</span>` 
                  : "";
              
              const isUser = message.role === "user";
              return `
                <div class="chat-bubble-wrapper ${isUser ? "user" : "ai"}">
                  <div class="chat-bubble">
                    ${escapeHtml(message.text)}
                    ${safety}
                  </div>
                  <div class="chat-time">Just now</div>
                </div>
              `;
            }).join("")}
          </div>
          
          <footer class="ai-chat-input-area">
            <form data-form="ai-chat" style="margin:0;">
              <div class="ai-chat-input-wrapper">
                <i class="ph ph-smiley" style="font-size:24px;color:rgba(0,0,0,0.4);cursor:pointer;"></i>
                <input class="ai-chat-input" id="aiMessage" name="message" required placeholder="Type your message here..." autocomplete="off" />
                <button class="ai-chat-send-btn" type="submit" title="Send message">
                  <i class="ph-bold ph-paper-plane-right"></i>
                </button>
              </div>
            </form>
          </footer>
        </main>
        
        <aside class="ai-chat-sidebar ${state.safetySidebarCollapsed ? 'collapsed' : ''}">
          <div style="display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:16px;">
            <div style="width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;margin-bottom:16px;color:var(--color-coral);font-size:32px;">
              <i class="ph-bold ph-shield-check"></i>
            </div>
            <h3 style="font-family:var(--font-serif);font-size:24px;margin-bottom:8px;">Safety First</h3>
            <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">This space is monitored by our clinical safety algorithms.</p>
          </div>
          
          <div class="ai-safety-card">
            <h3><i class="ph-fill ph-warning-circle"></i> Not for Emergencies</h3>
            <p>If you are in immediate danger or experiencing a medical emergency, please contact local emergency services or a crisis helpline immediately.</p>
            <a href="#/crisis" class="btn" style="background:transparent;border:1px solid rgba(255,255,255,0.3);color:white;width:100%;margin-top:16px;text-align:center;">View Helplines</a>
          </div>
          
          <div class="ai-safety-card">
            <h3><i class="ph-fill ph-user-circle-plus"></i> Human Escalation</h3>
            <p>If self-harm intent or severe distress is detected, the AI will pause and seamlessly hand off your session to a verified human counsellor.</p>
          </div>
        </aside>
      </div>
    `;
  }

  if (section === "counsellors") {
    const panelCounsellors = data.counsellors?.length ? data.counsellors : counsellors;
    return html`
      <div class="panel-hero">
        <div><h1 class="page-title">Find counsellors</h1><p class="page-subtitle">Filter by language, speciality, rate, rating, and enabled session modes.</p></div>
      </div>
      <div id="counsellor-map" style="width: 100%; height: 400px; background: #f0f0f0; margin-bottom: 24px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
         Loading map...
      </div>
      <div class="service-grid" style="display:grid;width:100%;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px;">
        ${panelCounsellors.map(counsellorCard).join("")}
      </div>
    `;
  }

  if (section === "cbt") {
    // Determine active tab HTML templates
    let subTabContentHtml = "";
    if (state.cbtActiveTab === "thought") {
      subTabContentHtml = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
          <!-- Thought Record Form -->
          <form data-form="cbt-thought-diary" class="dashboard-card" style="display: flex; flex-direction: column; gap: 16px;">
            <h3 style="font-family: var(--font-serif); font-size: 22px; color: var(--color-charcoal);"><i class="ph ph-plus-circle" style="color: var(--color-coral);"></i> New Thought Record</h3>
            <p style="font-size: 13px; color: var(--color-text-muted);">Identify cognitive distortions and reframe negative thoughts.</p>
            <div class="field">
              <label for="cbt-situation">1. Situation</label>
              <textarea id="cbt-situation" name="situation" placeholder="Who, what, where, when?" rows="2" required></textarea>
            </div>
            <div class="field">
              <label for="cbt-automatic">2. Automatic Thought</label>
              <textarea id="cbt-automatic" name="automaticThought" placeholder="What did you tell yourself?" rows="2" required></textarea>
            </div>
            <div class="field">
              <label for="cbt-distortions">3. Cognitive Distortions</label>
              <select id="cbt-distortions" name="distortion" required>
                <option value="">Select Primary Distortion</option>
                <option value="Catastrophizing">Catastrophizing (Assuming the worst outcome)</option>
                <option value="All-or-Nothing">All-or-Nothing (Black-and-white thinking)</option>
                <option value="Mind Reading">Mind Reading (Assuming you know what others think)</option>
                <option value="Emotional Reasoning">Emotional Reasoning (Feeling it makes it true)</option>
                <option value="Should Statements">Should Statements (Rigid self-expectations)</option>
              </select>
            </div>
            <div class="field">
              <label for="cbt-evidence">4. Evidence Supporting Thought</label>
              <textarea id="cbt-evidence" name="evidenceFor" placeholder="What facts support this thought?" rows="2" required></textarea>
            </div>
            <div class="field">
              <label for="cbt-evidence-against">5. Evidence Against Thought</label>
              <textarea id="cbt-evidence-against" name="evidenceAgainst" placeholder="What facts contradict this thought?" rows="2" required></textarea>
            </div>
            <div class="field">
              <label for="cbt-balanced">6. Balanced / Alternative Thought</label>
              <textarea id="cbt-balanced" name="balancedThought" placeholder="What is a more realistic, kinder perspective?" rows="2" required></textarea>
            </div>
            <button type="submit" class="btn primary" style="align-self: flex-start;">Save Thought Record</button>
          </form>
          
          <!-- History -->
          <div class="dashboard-card" style="display: flex; flex-direction: column; gap: 16px; max-height: 600px; overflow-y: auto;">
            <h3 style="font-family: var(--font-serif); font-size: 22px; color: var(--color-charcoal);"><i class="ph ph-clock-counter-clockwise"></i> Past Records</h3>
            ${state.cbtThoughtEntries.map(entry => `
              <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--color-border); padding: 16px; border-radius: 12px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong style="font-size: 14px; color: var(--color-coral);">${entry.distortion}</strong>
                  <span style="font-size: 11px; color: var(--color-text-muted);">${new Date(entry.createdAt).toLocaleDateString()}</span>
                </div>
                <p style="margin: 0; font-size: 13px; font-style: italic;">"${entry.automaticThought}"</p>
                <p style="margin: 0; font-size: 13px; color: var(--color-charcoal-muted);"><strong style="color: var(--color-sage);">Alternative:</strong> ${entry.balancedThought}</p>
              </div>
            `).join("") || `<p style="color: var(--color-text-muted); text-align: center; margin-top: 40px;">No entries logged yet.</p>`}
          </div>
        </div>
      `;
    } else if (state.cbtActiveTab === "exposure") {
      subTabContentHtml = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
          <!-- Fear Ladder Form -->
          <form data-form="cbt-exposure" class="dashboard-card" style="display: flex; flex-direction: column; gap: 16px; height: fit-content;">
            <h3 style="font-family: var(--font-serif); font-size: 22px; color: var(--color-charcoal);"><i class="ph ph-target" style="color: #2b6cb0;"></i> Build Fear Ladder</h3>
            <p style="font-size: 13px; color: var(--color-text-muted);">Step-by-step progressive desensitization.</p>
            <div class="field">
              <label for="exp-step">Exposure Step Description</label>
              <textarea id="exp-step" name="step" placeholder="e.g. Say hello to a stranger at the store" rows="2" required></textarea>
            </div>
            <div class="field">
              <label for="exp-anxiety">Anticipated Anxiety Level (1-100)</label>
              <input id="exp-anxiety" name="anxiety" type="number" min="1" max="100" value="50" required />
            </div>
            <button type="submit" class="btn primary" style="background: #2b6cb0; align-self: flex-start;">Add Exposure Step</button>
          </form>

          <!-- Ladder List -->
          <div class="dashboard-card" style="display: flex; flex-direction: column; gap: 16px;">
            <h3 style="font-family: var(--font-serif); font-size: 22px; color: var(--color-charcoal);"><i class="ph ph-list-numbers"></i> Ladder Steps</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${state.cbtExposures.sort((a,b) => a.anxiety - b.anxiety).map(item => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; background: rgba(0,0,0,0.02); border: 1px solid var(--color-border); border-radius: 12px;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="btn mini" style="padding: 4px; background: ${item.status === 'completed' ? 'var(--color-sage-bg)' : 'transparent'}; border: 1px solid var(--color-border);" data-action="toggle-exposure" data-id="${item.id}">
                      <i class="ph ${item.status === 'completed' ? 'ph-check-square' : 'ph-square'}" style="font-size: 18px; color: ${item.status === 'completed' ? 'var(--color-sage)' : 'var(--color-text-muted)'};"></i>
                    </button>
                    <span style="font-size: 14px; text-decoration: ${item.status === 'completed' ? 'line-through' : 'none'}; color: var(--color-charcoal);">${escapeHtml(item.step)}</span>
                  </div>
                  <span class="status-pill ${item.anxiety > 75 ? 'danger' : item.anxiety > 40 ? 'warning' : 'success'}">${item.anxiety} USUD</span>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `;
    } else if (state.cbtActiveTab === "activation") {
      subTabContentHtml = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
          <!-- Schedule Activity Form -->
          <form data-form="cbt-activation" class="dashboard-card" style="display: flex; flex-direction: column; gap: 16px; height: fit-content;">
            <h3 style="font-family: var(--font-serif); font-size: 22px; color: var(--color-charcoal);"><i class="ph ph-chart-polar" style="color: #38a169;"></i> Schedule Activity</h3>
            <p style="font-size: 13px; color: var(--color-text-muted);">Break the cycle of depression with active habits.</p>
            <div class="field">
              <label for="act-title">Activity Title</label>
              <input id="act-title" name="title" placeholder="Go for a 10-minute run" required />
            </div>
            <div class="field">
              <label for="act-category">Category</label>
              <select id="act-category" name="category" required>
                <option value="Physical">Physical</option>
                <option value="Social">Social</option>
                <option value="Creative">Creative</option>
                <option value="Self-care">Self-care</option>
              </select>
            </div>
            <div class="field">
              <label for="act-time">Scheduled For</label>
              <input id="act-time" name="scheduledFor" placeholder="e.g. Saturday morning" required />
            </div>
            <button type="submit" class="btn primary" style="background: #38a169; align-self: flex-start;">Schedule Activity</button>
          </form>

          <!-- Activities List -->
          <div class="dashboard-card" style="display: flex; flex-direction: column; gap: 16px;">
            <h3 style="font-family: var(--font-serif); font-size: 22px; color: var(--color-charcoal);"><i class="ph ph-calendar-check"></i> My Schedule</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${state.cbtActivities.map(item => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; background: rgba(0,0,0,0.02); border: 1px solid var(--color-border); border-radius: 12px;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="btn mini" style="padding: 4px; background: ${item.status === 'completed' ? 'var(--color-sage-bg)' : 'transparent'}; border: 1px solid var(--color-border);" data-action="toggle-activity" data-id="${item.id}">
                      <i class="ph ${item.status === 'completed' ? 'ph-check-square' : 'ph-square'}" style="font-size: 18px; color: ${item.status === 'completed' ? 'var(--color-sage)' : 'var(--color-text-muted)'};"></i>
                    </button>
                    <div>
                      <span style="font-size: 14px; display: block; text-decoration: ${item.status === 'completed' ? 'line-through' : 'none'}; color: var(--color-charcoal);">${escapeHtml(item.title)}</span>
                      <span style="font-size: 11px; color: var(--color-text-muted);">${escapeHtml(item.scheduledFor)}</span>
                    </div>
                  </div>
                  <span class="status-pill mini success">${item.category}</span>
                </div>
              `).join("") || `<p style="color: var(--color-text-muted); text-align: center;">No activities scheduled yet.</p>`}
            </div>
          </div>
        </div>
      `;
    } else if (state.cbtActiveTab === "grounding") {
      subTabContentHtml = `
        <div class="dashboard-card span-12" style="display: flex; flex-direction: column; gap: 24px; align-items: center; text-align: center; padding: 48px;">
          <div style="width: 72px; height: 72px; border-radius: 50%; background: rgba(49, 151, 149, 0.1); color: #319795; display: flex; align-items: center; justify-content: center; font-size: 36px;">
            <i class="ph ph-leaf"></i>
          </div>
          <div>
            <h3 style="font-family: var(--font-serif); font-size: 26px; color: var(--color-charcoal); margin-bottom: 8px;">The 5-4-3-2-1 Grounding Technique</h3>
            <p style="color: var(--color-text-muted); max-width: 600px; line-height: 1.6;">Anchor yourself in the present moment by clicking through the external sensory checks below when feeling anxious or overwhelmed.</p>
          </div>
          
          <div style="display: flex; justify-content: center; gap: 12px; width: 100%; max-width: 800px; margin-top: 16px;">
            <button class="btn secondary" style="flex: 1; padding: 20px; border-radius: 16px; border-color: rgba(49, 151, 149, 0.2);" onclick="toast('Look around: Name 5 things you can see (e.g. a cup, a painting, a clock).')">
              <strong style="display: block; font-size: 20px; color: #319795; margin-bottom: 4px;">5</strong>
              <span style="font-size: 12px;">Things to See</span>
            </button>
            <button class="btn secondary" style="flex: 1; padding: 20px; border-radius: 16px; border-color: rgba(49, 151, 149, 0.2);" onclick="toast('Feel: Name 4 things you can touch (e.g. hair, chair, keys, phone).')">
              <strong style="display: block; font-size: 20px; color: #319795; margin-bottom: 4px;">4</strong>
              <span style="font-size: 12px;">Things to Touch</span>
            </button>
            <button class="btn secondary" style="flex: 1; padding: 20px; border-radius: 16px; border-color: rgba(49, 151, 149, 0.2);" onclick="toast('Listen: Name 3 things you can hear (e.g. traffic, humming AC, birds).')">
              <strong style="display: block; font-size: 20px; color: #319795; margin-bottom: 4px;">3</strong>
              <span style="font-size: 12px;">Things to Hear</span>
            </button>
            <button class="btn secondary" style="flex: 1; padding: 20px; border-radius: 16px; border-color: rgba(49, 151, 149, 0.2);" onclick="toast('Smell: Name 2 things you can smell (e.g. coffee, paper, flowers).')">
              <strong style="display: block; font-size: 20px; color: #319795; margin-bottom: 4px;">2</strong>
              <span style="font-size: 12px;">Things to Smell</span>
            </button>
            <button class="btn secondary" style="flex: 1; padding: 20px; border-radius: 16px; border-color: rgba(49, 151, 149, 0.2);" onclick="toast('Taste: Name 1 thing you can taste (e.g. mint, toothpaste, food).')">
              <strong style="display: block; font-size: 20px; color: #319795; margin-bottom: 4px;">1</strong>
              <span style="font-size: 12px;">Thing to Taste</span>
            </button>
          </div>
        </div>
      `;
    } else if (state.cbtActiveTab === "worry") {
      subTabContentHtml = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
          <!-- Worry postponement Form -->
          <form data-form="cbt-worry" class="dashboard-card" style="display: flex; flex-direction: column; gap: 16px; height: fit-content;">
            <h3 style="font-family: var(--font-serif); font-size: 22px; color: var(--color-charcoal);"><i class="ph ph-clock-counter-clockwise" style="color: #805ad5;"></i> Postpone Worry Time</h3>
            <p style="font-size: 13px; color: var(--color-text-muted);">Acknowledge a worry and schedule it for later to reduce ongoing panic.</p>
            <div class="field">
              <label for="worry-thought">Anxious / Intrusive Thought</label>
              <textarea id="worry-thought" name="thought" placeholder="e.g. What if I perform poorly tomorrow?" rows="2" required></textarea>
            </div>
            <div class="field">
              <label for="worry-time">Postponed Worry Time Window</label>
              <input id="worry-time" name="postponedTo" placeholder="e.g. 6:00 PM to 6:15 PM" required />
            </div>
            <button type="submit" class="btn primary" style="background: #805ad5; align-self: flex-start;">Postpone Worry</button>
          </form>

          <!-- Worry Logs -->
          <div class="dashboard-card" style="display: flex; flex-direction: column; gap: 16px;">
            <h3 style="font-family: var(--font-serif); font-size: 22px; color: var(--color-charcoal);"><i class="ph ph-notebook"></i> Deferred Worries</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${state.cbtWorryLogs.map(item => `
                <div style="padding: 14px; background: rgba(0,0,0,0.02); border: 1px solid var(--color-border); border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <span style="font-size: 14px; color: var(--color-charcoal); display: block;">"${escapeHtml(item.thought)}"</span>
                    <span style="font-size: 11px; color: var(--color-text-muted);">Deferred to: <strong>${escapeHtml(item.postponedTo)}</strong></span>
                  </div>
                  <button class="btn secondary mini" style="padding: 4px 8px; font-size: 11px;" data-action="delete-worry" data-id="${item.id}">Resolve</button>
                </div>
              `).join("") || `<p style="color: var(--color-text-muted); text-align: center;">No worries scheduled for postponed review.</p>`}
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <div class="panel-hero" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div>
          <h1 class="page-title">CBT toolkit</h1>
          <p class="page-subtitle">Evidence-based Cognitive Behavioral self-reflection exercises.</p>
        </div>
        <button class="btn primary" data-action="open-daily-diary" style="background: #805ad5; color: white;">
          <i class="ph ph-book-open"></i> Open Daily Diary
        </button>
      </div>

      <!-- Tab Navigation -->
      <div style="display: flex; gap: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; margin-bottom: 24px; overflow-x: auto;">
        ${[
          ["thought", "ph-notebook", "Thought Diary"],
          ["exposure", "ph-target", "Exposure Hierarchy"],
          ["activation", "ph-chart-polar", "Behavioral Activation"],
          ["grounding", "ph-leaf", "Grounding Techniques"],
          ["worry", "ph-clock-counter-clockwise", "Worry Time"]
        ].map(([id, icon, label]) => `
          <button class="btn secondary ${state.cbtActiveTab === id ? 'active' : ''}" data-action="switch-cbt-tab" data-tab="${id}" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 12px; border-color: ${state.cbtActiveTab === id ? 'var(--color-charcoal)' : 'transparent'}; background: ${state.cbtActiveTab === id ? 'var(--color-charcoal)' : 'rgba(0,0,0,0.03)'}; color: ${state.cbtActiveTab === id ? 'white' : 'var(--color-charcoal)'};">
            <i class="ph ${icon}"></i> ${label}
          </button>
        `).join("")}
      </div>

      <!-- Tab Content Area -->
      ${subTabContentHtml}

      <!-- DAILY DIARY OVERLAY MODAL -->
      ${state.cbtDailyDiaryOpen ? html`
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 24px;">
          <div class="dashboard-card" style="width: 100%; max-width: 600px; background: var(--color-card-elevated); border: 1px solid var(--color-border); border-radius: 24px; padding: 32px; position: relative; box-shadow: var(--shadow-3); display: flex; flex-direction: column; gap: 20px;">
            <button data-action="close-daily-diary" style="position: absolute; top: 20px; right: 20px; background: transparent; border: none; color: var(--color-text-muted); font-size: 24px; cursor: pointer;">
              <i class="ph ph-x"></i>
            </button>
            <h2 style="font-family: var(--font-serif); font-size: 24px; color: var(--color-charcoal); display: flex; align-items: center; gap: 12px; margin: 0;"><i class="ph-fill ph-book-open" style="color: #805ad5;"></i> Daily Diary</h2>
            <p style="font-size: 14px; color: var(--color-text-muted); margin: 0;">Write down your daily log, reflection notes, and get optional AI reflection.</p>
            
            <form data-form="cbt-daily-diary" style="display: flex; flex-direction: column; gap: 16px;">
              <div class="field">
                <label for="diary-text">Reflection Note</label>
                <textarea id="diary-text" name="notes" placeholder="How did today feel? What was on your mind?" rows="4" required style="width: 100%;"></textarea>
              </div>
              <button type="submit" class="btn primary" style="background: #805ad5; align-self: flex-start;">Save Entry</button>
            </form>

            <div style="border-top: 1px solid var(--color-border); padding-top: 16px; max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;">
              <h4 style="margin: 0; font-size: 14px;">Diary Entries</h4>
              ${state.cbtDailyDiaryEntries.map(entry => `
                <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--color-border); padding: 12px; border-radius: 12px; font-size: 13px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; color: var(--color-text-muted);">
                    <span>${new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <p style="margin: 0;">${escapeHtml(entry.notes)}</p>
                </div>
              `).join("") || `<p style="color: var(--color-text-muted); font-size: 13px; text-align: center;">No entries written yet.</p>`}
            </div>
          </div>
        </div>
      ` : ""}
    `;
  }

  if (section === "reports") {
    return html`
      <div class="panel-hero">
        <div>
          <h1 class="page-title">Analysis reports</h1>
          <p class="page-subtitle">Dream, handwriting, and signature analysis with paid PDF unlock and expert review.</p>
        </div>
      </div>
      <div class="dashboard-grid">
        <div class="dashboard-card span-4 analysis-card-redesign" style="display: flex; flex-direction: column; justify-content: space-between; min-height: 220px;">
          <div>
            <div class="card-header-accent dream" style="width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; background: rgba(235, 94, 40, 0.1); color: var(--color-coral);">
              <i class="ph-fill ph-moon-stars"></i>
            </div>
            <h3 style="font-family:var(--font-serif); font-size:20px; color:var(--color-charcoal); margin-top:16px; margin-bottom:8px;">Dream Analysis</h3>
            <p class="card-desc">Reveal subconscious themes, archetypes, and clinical symbols from your dreams.</p>
          </div>
          <a href="#/services/dream" class="btn primary submit-btn" style="text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; margin-top:12px;">
            <i class="ph ph-sparkle"></i> Analyze New Dream
          </a>
        </div>

        <div class="dashboard-card span-4 analysis-card-redesign" style="display: flex; flex-direction: column; justify-content: space-between; min-height: 220px;">
          <div>
            <div class="card-header-accent handwriting" style="width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; background: rgba(43, 108, 176, 0.1); color: #2b6cb0;">
              <i class="ph-fill ph-pen-nib"></i>
            </div>
            <h3 style="font-family:var(--font-serif); font-size:20px; color:var(--color-charcoal); margin-top:16px; margin-bottom:8px;">Handwriting Analysis</h3>
            <p class="card-desc">Decode personality traits, emotional states, and cognitive patterns from stroke strokes.</p>
          </div>
          <a href="#/services/handwriting" class="btn primary submit-btn" style="text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; background: #2b6cb0; margin-top:12px;">
            <i class="ph ph-sparkle"></i> Analyze Handwriting
          </a>
        </div>

        <div class="dashboard-card span-4 analysis-card-redesign" style="display: flex; flex-direction: column; justify-content: space-between; min-height: 220px;">
          <div>
            <div class="card-header-accent signature" style="width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; background: rgba(128, 90, 213, 0.1); color: #805ad5;">
              <i class="ph-fill ph-signature"></i>
            </div>
            <h3 style="font-family:var(--font-serif); font-size:20px; color:var(--color-charcoal); margin-top:16px; margin-bottom:8px;">Signature Analysis</h3>
            <p class="card-desc">Explore confidence, self-image, and public persona based on line flows.</p>
          </div>
          <a href="#/services/signature" class="btn primary submit-btn" style="text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; background: #805ad5; margin-top:12px;">
            <i class="ph ph-sparkle"></i> Analyze Signature
          </a>
        </div>ure
          </button>
        </form>
        
        <section class="dashboard-card span-12">
          <h3><i class="ph ph-clock-counter-clockwise"></i> Report history</h3>
          <ul class="list" style="margin-top: 16px; border-top: 1px solid rgba(0,0,0,0.05);">
            ${[...data.analysisSubmissions, ...dashboard.reports]
              .map((report) => {
                const type = report.type || report.reportType || "Analysis";
                const title = report.title || report.description || report.inputText || report.aiSummary || "New analysis";
                const status = report.status || (report.isPdfUnlocked ? "Unlocked" : "Locked");
                const action = report.id && !report.isPdfUnlocked
                  ? `<button class="btn secondary" type="button" data-action="unlock-report" data-report-id="${escapeHtml(report.id)}" style="padding: 6px 12px; font-size: 13px;"><i class="ph ph-lock-key-open"></i> Unlock PDF</button>`
                  : report.pdfUrl
                    ? `<a class="btn secondary" href="${escapeHtml(report.pdfUrl)}" target="_blank" rel="noreferrer" style="padding: 6px 12px; font-size: 13px;"><i class="ph ph-download-simple"></i> Open PDF</a>`
                    : "";
                    
                const icon = type.toLowerCase().includes('dream') ? 'ph-cloud-moon' : type.toLowerCase().includes('signature') ? 'ph-signature' : 'ph-pen-nib';
                
                return `
                  <li class="list-item" style="display: flex; flex-direction: column; gap: 12px; padding: 20px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(0,0,0,0.04); display: flex; align-items: center; justify-content: center; color: var(--color-charcoal);">
                          <i class="ph ${icon}" style="font-size: 20px;"></i>
                        </div>
                        <div>
                          <strong style="display: block; font-size: 16px; color: var(--color-charcoal); margin-bottom: 2px;">${type}</strong>
                          <span style="color: #888; font-size: 14px;">${escapeHtml(title).substring(0, 40)}${title.length > 40 ? '...' : ''}</span>
                        </div>
                      </div>
                      <span class="status-pill ${status === "Unlocked" ? "success" : "warning"}">${status}</span>
                    </div>
                    ${action ? `<div style="display: flex; justify-content: flex-end;">${action}</div>` : ''}
                  </li>
                `;
              })
              .join("") || `<li class="list-item" style="color: #888; text-align: center; padding: 32px 0;"><i class="ph ph-file-dashed" style="font-size: 32px; display: block; margin-bottom: 8px; color: #ccc;"></i> No reports generated yet</li>`}
          </ul>
        </section>
      </div>
    `;
  }

  if (section === "wallet") {
    const transactions = Array.isArray(data.walletTransactions) ? data.walletTransactions : [];
    return html`
      <div class="panel-hero">
        <div><h1 class="page-title">Wallet</h1><p class="page-subtitle">INR-only wallet for sessions, report unlocks, premium content, refunds, and receipts.</p></div>
      </div>
      <div class="dashboard-grid">
        <div class="dashboard-card span-4"><h3>Balance</h3><div class="metric"><strong>${formatInr(dashboard.walletBalance)}</strong><span>Available balance</span></div></div>
        <div class="dashboard-card span-4"><h3>Reports unlocked</h3><div class="metric"><strong>${dashboard.reportsUnlocked}</strong><span>This account</span></div></div>
        <div class="dashboard-card span-4"><h3>Refunds</h3><p>No refunds pending.</p></div>
        <form class="dashboard-card span-6" data-form="wallet-topup">
          <h3>Top up wallet</h3>
          <div class="form-grid">
            <div class="field"><label for="topupAmount">Amount</label><input id="topupAmount" name="amountInr" type="number" min="1" step="1" value="500" required /></div>
            <button class="btn primary" type="submit">Add Money</button>
          </div>
        </form>
        <section class="dashboard-card span-12">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px;">
            <div>
              <h3>Transaction history</h3>
              <p>Immutable wallet credits, debits, payment references, and unlock charges.</p>
            </div>
            <span class="status-pill ${transactions.length ? "success" : "warning"}">${transactions.length} entr${transactions.length === 1 ? "y" : "ies"}</span>
          </div>
          ${transactions.length ? renderWalletTransactionsTable(transactions) : `<p>No wallet transactions yet.</p>`}
        </section>
      </div>
    `;
  }

  return html`
    <div class="panel-hero">
      <div>
        <h1 class="page-title">Welcome back</h1>
        <p class="page-subtitle">${escapeHtml(upcomingSessions.length ? `Next: ${upcomingSessions[0].type} with ${upcomingSessions[0].counsellor}` : dashboard.nextSession)}</p>
      </div>
      <button class="btn primary" type="button" data-demo-action="book-session" style="background: white; color: var(--color-charcoal); border: none;">Book Session</button>
    </div>
    
    <div class="dashboard-grid">
      <div class="dashboard-card span-4">
        <h3><i class="ph ph-wallet"></i> Wallet</h3>
        <div class="metric">
          <strong>${formatInr(dashboard.walletBalance)}</strong>
          <span>Current balance</span>
        </div>
      </div>
      <div class="dashboard-card span-4">
        <h3><i class="ph ph-smiley"></i> Mood</h3>
        <div class="metric">
          <strong class="mood-metric-value">${dashboard.moodScore}/10</strong>
          <span>Today</span>
        </div>
      </div>
      <div class="dashboard-card span-4">
        <h3><i class="ph ph-file-pdf"></i> Reports</h3>
        <div class="metric">
          <strong>${dashboard.reportsUnlocked}</strong>
          <span>Unlocked PDFs</span>
        </div>
      </div>
      
      ${renderMoodStudio({ dashboard, data })}
      
      <section class="dashboard-card span-12">
        <h3><i class="ph ph-video-camera"></i> Upcoming Sessions</h3>
        <ul class="list" style="margin-top: 16px; border-top: 1px solid rgba(0,0,0,0.05);">
          ${upcomingSessions.length ? upcomingSessions.map(userSessionListItem).join("") : `<li class="list-item" style="color: #888; text-align: center; padding: 32px 0;"><i class="ph ph-calendar-blank" style="font-size: 32px; display: block; margin-bottom: 8px; color: #ccc;"></i> No upcoming sessions yet</li>`}
        </ul>
      </section>
      
      <section class="dashboard-card span-12">
        <h3><i class="ph ph-clock-counter-clockwise"></i> Mood History</h3>
        <ul class="list" style="margin-top: 16px; border-top: 1px solid rgba(0,0,0,0.05); display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
          ${(data.moodHistory?.length ? data.moodHistory.slice(-5).reverse() : [{ score: dashboard.moodScore, note: "No backend mood logs yet.", createdAt: new Date().toISOString() }])
            .map((mood) => {
              const { factors, cleanNote } = parseMoodNote(mood.note);
              const tagsHtml = factors.map(f => `<span class="status-pill mini" style="background: rgba(0,0,0,0.04); color: #666; font-size: 11px; margin-right: 4px; padding: 2px 6px;">${escapeHtml(f)}</span>`).join("");
              return `
                <li style="padding: 16px; background: rgba(0,0,0,0.02); border-radius: 16px; border: 1px solid rgba(0,0,0,0.05); list-style: none;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="color: var(--color-coral); font-size: 18px;">${mood.score}/10</strong>
                    <small style="color: #888;">${new Date(mood.createdAt).toLocaleDateString()}</small>
                  </div>
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #444;">${escapeHtml(cleanNote || "No note")}</p>
                  ${tagsHtml ? `<div style="display: flex; flex-wrap: wrap; gap: 4px;">${tagsHtml}</div>` : ""}
                </li>`;
            })
            .join("")}
        </ul>
      </section>
    </div>
  `;
}

function counsellorCard(counsellor) {
  const name = counsellor.name || counsellor.displayName;
  const title = counsellor.title || "Verified counsellor";
  const rating = counsellor.rating || counsellor.ratingAvg || 0;
  const rate = counsellor.rate || counsellor.hourlyRateInr || 0;
  const status = counsellor.status || (counsellor.verificationStatus === "approved" ? "Online" : "Pending");
  const normalizedStatus = String(status).toLowerCase();
  const specialities = counsellor.specialities || counsellor.specializations || [];
  const languages = counsellor.languages || counsellor.languagesSpoken || [];
  const bookingCounsellorId = counsellor.id?.startsWith("cns_") ? counsellor.id : "cns_priya";
  return html`
    <article class="service-card hover-lift">
      <div class="counsellor-card-header">
        <img class="avatar" src="https://i.pravatar.cc/150?u=${escapeHtml(counsellor.id)}" alt="Avatar of ${escapeHtml(name)}" />
        <div class="counsellor-header-info">
          <div class="counsellor-name-row">
            <h3>${name}</h3>
            <i class="ph-fill ph-seal-check verified-badge" title="Verified Counsellor"></i>
          </div>
          <p class="counsellor-title">${title}</p>
        </div>
      </div>
      <div class="tag-list">
        <span class="status-pill ${normalizedStatus === "online" ? "success" : normalizedStatus === "busy" ? "warning" : ""}"><span class="status-dot"></span>${status}</span>
        <span class="tag"><i class="ph-fill ph-star" style="color: #ed8936;"></i> ${rating}</span>
        <span class="tag"><i class="ph ph-tag" style="color: var(--color-coral);"></i> ${formatInr(rate)}/hr</span>
      </div>
      <div class="counsellor-specialties">
        ${specialities.map(spec => `<span class="spec-tag">${escapeHtml(spec)}</span>`).join("")}
      </div>
      <div class="counsellor-languages">
        <i class="ph ph-globe"></i>
        ${languages.map(lang => {
          const mapping = { en: "English", hi: "Hindi", gu: "Gujarati", es: "Spanish", fr: "French" };
          return `<span class="lang-text">${escapeHtml(mapping[lang.toLowerCase()] || lang)}</span>`;
        }).join("<span class='lang-separator'>•</span>")}
      </div>
      <form data-form="booking" style="margin-top: auto;">
        <input type="hidden" name="counsellorId" value="${escapeHtml(bookingCounsellorId)}" />
        <input type="hidden" name="counsellor" value="${escapeHtml(name)}" />
        <input type="hidden" name="amount" value="${rate}" />
        <button class="btn primary" type="submit" style="width: 100%;">Request Session</button>
      </form>
    </article>
  `;
}

function userSessionListItem(session) {
  const time = session.time && !Number.isNaN(new Date(session.time).getTime())
    ? new Date(session.time).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : session.time || "Time not set";
    
  const isVideo = session.type?.toLowerCase().includes("video");
  const iconClass = isVideo ? "ph-fill ph-video-camera" : "ph-fill ph-users";
  const iconBg = isVideo ? "rgba(235, 94, 40, 0.08)" : "rgba(43, 108, 176, 0.08)";
  const iconColor = isVideo ? "var(--color-coral)" : "#2b6cb0";
  
  const status = session.status || "pending";
  const statusClass = status === "confirmed" ? "success" : "warning";
  
  return `
    <li class="session-list-item">
      <div class="session-icon-wrapper" style="background: ${iconBg}; color: ${iconColor};">
        <i class="${iconClass}"></i>
      </div>
      <div class="session-details">
        <span class="session-title">${escapeHtml(session.type)} with <strong>${escapeHtml(session.counsellor)}</strong></span>
        <div class="session-meta">
          <span class="session-time"><i class="ph ph-calendar-blank"></i> ${escapeHtml(time)}</span>
          <span class="status-pill mini ${statusClass}">${status}</span>
        </div>
      </div>
      <div class="session-price">
        ${formatInr(Number(session.cost || 0))}
      </div>
    </li>
  `;
}

async function counsellorPanel() {
  const data = await api.getState();
  const dashboard = data.dashboard.counsellor;
  return panelShell(
    "counsellor",
    "Counsellor Panel",
    "Manage verification, services, sessions, clients, reports, content, availability, and payouts.",
    [
      ["overview", "Overview"],
      ["verification", "Verification"],
      ["sessions", "Sessions"],
      ["availability", "Availability"],
      ["reviews", "Expert Reviews"],
      ["earnings", "Earnings"]
    ],
    counsellorPanelContent(state.panelSection, dashboard, data),
    data.backendStatus
  );
}

function counsellorPanelContent(section, dashboard, data) {
  const liveSessions = data.sessions || [];
  const liveSlots = data.availabilitySlots || [];
  const pendingRequestCount = liveSessions.length
    ? liveSessions.filter((session) => session.status === "pending").length
    : dashboard.pendingRequests;
  const openSlotCount = liveSlots.length
    ? liveSlots.filter((slot) => !slot.isBooked).length
    : dashboard.slotsOpen;

  if (section === "verification") {
    return html`
      <div class="panel-hero"><div><h1 class="page-title">Verification</h1><p class="page-subtitle">Professional accounts must be approved before they appear in search or accept clients.</p></div></div>
      <form class="dashboard-card" data-form="counsellor-application">
        <div class="form-grid">
          <div class="field"><label for="legalName">Legal name</label><input id="legalName" name="legalName" required /></div>
          <div class="field"><label for="speciality">Specialities</label><input id="speciality" name="speciality" required /></div>
          <div class="field"><label for="license">License number</label><input id="license" name="license" required /></div>
          <div class="field"><label for="documents">Document notes</label><textarea id="documents" name="documents" placeholder="Production version will upload files to protected storage."></textarea></div>
          <button class="btn primary" type="submit">Submit for Review</button>
        </div>
      </form>
    `;
  }
  if (section === "sessions") {
    const liveSessions = data.sessions || [];
    const pendingSessions = liveSessions.filter((session) => session.status === "pending");
    const fallbackRequests = dashboard.requests.map((request, index) => ({
      id: `local_request_${index}`,
      userId: request.user,
      sessionType: request.mode,
      scheduledAt: request.time,
      amountInr: request.amount,
      status: "pending",
      isFallback: true
    }));
    const sessions = liveSessions.length ? liveSessions : fallbackRequests;

    return html`
      <div class="panel-hero">
        <div>
          <h1 class="page-title">Session requests</h1>
          <p class="page-subtitle">${liveSessions.length ? `${pendingSessions.length} pending request${pendingSessions.length === 1 ? "" : "s"} from live backend data.` : `${dashboard.pendingRequests} fallback requests waiting.`}</p>
        </div>
        <span class="status-pill ${liveSessions.length ? "success" : "warning"}">${liveSessions.length ? "Live sessions" : "Static fallback"}</span>
      </div>
      <div class="dashboard-grid">
        ${sessions.map(counsellorSessionCard).join("")}
      </div>
    `;
  }
  if (section === "availability") {
    const slots = data.availabilitySlots || [];
    return html`
      <div class="panel-hero"><div><h1 class="page-title">Availability</h1><p class="page-subtitle">Create bookable slots for users. Saving replaces unbooked slots while preserving already-booked sessions.</p></div></div>
      <form class="dashboard-card" data-form="availability">
        <div class="form-grid">
          <div class="field"><label for="slotDate">First date</label><input id="slotDate" name="date" type="date" required /></div>
          <div class="field"><label for="startTime">Start time</label><input id="startTime" name="startTime" type="time" value="10:00" required /></div>
          <div class="field"><label for="endTime">End time</label><input id="endTime" name="endTime" type="time" value="11:00" required /></div>
          <div class="field"><label for="sessionType">Mode</label><select id="sessionType" name="sessionType"><option value="video">Video</option><option value="audio">Audio</option><option value="chat">Chat</option><option value="group">Group</option></select></div>
          <div class="field"><label for="repeatDays">Repeat days</label><input id="repeatDays" name="repeatDays" type="number" min="1" max="14" value="5" /></div>
          <button class="btn primary" type="submit">Save Availability</button>
        </div>
      </form>
      <div class="dashboard-card">
        <h3>Current slots</h3>
        <div class="tag-list" style="margin-top:16px;">
          ${slots.length ? slots.map((slot) => `<span class="tag">${slot.date} · ${slot.startTime}-${slot.endTime} · ${slot.sessionType || "video"}${slot.isBooked ? " · booked" : ""}</span>`).join("") : `<span class="tag">No live slots yet</span>`}
        </div>
      </div>
    `;
  }
  if (section === "reviews") {
    return html`
      <div class="panel-hero"><div><h1 class="page-title">Expert review queue</h1><p class="page-subtitle">Review AI-generated reports and add professional interpretation.</p></div></div>
      <div class="dashboard-grid">${dashboard.reviewQueue.map((item) => `<article class="dashboard-card span-6"><h3>${item.type}</h3><p>${item.user}</p><span class="status-pill warning">${item.status}</span><div class="form-actions"><button class="btn primary" data-demo-action="review-report">Open Review</button></div></article>`).join("")}</div>
    `;
  }
  if (section === "earnings") {
    return html`
      <div class="panel-hero"><div><h1 class="page-title">Earnings</h1><p class="page-subtitle">Session earnings, platform commission, withdrawals, payout status, and tax summary.</p></div><button class="btn primary" data-demo-action="withdraw">Request Withdrawal</button></div>
      <div class="dashboard-grid">
        <div class="dashboard-card span-4"><h3>This month</h3><div class="metric"><strong>${formatInr(dashboard.earningsMonth)}</strong><span>Gross earnings</span></div></div>
        <div class="dashboard-card span-4"><h3>Commission</h3><div class="metric"><strong>${appConfig.platformCommissionPercent}%</strong><span>Admin configured</span></div></div>
        <div class="dashboard-card span-4"><h3>Open slots</h3><div class="metric"><strong>${openSlotCount}</strong><span>This week</span></div></div>
      </div>
    `;
  }
  return html`
    <div class="panel-hero">
      <div><h1 class="page-title">Professional dashboard</h1><p class="page-subtitle">Today’s sessions, requests, ratings, content, and earnings at a glance.</p></div>
      <button class="btn primary" data-demo-action="go-online">Go Online</button>
    </div>
    <div class="dashboard-grid">
      <div class="dashboard-card span-3 span-4"><h3>Monthly earnings</h3><div class="metric"><strong>${formatInr(dashboard.earningsMonth)}</strong><span>Before payout</span></div></div>
      <div class="dashboard-card span-4"><h3>Pending requests</h3><div class="metric"><strong>${pendingRequestCount}</strong><span>Need response</span></div></div>
      <div class="dashboard-card span-4"><h3>Rating</h3><div class="metric"><strong>${dashboard.rating}</strong><span>Average user rating</span></div></div>
      <section class="dashboard-card span-12"><h3>Required features</h3><div class="tag-list">${counsellorFeatures.map((item) => `<span class="tag">${item}</span>`).join("")}</div></section>
    </div>
  `;
}

async function adminPanel() {
  const data = await api.getState();
  const dashboard = data.dashboard.admin;
  return panelShell(
    "admin",
    "Admin Panel",
    "Control the full MindHeal platform from one configuration-first workspace.",
    [
      ["overview", "Overview"],
      ["users", "Users"],
      ["counsellors", "Counsellors"],
      ["ai", "AI Config"],
      ["services", "Services"],
      ["contacts", "Contact Leads"],
      ["finance", "Finance"],
      ["cms", "CMS"],
      ["crisis", "Crisis Events"],
      ["audit", "Audit Logs"]
    ],
    adminPanelContent(state.panelSection, dashboard, data),
    data.backendStatus
  );
}

function adminPanelContent(section, dashboard, data) {
  if (section === "users") {
    return tablePanel("Users", ["Name", "Email", "Role", "Created"], data.users.map((user) => [user.name || user.fullName || "Demo user", user.email || "Not set", user.role, new Date(user.createdAt).toLocaleDateString()]));
  }
  if (section === "counsellors") {
    const rows = data.counsellorApplications.map((item) => {
      const status = item.status || "pending";
      const actionCell = status === "pending"
        ? `<div class="form-actions"><button class="btn primary" type="button" data-action="verify-counsellor" data-application-id="${item.id}" data-status="approved">Approve</button><button class="btn secondary" type="button" data-action="verify-counsellor" data-application-id="${item.id}" data-status="rejected">Reject</button></div>`
        : `<span class="status-pill ${status === "approved" ? "success" : "warning"}">${status}</span>`;
      return [
        item.fullName || item.name || item.legalName || "Applicant",
        item.specializations || item.speciality || "Not set",
        item.licenseNumber || item.license || "Not set",
        `<span class="status-pill ${status === "approved" ? "success" : status === "rejected" ? "danger" : "warning"}">${status}</span>`,
        actionCell
      ];
    });
    return html`
      <div class="panel-hero"><div><h1 class="page-title">Counsellor verification</h1><p class="page-subtitle">Approve, decline, suspend, or request resubmission with audit logs.</p></div></div>
      ${tablePanelMarkup(["Applicant", "Speciality", "License", "Status", "Actions"], rows.length ? rows : [["No applications yet", "-", "-", "-", "-"]])}
    `;
  }
  if (section === "ai") {
    const configs = data.apiConfigurations?.length
      ? data.apiConfigurations
      : apiConfigRows.map((serviceName, index) => ({
          id: `local_cfg_${index}`,
          serviceName,
          provider: index > 5 ? "" : "gemini",
          modelName: index > 5 ? "" : "gemini-2.5-flash",
          apiKeyEncrypted: "",
          systemPrompt: "",
          isActive: false
        }));

    return html`
      <div class="panel-hero"><div><h1 class="page-title">AI configuration</h1><p class="page-subtitle">API keys are masked in frontend, encrypted in DB, and decrypted only by backend services at runtime.</p></div></div>
      <div class="dashboard-grid">
        ${configs.map(adminApiConfigCard).join("")}
      </div>
    `;
  }
  if (section === "services") {
    const catalog = data.servicesCatalog?.length
      ? data.servicesCatalog
      : services.slice(0, 4).map((service, index) => ({
          id: `local_${index}`,
          name: service.title,
          description: service.summary,
          category: service.category,
          isActive: true,
          isFree: service.price === "Free",
          priceInr: service.price === "Free" ? 0 : Number(String(service.price).replace(/[^0-9]/g, "")) || 0
        }));

    return html`
      <div class="panel-hero">
        <div>
          <h1 class="page-title">Service catalog</h1>
          <p class="page-subtitle">Enable, disable, price, and route each service to backend-controlled product behavior.</p>
        </div>
        <span class="status-pill ${data.servicesCatalog?.length ? "success" : "warning"}">${data.servicesCatalog?.length ? "Live backend data" : "Static fallback"}</span>
      </div>
      <div class="dashboard-grid">
        ${catalog.map(adminServiceCard).join("")}
      </div>
    `;
  }
  if (section === "contacts") {
    const leads = data.contactLeads || [];
    const rows = leads.map((lead) => {
      const status = lead.status || "new";
      const actionCell = status === "handled"
        ? `<span class="status-pill success">Handled</span>`
        : `<div class="form-actions"><button class="btn primary" type="button" data-action="update-contact-status" data-contact-id="${escapeHtml(lead.id)}" data-status="handled">Mark handled</button><button class="btn secondary" type="button" data-action="update-contact-status" data-contact-id="${escapeHtml(lead.id)}" data-status="in_review">In review</button></div>`;
      return [
        escapeHtml(lead.name || lead.fullName || "Visitor"),
        escapeHtml(lead.email || "-"),
        escapeHtml(lead.phone || "-"),
        escapeHtml(lead.message || ""),
        `<span class="status-pill ${status === "handled" ? "success" : status === "in_review" ? "warning" : ""}">${escapeHtml(status)}</span>`,
        actionCell
      ];
    });
    return html`
      <div class="panel-hero">
        <div><h1 class="page-title">Contact leads</h1><p class="page-subtitle">Review website enquiries and track whether support/admin has handled them.</p></div>
        <span class="status-pill ${leads.length ? "success" : "warning"}">${leads.length} lead${leads.length === 1 ? "" : "s"}</span>
      </div>
      ${tablePanelMarkup(["Name", "Email", "Phone", "Message", "Status", "Actions"], rows.length ? rows : [["No contact leads yet", "-", "-", "-", "-", "-"]])}
    `;
  }
  if (section === "finance") {
    return html`
      <div class="panel-hero"><div><h1 class="page-title">Finance</h1><p class="page-subtitle">Transactions, refunds, commissions, payouts, GST exports, and gateway webhook checks.</p></div></div>
      ${tablePanelMarkup(["ID", "User", "Type", "Amount", "Status"], dashboard.transactions.map((txn) => [txn.id, txn.user, txn.type, formatInr(txn.amount), txn.status]))}
    `;
  }
  if (section === "cms") {
    return html`
      <div class="panel-hero"><div><h1 class="page-title">Content management</h1><p class="page-subtitle">Regularly changing content should be admin-editable: onboarding, tips, FAQs, sounds, videos, banners, and notification templates.</p></div></div>
      <div class="dashboard-grid">
        ${["Onboarding carousel", "Mental health tips", "Video tutorials", "Ambient sounds", "FAQs", "Push templates"].map((item) => `<article class="dashboard-card span-4"><h3>${item}</h3><p>Ready for backend CMS integration.</p><button class="btn secondary" data-demo-action="${item}">Edit</button></article>`).join("")}
      </div>
    `;
  }
  if (section === "audit") {
    return html`
      <div class="panel-hero"><div><h1 class="page-title">Audit Logs</h1><p class="page-subtitle">Immutable ledger of administrative and system actions for security and compliance.</p></div><button class="btn secondary" data-demo-action="refresh-logs">Refresh</button></div>
      <div id="audit-logs-container">Loading...</div>
    `;
  }
  if (section === "crisis") {
    const events = data.crisisEvents || [];
    const rows = events.map((event) => [
      escapeHtml(event.id || "-"),
      escapeHtml(event.userId || "Anonymous"),
      `<span class="status-pill danger">${escapeHtml(event.riskLevel || "unknown")}</span>`,
      escapeHtml(event.source || "-"),
      escapeHtml(event.detectedTextHash || "-"),
      escapeHtml(event.actionTaken || "-"),
      event.createdAt ? new Date(event.createdAt).toLocaleString() : "-"
    ]);
    return html`
      <div class="panel-hero">
        <div><h1 class="page-title">Crisis events</h1><p class="page-subtitle">High-risk AI safety detections with hashed text only; raw user messages are never displayed here.</p></div>
        <span class="status-pill ${events.length ? "danger" : "success"}">${events.length} event${events.length === 1 ? "" : "s"}</span>
      </div>
      ${tablePanelMarkup(["ID", "User", "Risk", "Source", "Text hash", "Action", "Created"], rows.length ? rows : [["No crisis events logged", "-", "-", "-", "-", "-", "-"]])}
    `;
  }
  return html`
    <div class="panel-hero">
      <div><h1 class="page-title">Admin overview</h1><p class="page-subtitle">Platform-wide metrics and high-priority operational controls.</p></div>
      <button class="btn primary" data-demo-action="send-notification">Send Notification</button>
    </div>
    <div class="dashboard-grid">
      <div class="dashboard-card span-3 span-4"><h3>Users</h3><div class="metric"><strong>${dashboard.users.toLocaleString("en-IN")}</strong><span>Registered</span></div></div>
      <div class="dashboard-card span-4"><h3>Counsellors</h3><div class="metric"><strong>${dashboard.counsellors}</strong><span>Verified/active</span></div></div>
      <div class="dashboard-card span-4"><h3>Revenue</h3><div class="metric"><strong>${formatInr(dashboard.revenueMonth)}</strong><span>This month</span></div></div>
      <div class="dashboard-card span-6"><h3>Pending verifications</h3><div class="metric"><strong>${dashboard.pendingVerifications}</strong><span>Need admin review</span></div></div>
      <div class="dashboard-card span-6"><h3>AI messages</h3><div class="metric"><strong>${dashboard.aiMessages.toLocaleString("en-IN")}</strong><span>This month</span></div></div>
      <section class="dashboard-card span-12"><h3>Required controls</h3><div class="tag-list">${adminFeatures.map((item) => `<span class="tag">${item}</span>`).join("")}</div></section>
    </div>
  `;
}

function tablePanel(title, headers, rows) {
  return html`
    <div class="panel-hero"><div><h1 class="page-title">${title}</h1><p class="page-subtitle">Data is currently backed by local mock storage and ready to connect to backend APIs.</p></div></div>
    ${tablePanelMarkup(headers, rows.length ? rows : [["No records yet", "-", "-", "-"]])}
  `;
}

function tablePanelMarkup(headers, rows) {
  return html`
    <div class="table-card">
      <div class="table-wrap">
        <table>
          <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
  `;
}


function adminApiConfigCard(config) {
  const serviceName = escapeHtml(config.serviceName || "Configured service");
  const provider = String(config.provider || "gemini").toLowerCase();
  const modelName = escapeHtml(config.modelName || "");
  const systemPrompt = escapeHtml(config.systemPrompt || "");
  const maskedKey = escapeHtml(config.apiKeyEncrypted || "");
  const isActive = config.isActive === true;
  const disabled = String(config.id || "").startsWith("local_cfg_");

  return html`
    <form class="dashboard-card span-6" data-form="admin-api-config" data-service-name="${serviceName}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px;">
        <div>
          <h3>${serviceName}</h3>
          <p>${maskedKey ? `Key: ${maskedKey}` : "No backend key stored yet."}</p>
        </div>
        <span class="status-pill ${isActive ? "success" : "warning"}">${isActive ? "Active" : "Inactive"}</span>
      </div>
      <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">
        <div class="field">
          <label for="provider-${escapeHtml(config.id || serviceName)}">Provider</label>
          <select id="provider-${escapeHtml(config.id || serviceName)}" name="provider" ${disabled ? "disabled" : ""}>
            <option value="gemini" ${provider === "gemini" ? "selected" : ""}>Gemini</option>
            <option value="openai" ${provider === "openai" ? "selected" : ""}>OpenAI</option>
            <option value="custom" ${provider === "custom" ? "selected" : ""}>Custom</option>
          </select>
        </div>
        <div class="field">
          <label for="model-${escapeHtml(config.id || serviceName)}">Model</label>
          <input id="model-${escapeHtml(config.id || serviceName)}" name="modelName" value="${modelName}" placeholder="gemini-2.5-flash" ${disabled ? "disabled" : ""} />
        </div>
        <div class="field">
          <label for="key-${escapeHtml(config.id || serviceName)}">API key</label>
          <input id="key-${escapeHtml(config.id || serviceName)}" name="apiKeyEncrypted" type="password" placeholder="${maskedKey || "Paste key"}" ${disabled ? "disabled" : ""} />
        </div>
        <label class="field" style="display:flex;align-items:center;gap:10px;justify-content:center;">
          <input name="isActive" type="checkbox" ${isActive ? "checked" : ""} ${disabled ? "disabled" : ""} />
          <span>Active</span>
        </label>
      </div>
      <div class="field" style="margin-top:16px;">
        <label for="prompt-${escapeHtml(config.id || serviceName)}">System prompt</label>
        <textarea id="prompt-${escapeHtml(config.id || serviceName)}" name="systemPrompt" ${disabled ? "disabled" : ""}>${systemPrompt}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn primary" type="submit" ${disabled ? "disabled" : ""}>Save Config</button>
      </div>
    </form>
  `;
}

function adminServiceCard(service) {
  const isActive = service.isActive !== false;
  const isFree = service.isFree === true;
  const priceInr = service.priceInr ?? Math.round(Number(service.pricePaise || 0) / 100);
  const disabled = String(service.id || "").startsWith("local_");
  const serviceId = escapeHtml(service.id || "");
  const serviceName = escapeHtml(service.name || "");
  const serviceDescription = escapeHtml(service.description || "");
  const serviceCategory = escapeHtml(service.category || "");

  return html`
    <form class="dashboard-card span-6" data-form="admin-service" data-service-id="${serviceId}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px;">
        <div>
          <h3>${serviceName || "Untitled service"}</h3>
          <p>${serviceDescription || "No description configured yet."}</p>
        </div>
        <span class="status-pill ${isActive ? "success" : "warning"}">${isActive ? "Enabled" : "Disabled"}</span>
      </div>
      <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">
        <div class="field">
          <label for="service-name-${serviceId}">Name</label>
          <input id="service-name-${serviceId}" name="name" value="${serviceName}" ${disabled ? "disabled" : ""} />
        </div>
        <div class="field">
          <label for="service-category-${serviceId}">Category</label>
          <input id="service-category-${serviceId}" name="category" value="${serviceCategory}" ${disabled ? "disabled" : ""} />
        </div>
        <div class="field">
          <label for="service-price-${serviceId}">Price INR</label>
          <input id="service-price-${serviceId}" name="priceInr" type="number" min="0" step="1" value="${priceInr}" ${disabled ? "disabled" : ""} />
        </div>
        <label class="field" style="display:flex;align-items:center;gap:10px;justify-content:center;">
          <input name="isActive" type="checkbox" ${isActive ? "checked" : ""} ${disabled ? "disabled" : ""} />
          <span>Enabled</span>
        </label>
        <label class="field" style="display:flex;align-items:center;gap:10px;justify-content:center;">
          <input name="isFree" type="checkbox" ${isFree ? "checked" : ""} ${disabled ? "disabled" : ""} />
          <span>Free</span>
        </label>
      </div>
      <div class="field" style="margin-top:16px;">
        <label for="service-description-${serviceId}">Description</label>
        <textarea id="service-description-${serviceId}" name="description" rows="3" ${disabled ? "disabled" : ""}>${serviceDescription}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn primary" type="submit" ${disabled ? "disabled" : ""}>Save Service</button>
        <button class="btn secondary" type="button" data-action="toggle-service" data-service-id="${serviceId}" data-next-active="${isActive ? "false" : "true"}" ${disabled ? "disabled" : ""}>${isActive ? "Disable" : "Enable"}</button>
      </div>
    </form>
  `;
}

function counsellorSessionCard(session) {
  const status = session.status || "pending";
  const amount = Number(session.amountInr || session.amount || session.amountPaise / 100 || 0);
  const scheduledAt = session.scheduledAt && !Number.isNaN(new Date(session.scheduledAt).getTime())
    ? new Date(session.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : session.scheduledAt || "Time not set";
  const mode = escapeHtml(String(session.sessionType || "video"));
  const userLabel = escapeHtml(String(session.userName || session.userId || "Client"));
  const isPending = status === "pending" && !session.isFallback;

  return html`
    <article class="dashboard-card span-6">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
        <div>
          <h3>${userLabel}</h3>
          <p>${mode} session · ${escapeHtml(scheduledAt)}</p>
        </div>
        <span class="status-pill ${status === "confirmed" ? "success" : status === "declined" || status === "cancelled" ? "danger" : "warning"}">${escapeHtml(status)}</span>
      </div>
      <strong>${formatInr(amount)}</strong>
      <div class="form-actions">
        ${isPending ? `<button class="btn primary" type="button" data-action="accept-session" data-session-id="${session.id}">Accept</button><button class="btn secondary" type="button" data-action="decline-session" data-session-id="${session.id}">Decline</button>` : `<button class="btn secondary" type="button" ${session.isFallback ? `data-demo-action="session-${status}"` : "disabled"}>${session.isFallback ? "Backend required" : "No action"}</button>`}
      </div>
    </article>
  `;
}

function panelShell(role, title, subtitle, navItems, content, backendStatus = "offline") {
  const iconMapping = {
    overview: "ph-bold ph-layout",
    ai: "ph-bold ph-chat-circle-dots",
    counsellors: "ph-bold ph-users-three",
    cbt: "ph-bold ph-brain",
    reports: "ph-bold ph-file-text",
    wallet: "ph-bold ph-wallet",
    verification: "ph-bold ph-shield-check",
    availability: "ph-bold ph-calendar-blank",
    sessions: "ph-bold ph-video-camera",
    clients: "ph-bold ph-user-list",
    payouts: "ph-bold ph-bank",
    users: "ph-bold ph-users",
    services: "ph-bold ph-folder-open",
    api: "ph-bold ph-gear-six",
    crisis: "ph-bold ph-warning-octagon",
    leads: "ph-bold ph-envelope-open"
  };

  return html`
    <main class="panel-layout" data-panel-role="${role}">
      <aside class="panel-sidebar ${state.sidebarCollapsed ? "collapsed" : ""}">
        <button class="sidebar-toggle" type="button" data-action="toggle-sidebar" title="${state.sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}" aria-label="Toggle navigation sidebar">
          <i class="ph-bold ${state.sidebarCollapsed ? "ph-caret-right" : "ph-caret-left"}"></i>
        </button>
        <div class="sidebar-brand-container">
          <a class="brand" href="#/">
            <img src="assets/logos/mindheal-logo.svg" alt="" />
            <div class="brand-meta">
              <span class="brand-title">${title}</span>
              <span class="status-pill ${backendStatus === "online" ? "success" : "warning"}">${backendStatus === "online" ? "API connected" : "Local fallback"}</span>
            </div>
          </a>
        </div>
        <p>${subtitle}</p>
        <nav class="panel-nav" aria-label="${title} sections">
          ${navItems.map(([id, label]) => `
            <button class="panel-link ${state.panelSection === id ? "active" : ""}" type="button" data-panel-section="${id}" title="${label}">
              <div class="panel-link-left">
                <i class="${iconMapping[id] || "ph-bold ph-circle"}"></i>
                <span class="link-label">${label}</span>
              </div>
              <span class="chevron">›</span>
            </button>
          `).join("")}
        </nav>
        <div class="section-actions" style="display:flex;flex-direction:column;gap:8px;">
          <a class="btn secondary" href="#/" title="Back to Home"><i class="ph ph-house"></i><span>Back to Home</span></a>
          <button class="btn secondary" type="button" data-action="logout" title="Logout"><i class="ph ph-sign-out"></i><span>Logout</span></button>
        </div>
      </aside>
      <section class="panel-main">${content}</section>
    </main>
  `;
}

function attachGlobalHandlers() {
  document.querySelectorAll("[data-action='toggle-menu']").forEach((button) => {
    button.addEventListener("click", () => {
      state.navOpen = !state.navOpen;
      render();
    });
  });
}

function attachPageHandlers() {
  document.querySelectorAll("[data-action='toggle-sidebar']").forEach((button) => {
    button.addEventListener("click", () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      localStorage.setItem("sidebar-collapsed", state.sidebarCollapsed);
      render();
    });
  });

  document.querySelectorAll("[data-action='toggle-safety']").forEach((button) => {
    button.addEventListener("click", () => {
      state.safetySidebarCollapsed = !state.safetySidebarCollapsed;
      localStorage.setItem("safety-sidebar-collapsed", state.safetySidebarCollapsed);
      render();
    });
  });

  document.querySelectorAll("[data-form='contact']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await api.submitContact(getFormData(form));
      form.reset();
      toast("Message saved. The support team can review it from the admin panel.");
    });
  });

  document.querySelectorAll("[data-form='auth']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = getFormData(form);
      const role = form.dataset.role;
      const mode = form.dataset.mode;
      mode === "signup" ? await api.signUp(role, payload) : await api.login(role, payload);
      toast(`${role === "admin" ? "Admin" : role === "counsellor" ? "Counsellor" : "User"} session started.`);
      navigate(form.dataset.panel);
    });
  });

  document.querySelectorAll("[data-panel-section]").forEach((button) => {
    button.addEventListener("click", () => {
      state.panelSection = button.dataset.panelSection;
      
      const panelNode = button.closest(".panel-layout");
      if (panelNode && panelNode.dataset.panelRole) {
        const expectedPath = "/panel/" + panelNode.dataset.panelRole;
        if (state.route.path !== expectedPath) {
          navigate(expectedPath);
          return;
        }
      }
      
      render().then(() => {
        if (state.panelSection === "audit" && state.route.path.startsWith("/panel/admin")) {
          loadAuditLogs();
        }
      });
    });
  });

  document.querySelectorAll("[data-action='logout']").forEach((button) => {
    button.addEventListener("click", async () => {
      await api.logout();
      if (appSocket) {
        appSocket.disconnect();
        appSocket = null;
      }
      toast("Logged out.");
      state.panelSection = "overview";
      navigate("/");
    });
  });

  document.querySelectorAll("[data-form='mood']").forEach((form) => {
    bindMoodStudioForm(form, { api, getFormData, toast, render });
  });

  document.querySelectorAll("[data-form='analysis']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api.submitAnalysis(getFormData(form));
        toast("Free summary generated and saved to report history.");
        form.reset();
        await render();
      } catch (error) {
        toast(error.message || "Analysis request failed.", "error");
      }
    });
  });

  // Scroll to Analyzer on Dream landing page
  document.querySelectorAll("[data-action='dream-landing-scroll']").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById("dream-analyzer");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });

  // Switch tabs in Dream landing page auth modal
  document.querySelectorAll("[data-action='dream-landing-tab-switch']").forEach((button) => {
    button.addEventListener("click", () => {
      state.dreamAuthMode = button.dataset.mode;
      render();
    });
  });

  // Close Dream landing page auth modal
  document.querySelectorAll("[data-action='close-dream-auth-modal']").forEach((button) => {
    button.addEventListener("click", () => {
      state.showDreamAuthModal = false;
      render();
    });
  });

  // Submit analysis on Dream landing page
  document.querySelectorAll("[data-form='dream-landing-analysis']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = getFormData(form);
      state.dreamInput = payload.description || "";
      state.dreamError = "";

      const liveState = await api.getState();
      if (!liveState.auth) {
        state.showDreamAuthModal = true;
        render();
        return;
      }

      state.dreamAnalyzing = true;
      render();

      try {
        const result = await api.submitAnalysis({
          type: "Dream Analysis",
          description: state.dreamInput,
          sampleFile: form.elements.sampleFile?.files?.[0]
        });
        state.dreamResult = result;
      } catch (error) {
        state.dreamError = error.message || "Dream analysis failed.";
      } finally {
        state.dreamAnalyzing = false;
        render();
      }
    });
  });

  // Submit authentication in Dream landing page modal
  document.querySelectorAll("[data-form='dream-landing-auth']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = getFormData(form);
      try {
        if (state.dreamAuthMode === "signup") {
          await api.signUp("user", { ...payload, language: "English" });
        } else {
          await api.login("user", payload);
        }
        toast("Authenticated successfully. Starting dream analysis...");
        state.showDreamAuthModal = false;
        render();

        let result;
        if (state.dreamInput) {
          state.dreamAnalyzing = true;
          render();
          result = await api.submitAnalysis({ type: "Dream Analysis", description: state.dreamInput });
          state.dreamResult = result;
        } else if (state.handwritingInput) {
          state.handwritingAnalyzing = true;
          render();
          result = await api.submitAnalysis({ type: "Handwriting Analysis", description: state.handwritingInput });
          state.handwritingResult = result;
        } else if (state.signatureInput) {
          state.signatureAnalyzing = true;
          render();
          result = await api.submitAnalysis({ type: "Signature Analysis", description: state.signatureInput });
          state.signatureResult = result;
        }
      } catch (error) {
        toast(error.message || "Authentication failed.", "error");
      } finally {
        state.dreamAnalyzing = false;
        state.handwritingAnalyzing = false;
        state.signatureAnalyzing = false;
        render();
      }
    });
  });

  // Scroll to Analyzer on Handwriting landing page
  document.querySelectorAll("[data-action='handwriting-landing-scroll']").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById("handwriting-analyzer");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });

  // Submit analysis on Handwriting landing page
  document.querySelectorAll("[data-form='handwriting-landing-analysis']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = getFormData(form);
      state.handwritingInput = payload.description || "";
      state.handwritingError = "";

      const liveState = await api.getState();
      if (!liveState.auth) {
        state.dreamAuthMode = "signup";
        state.showDreamAuthModal = true;
        render();
        return;
      }

      state.handwritingAnalyzing = true;
      render();

      try {
        const result = await api.submitAnalysis({
          type: "Handwriting Analysis",
          description: state.handwritingInput,
          sampleFile: form.elements.sampleFile?.files?.[0]
        });
        state.handwritingResult = result;
      } catch (error) {
        state.handwritingError = error.message || "Handwriting analysis failed.";
      } finally {
        state.handwritingAnalyzing = false;
        render();
      }
    });
  });

  // Unlock Handwriting PDF report
  document.querySelectorAll("[data-action='handwriting-landing-unlock']").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const unlocked = await api.unlockReport(button.dataset.reportId);
        state.handwritingResult = unlocked;
        toast("Report PDF unlocked successfully.");
        render();
      } catch (error) {
        toast(error.message || "Failed to unlock report. Check your wallet balance.", "error");
      }
    });
  });

  // Scroll to Analyzer on Signature landing page
  document.querySelectorAll("[data-action='signature-landing-scroll']").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById("signature-analyzer");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });

  // Submit analysis on Signature landing page
  document.querySelectorAll("[data-form='signature-landing-analysis']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = getFormData(form);
      state.signatureInput = payload.description || "";
      state.signatureError = "";

      const liveState = await api.getState();
      if (!liveState.auth) {
        state.dreamAuthMode = "signup";
        state.showDreamAuthModal = true;
        render();
        return;
      }

      state.signatureAnalyzing = true;
      render();

      try {
        const result = await api.submitAnalysis({
          type: "Signature Analysis",
          description: state.signatureInput,
          sampleFile: form.elements.sampleFile?.files?.[0]
        });
        state.signatureResult = result;
      } catch (error) {
        state.signatureError = error.message || "Signature analysis failed.";
      } finally {
        state.signatureAnalyzing = false;
        render();
      }
    });
  });

  // Unlock Signature PDF report
  document.querySelectorAll("[data-action='signature-landing-unlock']").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const unlocked = await api.unlockReport(button.dataset.reportId);
        state.signatureResult = unlocked;
        toast("Report PDF unlocked successfully.");
        render();
      } catch (error) {
        toast(error.message || "Failed to unlock report. Check your wallet balance.", "error");
      }
    });
  });

  // Unlock PDF report on landing page
  document.querySelectorAll("[data-action='dream-landing-unlock']").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const unlocked = await api.unlockReport(button.dataset.reportId);
        state.dreamResult = unlocked;
        toast("Report PDF unlocked successfully.");
        render();
      } catch (error) {
        toast(error.message || "Failed to unlock report. Check your wallet balance.", "error");
      }
    });
  });

  document.querySelectorAll("[data-action='unlock-report']").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api.unlockReport(button.dataset.reportId);
        toast("PDF unlocked and saved to report history.");
        await render();
      } catch (error) {
        toast(error.message || "Report unlock failed.", "error");
      }
    });
  });

  document.querySelectorAll("[data-form='booking']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await api.bookSession(getFormData(form));
      toast("Session request created. Payment hold and counsellor acceptance should be handled by backend in production.");
    });
  });

  document.querySelectorAll("[data-form='wallet-topup']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api.topUpWallet(getFormData(form));
        toast("Wallet top-up completed in mock payment mode.");
        await render();
      } catch (error) {
        toast(error.message || "Wallet top-up failed.", "error");
      }
    });
  });

  document.querySelectorAll("[data-form='counsellor-application']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await api.submitCounsellorApplication(getFormData(form));
      toast("Application submitted for admin review.");
      form.reset();
    });
  });

  document.querySelectorAll("[data-form='availability']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api.saveAvailability({ slots: buildAvailabilitySlots(getFormData(form)) });
        toast("Availability slots saved.");
        await render();
      } catch (error) {
        toast(error.message || "Availability update failed.", "error");
      }
    });
  });

  document.querySelectorAll("[data-form='ai-chat']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = getFormData(form);
      const userMessage = payload.message?.trim();
      if (!userMessage) return;

      state.aiMessages.push({ role: "user", text: userMessage });
      saveAiMessages();
      form.reset();
      await render();

      try {
        const result = await api.sendAiMessage(payload);
        state.aiMessages.push({
          role: "ai",
          text: result.response,
          safety: result.safety?.riskLevel || "low"
        });
        saveAiMessages();
        await render();
      } catch (error) {
        state.aiMessages.push({
          role: "ai",
          text: error.message || "AI chat is unavailable right now. Please try again shortly.",
          safety: "error"
        });
        saveAiMessages();
        toast(error.message || "AI chat failed.", "error");
        await render();
      }
    });
  });

  document.querySelectorAll("[data-demo-action='send-notification']").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const users = await api.getState().then(s => s.users);
        const targetUserId = users.length > 0 ? users[0].id : "usr_demo";
        await api.sendNotification({
          userId: targetUserId,
          role: "user",
          title: "System Update",
          message: "This is a real-time notification sent from the admin panel.",
          type: "info"
        });
        toast(`Real-time notification sent to ${targetUserId}.`);
      } catch (err) {
        toast("Failed to send notification.", "error");
      }
    });
  });

  document.querySelectorAll("[data-demo-action='refresh-logs']").forEach((button) => {
    button.addEventListener("click", () => {
      loadAuditLogs();
    });
  });

  document.querySelectorAll("[data-action='verify-counsellor']").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api.updateApplicationStatus(button.dataset.applicationId, button.dataset.status);
        toast(`Counsellor application ${button.dataset.status}.`);
        await render();
      } catch (error) {
        toast(error.message || "Verification update failed.", "error");
      }
    });
  });

  document.querySelectorAll("[data-form='admin-service']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const payload = getAdminServicePayload(form);
        await api.updateService(form.dataset.serviceId, payload);
        toast("Service catalog updated.");
        await render();
      } catch (error) {
        toast(error.message || "Service update failed.", "error");
      }
    });
  });

  document.querySelectorAll("[data-action='toggle-service']").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api.updateService(button.dataset.serviceId, {
          isActive: button.dataset.nextActive === "true"
        });
        toast(button.dataset.nextActive === "true" ? "Service enabled." : "Service disabled.");
        await render();
      } catch (error) {
        toast(error.message || "Service toggle failed.", "error");
      }
    });
  });

  document.querySelectorAll("[data-form='admin-api-config']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api.updateApiConfig(form.dataset.serviceName, getFormData(form));
        toast("API configuration saved.");
        await render();
      } catch (error) {
        toast(error.message || "API configuration update failed.", "error");
      }
    });
  });

  document.querySelectorAll("[data-action='accept-session']").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api.acceptSession(button.dataset.sessionId);
        toast("Session accepted.");
        await render();
      } catch (error) {
        toast(error.message || "Session accept failed.", "error");
      }
    });
  });

  document.querySelectorAll("[data-action='decline-session']").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api.declineSession(button.dataset.sessionId);
        toast("Session declined.");
        await render();
      } catch (error) {
        toast(error.message || "Session decline failed.", "error");
      }
    });
  });

  document.querySelectorAll("[data-action='update-contact-status']").forEach((button) => {
    button.addEventListener("click", async () => {
      const contactId = button.getAttribute("data-contact-id");
      const newStatus = button.getAttribute("data-status");
      await api.updateContactStatus(contactId, newStatus);
      toast(`Contact marked as ${newStatus}`);
      state.panelSection = "contacts";
      render();
    });
  });

  document.querySelectorAll("[data-action='ai-restart-chat']").forEach((button) => {
    button.addEventListener("click", () => {
      state.aiMessages = [
        { role: "ai", text: "I'm here. Take your time. What feels most present for you today?", safety: "low" }
      ];
      saveAiMessages();
      toast("Chat session has been restarted.");
      render(); 
    });
  });

  document.querySelectorAll("[data-action='ai-handover']").forEach((button) => {
    button.addEventListener("click", () => {
      toast("Request sent. Handing over to a human counsellor...");
      button.disabled = true;
      button.innerHTML = '<i class="ph ph-spinner ph-spin" style="margin-right:6px;"></i><span class="btn-text">Connecting...</span>';
    });
  });

  document.querySelectorAll("[data-demo-action]").forEach((button) => {
    if (button.dataset.demoAction === "send-notification" || button.dataset.demoAction === "refresh-logs") return;
    button.addEventListener("click", () => {
      const toolName = button.dataset.demoAction;
      if (toolName === "CBT Thought Diary") {
        state.panelSection = "cbt";
        state.cbtActiveTab = "thought";
        render();
      } else if (toolName === "Daily Diary") {
        state.panelSection = "cbt";
        state.cbtDailyDiaryOpen = true;
        render();
      } else {
        toast(`${toolName} is wired as a frontend action placeholder.`);
      }
    });
  });

  // Switch CBT Tabs
  document.querySelectorAll("[data-action='switch-cbt-tab']").forEach((button) => {
    button.addEventListener("click", () => {
      state.cbtActiveTab = button.dataset.tab;
      render();
    });
  });

  // Open & Close Daily Diary Modal
  document.querySelectorAll("[data-action='open-daily-diary']").forEach((button) => {
    button.addEventListener("click", () => {
      state.cbtDailyDiaryOpen = true;
      render();
    });
  });
  document.querySelectorAll("[data-action='close-daily-diary']").forEach((button) => {
    button.addEventListener("click", () => {
      state.cbtDailyDiaryOpen = false;
      render();
    });
  });

  // Daily Diary Form Submit
  document.querySelectorAll("[data-form='cbt-daily-diary']").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = getFormData(form);
      const newEntry = {
        id: `diary_${Date.now()}`,
        notes: payload.notes,
        createdAt: new Date().toISOString()
      };
      state.cbtDailyDiaryEntries.unshift(newEntry);
      localStorage.setItem("cbt-daily-diary", JSON.stringify(state.cbtDailyDiaryEntries));
      toast("Daily diary entry saved.");
      form.reset();
      render();
    });
  });

  // Thought Diary Form Submit
  document.querySelectorAll("[data-form='cbt-thought-diary']").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = getFormData(form);
      const newEntry = {
        id: `thought_${Date.now()}`,
        situation: payload.situation,
        automaticThought: payload.automaticThought,
        distortion: payload.distortion,
        evidenceFor: payload.evidenceFor,
        evidenceAgainst: payload.evidenceAgainst,
        balancedThought: payload.balancedThought,
        createdAt: new Date().toISOString()
      };
      state.cbtThoughtEntries.unshift(newEntry);
      localStorage.setItem("cbt-thought-diary", JSON.stringify(state.cbtThoughtEntries));
      toast("Thought record saved.");
      form.reset();
      render();
    });
  });

  // Exposure Step Submit
  document.querySelectorAll("[data-form='cbt-exposure']").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = getFormData(form);
      const newStep = {
        id: `exp_${Date.now()}`,
        step: payload.step,
        anxiety: Number(payload.anxiety || 50),
        status: "pending"
      };
      state.cbtExposures.push(newStep);
      localStorage.setItem("cbt-exposure-hierarchy", JSON.stringify(state.cbtExposures));
      toast("Exposure step added.");
      form.reset();
      render();
    });
  });

  // Toggle Exposure Completion
  document.querySelectorAll("[data-action='toggle-exposure']").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.id;
      const index = state.cbtExposures.findIndex(item => item.id === targetId);
      if (index !== -1) {
        state.cbtExposures[index].status = state.cbtExposures[index].status === "completed" ? "pending" : "completed";
        localStorage.setItem("cbt-exposure-hierarchy", JSON.stringify(state.cbtExposures));
        render();
      }
    });
  });

  // Behavioral Activation Schedule Submit
  document.querySelectorAll("[data-form='cbt-activation']").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = getFormData(form);
      const newActivity = {
        id: `act_${Date.now()}`,
        title: payload.title,
        category: payload.category,
        scheduledFor: payload.scheduledFor,
        status: "pending"
      };
      state.cbtActivities.push(newActivity);
      localStorage.setItem("cbt-behavioral-activation", JSON.stringify(state.cbtActivities));
      toast("Activity scheduled.");
      form.reset();
      render();
    });
  });

  // Toggle Activity Completion
  document.querySelectorAll("[data-action='toggle-activity']").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.id;
      const index = state.cbtActivities.findIndex(item => item.id === targetId);
      if (index !== -1) {
        state.cbtActivities[index].status = state.cbtActivities[index].status === "completed" ? "pending" : "completed";
        localStorage.setItem("cbt-behavioral-activation", JSON.stringify(state.cbtActivities));
        render();
      }
    });
  });

  // Worry Postponement Submit
  document.querySelectorAll("[data-form='cbt-worry']").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = getFormData(form);
      const newWorry = {
        id: `wor_${Date.now()}`,
        thought: payload.thought,
        postponedTo: payload.postponedTo,
        createdAt: new Date().toISOString()
      };
      state.cbtWorryLogs.push(newWorry);
      localStorage.setItem("cbt-worry-time", JSON.stringify(state.cbtWorryLogs));
      toast("Worry postponed.");
      form.reset();
      render();
    });
  });

  // Delete Worry Log
  document.querySelectorAll("[data-action='delete-worry']").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.id;
      state.cbtWorryLogs = state.cbtWorryLogs.filter(item => item.id !== targetId);
      localStorage.setItem("cbt-worry-time", JSON.stringify(state.cbtWorryLogs));
      toast("Worry resolved.");
      render();
    });
  });
}

function getAdminServicePayload(form) {
  return {
    name: form.elements.name.value.trim(),
    description: form.elements.description.value.trim(),
    category: form.elements.category.value.trim(),
    priceInr: Number(form.elements.priceInr.value || 0),
    isActive: form.elements.isActive.checked,
    isFree: form.elements.isFree.checked
  };
}

function buildAvailabilitySlots(payload) {
  const repeatDays = Math.max(1, Math.min(14, Number(payload.repeatDays || 1)));
  const start = new Date(`${payload.date}T00:00:00`);
  if (Number.isNaN(start.getTime())) throw new Error("Choose a valid first date.");

  return Array.from({ length: repeatDays }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: date.toISOString().slice(0, 10),
      startTime: payload.startTime,
      endTime: payload.endTime,
      sessionType: payload.sessionType || "video"
    };
  });
}

async function loadAuditLogs() {
  const container = document.getElementById("audit-logs-container");
  if (!container) return;
  try {
    const logs = await api.getAuditLogs();
    if (!logs.length) {
      container.innerHTML = '<div class="dashboard-card span-12"><p>No audit logs found.</p></div>';
      return;
    }
    const rows = logs.map(log => [
      new Date(log.created_at || log.createdAt).toLocaleString(),
      log.user_id || log.userId,
      log.action,
      log.entity,
      log.entity_id || log.entityId || "-",
      JSON.stringify(log.details || {})
    ]);
    container.innerHTML = tablePanelMarkup(["Time", "User ID", "Action", "Entity", "Entity ID", "Details"], rows);
  } catch (err) {
    container.innerHTML = '<div class="alert danger">Failed to load audit logs.</div>';
  }
}

render();

// --- Global Drag-to-Scroll for horizontal-scroll containers ---
let isDown = false;
let startX;
let scrollLeft;
let slider = null;

const stopDrag = () => {
  isDown = false;
  if (slider) {
    slider.style.cursor = 'grab';
    slider.style.scrollSnapType = ''; // Restore snap behavior
    slider.style.scrollBehavior = ''; // Restore smooth scroll if active
  }
};

document.addEventListener('mousedown', (e) => {
  slider = e.target.closest('.horizontal-scroll');
  if (!slider) return;
  isDown = true;
  slider.style.cursor = 'grabbing';
  // Disable snap & smooth scroll so JS drag is instantaneous and smooth
  slider.style.scrollSnapType = 'none';
  slider.style.scrollBehavior = 'auto';
  startX = e.pageX - slider.offsetLeft;
  scrollLeft = slider.scrollLeft;
});

document.addEventListener('mouseleave', stopDrag);
document.addEventListener('mouseup', stopDrag);

document.addEventListener('mousemove', (e) => {
  if (!isDown || !slider) return;
  e.preventDefault(); // Prevent native text/image dragging
  const x = e.pageX - slider.offsetLeft;
  const walk = (x - startX) * 1.5; // Smooth scroll multiplier
  slider.scrollLeft = scrollLeft - walk;
});

// Prevent native image dragging inside horizontal scrolls which interrupts JS drag
document.addEventListener('dragstart', (e) => {
  if (e.target.closest('.horizontal-scroll')) {
    e.preventDefault();
  }
});
// --- Service Landing Pages ---
function createServiceLandingPage(config) {
  return html`
    <main style="background:var(--color-charcoal);min-height:100vh;padding-top:120px;padding-bottom:120px;overflow:hidden;">
      <!-- Background Effects -->
      <div style="position:absolute;top:0;left:0;width:100%;height:100%;background:radial-gradient(circle at 50% 0%, rgba(235,94,40,0.15) 0%, transparent 60%);pointer-events:none;z-index:0;"></div>
      
      <div class="container" style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;text-align:center;">
        
        <div style="width:80px;height:80px;border-radius:24px;background:rgba(235,94,40,0.2);color:var(--color-coral);display:flex;align-items:center;justify-content:center;font-size:40px;margin-bottom:32px;box-shadow:0 16px 32px rgba(235,94,40,0.2), inset 0 2px 2px rgba(255,255,255,0.2);">
          <i class="${config.icon}"></i>
        </div>
        
        <h1 style="font-family:var(--font-serif);font-size:64px;color:white;margin-bottom:24px;line-height:1.1;max-width:800px;">
          ${config.title}
        </h1>
        
        <p style="font-size:20px;color:rgba(255,255,255,0.7);max-width:600px;margin-bottom:48px;line-height:1.6;">
          ${config.subtitle}
        </p>
        
        <div style="display:flex;gap:16px;margin-bottom:80px;">
          <a href="#/auth/user-signup" class="btn hover-lift" style="background:var(--color-coral);color:white;border-radius:999px;height:56px;padding:0 40px;font-size:18px;font-weight:600;display:flex;align-items:center;text-decoration:none;border:none;">
            ${config.ctaText}
          </a>
        </div>
        
        <!-- Features Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:32px;width:100%;text-align:left;">
          ${config.features.map(f => `
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:24px;padding:40px;backdrop-filter:blur(16px);transition:transform 0.3s ease;" class="hover-lift">
              <div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;color:white;margin-bottom:24px;font-size:24px;">
                <i class="${f.icon}"></i>
              </div>
              <h3 style="font-family:var(--font-serif);font-size:24px;color:white;margin-bottom:12px;">${f.title}</h3>
              <p style="color:rgba(255,255,255,0.6);font-size:16px;line-height:1.6;margin:0;">${f.desc}</p>
            </div>
          `).join("")}
        </div>
        
      </div>
    </main>
  `;
}

async function serviceDreamAnalysis() {
  const data = await api.getState();
  const loggedIn = !!data.auth;

  return html`
    <main style="background: #121214; min-height: 100vh; padding-top: 140px; padding-bottom: 120px; color: #f8fafc; overflow: hidden; position: relative;">
      <!-- Subtle Radial Gradients for Glow Effects -->
      <div style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 1200px; height: 600px; background: radial-gradient(circle at 50% 10%, rgba(235,94,40,0.18) 0%, transparent 60%); pointer-events: none; z-index: 0;"></div>
      
      <div class="container" style="position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; text-align: center;">
        
        <!-- Center glowing moon icon container -->
        <div style="width: 100px; height: 100px; border-radius: 28px; background: rgba(235,94,40,0.18); color: var(--color-coral); display: flex; align-items: center; justify-content: center; font-size: 48px; margin-bottom: 36px; box-shadow: 0 0 40px rgba(235,94,40,0.35), inset 0 2px 2px rgba(255,255,255,0.25);">
          <i class="ph-fill ph-moon-stars"></i>
        </div>
        
        <h1 style="font-family: var(--font-serif); font-size: 56px; color: white; margin-bottom: 24px; line-height: 1.1; max-width: 800px; font-weight: 700; letter-spacing: -0.02em;">
          Unlock the Hidden Meanings in Your Dreams
        </h1>
        
        <p style="font-size: 18px; color: rgba(255,255,255,0.7); max-width: 640px; margin-bottom: 48px; line-height: 1.6;">
          Get a free psychological summary of your subconscious dreams using our advanced clinical AI and expert analysis tools.
        </p>
        
        <div style="margin-bottom: 80px;">
          <button class="btn primary hover-lift" data-action="dream-landing-scroll" style="background: var(--color-coral); color: white; border-radius: 999px; height: 56px; padding: 0 40px; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; border: none; box-shadow: 0 10px 20px rgba(235,94,40,0.25);">
            Analyse Your Dream <i class="ph ph-arrow-down"></i>
          </button>
        </div>

        <!-- Dynamic Content Section -->
        <div id="dream-analyzer" style="width: 100%; max-width: 800px; text-align: left; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 28px; padding: 48px; backdrop-filter: blur(24px); box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
          
          ${state.dreamAnalyzing ? html`
            <!-- LOADING STATE -->
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; text-align: center;">
              <div class="ph ph-spinner ph-spin" style="font-size: 64px; color: var(--color-coral); margin-bottom: 24px;"></div>
              <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin-bottom: 8px;">Decoding Your Subconscious</h3>
              <p style="color: rgba(255,255,255,0.6); max-width: 400px; font-size: 15px;">Our clinical AI is analyzing symbols, archetypes, and emotional indicators in your dream...</p>
            </div>
          ` : state.dreamResult ? html`
            <!-- RESULTS STATE -->
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 24px; margin-bottom: 32px;">
                <h3 style="font-family: var(--font-serif); font-size: 28px; color: white; margin: 0;">Dream Analysis Summary</h3>
                <span style="background: rgba(235,94,40,0.15); color: var(--color-coral); padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 600;">AI Report Generated</span>
              </div>
              
              <div style="color: rgba(255,255,255,0.85); line-height: 1.7; font-size: 16px; margin-bottom: 40px; white-space: pre-wrap;">
                ${state.dreamResult.aiSummary}
              </div>

              <!-- ACTIONS AND UPSELL -->
              <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 32px; display: flex; flex-direction: column; gap: 24px;">
                <div>
                  <h4 style="font-family: var(--font-serif); font-size: 20px; color: white; margin-bottom: 8px;">Go Deeper into Your Subconscious</h4>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 0; line-height: 1.5;">Unlock the full PDF report with comprehensive Jungian archetype mapping, or speak directly with an expert counsellor to review the clinical implications of this dream.</p>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 16px;">
                  ${state.dreamResult.isPdfUnlocked ? html`
                    <a href="${state.dreamResult.pdfUrl}" target="_blank" class="btn primary" style="background: #10b981; color: white; border: none; display: flex; align-items: center; gap: 8px; text-decoration: none;">
                      <i class="ph ph-file-pdf"></i> Download PDF Report
                    </a>
                  ` : html`
                    <button class="btn primary" data-action="dream-landing-unlock" data-report-id="${state.dreamResult.id}" style="background: var(--color-coral); color: white; border: none; display: flex; align-items: center; gap: 8px;">
                      <i class="ph ph-lock-key-open"></i> Unlock PDF Report (₹${state.dreamResult.pdfUnlockFeeInr || 49})
                    </button>
                  `}
                  <a href="#/counsellors" class="btn secondary" style="border: 1px solid rgba(255,255,255,0.15); color: white; background: transparent; display: flex; align-items: center; gap: 8px; text-decoration: none;">
                    <i class="ph ph-user-check"></i> Book expert review
                  </a>
                  <button class="btn secondary" onclick="state.dreamResult = null; state.dreamInput = ''; render();" style="border: 1px solid rgba(255,255,255,0.15); color: white; background: transparent;">
                    Analyze Another Dream
                  </button>
                </div>
              </div>
            </div>
          ` : html`
            <!-- INPUT STATE -->
            <form data-form="dream-landing-analysis" style="display: flex; flex-direction: column; gap: 24px;">
              <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 16px;">Describe Your Subconscious Journey</h3>
              
              <div class="field" style="display: flex; flex-direction: column; gap: 8px;">
                <label for="dreamDescriptionLanding" style="color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 500;">What events, symbols, or emotions stood out?</label>
                <textarea id="dreamDescriptionLanding" name="description" placeholder="Type here in detail... (e.g. 'I was flying over a vast dark ocean, then the sky turned into mirrors...')" style="min-height: 160px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 16px; padding: 20px; font-size: 15px; width: 100%; box-sizing: border-box; resize: vertical; outline: none; transition: border-color 0.3s;" required>${state.dreamInput}</textarea>
              </div>

              <div class="field" style="display: flex; flex-direction: column; gap: 8px;">
                <label style="color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 500;">Attach an illustration or notebook scan (Optional)</label>
                <label for="dreamFileLanding" class="file-upload-dropzone-compact" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); display: flex; align-items: center; gap: 12px; cursor: pointer;">
                  <i class="ph ph-image"></i>
                  <span id="dream-file-text-landing">Choose file...</span>
                  <input id="dreamFileLanding" name="sampleFile" type="file" accept="image/png,image/jpeg,application/pdf" style="display: none;" onchange="const name = this.files[0]?.name; document.getElementById('dream-file-text-landing').innerText = name || 'Choose file...'; this.closest('.file-upload-dropzone-compact').classList.toggle('has-file', !!name);" />
                </label>
              </div>

              ${state.dreamError ? html`
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; border-radius: 12px; padding: 16px; font-size: 14px;">
                  ${state.dreamError}
                </div>
              ` : ""}

              <button class="btn primary submit-btn" type="submit" style="background: var(--color-coral); color: white; border: none; height: 50px; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 12px;">
                <i class="ph ph-sparkle"></i> Analyse Subconscious Dream
              </button>
            </form>
          `}
        </div>

        <!-- Features/Benefits Section matching the mock landing page style -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 32px; width: 100%; text-align: left; margin-top: 80px;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 40px; backdrop-filter: blur(16px);" class="hover-lift">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: white; margin-bottom: 24px; font-size: 24px;">
              <i class="ph-bold ph-pencil-simple"></i>
            </div>
            <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin-bottom: 12px;">Vivid Detail Journaling</h3>
            <p style="color: rgba(255,255,255,0.6); font-size: 16px; line-height: 1.6; margin: 0;">Easily journal the context, emotions, and vivid details of your dreams in a safe, encrypted space.</p>
          </div>
          
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 40px; backdrop-filter: blur(16px);" class="hover-lift">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: white; margin-bottom: 24px; font-size: 24px;">
              <i class="ph-bold ph-brain"></i>
            </div>
            <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin-bottom: 12px;">Clinical AI Analysis</h3>
            <p style="color: rgba(255,255,255,0.6); font-size: 16px; line-height: 1.6; margin: 0;">Receive an instant preliminary psychological analysis identifying key themes, emotions, and archetypes.</p>
          </div>
          
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 40px; backdrop-filter: blur(16px);" class="hover-lift">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: white; margin-bottom: 24px; font-size: 24px;">
              <i class="ph-bold ph-user-check"></i>
            </div>
            <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin-bottom: 12px;">Expert Counsellor Review</h3>
            <p style="color: rgba(255,255,255,0.6); font-size: 16px; line-height: 1.6; margin: 0;">Optionally request a verified human psychologist to review the analysis for deeper clinical insights.</p>
          </div>
        </div>
      </div>

      <!-- GLASSMORPHIC AUTH MODAL overlay -->
      ${state.showDreamAuthModal ? html`
        <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); backdrop-filter: blur(16px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 24px;">
          <div style="background: #18181b; border: 1px solid rgba(255,255,255,0.1); width: 100%; max-width: 480px; border-radius: 24px; padding: 40px; position: relative; box-shadow: 0 24px 60px rgba(0,0,0,0.5);">
            <button data-action="close-dream-auth-modal" style="position: absolute; top: 20px; right: 20px; background: transparent; border: none; color: rgba(255,255,255,0.6); font-size: 24px; cursor: pointer;">
              <i class="ph ph-x"></i>
            </button>
            
            <div style="display: flex; gap: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px; margin-bottom: 24px;">
              <button data-action="dream-landing-tab-switch" data-mode="signup" style="background: transparent; border: none; font-size: 16px; font-weight: 600; color: ${state.dreamAuthMode === 'signup' ? 'var(--color-coral)' : 'rgba(255,255,255,0.6)'}; cursor: pointer; padding-bottom: 8px; border-bottom: 2px solid ${state.dreamAuthMode === 'signup' ? 'var(--color-coral)' : 'transparent'};">Create Account</button>
              <button data-action="dream-landing-tab-switch" data-mode="login" style="background: transparent; border: none; font-size: 16px; font-weight: 600; color: ${state.dreamAuthMode === 'login' ? 'var(--color-coral)' : 'rgba(255,255,255,0.6)'}; cursor: pointer; padding-bottom: 8px; border-bottom: 2px solid ${state.dreamAuthMode === 'login' ? 'var(--color-coral)' : 'transparent'};">Login</button>
            </div>

            <form data-form="dream-landing-auth" style="display: flex; flex-direction: column; gap: 20px;">
              <div style="font-size: 14px; color: rgba(255,255,255,0.6); margin-bottom: 8px;">
                To save and review your clinical dream analysis, please log in or create an account.
              </div>
              
              ${state.dreamAuthMode === "signup" ? html`
                <div class="field" style="display: flex; flex-direction: column; gap: 6px;">
                  <label for="modal-name" style="color: rgba(255,255,255,0.8); font-size: 13px;">Full Name</label>
                  <input id="modal-name" name="name" style="height: 44px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0 16px; color: white; outline: none; font-size: 14px;" required />
                </div>
              ` : ""}

              <div class="field" style="display: flex; flex-direction: column; gap: 6px;">
                <label for="modal-email" style="color: rgba(255,255,255,0.8); font-size: 13px;">Email Address</label>
                <input id="modal-email" name="email" type="email" style="height: 44px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0 16px; color: white; outline: none; font-size: 14px;" required />
              </div>

              <div class="field" style="display: flex; flex-direction: column; gap: 6px;">
                <label for="modal-password" style="color: rgba(255,255,255,0.8); font-size: 13px;">Password</label>
                <input id="modal-password" name="password" type="password" style="height: 44px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0 16px; color: white; outline: none; font-size: 14px;" required />
              </div>

              <button class="btn primary" type="submit" style="background: var(--color-coral); color: white; border: none; height: 46px; border-radius: 8px; font-weight: 600; margin-top: 10px; width: 100%;">
                ${state.dreamAuthMode === "signup" ? "Create Account & Analyze" : "Login & Analyze"}
              </button>
            </form>
          </div>
        </div>
      ` : ""}
    </main>
  `;
}

async function serviceHandwritingAnalysis() {
  const data = await api.getState();
  const loggedIn = !!data.auth;

  return html`
    <main style="background: #121214; min-height: 100vh; padding-top: 140px; padding-bottom: 120px; color: #f8fafc; overflow: hidden; position: relative;">
      <div style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 1200px; height: 600px; background: radial-gradient(circle at 50% 10%, rgba(43,108,176,0.18) 0%, transparent 60%); pointer-events: none; z-index: 0;"></div>
      
      <div class="container" style="position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; text-align: center;">
        <div style="width: 100px; height: 100px; border-radius: 28px; background: rgba(43,108,176,0.18); color: #2b6cb0; display: flex; align-items: center; justify-content: center; font-size: 48px; margin-bottom: 36px; box-shadow: 0 0 40px rgba(43,108,176,0.35), inset 0 2px 2px rgba(255,255,255,0.25);">
          <i class="ph-fill ph-pen-nib"></i>
        </div>
        
        <h1 style="font-family: var(--font-serif); font-size: 56px; color: white; margin-bottom: 24px; line-height: 1.1; max-width: 800px; font-weight: 700; letter-spacing: -0.02em;">
          Discover Your Personality Through Graphology
        </h1>
        
        <p style="font-size: 18px; color: rgba(255,255,255,0.7); max-width: 640px; margin-bottom: 48px; line-height: 1.6;">
          Upload a sample of your handwriting to uncover personality traits, emotional states, and behavioral patterns.
        </p>
        
        <div style="margin-bottom: 80px;">
          <button class="btn primary hover-lift" data-action="handwriting-landing-scroll" style="background: #2b6cb0; color: white; border-radius: 999px; height: 56px; padding: 0 40px; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; border: none; box-shadow: 0 10px 20px rgba(43,108,176,0.25);">
            Analyze Handwriting <i class="ph ph-arrow-down"></i>
          </button>
        </div>

        <div id="handwriting-analyzer" style="width: 100%; max-width: 800px; text-align: left; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 28px; padding: 48px; backdrop-filter: blur(24px); box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
          
          ${state.handwritingAnalyzing ? html`
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; text-align: center;">
              <div class="ph ph-spinner ph-spin" style="font-size: 64px; color: #2b6cb0; margin-bottom: 24px;"></div>
              <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin-bottom: 8px;">Analyzing Handwriting Patterns</h3>
              <p style="color: rgba(255,255,255,0.6); max-width: 400px; font-size: 15px;">Decoding slants, size, pressure, and loops to map graphological archetypes...</p>
            </div>
          ` : state.handwritingResult ? html`
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 24px; margin-bottom: 32px;">
                <h3 style="font-family: var(--font-serif); font-size: 28px; color: white; margin: 0;">Handwriting Analysis Result</h3>
                <span style="background: rgba(43,108,176,0.15); color: #2b6cb0; padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 600;">Report Generated</span>
              </div>
              
              <div style="color: rgba(255,255,255,0.85); line-height: 1.7; font-size: 16px; margin-bottom: 40px; white-space: pre-wrap;">
                ${state.handwritingResult.aiSummary}
              </div>

              <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 32px; display: flex; flex-direction: column; gap: 24px;">
                <div>
                  <h4 style="font-family: var(--font-serif); font-size: 20px; color: white; margin-bottom: 8px;">Detailed Analysis & Guidance</h4>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 0; line-height: 1.5;">Unlock the full PDF report with graphological indicators, or discuss results in-depth with a clinical psychologist.</p>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 16px;">
                  ${state.handwritingResult.isPdfUnlocked ? html`
                    <a href="${state.handwritingResult.pdfUrl}" target="_blank" class="btn primary" style="background: #10b981; color: white; border: none; display: flex; align-items: center; gap: 8px; text-decoration: none;">
                      <i class="ph ph-file-pdf"></i> Download PDF Report
                    </a>
                  ` : html`
                    <button class="btn primary" data-action="handwriting-landing-unlock" data-report-id="${state.handwritingResult.id}" style="background: #2b6cb0; color: white; border: none; display: flex; align-items: center; gap: 8px;">
                      <i class="ph ph-lock-key-open"></i> Unlock PDF Report (₹${state.handwritingResult.pdfUnlockFeeInr || 49})
                    </button>
                  `}
                  <a href="#/counsellors" class="btn secondary" style="border: 1px solid rgba(255,255,255,0.15); color: white; background: transparent; display: flex; align-items: center; gap: 8px; text-decoration: none;">
                    <i class="ph ph-user-check"></i> Book expert review
                  </a>
                  <button class="btn secondary" onclick="state.handwritingResult = null; state.handwritingInput = ''; render();" style="border: 1px solid rgba(255,255,255,0.15); color: white; background: transparent;">
                    Analyze Another Sample
                  </button>
                </div>
              </div>
            </div>
          ` : html`
            <form data-form="handwriting-landing-analysis" style="display: flex; flex-direction: column; gap: 24px;">
              <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 16px;">Submit Handwriting Specimen</h3>
              
              <div class="field" style="display: flex; flex-direction: column; gap: 8px;">
                <label style="color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 500;">Upload handwriting sample (Required)</label>
                <label for="handwritingFileLanding" class="file-upload-dropzone-compact" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); display: flex; align-items: center; gap: 12px; cursor: pointer;">
                  <i class="ph ph-cloud-arrow-up"></i>
                  <span id="handwriting-file-text-landing">Choose image or PDF...</span>
                  <input id="handwritingFileLanding" name="sampleFile" type="file" accept="image/png,image/jpeg,application/pdf" style="display: none;" onchange="const name = this.files[0]?.name; document.getElementById('handwriting-file-text-landing').innerText = name || 'Choose file...'; this.closest('.file-upload-dropzone-compact').classList.toggle('has-file', !!name);" required />
                </label>
              </div>

              <div class="field" style="display: flex; flex-direction: column; gap: 8px;">
                <label for="handwritingDescriptionLanding" style="color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 500;">Context or writing surface (Optional)</label>
                <textarea id="handwritingDescriptionLanding" name="description" placeholder="Under what conditions was this written? (e.g. standing up, rushed, on a clipboard...)" style="min-height: 120px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 16px; padding: 20px; font-size: 15px; width: 100%; box-sizing: border-box; resize: vertical; outline: none; transition: border-color 0.3s;">${state.handwritingInput}</textarea>
              </div>

              ${state.handwritingError ? html`
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; border-radius: 12px; padding: 16px; font-size: 14px;">
                  ${state.handwritingError}
                </div>
              ` : ""}

              <button class="btn primary submit-btn" type="submit" style="background: #2b6cb0; color: white; border: none; height: 50px; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 12px;">
                <i class="ph ph-sparkle"></i> Analyze Handwriting Specimen
              </button>
            </form>
          `}
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 32px; width: 100%; text-align: left; margin-top: 80px;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 40px; backdrop-filter: blur(16px);" class="hover-lift">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: white; margin-bottom: 24px; font-size: 24px;">
              <i class="ph-bold ph-upload-simple"></i>
            </div>
            <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin-bottom: 12px;">Easy Upload</h3>
            <p style="color: rgba(255,255,255,0.6); font-size: 16px; line-height: 1.6; margin: 0;">Snap a photo of your handwritten text and upload it directly to our secure platform.</p>
          </div>
          
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 40px; backdrop-filter: blur(16px);" class="hover-lift">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: white; margin-bottom: 24px; font-size: 24px;">
              <i class="ph-bold ph-magnifying-glass"></i>
            </div>
            <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin-bottom: 12px;">Deep Analysis</h3>
            <p style="color: rgba(255,255,255,0.6); font-size: 16px; line-height: 1.6; margin: 0;">We analyze slant, pressure, spacing, and stroke size to build a comprehensive personality profile.</p>
          </div>
          
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 40px; backdrop-filter: blur(16px);" class="hover-lift">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: white; margin-bottom: 24px; font-size: 24px;">
              <i class="ph-bold ph-lock-key"></i>
            </div>
            <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin-bottom: 12px;">Total Privacy</h3>
            <p style="color: rgba(255,255,255,0.6); font-size: 16px; line-height: 1.6; margin: 0;">Your samples and reports are encrypted end-to-end and visible only to you and your selected expert.</p>
          </div>
        </div>
      </div>
    </main>
  `;
}

async function serviceSignatureAnalysis() {
  const data = await api.getState();
  const loggedIn = !!data.auth;

  return html`
    <main style="background: #121214; min-height: 100vh; padding-top: 140px; padding-bottom: 120px; color: #f8fafc; overflow: hidden; position: relative;">
      <div style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 1200px; height: 600px; background: radial-gradient(circle at 50% 10%, rgba(128,90,213,0.18) 0%, transparent 60%); pointer-events: none; z-index: 0;"></div>
      
      <div class="container" style="position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; text-align: center;">
        <div style="width: 100px; height: 100px; border-radius: 28px; background: rgba(128,90,213,0.18); color: #805ad5; display: flex; align-items: center; justify-content: center; font-size: 48px; margin-bottom: 36px; box-shadow: 0 0 40px rgba(128,90,213,0.35), inset 0 2px 2px rgba(255,255,255,0.25);">
          <i class="ph-fill ph-signature"></i>
        </div>
        
        <h1 style="font-family: var(--font-serif); font-size: 56px; color: white; margin-bottom: 24px; line-height: 1.1; max-width: 800px; font-weight: 700; letter-spacing: -0.02em;">
          What Does Your Signature Say About You?
        </h1>
        
        <p style="font-size: 18px; color: rgba(255,255,255,0.7); max-width: 640px; margin-bottom: 48px; line-height: 1.6;">
          Your signature is your public face. Understand how you present yourself to the world through expert signature analysis.
        </p>
        
        <div style="margin-bottom: 80px;">
          <button class="btn primary hover-lift" data-action="signature-landing-scroll" style="background: #805ad5; color: white; border-radius: 999px; height: 56px; padding: 0 40px; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; border: none; box-shadow: 0 10px 20px rgba(128,90,213,0.25);">
            Analyze Signature <i class="ph ph-arrow-down"></i>
          </button>
        </div>

        <div id="signature-analyzer" style="width: 100%; max-width: 800px; text-align: left; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 28px; padding: 48px; backdrop-filter: blur(24px); box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
          
          ${state.signatureAnalyzing ? html`
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; text-align: center;">
              <div class="ph ph-spinner ph-spin" style="font-size: 64px; color: #805ad5; margin-bottom: 24px;"></div>
              <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin-bottom: 8px;">Decoding Signature Flow</h3>
              <p style="color: rgba(255,255,255,0.6); max-width: 400px; font-size: 15px;">Scanning strokes, underlines, loop angles, and spacing styles...</p>
            </div>
          ` : state.signatureResult ? html`
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 24px; margin-bottom: 32px;">
                <h3 style="font-family: var(--font-serif); font-size: 28px; color: white; margin: 0;">Signature Analysis Result</h3>
                <span style="background: rgba(128,90,213,0.15); color: #805ad5; padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 600;">Report Generated</span>
              </div>
              
              <div style="color: rgba(255,255,255,0.85); line-height: 1.7; font-size: 16px; margin-bottom: 40px; white-space: pre-wrap;">
                ${state.signatureResult.aiSummary}
              </div>

              <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 32px; display: flex; flex-direction: column; gap: 24px;">
                <div>
                  <h4 style="font-family: var(--font-serif); font-size: 20px; color: white; margin-bottom: 8px;">Persona Mapping & Insights</h4>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 0; line-height: 1.5;">Unlock the full PDF report with personal branding assessments and strokes indicators, or speak directly with an expert counsellor.</p>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 16px;">
                  ${state.signatureResult.isPdfUnlocked ? html`
                    <a href="${state.signatureResult.pdfUrl}" target="_blank" class="btn primary" style="background: #10b981; color: white; border: none; display: flex; align-items: center; gap: 8px; text-decoration: none;">
                      <i class="ph ph-file-pdf"></i> Download PDF Report
                    </a>
                  ` : html`
                    <button class="btn primary" data-action="signature-landing-unlock" data-report-id="${state.signatureResult.id}" style="background: #805ad5; color: white; border: none; display: flex; align-items: center; gap: 8px;">
                      <i class="ph ph-lock-key-open"></i> Unlock PDF Report (₹${state.signatureResult.pdfUnlockFeeInr || 49})
                    </button>
                  `}
                  <a href="#/counsellors" class="btn secondary" style="border: 1px solid rgba(255,255,255,0.15); color: white; background: transparent; display: flex; align-items: center; gap: 8px; text-decoration: none;">
                    <i class="ph ph-user-check"></i> Book expert review
                  </a>
                  <button class="btn secondary" onclick="state.signatureResult = null; state.signatureInput = ''; render();" style="border: 1px solid rgba(255,255,255,0.15); color: white; background: transparent;">
                    Analyze Another Signature
                  </button>
                </div>
              </div>
            </div>
          ` : html`
            <form data-form="signature-landing-analysis" style="display: flex; flex-direction: column; gap: 24px;">
              <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 16px;">Submit Signature Specimen</h3>
              
              <div class="field" style="display: flex; flex-direction: column; gap: 8px;">
                <label style="color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 500;">Upload signature sample (Required)</label>
                <label for="signatureFileLanding" class="file-upload-dropzone-compact" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); display: flex; align-items: center; gap: 12px; cursor: pointer;">
                  <i class="ph ph-cloud-arrow-up"></i>
                  <span id="signature-file-text-landing">Choose image or PDF...</span>
                  <input id="signatureFileLanding" name="sampleFile" type="file" accept="image/png,image/jpeg,application/pdf" style="display: none;" onchange="const name = this.files[0]?.name; document.getElementById('signature-file-text-landing').innerText = name || 'Choose file...'; this.closest('.file-upload-dropzone-compact').classList.toggle('has-file', !!name);" required />
                </label>
              </div>

              <div class="field" style="display: flex; flex-direction: column; gap: 8px;">
                <label for="signatureDescriptionLanding" style="color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 500;">Name or context (Optional)</label>
                <textarea id="signatureDescriptionLanding" name="description" placeholder="Whose signature is this? Any relevant background info..." style="min-height: 120px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 16px; padding: 20px; font-size: 15px; width: 100%; box-sizing: border-box; resize: vertical; outline: none; transition: border-color 0.3s;">${state.signatureInput}</textarea>
              </div>

              ${state.signatureError ? html`
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; border-radius: 12px; padding: 16px; font-size: 14px;">
                  ${state.signatureError}
                </div>
              ` : ""}

              <button class="btn primary submit-btn" type="submit" style="background: #805ad5; color: white; border: none; height: 50px; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 12px;">
                <i class="ph ph-sparkle"></i> Analyze Signature Specimen
              </button>
            </form>
          `}
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 32px; width: 100%; text-align: left; margin-top: 80px;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 40px; backdrop-filter: blur(16px);" class="hover-lift">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: white; margin-bottom: 24px; font-size: 24px;">
              <i class="ph-bold ph-pen"></i>
            </div>
            <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin-bottom: 12px;">Stroke Analysis</h3>
            <p style="color: rgba(255,255,255,0.6); font-size: 16px; line-height: 1.6; margin: 0;">Discover what underlines, loops, and letter sizing reveal about your confidence and ambition.</p>
          </div>
          
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 40px; backdrop-filter: blur(16px);" class="hover-lift">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: white; margin-bottom: 24px; font-size: 24px;">
              <i class="ph-bold ph-file-text"></i>
            </div>
            <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin-bottom: 12px;">Detailed Report</h3>
            <p style="color: rgba(255,255,255,0.6); font-size: 16px; line-height: 1.6; margin: 0;">Receive a beautifully formatted PDF report breaking down the psychological markers in your signature.</p>
          </div>
          
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 40px; backdrop-filter: blur(16px);" class="hover-lift">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: white; margin-bottom: 24px; font-size: 24px;">
              <i class="ph-bold ph-trend-up"></i>
            </div>
            <h3 style="font-family: var(--font-serif); font-size: 24px; color: white; margin-bottom: 12px;">Self Improvement</h3>
            <p style="color: rgba(255,255,255,0.6); font-size: 16px; line-height: 1.6; margin: 0;">Learn actionable insights on how to adjust your public persona for better personal and professional outcomes.</p>
          </div>
        </div>
      </div>
    </main>
  `;
}

function serviceGroupHealing() {
  return createServiceLandingPage({
    title: "Find Strength in Community Healing",
    subtitle: "Join expert-led, secure group therapy sessions to share experiences, build resilience, and heal together.",
    icon: "ph-fill ph-users-three",
    ctaText: "Browse Sessions",
    features: [
      { icon: "ph-bold ph-video-camera", title: "Secure Video", desc: "Participate in high-quality, encrypted video calls designed for intimate group settings." },
      { icon: "ph-bold ph-shield-check", title: "Moderated Spaces", desc: "Every session is guided by a verified clinical psychologist to ensure a safe, supportive environment." },
      { icon: "ph-bold ph-users", title: "Shared Experiences", desc: "Connect with peers facing similar challenges, from anxiety to grief and relationship issues." }
    ]
  });
}

function serviceMindGames() {
  return createServiceLandingPage({
    title: "Train Your Brain with Cognitive Games",
    subtitle: "Improve memory, focus, and emotional regulation through engaging, clinically-designed mental exercises.",
    icon: "ph-fill ph-brain",
    ctaText: "Play Now",
    features: [
      { icon: "ph-bold ph-puzzle-piece", title: "Cognitive Challenges", desc: "Engage in puzzles that target specific areas of cognitive function and working memory." },
      { icon: "ph-bold ph-chart-line-up", title: "Track Progress", desc: "Monitor your improvement over time with detailed analytics and personalized training programs." },
      { icon: "ph-bold ph-heart", title: "Stress Relief", desc: "Enjoy relaxing games specifically designed to lower cortisol levels and induce a state of flow." }
    ]
  });
}

function serviceFocusTools() {
  return createServiceLandingPage({
    title: "Enhance Your Productivity and Focus",
    subtitle: "Combat ADHD symptoms and general distraction with our suite of timers, ambient sounds, and task managers.",
    icon: "ph-fill ph-target",
    ctaText: "Start Focusing",
    features: [
      { icon: "ph-bold ph-timer", title: "Pomodoro Timers", customizable: "Customizable work/break intervals to maintain peak productivity without burnout." },
      { icon: "ph-bold ph-headphones", title: "Ambient Soundscapes", desc: "Access a library of binaural beats, white noise, and nature sounds to drown out distractions." },
      { icon: "ph-bold ph-check-square", title: "Task Chunking", desc: "Break overwhelming projects into manageable, bite-sized tasks to reduce executive dysfunction." }
    ]
  });
}

function serviceHealingMap() {
  return createServiceLandingPage({
    title: "Locate Mental Wellness Resources Near You",
    subtitle: "Find verified clinics, support groups, and crisis centers in your local area with our interactive map.",
    icon: "ph-fill ph-map-pin",
    ctaText: "Open Map",
    features: [
      { icon: "ph-bold ph-navigation-arrow", title: "Location Based", desc: "Instantly discover nearby mental health facilities and verified private practices." },
      { icon: "ph-bold ph-star", title: "Community Reviews", desc: "Read anonymized reviews and ratings from other MindHeal users to find the best fit." },
      { icon: "ph-bold ph-calendar-plus", title: "Direct Booking", desc: "Schedule in-person appointments directly through the map interface." }
    ]
  });
}

function servicePsychologicalTests() {
  return createServiceLandingPage({
    title: "Understand Your Mental Health Better",
    subtitle: "Take clinically-validated screening assessments for anxiety, depression, burnout, ADHD, and stress.",
    icon: "ph-fill ph-clipboard-text",
    ctaText: "Take a Test",
    features: [
      { icon: "ph-bold ph-check-circle", title: "Validated Scales", desc: "Assessments based on standard clinical tools like PHQ-9 and GAD-7." },
      { icon: "ph-bold ph-file-pdf", title: "Instant Results", desc: "Get an immediate score and detailed breakdown of what your results indicate." },
      { icon: "ph-bold ph-share-network", title: "Share with Experts", desc: "Easily forward your assessment results to your chosen counsellor for a more informed first session." }
    ]
  });
}

function serviceCBTDiary() {
  return createServiceLandingPage({
    title: "Reframe Your Thoughts with CBT",
    subtitle: "Challenge negative thinking patterns and build healthier habits with our guided Cognitive Behavioral Therapy diary.",
    icon: "ph-fill ph-book-open",
    ctaText: "Start Journaling",
    features: [
      { icon: "ph-bold ph-pencil", title: "Structured Entries", desc: "A guided nine-step form for analyzing situations, automatic thoughts, and evidence." },
      { icon: "ph-bold ph-scales", title: "Balanced Thinking", desc: "Learn to identify cognitive distortions and formulate balanced, rational replacement thoughts." },
      { icon: "ph-bold ph-chart-bar", title: "Mood Tracking", desc: "Log your mood daily to visualize emotional patterns and correlate them with your thought entries." }
    ]
  });
}

function servicePsychologyCourses() {
  return createServiceLandingPage({
    title: "Learn the Science of Well-being",
    subtitle: "Access interactive video courses on emotional intelligence, managing panic attacks, and improving sleep hygiene.",
    icon: "ph-fill ph-graduation-cap",
    ctaText: "Browse Courses",
    features: [
      { icon: "ph-bold ph-video", title: "Expert Led", desc: "All courses are created and taught by verified clinical psychologists and subject matter experts." },
      { icon: "ph-bold ph-certificate", title: "Interactive Modules", desc: "Engage with quizzes, worksheets, and actionable assignments to reinforce your learning." },
      { icon: "ph-bold ph-device-mobile", title: "Learn Anywhere", desc: "Download course materials for offline viewing and learn at your own pace." }
    ]
  });
}
