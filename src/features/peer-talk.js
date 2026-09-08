import { html, escapeHtml, toast, formatInr } from "../utils/dom.js";
import { t } from "../utils/i18n.js";
import { api } from "../services/mock-api.js?v=5";

// Load local state or defaults
let localState = {
  activeTab: "pay-and-talk", // "pay-and-talk" | "talk-and-earn" | "session-room" | "earnings"
  filters: {
    language: "all",
    interest: "all",
    gender: "all",
    price: "all"
  },
  selectedListener: null,
  selectedDuration: 30,
  disclaimerAccepted: false,
  onboardingStep: 1, // 1: intro, 2: KYC/payout, 3: profile details
  onboardingData: {
    publicDisplayName: "",
    shortBio: "",
    languages: [],
    conversationInterests: [],
    rates: { 15: 150, 30: 300, 45: 450, 60: 600 }
  },
  listenerProfile: null, // loaded from backend
  activeRequest: null,   // active outgoing or incoming request
  activeSession: null,   // active session details
  chatMessages: [],
  remainingSessionSeconds: 0,
  gateSecondsRemaining: 300,
  consents: {
    voice: { me: false, peer: false },
    video: { me: false, peer: false },
    file: { me: false, peer: false }
  }
};

// Expose switch functions to window for onclick handlers
window.switchPeerTalkTab = function(tab) {
  localState.activeTab = tab;
  window.triggerAppRender();
};

window.acceptPeerDisclaimer = async function() {
  const btn = document.querySelector("#btn-accept-disclaimer");
  if (btn) btn.disabled = true;
  try {
    const res = await api.request("/peer-talk/accept-disclaimer", {
      method: "POST",
      body: { policyVersion: "v1.0", language: "en" }
    });
    if (res.ok) {
      localState.disclaimerAccepted = true;
      toast("Disclaimer accepted.", "success");
      window.triggerAppRender();
    } else {
      toast(res.error?.message || "Failed to accept disclaimer.");
    }
  } catch (err) {
    toast(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.setPeerFilter = function(key, val) {
  localState.filters[key] = val;
  window.triggerAppRender();
};

window.selectListenerForBooking = function(listenerJson) {
  try {
    localState.selectedListener = JSON.parse(decodeURIComponent(listenerJson));
    window.triggerAppRender();
  } catch (err) {
    toast("Error selecting listener.");
  }
};

window.changeBookingDuration = function(dur) {
  localState.selectedDuration = Number(dur);
  window.triggerAppRender();
};

window.submitPeerRequest = async function() {
  if (!localState.selectedListener) return;
  const btn = document.querySelector("#btn-submit-request");
  if (btn) btn.disabled = true;
  
  try {
    const res = await api.request("/peer-session-requests", {
      method: "POST",
      body: {
        listenerProfileId: localState.selectedListener.id,
        durationMinutes: localState.selectedDuration,
        requestedMode: "text"
      }
    });

    if (res.ok) {
      localState.activeRequest = res.data.request;
      localState.activeTab = "pay-and-talk"; // show waiting loader
      toast("Request sent successfully! Waiting for listener response...", "success");
      
      // Start polling status
      startRequestPolling(res.data.request.id);
    } else {
      toast(res.error?.message || "Failed to submit request.");
    }
  } catch (err) {
    toast(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
};

let pollInterval = null;
function startRequestPolling(requestId) {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    const res = await api.request(`/peer-session-requests/${requestId}`);
    if (res.ok) {
      const req = res.data;
      localState.activeRequest = req;
      if (req.requestStatus === "accepted") {
        clearInterval(pollInterval);
        toast("Your request was accepted! Proceeding to payment...", "success");
        // Trigger payment order creation
        initiateRequestPayment(req.id);
      } else if (req.requestStatus === "declined" || req.requestStatus === "expired") {
        clearInterval(pollInterval);
        toast(`Request was ${req.requestStatus}. Reason: ${req.declineReason || "Timeout"}`);
        localState.activeRequest = null;
        window.triggerAppRender();
      }
    }
  }, 3000);
}

async function initiateRequestPayment(requestId) {
  const orderRes = await api.request(`/peer-session-requests/${requestId}/payment-order`, { method: "POST" });
  if (orderRes.ok) {
    const order = orderRes.data.order;
    toast("Generating payment gateway checkout...");
    
    // Simulate Razorpay verification callback
    const verifyRes = await api.request(`/peer-session-requests/${requestId}/payment-verify`, {
      method: "POST",
      body: {
        orderId: order.id,
        razorpay_order_id: order.gatewayOrderId,
        razorpay_payment_id: `pay_peer_mock_${Date.now()}`,
        razorpay_signature: "mock_signature"
      }
    });

    if (verifyRes.ok) {
      toast("Payment completed successfully! Room is ready.", "success");
      localState.activeSession = verifyRes.data.session;
      localState.activeRequest = null;
      localState.activeTab = "session-room";
      startSessionRoom();
    } else {
      toast(verifyRes.error?.message || "Payment verification failed.");
    }
  } else {
    toast(orderRes.error?.message || "Failed to create payment order.");
  }
}

// Presence and live listening toggles for User B
window.toggleGoLive = async function(isLive) {
  const endpoint = isLive ? "/peer-listeners/me/go-live" : "/peer-listeners/me/go-offline";
  const res = await api.request(endpoint, { method: "POST" });
  if (res.ok) {
    toast(isLive ? "You are now Live and available!" : "You are now Offline.", "success");
    localState.listenerProfile = { ...localState.listenerProfile, presence: res.data.presence };
    window.triggerAppRender();
  } else {
    toast(res.error?.message || "Action failed.");
  }
};

window.acceptIncomingRequest = async function(reqId) {
  const res = await api.request(`/peer-session-requests/${reqId}/accept`, { method: "POST" });
  if (res.ok) {
    toast("Request accepted. Awaiting requester payment...", "success");
    localState.activeRequest = res.data;
    window.triggerAppRender();
  } else {
    toast(res.error?.message || "Failed to accept request.");
  }
};

window.declineIncomingRequest = async function(reqId) {
  const res = await api.request(`/peer-session-requests/${reqId}/decline`, {
    method: "POST",
    body: { reason: "Listener declined request" }
  });
  if (res.ok) {
    toast("Request declined.");
    localState.activeRequest = null;
    window.triggerAppRender();
  } else {
    toast(res.error?.message || "Failed to decline request.");
  }
};

// Onboarding form updates
window.updateOnboardingData = function(field, val) {
  localState.onboardingData[field] = val;
};

window.setOnboardingLanguages = function(langs) {
  localState.onboardingData.languages = langs.split(",").map(s => s.trim()).filter(Boolean);
};

window.setOnboardingInterests = function(interests) {
  localState.onboardingData.conversationInterests = interests.split(",").map(s => s.trim()).filter(Boolean);
};

window.submitOnboarding = async function() {
  const btn = document.querySelector("#btn-submit-onboarding");
  if (btn) btn.disabled = true;
  try {
    const applyRes = await api.request("/peer-listeners/apply", {
      method: "POST",
      body: localState.onboardingData
    });
    if (applyRes.ok) {
      toast("Application submitted successfully for review!", "success");
      localState.listenerProfile = applyRes.data;
      window.triggerAppRender();
    } else {
      toast(applyRes.error?.message || "Application submission failed.");
    }
  } catch (err) {
    toast(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
};

export function renderPeerTalk(state, dashboard, data) {
  // Sync state parameters directly with the backend SSoT
  if (data.peerTalkState) {
    localState.disclaimerAccepted = data.peerTalkState.disclaimerAccepted;
    localState.listenerProfile = data.peerTalkState.listenerProfile;
    localState.activeSession = data.peerTalkState.activeSession;
    localState.activeRequest = data.peerTalkState.activeRequest;
  }

  return html`
    <div class="peer-talk-layout" style="display:flex;flex-direction:column;gap:24px;">
      <!-- Hero Banner -->
      <div class="panel-hero" style="background: linear-gradient(135deg, #1A1A18 0%, #2D2A26 100%); color: white; padding: 24px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div>
          <span class="status-pill info" style="background:rgba(128,90,213,0.2);color:#9F7AEA;border:1px solid rgba(128,90,213,0.4);font-weight:700;margin-bottom:8px;display:inline-block;">PEER COMPANIONSHIP</span>
          <h1 class="page-title" style="margin:0 0 8px 0;color:white;">Talk to Someone</h1>
          <p class="page-subtitle" style="margin:0;color:rgba(255,255,255,0.7);font-size:14px;max-width:600px;">
            Connect with verified peer listeners for warm, non-professional wellness conversation. Paid Peer-to-Peer Listening Marketplace.
          </p>
        </div>
        <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);padding:12px 20px;border-radius:12px;display:flex;align-items:center;gap:12px;">
          <i class="ph ph-wallet" style="font-size:24px;color:var(--color-coral);"></i>
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,0.6);">Wallet Balance</div>
            <div style="font-size:18px;font-weight:700;">${formatInr(dashboard.walletBalance || 0)}</div>
          </div>
        </div>
      </div>

      <!-- Feature Tabs -->
      <div style="display:flex;gap:12px;border-bottom:1px solid var(--color-border);padding-bottom:12px;">
        <button class="filter-tab ${localState.activeTab === 'pay-and-talk' ? 'active' : ''}" onclick="window.switchPeerTalkTab('pay-and-talk')">
          <i class="ph-bold ph-chats-teardrop" style="margin-right:6px;"></i> Pay & Talk
        </button>
        <button class="filter-tab ${localState.activeTab === 'talk-and-earn' ? 'active' : ''}" onclick="window.switchPeerTalkTab('talk-and-earn')">
          <i class="ph-bold ph-currency-inr" style="margin-right:6px;"></i> Talk & Earn
        </button>
        ${localState.activeSession ? html`
          <button class="filter-tab ${localState.activeTab === 'session-room' ? 'active' : ''}" onclick="window.switchPeerTalkTab('session-room')">
            <i class="ph-bold ph-video-camera" style="margin-right:6px;"></i> Active Session
          </button>
        ` : ""}
      </div>

      <!-- Section Rendering -->
      ${renderActiveSection(dashboard, data)}
    </div>
  `;
}

function renderActiveSection(dashboard, data) {
  if (localState.activeTab === "pay-and-talk") {
    return renderPayAndTalk(dashboard, data);
  } else if (localState.activeTab === "talk-and-earn") {
    return renderTalkAndEarn(dashboard, data);
  } else if (localState.activeTab === "session-room") {
    return renderSessionRoomTab();
  }
  return "";
}

// 1. Pay & Talk View
function renderPayAndTalk(dashboard, data) {
  if (!localState.disclaimerAccepted) {
    return renderDisclaimerAcceptance();
  }

  if (localState.activeRequest) {
    return html`
      <div class="card" style="padding:48px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px;">
        <div class="spinner" style="border: 4px solid rgba(224,106,78,0.1); border-top: 4px solid var(--color-coral); border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;"></div>
        <h2>Waiting for Listener to Accept...</h2>
        <p style="color:var(--color-charcoal-muted);max-width:400px;">
          Your session request has been sent. Listener has 60 seconds to accept the request before it expires.
        </p>
      </div>
    `;
  }

  // Active Peer catalogue
  const filters = localState.filters || {};
  const listeners = (data.peerListeners || []).filter(listener => {
    if (filters.language && filters.language !== "all") {
      const sp = (listener.languages || []).map(l => String(l).toLowerCase());
      if (!sp.includes(filters.language.toLowerCase())) return false;
    }
    if (filters.interest && filters.interest !== "all") {
      const interests = (listener.conversationInterests || []).map(i => String(i).toLowerCase());
      const queryInterest = filters.interest.toLowerCase();
      const matches = interests.some(i => i.includes(queryInterest) || queryInterest.includes(i));
      if (!matches) return false;
    }
    return true;
  });
  
  return html`
    <div style="display:grid;grid-template-columns:300px 1fr;gap:24px;align-items:start;">
      <!-- Catalog Filters Sidebar -->
      <aside class="card" style="padding:20px;display:flex;flex-direction:column;gap:16px;">
        <h3 style="font-family:var(--font-serif);margin:0 0 8px 0;">Filters</h3>
        <div class="field">
          <label>Language</label>
          <select class="form-control" onchange="window.setPeerFilter('language', this.value)">
            <option value="all">All Languages</option>
            <option value="English">English</option>
            <option value="Hindi">Hindi</option>
          </select>
        </div>
        <div class="field">
          <label>Interest Topic</label>
          <select class="form-control" onchange="window.setPeerFilter('interest', this.value)">
            <option value="all">All Topics</option>
            <option value="Anxiety">Anxiety</option>
            <option value="Depression">Depression</option>
            <option value="Relationships">Relationships</option>
            <option value="Career">Career Stress</option>
            <option value="Grief">Grief & Loss</option>
            <option value="Academic">Academic Stress</option>
            <option value="Self-Esteem">Self-Esteem</option>
            <option value="Loneliness">Loneliness</option>
            <option value="Sleep">Sleep Issues</option>
            <option value="Anger">Anger Management</option>
          </select>
        </div>
      </aside>

      <!-- Catalogue Listings -->
      <main style="display:flex;flex-direction:column;gap:20px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:20px;">
          ${listeners.length === 0 ? html`
            <div class="card span-12" style="padding:48px;text-align:center;color:var(--color-charcoal-muted);">
              <i class="ph ph-users-three" style="font-size:48px;display:block;margin-bottom:12px;color:var(--color-coral);"></i>
              No Peer Listeners are currently online. Please check back shortly!
            </div>
          ` : listeners.map(listener => html`
            <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:12px;">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:50px;height:50px;border-radius:50%;background:#F0ECE6;display:flex;align-items:center;justify-content:center;font-size:24px;">
                  👤
                </div>
                <div>
                  <h4 style="margin:0;font-size:16px;">${listener.publicDisplayName}</h4>
                  <div style="font-size:12px;color:var(--color-charcoal-muted);">
                    Age Band: ${listener.ageBand} • ${listener.cityDisplay || "India"}
                  </div>
                </div>
              </div>
              <p style="font-size:13px;color:var(--color-charcoal-muted);margin:0;height:40px;overflow:hidden;">
                "${listener.shortBio || "Warm listener ready to support."}"
              </p>
              <div style="font-size:12px;color:var(--color-coral);font-weight:700;">
                ★ ${listener.averageRating || "5.0"} (${listener.ratingCount || 0} reviews)
              </div>
              <button class="btn primary" onclick="window.selectListenerForBooking('${encodeURIComponent(JSON.stringify(listener))}')" style="width:100%;margin-top:8px;">
                Talk to ${listener.publicDisplayName}
              </button>
            </div>
          `)}
        </div>
      </main>

      <!-- Booking Overlay Modal -->
      ${localState.selectedListener ? renderBookingModal() : ""}
    </div>
  `;
}

function renderBookingModal() {
  const listener = localState.selectedListener;
  const price = localState.selectedDuration * 10; // Simple INR 10/min rate guide

  return html`
    <div class="modal-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;">
      <div class="card" style="width:450px;padding:32px;display:flex;flex-direction:column;gap:20px;background:white;">
        <header style="display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;font-family:var(--font-serif);">Select Conversation Duration</h3>
          <button class="btn secondary" onclick="localState.selectedListener = null; window.triggerAppRender();" style="border:none;background:transparent;font-size:18px;cursor:pointer;">&times;</button>
        </header>
        <div>
          <label style="font-size:12px;font-weight:700;display:block;margin-bottom:8px;">Select Duration</label>
          <div style="display:flex;gap:8px;">
            ${[15, 30, 45, 60].map(dur => html`
              <button class="filter-tab ${localState.selectedDuration === dur ? 'active' : ''}" onclick="window.changeBookingDuration('${dur}')" style="flex:1;">
                ${dur} mins
              </button>
            `)}
          </div>
        </div>
        <div style="background:#FDFCF7;border:1px solid #ECE8E1;padding:16px;border-radius:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;">
            <span>Rate</span>
            <span>₹10.00 / min</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;color:var(--color-coral);border-top:1px dashed #ECE8E1;padding-top:8px;">
            <span>Total Payable</span>
            <span>₹${price}.00</span>
          </div>
        </div>
        <p style="font-size:11px;color:var(--color-charcoal-muted);margin:0;text-align:center;line-height:1.4;">
          Clicking request will lock listener slot and request acceptance. Live payment order will be initialized after acceptance.
        </p>
        <button id="btn-submit-request" class="btn primary" onclick="window.submitPeerRequest()" style="width:100%;">
          Send Request to ${listener.publicDisplayName}
        </button>
      </div>
    </div>
  `;
}

// 2. Onboarding / Disclaimer View
function renderDisclaimerAcceptance() {
  return html`
    <div class="card" style="max-width:600px;margin:32px auto;padding:32px;display:flex;flex-direction:column;gap:24px;border: 1px solid rgba(224,106,78,0.2);">
      <div style="display:flex;align-items:center;gap:12px;color:var(--color-coral);">
        <i class="ph-bold ph-shield-warning" style="font-size:32px;"></i>
        <h2 style="margin:0;font-family:var(--font-serif);">Peer-to-Peer Conversation Disclaimer</h2>
      </div>

      <div style="background:#FDFCF7;padding:20px;border-radius:12px;border:1px solid #ECE8E1;line-height:1.6;font-size:14px;color:var(--color-charcoal);">
        <p style="margin-top:0;"><strong>English:</strong></p>
        <p style="margin-bottom:20px;font-style:italic;">
          "This is a paid peer-to-peer conversation service. Peer Listeners are not acting as counsellors, therapists or medical professionals. This service is not therapy, diagnosis, treatment, prescription, crisis support or emergency care."
        </p>
        <p><strong>हिन्दी (Hindi):</strong></p>
        <p style="margin-bottom:0;font-style:italic;">
          "यह एक सशुल्क पीयर-टू-पीयर (आपसी) बातचीत सेवा है। पीयर लिसनर्स (सुनने वाले साथी) काउंसलर, थेरेपिस्ट या चिकित्सा पेशेवरों के रूप में कार्य नहीं कर रहे हैं। यह सेवा थेरेपी, निदान, उपचार, नुस्खे, संकट सहायता या आपातकालीन देखभाल नहीं है।"
        </p>
      </div>

      <div style="font-size:12px;color:var(--color-charcoal-muted);line-height:1.4;">
        By clicking Accept & Continue, you acknowledge that you are at least 18 years of age and understand that this conversation platform is purely for wellness dialogue and peer support, not professional clinical consultation.
      </div>

      <button id="btn-accept-disclaimer" class="btn primary" onclick="window.acceptPeerDisclaimer()" style="width:100%;">
        Accept & Continue
      </button>
    </div>
  `;
}

// 3. Talk & Earn View (User B Listener dashboard)
function renderTalkAndEarn(dashboard, data) {
  const profile = localState.listenerProfile;

  if (!profile) {
    return renderListenerOnboarding();
  }

  // Pending approval state
  if (profile.verificationStatus === "pending") {
    return html`
      <div class="card" style="padding:48px;text-align:center;max-width:500px;margin:32px auto;display:flex;flex-direction:column;align-items:center;gap:16px;">
        <i class="ph ph-hourglass" style="font-size:64px;color:var(--color-coral);"></i>
        <h2>Application Under Review</h2>
        <p style="color:var(--color-charcoal-muted);line-height:1.5;">
          Thank you for applying to be a Peer Listener! Our trust and safety team is verifying your KYC, PAN details, and training acknowledgement. You will receive an in-app notification once approved.
        </p>
        <div style="background:#FDFCF7;border:1px solid #ECE8E1;padding:12px;border-radius:8px;font-size:13px;width:100%;">
          Status: <strong style="color:var(--color-coral);">Pending Admin Verification</strong>
        </div>
      </div>
    `;
  }

  // Approved dashboard
  const presenceStatus = profile.presence?.currentStatus || "offline";

  return html`
    <div style="display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start;">
      <!-- Listener Dashboard Main Panel -->
      <main style="display:flex;flex-direction:column;gap:24px;">
        <div class="card" style="padding:24px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h3 style="margin:0 0 4px 0;font-family:var(--font-serif);">Go Live Options</h3>
            <p style="margin:0;font-size:13px;color:var(--color-charcoal-muted);">
              Set your availability status to receive conversation requests.
            </p>
          </div>
          <div>
            ${presenceStatus === "offline" ? html`
              <button class="btn primary" onclick="window.toggleGoLive(true)">Go Online</button>
            ` : html`
              <button class="btn secondary" onclick="window.toggleGoLive(false)">Go Offline</button>
            `}
          </div>
        </div>

        <!-- Incoming Request Alert -->
        ${localState.activeRequest && localState.activeRequest.requestStatus === "pending" ? html`
          <div class="card" style="padding:24px;border: 1px solid rgba(224,90,71,0.4); background:rgba(224,90,71,0.05); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h4 style="margin:0;color:var(--color-coral);">Incoming Conversation Request!</h4>
              <p style="margin:4px 0 0 0;font-size:13px;">
                User requested a <strong>${localState.activeRequest.requestedDurationMinutes} minute</strong> text session.
              </p>
            </div>
            <div style="display:flex;gap:10px;">
              <button class="btn primary" onclick="window.acceptIncomingRequest('${localState.activeRequest.id}')">Accept</button>
              <button class="btn secondary" onclick="window.declineIncomingRequest('${localState.activeRequest.id}')">Decline</button>
            </div>
          </div>
        ` : ""}

        <!-- Earnings Summary Card -->
        <div class="card" style="padding:24px;display:flex;flex-direction:column;gap:16px;">
          <h3 style="margin:0;font-family:var(--font-serif);">My Payout Overview</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <div style="background:#FDFCF7;border:1px solid #ECE8E1;padding:16px;border-radius:12px;">
              <div style="font-size:11px;color:var(--color-charcoal-muted);">Available Earnings</div>
              <div style="font-size:24px;font-weight:700;color:var(--color-coral);">₹0.00</div>
            </div>
            <div style="background:#FDFCF7;border:1px solid #ECE8E1;padding:16px;border-radius:12px;">
              <div style="font-size:11px;color:var(--color-charcoal-muted);">Completed Sessions</div>
              <div style="font-size:24px;font-weight:700;color:var(--color-coral);">0</div>
            </div>
          </div>
        </div>
      </main>

      <!-- Sidebar Status -->
      <aside style="display:flex;flex-direction:column;gap:20px;">
        <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:12px;">
          <h4 style="margin:0;font-family:var(--font-serif);">My Live Status</h4>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="status-indicator ${presenceStatus === 'available' ? 'online' : 'offline'}" style="width:12px;height:12px;border-radius:50%;display:inline-block;background:${presenceStatus === 'available' ? '#48BB78' : '#A0AEC0'};"></span>
            <span style="font-weight:700;text-transform:uppercase;font-size:12px;">${presenceStatus}</span>
          </div>
          <div style="font-size:12px;color:var(--color-charcoal-muted);line-height:1.4;">
            Keep this tab open to keep sending heartbeats. Hearts will automatically go offline if inactivity exceeds 60 seconds.
          </div>
        </div>
      </aside>
    </div>
  `;
}

function renderListenerOnboarding() {
  return html`
    <div class="card" style="max-width:600px;margin:32px auto;padding:32px;display:flex;flex-direction:column;gap:20px;">
      <h2 style="margin:0;font-family:var(--font-serif);">Register as a Peer Listener</h2>
      <p style="color:var(--color-charcoal-muted);margin:0;font-size:14px;line-height:1.5;">
         Complete this registration form to build your public profile and start accepting paid conversation requests.
      </p>

      <div class="field">
        <label>Public Display Name (Do NOT use full legal name)</label>
        <input type="text" class="form-control" placeholder="e.g. Sam, HopeListener" oninput="window.updateOnboardingData('publicDisplayName', this.value)" />
      </div>

      <div class="field">
        <label>Short Bio</label>
        <textarea class="form-control" placeholder="Tell users about your style and interests..." oninput="window.updateOnboardingData('shortBio', this.value)"></textarea>
      </div>

      <div class="field">
        <label>Languages (comma-separated)</label>
        <input type="text" class="form-control" placeholder="English, Hindi" oninput="window.setOnboardingLanguages(this.value)" />
      </div>

      <div class="field">
        <label>Conversation Interests (comma-separated)</label>
        <input type="text" class="form-control" placeholder="Anxiety, Stress, Career stress" oninput="window.setOnboardingInterests(this.value)" />
      </div>

      <button id="btn-submit-onboarding" class="btn primary" onclick="window.submitOnboarding()" style="width:100%;margin-top:16px;">
        Submit Application for Review
      </button>
    </div>
  `;
}

// 4. Session Room Tab Rendering
function renderSessionRoomTab() {
  const session = localState.activeSession;
  if (!session) return "";

  return html`
    <div class="card" style="padding:24px;display:grid;grid-template-columns:1fr 300px;gap:24px;height:550px;">
      <!-- Active Chat Area -->
      <div style="display:flex;flex-direction:column;justify-content:space-between;height:100%;">
        <!-- Header -->
        <header style="border-bottom:1px solid var(--color-border);padding-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h3 style="margin:0;font-family:var(--font-serif);">Peer Conversation Room</h3>
            <span style="font-size:12px;color:var(--color-charcoal-muted);">Status: Active Text Only (First 5 Mins)</span>
          </div>
          <div style="font-size:18px;font-weight:700;color:var(--color-coral);">
            Timer: ${Math.floor(localState.gateSecondsRemaining / 60)}:${String(localState.gateSecondsRemaining % 60).padStart(2, '0')}
          </div>
        </header>

        <!-- Message logs -->
        <div style="flex:1;overflow-y:auto;padding:16px 0;display:flex;flex-direction:column;gap:12px;">
          <div style="align-self:center;background:#F0ECE6;padding:6px 12px;border-radius:12px;font-size:11px;color:var(--color-charcoal-muted);">
            Paid Session Started. 5-Minute Text Only Gate is active.
          </div>
          ${localState.chatMessages.map(msg => html`
            <div style="align-self:${msg.senderId === 'me' ? 'flex-end' : 'flex-start'};background:${msg.senderId === 'me' ? 'var(--color-coral)' : '#F0ECE6'};color:${msg.senderId === 'me' ? 'white' : 'var(--color-charcoal)'};padding:10px 16px;border-radius:12px;max-width:70%;">
              ${msg.text}
            </div>
          `)}
        </div>

        <!-- Input control -->
        <footer style="display:flex;gap:10px;padding-top:12px;border-top:1px solid var(--color-border);">
          <input type="text" id="chat-msg-input" class="form-control" placeholder="Type a message..." style="flex:1;" />
          <button class="btn primary" onclick="sendChatRoomMessage()">Send</button>
        </footer>
      </div>

      <!-- Consent panel & safety side-deck -->
      <aside style="border-left:1px solid var(--color-border);padding-left:24px;display:flex;flex-direction:column;gap:20px;">
        <h4 style="margin:0;font-family:var(--font-serif);">Room Controls</h4>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button class="btn secondary" style="width:100%;text-align:left;" disabled>
            Request Voice (Disabled: Gate Active)
          </button>
          <button class="btn secondary" style="width:100%;text-align:left;" disabled>
            Request Video (Disabled: Gate Active)
          </button>
          <button class="btn secondary" style="width:100%;text-align:left;" disabled>
            File Sharing (Disabled: Gate Active)
          </button>
        </div>

        <div style="margin-top:auto;border-top:1px solid var(--color-border);padding-top:20px;display:flex;flex-direction:column;gap:10px;">
          <button class="btn primary" style="background:#E53E3E;color:white;width:100%;" onclick="triggerSafetyExit()">
            ⚠️ Safety Exit & End
          </button>
          <button class="btn secondary" style="width:100%;" onclick="endSessionNormally()">
            End Session
          </button>
        </div>
      </aside>
    </div>
  `;
}

function startSessionRoom() {
  localState.gateSecondsRemaining = 300;
  localState.chatMessages = [
    { senderId: 'peer', text: "Hello! Thank you for connecting. How can I help you today?" }
  ];
  
  const timer = setInterval(() => {
    if (localState.gateSecondsRemaining > 0) {
      localState.gateSecondsRemaining--;
      window.triggerAppRender();
    } else {
      clearInterval(timer);
    }
  }, 1000);
}

window.sendChatRoomMessage = function() {
  const input = document.querySelector("#chat-msg-input");
  if (!input || !input.value.trim()) return;
  localState.chatMessages.push({
    senderId: 'me',
    text: input.value.trim()
  });
  input.value = "";
  window.triggerAppRender();
};

window.triggerSafetyExit = async function() {
  if (confirm("Are you sure you want to trigger a Safety Exit? This will immediately end the call and hold funds for review.")) {
    const res = await api.request(`/peer-sessions/${localState.activeSession.id}/safety-exit`, { method: "POST" });
    if (res.ok) {
      toast("Safety Exit activated. Session ended.", "success");
      localState.activeSession = null;
      localState.activeTab = "pay-and-talk";
      window.triggerAppRender();
    }
  }
};

window.endSessionNormally = async function() {
  if (confirm("Are you sure you want to end this conversation?")) {
    const res = await api.request(`/peer-sessions/${localState.activeSession.id}/leave`, { method: "POST" });
    if (res.ok) {
      toast("Session completed.");
      localState.activeSession = null;
      localState.activeTab = "pay-and-talk";
      window.triggerAppRender();
    }
  }
};
