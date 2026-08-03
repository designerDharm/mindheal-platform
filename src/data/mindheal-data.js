export const appConfig = {
  brandName: "MindHeal",
  company: "Prilient Technologies Pvt. Ltd.",
  supportEmail: "support@mindheal.in",
  phone: "+91 90000 00000",
  address: "Jaipur, Rajasthan, India",
  apiBaseUrl: "https://api.mindheal.in/api/v1",
  currencies: ["INR"],
  defaultLanguage: "en",
  reportUnlockPrice: 49,
  platformCommissionPercent: 20
};

export const supportedLanguages = [
  "English",
  "Hindi",
  "Arabic"
];



export const publicNav = [
  { label: "Home", path: "/" },
  { label: "Services", path: "/services" },
  { label: "For Counsellors", path: "/for-counsellors" },
  { label: "Contact", path: "/contact" }
];

export const serviceCategories = [
  "AI Support",
  "Human Counselling",
  "CBT Tools",
  "Analysis Reports",
  "Wellness Tools",
  "Community"
];

export const services = [
  {
    id: "ai-counselling",
    title: "AI Counselling Chat",
    category: "AI Support",
    price: "Free",
    image: "assets/images/real_video.png",
    icon: `<i class="ph ph-robot" style="font-size:2rem;color:var(--primary)"></i>`,
    summary: "A confidential, omnipresent AI companion designed for profound emotional introspection and immediate preliminary psychological support.",
    details: [
      "Admin-configurable AI provider, model, system prompt, safety filters, and daily rate limits.",
      "Mood check-in before and after each session.",
      "Crisis escalation shows helplines and human counsellor handoff."
    ]
  },
  {
    id: "human-counselling",
    title: "Human Counsellor Sessions",
    category: "Human Counselling",
    price: "Counsellor rate",
    image: "assets/images/real_portrait.png",
    icon: `<i class="ph ph-user-circle" style="font-size:2rem;color:var(--primary)"></i>`,
    summary: "Consult credentialed clinical experts for immersive text, audio, high-definition video interventions, or collaborative group therapy.",
    details: [
      "Search by speciality, language, rating, price, availability, and session mode.",
      "Counsellors enable or disable chat, audio, and video from their panel.",
      "Session reminders, wallet hold, refunds, ratings, and consent-based recordings."
    ]
  },
  {
    id: "cbt-tools",
    title: "CBT Self-Help Toolkit",
    category: "CBT Tools",
    price: "Free core tools",
    image: "assets/images/real_hero.png",
    icon: `<i class="ph ph-brain" style="font-size:2rem;color:var(--primary)"></i>`,
    summary: "Comprehensive cognitive behavioral frameworks, including distortion tracking, resilience paradigms, and empirical psychometric evaluations.",
    details: [
      "Nine-step CBT thought diary with cognitive distortion tracking.",
      "Psychological tests for depression, anxiety, burnout, ADHD, eating patterns, and stress.",
      "AI suggests exercises based on user mood, tests, and diary patterns."
    ]
  },
  {
    id: "mood-tracker",
    title: "Mood & Emotion Tracker",
    category: "Wellness Tools",
    price: "Free",
    image: "assets/images/real_video.png",
    icon: `<i class="ph ph-heartbeat" style="font-size:2rem;color:var(--primary)"></i>`,
    summary: "Systematically document affective states to illuminate subconscious cognitive paradigms and mitigate psychological triggers.",
    details: [
      "Track complex emotions, not just basic moods.",
      "Identify triggers and coping mechanisms over time.",
      "Export data securely for clinical review."
    ]
  },
  {
    id: "dream-analysis",
    title: "Dream Analysis",
    category: "Analysis Reports",
    price: "Free summary, paid PDF",
    image: "assets/images/real_video.png",
    icon: `<i class="ph ph-moon-stars" style="font-size:2rem;color:var(--primary)"></i>`,
    summary: "Provide narrative or multimedia dream transcripts for rigorous psychoanalytic interpretation and archetype deconstruction.",
    details: [
      "Voice transcription and photo upload support.",
      "Free brief summary, then paid detailed PDF report unlock.",
      "Expert review upsell with counsellors who offer dream analysis."
    ]
  },
  {
    id: "handwriting-signature",
    title: "Handwriting & Signature Analysis",
    category: "Analysis Reports",
    price: "Free summary, paid PDF",
    image: "assets/images/real_portrait.png",
    icon: `<i class="ph ph-pen-nib" style="font-size:2rem;color:var(--primary)"></i>`,
    summary: "Upload graphological specimens for sophisticated biometric and personality profiling through advanced stroke analysis.",
    details: [
      "Guided capture instructions for clean images.",
      "Signature draw pad option for web users.",
      "Report history and premium comparison over time."
    ]
  },
  {
    id: "mind-games",
    title: "Mind Training Games",
    category: "Wellness Tools",
    price: "Free",
    image: "assets/images/real_hero.png",
    icon: `<i class="ph ph-game-controller" style="font-size:2rem;color:var(--primary)"></i>`,
    summary: "Neurocognitive interactive modules meticulously engineered to optimize executive function, emotional regulation, and immediate grounding.",
    details: [
      "Memory Matrix, Breathe Box, Emotion Wheel, CBT Thought Log, Worry Time Box, and more.",
      "Progress tracked by area: focus, stress, sleep, anger, anxiety, and mood.",
      "Designed for repeat use without punitive streak language."
    ]
  },
  {
    id: "focus-tools",
    title: "Focus & Calm Tools",
    category: "Wellness Tools",
    price: "Free and premium",
    icon: `<i class="ph ph-timer" style="font-size:2rem;color:var(--primary)"></i>`,
    summary: "Advanced physiological modulation techniques, encompassing structured breathwork, auditory soundscapes, and focused mindfulness interventions.",
    details: [
      "Box breathing, 4-7-8 breathing, pursed lip breathing, and alternate nostril breathing.",
      "Layerable ambient sounds with free and premium packs.",
      "Background playback and session counters for completed exercises."
    ]
  },
  {
    id: "healing-map",
    title: "Healing Location Map",
    category: "Human Counselling",
    price: "Free discovery",
    icon: `<i class="ph ph-map-pin" style="font-size:2rem;color:var(--primary)"></i>`,
    summary: "Navigate an aggregated geo-spatial directory of accredited clinical sanctuaries, therapeutic retreats, and psychiatric institutions.",
    details: [
      "Google Maps and Places API ready.",
      "Admin-approved offline listings only.",
      "Filter by entity type, distance, speciality, rating, and city."
    ]
  },
  {
    id: "group-sessions",
    title: "Group Healing Sessions",
    category: "Community",
    price: "Free or paid",
    icon: `<i class="ph ph-users-three" style="font-size:2rem;color:var(--primary)"></i>`,
    summary: "Clinician-facilitated collective healing environments addressing complex trauma, prolonged grief, and systematic addiction recovery.",
    details: [
      "Group video, host controls, raise hand, chat sidebar, and optional reflection prompt.",
      "Participants can book one-on-one follow-up after group sessions.",
      "Fee and capacity configured by counsellor, visible to admin."
    ]
  }
];

export const counsellors = [
  {
    id: "c-101",
    name: "Dr. Priya Mehta",
    title: "Clinical Psychologist",
    rating: 4.9,
    sessions: 1280,
    languages: ["English", "Hindi"],
    specialities: ["Anxiety", "CBT", "Relationship Counselling"],
    modes: ["Chat", "Audio", "Video"],
    rate: 900,
    status: "Online"
  },
  {
    id: "c-102",
    name: "Aarav Sen",
    title: "Trauma Counsellor",
    rating: 4.8,
    sessions: 860,
    languages: ["English", "Hindi"],
    specialities: ["Trauma", "Grief", "Mindfulness"],
    modes: ["Audio", "Video"],
    rate: 750,
    status: "Busy"
  },
  {
    id: "c-103",
    name: "Nisha Iyer",
    title: "CBT Therapist",
    rating: 4.7,
    sessions: 640,
    languages: ["English", "Arabic"],
    specialities: ["CBT", "Burnout", "ADHD"],
    modes: ["Chat", "Video"],
    rate: 650,
    status: "Offline"
  }
];

export const userFeatures = [
  "Dashboard with mood check-in and upcoming sessions",
  "AI counselling chat with history and safety escalation",
  "Browse counsellors, view profiles, and book sessions",
  "Chat, audio, video, group session, and expert review flows",
  "Dream, handwriting, and signature report submissions",
  "CBT thought diary, coping cards, mood tracker, daily diary, and psychological tests",
  "Wallet top-up, transactions, refunds, and report unlocks",
  "My Sessions, My Reports, AI chat history, profile, privacy, and language settings"
];

export const counsellorFeatures = [
  "Individual or organisation registration with document upload",
  "Admin verification status and resubmission flow",
  "Availability, slots, buffer time, daily session limit, and offline map listing",
  "Accept or decline session requests with reason",
  "Text chat, audio/video calls, group sessions, and screen share readiness",
  "Review AI chat transcripts only after user consent",
  "Analysis report review queue with expert commentary",
  "Earnings ledger, withdrawals, payout status, tax summary, and content uploads"
];

export const adminFeatures = [
  "Role-based admin login with 2FA-ready structure",
  "User and counsellor account management",
  "Counsellor document verification and prescription authority control",
  "AI API key manager, system prompt editor, model parameters, and prompt history",
  "Service catalog, pricing, feature toggles, and custom future services",
  "Wallets, transactions, refunds, commissions, payouts, and GST reports",
  "CMS for onboarding, tips, videos, sounds, FAQs, banners, and notifications",
  "Analytics for users, sessions, revenue, AI usage, counsellors, languages, and geography"
];

export const dashboardSeed = {
  user: {
    walletBalance: 1250,
    moodScore: 7,
    nextSession: "Today, 4:00 PM with Dr. Priya Mehta",
    reportsUnlocked: 3,
    upcomingSessions: [
      { type: "Video", counsellor: "Dr. Priya Mehta", time: "Today 4:00 PM", cost: 900 },
      { type: "Group", counsellor: "Aarav Sen", time: "Sat 7:00 PM", cost: 199 }
    ],
    reports: [
      { type: "Dream", title: "Flying over water", status: "Unlocked" },
      { type: "Handwriting", title: "Baseline sample", status: "Locked" }
    ]
  },
  counsellor: {
    earningsMonth: 84500,
    pendingRequests: 4,
    rating: 4.8,
    slotsOpen: 18,
    requests: [
      { user: "Riya Sharma", mode: "Video", time: "Tomorrow 6:00 PM", amount: 750 },
      { user: "Karan Patel", mode: "Chat", time: "Today 8:30 PM", amount: 500 }
    ],
    reviewQueue: [
      { type: "Dream Review", user: "A. Gupta", status: "Waiting" },
      { type: "Signature Review", user: "M. Khan", status: "Draft" }
    ]
  },
  admin: {
    users: 50234,
    counsellors: 214,
    revenueMonth: 1220000,
    aiMessages: 187500,
    pendingVerifications: 16,
    transactions: [
      { id: "TXN-9001", user: "Riya Sharma", type: "Wallet top-up", amount: 1000, status: "Success" },
      { id: "TXN-9002", user: "Aarav Sen", type: "Payout", amount: 18000, status: "Pending" },
      { id: "TXN-9003", user: "Karan Patel", type: "Dream PDF", amount: 49, status: "Success" }
    ]
  }
};

export const apiConfigRows = [
  "AI Counselling Chat",
  "Dream Analysis Summary",
  "Dream Analysis PDF Report",
  "Voice Transcription",
  "Handwriting Analysis",
  "Signature Analysis",
  "Google Maps",
  "OTP Gateway",
  "Payment Gateway"
];

export const roadmap = [
  {
    title: "Foundation",
    duration: "Weeks 1-8",
    items: ["Website and auth shell", "Backend schema", "Admin API config", "User dashboard", "Counsellor registration", "Wallet foundation"]
  },
  {
    title: "Core Counselling",
    duration: "Weeks 9-16",
    items: ["Counsellor booking", "Chat sessions", "Audio/video calls", "Report pipelines", "PDF unlock", "Payout workflows"]
  },
  {
    title: "Full Wellness Platform",
    duration: "Weeks 17-24",
    items: ["CBT tools", "Psychological tests", "Games", "Focus tools", "Healing map", "Group sessions", "3 languages"]
  },
  {
    title: "Security & Launch",
    duration: "Weeks 25-28",
    items: ["Pen test", "Performance testing", "Production monitoring", "SEO", "Accessibility QA", "Launch readiness"]
  }
];

export const howItWorks = [
  { step: 1, title: "Discreet Profiling", desc: "Complete a secure, private assessment to help us understand your unique emotional landscape.", icon: `<i class="ph ph-shield-check" style="font-size:32px;color:var(--color-cream)"></i>` },
  { step: 2, title: "Intelligent Matching", desc: "Our proprietary AI curates a bespoke selection of world-class therapeutic experts tailored to your needs.", icon: `<i class="ph ph-sparkle" style="font-size:32px;color:var(--color-cream)"></i>` },
  { step: 3, title: "Private Consultations", desc: "Engage in highly secure, confidential video sessions from the comfort of your personal space.", icon: `<i class="ph ph-video-camera" style="font-size:32px;color:var(--color-cream)"></i>` },
  { step: 4, title: "Continuous Evolution", desc: "Monitor your cognitive wellness with elite behavioral analytics and ongoing concierge support.", icon: `<i class="ph ph-chart-line-up" style="font-size:32px;color:var(--color-cream)"></i>` }
];

export const testimonials = [
  { name: "Executive Director, Finance", role: "Private Client", quote: "The discretion and caliber of the professionals on MindHeal is unmatched. It has fundamentally transformed how I manage high-stakes anxiety.", rating: 5 },
  { name: "Founder & CEO", role: "Private Client", quote: "A seamless, elite experience. The AI reflection tools provide immediate clarity during intense travel schedules.", rating: 5 },
  { name: "Dr. Kavita R.", role: "Clinical Specialist", quote: "MindHeal offers a sophisticated environment that allows me to deliver exceptional care to clients who demand the very best.", rating: 5 }
];

export const blogs = [
  { title: "The Psychology of High Performance", excerpt: "Exploring the delicate balance between extreme success and cognitive burnout among elite professionals.", date: "Jun 02, 2026", author: "MindHeal Editorial", image: "assets/images/real_portrait.png" },
  { title: "Redefining Resilience in Leadership", excerpt: "How modern executives are leveraging advanced cognitive behavioral strategies to maintain peak clarity.", date: "May 28, 2026", author: "Dr. Priya Mehta", image: "assets/images/real_hero.png" },
  { title: "The Executive's Guide to Grounding", excerpt: "Discreet, high-impact techniques to immediately lower cortisol levels before critical negotiations.", date: "May 20, 2026", author: "MindHeal Editorial", image: "assets/images/real_video.png" }
];

export const team = [
  { name: "Dr. Priya Mehta", role: "Chief Clinical Director", bio: "Renowned expert in cognitive restructuring for high-performers. Ph.D. from Oxford.", image: "assets/images/real_portrait.png" },
  { name: "Aarav Sen", role: "Head of Concierge Therapy", bio: "Specializes in executive stress, discreet interventions, and advanced mindfulness architectures.", image: "assets/images/real_portrait.png" },
  { name: "Nisha Iyer", role: "Director of Wellness Experience", bio: "Ensures unparalleled privacy, ethical standards, and frictionless experiences for our elite clientele.", image: "assets/images/real_portrait.png" }
];

export const videos = [
  { title: "What is MindHeal?", duration: "2:15", thumbnail: "assets/images/real_hero.png" },
  { title: "Guided Box Breathing", duration: "5:00", thumbnail: "assets/images/real_video.png" },
  { title: "How to use the CBT Diary", duration: "3:40", thumbnail: "assets/images/real_portrait.png" }
];
