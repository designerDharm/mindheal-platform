import { useState } from "react";

const sections = {
  overview: {
    label: "Project Overview",
    icon: "🧠",
    color: "#7C3AED"
  },
  techStack: {
    label: "Tech Stack",
    icon: "⚙️",
    color: "#059669"
  },
  userApp: {
    label: "User App",
    icon: "📱",
    color: "#2563EB"
  },
  counsellorApp: {
    label: "Counsellor App",
    icon: "👨‍⚕️",
    color: "#D97706"
  },
  adminPanel: {
    label: "Admin Panel",
    icon: "🖥️",
    color: "#DC2626"
  },
  database: {
    label: "Database Schema",
    icon: "🗄️",
    color: "#0891B2"
  },
  apis: {
    label: "API Architecture",
    icon: "🔌",
    color: "#7C3AED"
  },
  gemini: {
    label: "Gemini AI Integration",
    icon: "🤖",
    color: "#059669"
  },
  payments: {
    label: "Payments & Wallet",
    icon: "💰",
    color: "#B45309"
  },
  deployment: {
    label: "Deployment",
    icon: "🚀",
    color: "#1D4ED8"
  },
  roadmap: {
    label: "Dev Roadmap",
    icon: "🗺️",
    color: "#7C3AED"
  }
};

const content = {
  overview: {
    title: "MindCare — Full Stack Mental Health Platform",
    subtitle: "3 Apps · 1 Ecosystem",
    blocks: [
      {
        heading: "Platform Summary",
        text: `MindCare is a three-component mental health super-app: a User Mobile App, a Counsellor Mobile App, and a Web-based Admin Panel. It connects patients with AI-powered tools and verified human counsellors — all within a secure, multilingual, wallet-based ecosystem.`
      },
      {
        heading: "Core Pillars",
        items: [
          "🔐 Secure Auth — Email / Mobile OTP / Google OAuth",
          "🤖 Gemini AI — Free (Flash) + Paid (Pro) services",
          "💬 Real-time — Chat, Audio & Video Calls (WebRTC)",
          "📊 Reports — AI PDF generation for Dream & Handwriting",
          "💰 Wallet — INR top-up, pay-per-service transactions",
          "🗺️ Map — Nearby clinics, rehab & healing centres",
          "🌐 Multilingual — Indian + International languages",
          "✅ Admin Verification — All counsellors approved before going live"
        ]
      }
    ]
  },
  techStack: {
    title: "Full Technology Stack",
    subtitle: "Google Antigravity + Stitch + Best-in-class tools",
    blocks: [
      {
        heading: "Mobile Apps (User + Counsellor)",
        items: [
          "Platform: Google Antigravity (Flutter-based Google framework)",
          "UI Design: Google Stitch (design-to-code pipeline)",
          "State: Riverpod / BLoC pattern",
          "Navigation: GoRouter",
          "Local Storage: Hive / SharedPreferences",
          "Push Notifications: Firebase Cloud Messaging (FCM)",
          "Real-time: Firebase Realtime DB + WebRTC (video/audio)",
          "Maps: Google Maps SDK + Places API",
          "Media: Camera, Audio Recorder, File Picker packages"
        ]
      },
      {
        heading: "Backend (REST + WebSocket APIs)",
        items: [
          "Runtime: Node.js with Express.js (or Dart Shelf for Antigravity native)",
          "WebSocket: Socket.io (real-time chat & signalling)",
          "WebRTC Signalling: Mediasoup / Agora (fallback)",
          "Auth: Firebase Auth + custom JWT middleware",
          "File Storage: Firebase Storage / Google Cloud Storage",
          "Queue: Firebase Cloud Tasks (async jobs: PDF generation, OTP)",
          "PDF Generation: Puppeteer / PDFKit (Node.js backend)"
        ]
      },
      {
        heading: "Database",
        items: [
          "Primary DB: Cloud Firestore (NoSQL, real-time, scalable)",
          "Relational needs: Cloud SQL (PostgreSQL) — transactions, wallet",
          "Cache: Redis (session, OTP, rate limiting)",
          "Search: Algolia or Firestore composite indexes"
        ]
      },
      {
        heading: "Admin Panel",
        items: [
          "Framework: Next.js 14 (React, App Router)",
          "UI Library: shadcn/ui + Tailwind CSS",
          "Charts: Recharts / Chart.js",
          "Auth: Firebase Admin SDK",
          "Hosting: Firebase Hosting / Vercel"
        ]
      },
      {
        heading: "AI / ML",
        items: [
          "Gemini Flash API: Free-tier services (AI Chat Bot, basic analysis)",
          "Gemini Pro API: Paid-tier services (Dream Analysis PDF, Handwriting)",
          "Google Cloud Vision API: Handwriting & signature image parsing",
          "Google Cloud Speech-to-Text: Voice dream narration transcription",
          "Vertex AI: Fine-tuned models for psychology domain (admin trains)"
        ]
      },
      {
        heading: "Payments",
        items: [
          "Gateway: Razorpay (INR, UPI, cards, net banking)",
          "Wallet: Custom wallet on Cloud SQL with double-entry ledger",
          "Payouts: Razorpay Route (counsellor earnings)"
        ]
      }
    ]
  },
  userApp: {
    title: "User Mobile App — Screen-by-Screen",
    subtitle: "Complete feature map",
    blocks: [
      {
        heading: "Onboarding Flow",
        items: [
          "Splash Screen → animated logo",
          "Welcome Carousel (3–5 slides): value props, mental health awareness",
          "Auth Choice: Email / Mobile / Google Sign-In",
          "OTP Verification screen (resend timer, 6-digit input)",
          "Profile Setup: Name, Age, Gender, Language preference",
          "First-time: short Mental Health Assessment Quiz (5–7 Qs)"
        ]
      },
      {
        heading: "Dashboard (Home)",
        items: [
          "Greeting + mood check-in widget (emoji scale)",
          "Quick access cards: AI Chat, Book Counsellor, Dream Analysis",
          "Daily tip / affirmation card (rotates)",
          "Upcoming sessions widget",
          "Mind Training Games shortcut",
          "Featured counsellors carousel",
          "Nearby centres map preview"
        ]
      },
      {
        heading: "Counselling Module",
        items: [
          "Browse Counsellors: filter by specialization, language, price, rating",
          "Counsellor Profile: bio, qualifications, reviews, available slots",
          "Book Session: date/time picker, select mode (chat/audio/video)",
          "AI Counsellor: free chat with Gemini Flash bot",
          "In-Session Chat: real-time messaging, file sharing",
          "Audio Call: WebRTC-based (if counsellor enabled)",
          "Video Call: WebRTC-based (if counsellor enabled)",
          "Session History & recordings (with consent)"
        ]
      },
      {
        heading: "Dream Analysis",
        items: [
          "Input: Type dream description (text area)",
          "OR: Upload photo of written dream (camera/gallery)",
          "OR: Record voice narration (audio recorder → Speech-to-Text)",
          "AI generates instant brief analysis (Gemini Flash — free)",
          "Detailed PDF report available (Gemini Pro — paid, nominal fee)",
          "PDF: view in-app, download, or 'Review with Expert' (books counsellor)"
        ]
      },
      {
        heading: "Handwriting & Signature Analysis",
        items: [
          "Upload handwriting sample (photo)",
          "Upload signature sample (photo or draw on canvas)",
          "Cloud Vision API parses → Gemini Pro generates psychological profile",
          "Same PDF + expert review flow as Dream Analysis"
        ]
      },
      {
        heading: "Mind Training Games",
        items: [
          "Memory Match, Focus Tap, Breathing Pacer, Mindfulness Timer",
          "Pattern Recognition, Cognitive Reframing exercises",
          "All games are FREE",
          "Progress tracking per game with streaks"
        ]
      },
      {
        heading: "Focus & Wellness Tools",
        items: [
          "Binaural Beats / Nature Sounds player",
          "Focus timer (Pomodoro)",
          "Breathing exercises (guided animation)",
          "Journaling (private encrypted notes)",
          "CBT worksheets for anxiety / trauma / procrastination",
          "Video tips (YouTube embed links added by counsellors/admin)"
        ]
      },
      {
        heading: "Map — Nearby Services",
        items: [
          "Google Maps integration",
          "Pins: Counsellor Clinics, Rehab Centres, Healing Centres",
          "Only shows centres that opted in for offline services",
          "Filter by type, distance, rating",
          "Tap pin → details, contact, book appointment"
        ]
      },
      {
        heading: "My Sessions",
        items: [
          "Upcoming bookings with countdown",
          "Past sessions: notes, recordings, prescriptions",
          "AI chat history",
          "Analysis reports archive"
        ]
      },
      {
        heading: "Wallet",
        items: [
          "Balance display (INR)",
          "Top-up via Razorpay (UPI / Card / NetBanking)",
          "Transaction history with filters",
          "Auto-deduct on service use",
          "Refund tracking"
        ]
      },
      {
        heading: "Profile & Settings",
        items: [
          "Edit personal info, photo",
          "Language selector (10+ Indian + international languages)",
          "Notification preferences",
          "Privacy settings",
          "Emergency contacts",
          "Account deletion / data export"
        ]
      }
    ]
  },
  counsellorApp: {
    title: "Counsellor Mobile App — Complete Feature Set",
    subtitle: "For Individual Experts & Organisations",
    blocks: [
      {
        heading: "Registration Flow (Pre-Verification)",
        items: [
          "Account Type selection: Individual or Organisation",
          "Basic Info: Name, mobile, email, profile photo",
          "Professional Details: Designation, specializations, years of experience",
          "Education: Degrees, certifications, upload documents",
          "License: License number, issuing body, upload certificate",
          "Organisation (if org): Team members, org logo, address",
          "Service Settings: Chat / Audio / Video toggles, pricing per service",
          "Offline Services: Enable map listing, enter clinic address (geo-tagged)",
          "Submit → 'Pending Admin Verification' status screen"
        ]
      },
      {
        heading: "Dashboard (Post-Verification)",
        items: [
          "Earnings overview widget (today / this week / total)",
          "Upcoming sessions list",
          "New booking notifications",
          "Pending reviews (dream analysis, handwriting reports)",
          "Quick toggle: online / offline / busy status"
        ]
      },
      {
        heading: "Client Management",
        items: [
          "Client list with last interaction",
          "Individual client profile: history, AI chat logs (with patient consent)",
          "View AI counsellor transcripts to provide continuity",
          "Add private clinical notes per session",
          "Attach prescriptions (if licensed)"
        ]
      },
      {
        heading: "Session Handling",
        items: [
          "Accept / Decline booking requests",
          "In-session: Chat, audio call, video call",
          "Screen share (video call mode)",
          "Session timer and billing auto-calculation",
          "End session → auto-charge patient wallet → credit counsellor"
        ]
      },
      {
        heading: "AI Report Reviews",
        items: [
          "Review queue: Dream analysis PDFs, Handwriting reports",
          "Add expert commentary on top of AI report",
          "Approve or flag for re-analysis",
          "Charge service fee for expert review (set in settings)"
        ]
      },
      {
        heading: "Services Offered",
        items: [
          "Dream Analysis (expert review + own analysis)",
          "Handwriting / Signature Analysis",
          "Group healing sessions (schedule & manage)",
          "Upload YouTube video tutorials (linked to profile)",
          "Prescription writing (licensed counsellors only)"
        ]
      },
      {
        heading: "Earnings & Payouts",
        items: [
          "Earnings ledger: per session, per report review, per service",
          "Platform commission deducted (set by admin, e.g. 15–20%)",
          "Withdrawal to bank via Razorpay Route",
          "Invoice generation for accounting"
        ]
      },
      {
        heading: "Profile & Settings",
        items: [
          "Edit all profile sections",
          "Language preference",
          "Service enable/disable toggles",
          "Pricing management",
          "Availability calendar (set working hours, block dates)",
          "Map listing management (offline services)"
        ]
      }
    ]
  },
  adminPanel: {
    title: "Admin Web Panel — Full Control Center",
    subtitle: "Next.js dashboard — complete management",
    blocks: [
      {
        heading: "Dashboard Overview",
        items: [
          "KPIs: Total users, counsellors, sessions, revenue (today/month/all-time)",
          "Live activity feed: new registrations, bookings, transactions",
          "Revenue chart (Recharts line + bar)",
          "Top counsellors by earnings / ratings",
          "Pending verifications count badge"
        ]
      },
      {
        heading: "User Management",
        items: [
          "Table: all users with search, filter, pagination",
          "User detail: profile, wallet, sessions, reports",
          "Actions: suspend, ban, verify email manually, reset password",
          "Send push notification to individual / bulk users"
        ]
      },
      {
        heading: "Counsellor Verification",
        items: [
          "Queue of pending applications",
          "Detail view: all submitted documents, license check",
          "Actions: Approve (goes live) / Decline (with reason email)",
          "Re-verification requests management",
          "Verified counsellors: manage, suspend, flag"
        ]
      },
      {
        heading: "Financial Management",
        items: [
          "All wallet transactions (users + counsellors)",
          "Razorpay webhook logs",
          "Revenue by service type",
          "Commission settings per service",
          "Refund processing",
          "Counsellor payout approvals",
          "Fraud detection flags"
        ]
      },
      {
        heading: "AI & Services Management",
        items: [
          "Gemini API key management (Free Flash vs Paid Pro assignment per service)",
          "Toggle which services use free vs paid Gemini tier",
          "AI chat bot: system prompt editor, persona configuration",
          "Service catalog: add new services, edit pricing, delete services",
          "AI Model Training: upload datasets for Vertex AI fine-tuning",
          "Monitor API usage & costs per service"
        ]
      },
      {
        heading: "Content & Notifications",
        items: [
          "Push notifications: compose & send to all / segment (users or counsellors)",
          "In-app banners management",
          "Daily tips content editor",
          "Promotional campaigns",
          "YouTube tutorial approval queue"
        ]
      },
      {
        heading: "Map & Locations",
        items: [
          "Approve / reject location listings from counsellors",
          "View all pins on admin map",
          "Add/remove approved healing centres manually"
        ]
      },
      {
        heading: "Reports & Analytics",
        items: [
          "Session analytics: volume, duration, type breakdown",
          "Service usage: dream analysis, handwriting, games play counts",
          "Retention & engagement metrics",
          "Language usage distribution",
          "Export reports as CSV/PDF"
        ]
      }
    ]
  },
  database: {
    title: "Database Schema Overview",
    subtitle: "Firestore Collections + Cloud SQL Tables",
    blocks: [
      {
        heading: "Firestore Collections",
        items: [
          "users/{uid}: profile, language, wallet_ref, fcm_token, status",
          "counsellors/{uid}: profile, verification_status, services, pricing, location",
          "sessions/{sid}: user_id, counsellor_id, type, status, start, end, cost",
          "chats/{chatId}/messages/{msgId}: text, media_url, sender, timestamp, read",
          "dream_analyses/{id}: user_id, input_text, audio_url, image_url, ai_summary, pdf_url, expert_id",
          "handwriting_analyses/{id}: user_id, image_url, ai_report, expert_id, pdf_url",
          "games/{gameId}/scores/{uid}: score, level, timestamp",
          "notifications/{uid}/items/{nid}: title, body, type, read, created_at",
          "reports/{id}: type, user_id, pdf_url, paid, reviewed_by"
        ]
      },
      {
        heading: "Cloud SQL (PostgreSQL) — Financial",
        items: [
          "wallets: id, user_id, balance_paise, currency, updated_at",
          "transactions: id, wallet_id, amount, type(credit/debit), reference, status, created_at",
          "payouts: id, counsellor_id, amount, razorpay_payout_id, status, created_at",
          "razorpay_orders: id, order_id, user_id, amount, status, created_at",
          "commissions: id, session_id, platform_cut, counsellor_cut, processed_at"
        ]
      }
    ]
  },
  apis: {
    title: "API Architecture",
    subtitle: "RESTful + WebSocket backend endpoints",
    blocks: [
      {
        heading: "Auth Service",
        items: [
          "POST /auth/send-otp — send OTP via SMS/email",
          "POST /auth/verify-otp — verify and return JWT",
          "POST /auth/google — Google OAuth token exchange",
          "POST /auth/refresh — refresh JWT"
        ]
      },
      {
        heading: "User Service",
        items: [
          "GET/PUT /users/me — get and update profile",
          "GET /users/me/sessions — all sessions",
          "GET /users/me/analyses — all dream/handwriting reports",
          "GET /users/me/wallet — wallet balance + transactions"
        ]
      },
      {
        heading: "Counsellor Service",
        items: [
          "GET /counsellors — list with filters",
          "GET /counsellors/:id — full profile",
          "POST /counsellors/register — submit registration",
          "GET /counsellors/me/clients — client list",
          "GET /counsellors/me/earnings — earnings data"
        ]
      },
      {
        heading: "Session & Communication",
        items: [
          "POST /sessions — create booking",
          "PATCH /sessions/:id — update status",
          "GET /sessions/:id — session details",
          "WS /ws/chat/:sessionId — real-time chat",
          "WS /ws/signalling/:roomId — WebRTC signalling"
        ]
      },
      {
        heading: "AI Services",
        items: [
          "POST /ai/chat — AI counsellor message (Gemini Flash)",
          "POST /ai/dream/analyse — submit dream → AI summary (Gemini Flash)",
          "POST /ai/dream/report — generate full PDF (Gemini Pro, payment check)",
          "POST /ai/handwriting/analyse — Cloud Vision + Gemini Pro",
          "POST /ai/dream/expert-review — attach counsellor review"
        ]
      },
      {
        heading: "Payment Service",
        items: [
          "POST /payments/topup — create Razorpay order",
          "POST /payments/topup/verify — verify signature, credit wallet",
          "POST /payments/pay — deduct from wallet for service",
          "GET /payments/transactions — user transaction history",
          "POST /payments/payout — counsellor withdrawal"
        ]
      },
      {
        heading: "Admin Service",
        items: [
          "GET /admin/stats — dashboard KPIs",
          "GET /admin/counsellors/pending — verification queue",
          "PATCH /admin/counsellors/:id/verify — approve / decline",
          "POST /admin/notifications/send — push notification blast",
          "GET /admin/transactions — all financial data",
          "PATCH /admin/ai/config — update API tier assignments"
        ]
      }
    ]
  },
  gemini: {
    title: "Gemini AI Integration Strategy",
    subtitle: "Free Flash API → Free services | Pro API → Paid services",
    blocks: [
      {
        heading: "Gemini Flash (Free Tier) — Free User Services",
        items: [
          "AI Counsellor Bot: all chat interactions with users",
          "Dream Analysis — Brief Summary: instant text response",
          "Handwriting Analysis — Brief Summary: instant text response",
          "Daily mental health tips generation",
          "Game hint/encouragement generation",
          "Language translation for multilingual support"
        ]
      },
      {
        heading: "Gemini Pro (Paid Tier) — Paid User Services",
        items: [
          "Dream Analysis — Full PDF Report (detailed psychological analysis)",
          "Handwriting & Signature Analysis — Full PDF Report",
          "Expert-grade psychological profiling in reports",
          "Admin: AI model response quality evaluation"
        ]
      },
      {
        heading: "Supporting Google AI APIs",
        items: [
          "Google Cloud Vision API: parse handwriting images, signature images",
          "Google Cloud Speech-to-Text: transcribe voice dream narration",
          "Vertex AI: host fine-tuned psychology-specific models (admin trains)",
          "Firebase ML: on-device lightweight models for offline basic features"
        ]
      },
      {
        heading: "Implementation Notes",
        items: [
          "Each service tagged with tier in Firestore: ai_tier: 'flash' | 'pro'",
          "Backend middleware checks tier before routing to correct API key",
          "Admin panel allows reassigning services between tiers",
          "Rate limiting per user per day for free Flash calls",
          "PDF generation: Gemini Pro output → Puppeteer renders HTML → PDF"
        ]
      }
    ]
  },
  payments: {
    title: "Payments & Wallet Architecture",
    subtitle: "Razorpay INR · Double-entry ledger · Counsellor payouts",
    blocks: [
      {
        heading: "User Wallet Flow",
        items: [
          "1. User selects top-up amount (₹99 / ₹199 / ₹499 / ₹999 / custom)",
          "2. Backend creates Razorpay order → returns order_id",
          "3. App opens Razorpay checkout (UPI / card / net banking)",
          "4. On success: Razorpay sends webhook → backend verifies signature",
          "5. Backend credits wallet (Cloud SQL transaction, atomic)",
          "6. User sees updated balance instantly (Firestore real-time update)"
        ]
      },
      {
        heading: "Service Payment Flow",
        items: [
          "User initiates paid service (PDF report, book session, etc.)",
          "Backend checks wallet balance ≥ service cost",
          "If insufficient: prompt top-up",
          "If sufficient: deduct from wallet, create debit transaction record",
          "Credit counsellor's pending earnings (minus platform commission)",
          "Session ends → counsellor can withdraw earnings"
        ]
      },
      {
        heading: "Counsellor Payout Flow",
        items: [
          "Counsellor requests withdrawal from app",
          "Admin approves payout (or auto-approve above threshold)",
          "Razorpay Route transfers to counsellor's bank account",
          "Payout record created with Razorpay payout ID",
          "Both parties receive notification"
        ]
      },
      {
        heading: "Commission Structure (Admin Configurable)",
        items: [
          "Platform commission: 15–20% per session (configurable per admin)",
          "AI PDF report: 100% to platform (minus Gemini API cost)",
          "Expert review: split expert 80% / platform 20%",
          "All rates editable from Admin Panel → Financial Settings"
        ]
      }
    ]
  },
  deployment: {
    title: "Deployment & Infrastructure",
    subtitle: "Google Cloud-native architecture",
    blocks: [
      {
        heading: "Mobile App Distribution",
        items: [
          "User App: Google Play Store + Apple App Store",
          "Counsellor App: Google Play Store + Apple App Store",
          "CI/CD: GitHub Actions → build → Fastlane → store submission",
          "Beta testing: Firebase App Distribution"
        ]
      },
      {
        heading: "Backend",
        items: [
          "API Server: Google Cloud Run (containerized, auto-scaling)",
          "WebSocket: Cloud Run with session affinity OR dedicated VM",
          "Cron Jobs: Cloud Scheduler (session reminders, report cleanup)",
          "Async Tasks: Cloud Tasks queue (PDF gen, OTP, notifications)"
        ]
      },
      {
        heading: "Data & Storage",
        items: [
          "Firestore: multi-region (nam5 for India + international)",
          "Cloud SQL: PostgreSQL on Cloud SQL, private IP, HA replica",
          "Cloud Storage: user uploads (dreams, handwriting, audio)",
          "Redis: Cloud Memorystore (OTP cache, rate limiting)"
        ]
      },
      {
        heading: "Admin Panel",
        items: [
          "Next.js: deployed on Vercel or Firebase Hosting",
          "Domain: admin.mindcare.in",
          "Auth: Firebase Admin SDK, restricted to admin email domain",
          "Staging: separate Firebase project for QA"
        ]
      },
      {
        heading: "Security",
        items: [
          "Firebase App Check: prevent unauthorized API access",
          "HTTPS everywhere (Cloud Run + Firebase Hosting auto-SSL)",
          "Firestore Security Rules: users can only read own data",
          "Cloud Armor: DDoS protection on API",
          "PII encryption at rest: Cloud KMS",
          "HIPAA-aligned data handling for health records"
        ]
      }
    ]
  },
  roadmap: {
    title: "Development Roadmap",
    subtitle: "Phased delivery — MVP to full launch",
    blocks: [
      {
        heading: "Phase 1 — Foundation (Weeks 1–4)",
        items: [
          "✅ Firebase project setup (Auth, Firestore, Storage, FCM)",
          "✅ Razorpay account + webhook endpoint",
          "✅ Gemini API keys (Flash + Pro) configured in backend",
          "✅ Google Stitch designs: onboarding + auth screens",
          "✅ Antigravity: auth flow (email/mobile/Google + OTP)",
          "✅ Backend: /auth endpoints + JWT middleware",
          "✅ User profile creation + language selector",
          "✅ Basic dashboard shell"
        ]
      },
      {
        heading: "Phase 2 — Core Features (Weeks 5–10)",
        items: [
          "🔄 AI Chat Bot (Gemini Flash integration)",
          "🔄 Counsellor listing + profile pages",
          "🔄 Session booking system",
          "🔄 Real-time chat (WebSocket)",
          "🔄 Wallet top-up (Razorpay)",
          "🔄 Counsellor App: registration + dashboard",
          "🔄 Admin Panel: counsellor verification queue"
        ]
      },
      {
        heading: "Phase 3 — AI Services (Weeks 11–15)",
        items: [
          "🔄 Dream Analysis (text + voice + photo input)",
          "🔄 Gemini Pro PDF report generation",
          "🔄 Handwriting & Signature Analysis (Cloud Vision)",
          "🔄 PDF viewer + download + expert review booking",
          "🔄 Admin: AI config panel + tier assignment"
        ]
      },
      {
        heading: "Phase 4 — Communication & Map (Weeks 16–19)",
        items: [
          "🔄 WebRTC audio calls",
          "🔄 WebRTC video calls",
          "🔄 Google Maps integration (user + counsellor)",
          "🔄 Counsellor location listing management",
          "🔄 Prescription module (licensed counsellors)"
        ]
      },
      {
        heading: "Phase 5 — Games, Tools & Polish (Weeks 20–24)",
        items: [
          "🔄 Mind Training Games (4–6 games)",
          "🔄 Focus tools, breathing, sounds player",
          "🔄 CBT worksheets for anxiety/trauma/procrastination",
          "🔄 Multilingual content (i18n implementation)",
          "🔄 Push notifications (FCM all scenarios)",
          "🔄 Full Admin Panel analytics",
          "🔄 Performance optimisation + security audit",
          "🔄 Beta testing → Store submission"
        ]
      }
    ]
  }
};

function Badge({ text, color }) {
  return (
    <span style={{
      background: color + "22",
      color: color,
      border: `1px solid ${color}44`,
      borderRadius: 6,
      padding: "2px 10px",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 0.3
    }}>{text}</span>
  );
}

function Block({ block, accent }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e8eaf0",
      borderRadius: 12,
      padding: "20px 24px",
      marginBottom: 16
    }}>
      <div style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 16,
        fontWeight: 700,
        color: accent,
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 8
      }}>
        <span style={{
          width: 3,
          height: 18,
          background: accent,
          borderRadius: 2,
          display: "inline-block"
        }}/>
        {block.heading}
      </div>
      {block.text && (
        <p style={{ color: "#374151", lineHeight: 1.7, fontSize: 14, margin: 0 }}>{block.text}</p>
      )}
      {block.items && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {block.items.map((item, i) => (
            <li key={i} style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "5px 0",
              fontSize: 13.5,
              color: "#374151",
              borderBottom: i < block.items.length - 1 ? "1px solid #f3f4f6" : "none"
            }}>
              <span style={{ color: accent, marginTop: 1, flexShrink: 0 }}>›</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("overview");
  const sec = sections[active];
  const con = content[active];

  return (
    <div style={{
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      background: "#f8f9fc",
      minHeight: "100vh",
      display: "flex"
    }}>
      {/* Sidebar */}
      <div style={{
        width: 220,
        minHeight: "100vh",
        background: "linear-gradient(160deg, #0f0c29, #302b63, #24243e)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 0",
        position: "fixed",
        top: 0, left: 0, bottom: 0,
        overflowY: "auto"
      }}>
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'Playfair Display', serif" }}>
            🧠 MindCare
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>Full Stack Blueprint</div>
        </div>
        <nav style={{ padding: "16px 0", flex: 1 }}>
          {Object.entries(sections).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 20px",
                border: "none",
                background: active === key
                  ? `linear-gradient(90deg, ${val.color}33, transparent)`
                  : "transparent",
                borderLeft: active === key ? `3px solid ${val.color}` : "3px solid transparent",
                cursor: "pointer",
                textAlign: "left",
                color: active === key ? "#fff" : "rgba(255,255,255,0.6)",
                fontSize: 13,
                fontWeight: active === key ? 600 : 400,
                transition: "all 0.15s"
              }}
            >
              <span style={{ fontSize: 16 }}>{val.icon}</span>
              <span>{val.label}</span>
            </button>
          ))}
        </nav>
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
            Google Antigravity + Stitch
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ marginLeft: 220, flex: 1, padding: "32px 40px", maxWidth: "calc(100vw - 220px)" }}>
        {/* Header */}
        <div style={{
          marginBottom: 32,
          paddingBottom: 24,
          borderBottom: "2px solid #e8eaf0"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 28 }}>{sec.icon}</span>
            <h1 style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              fontFamily: "'Playfair Display', Georgia, serif",
              color: "#0f0c29"
            }}>{con.title}</h1>
          </div>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>{con.subtitle}</p>

          {/* Pill badges */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {active === "overview" && [
              ["User App", "#2563EB"],
              ["Counsellor App", "#D97706"],
              ["Admin Panel", "#DC2626"],
              ["Gemini AI", "#059669"],
              ["INR Wallet", "#B45309"]
            ].map(([t, c]) => <Badge key={t} text={t} color={c} />)}
            {active === "techStack" && [
              ["Google Antigravity", "#059669"],
              ["Google Stitch", "#7C3AED"],
              ["Node.js", "#65a30d"],
              ["Firestore", "#F59E0B"],
              ["Gemini Flash + Pro", "#0891B2"]
            ].map(([t, c]) => <Badge key={t} text={t} color={c} />)}
            {active === "userApp" && [
              ["Free AI Chat", "#059669"],
              ["Paid Reports", "#D97706"],
              ["WebRTC Calls", "#2563EB"],
              ["Games", "#7C3AED"],
              ["Map", "#DC2626"]
            ].map(([t, c]) => <Badge key={t} text={t} color={c} />)}
            {active === "roadmap" && [
              ["~24 Weeks", "#7C3AED"],
              ["5 Phases", "#059669"],
              ["MVP Ready ~Week 10", "#2563EB"]
            ].map(([t, c]) => <Badge key={t} text={t} color={c} />)}
          </div>
        </div>

        {/* Content blocks */}
        <div style={{ maxWidth: 900 }}>
          {con.blocks.map((block, i) => (
            <Block key={i} block={block} accent={sec.color} />
          ))}
        </div>
      </div>
    </div>
  );
}
