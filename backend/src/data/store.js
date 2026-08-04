import { createId } from "../utils/security.js";

export const store = {
  users: [
    {
      id: "usr_user_1",
      role: "user",
      fullName: "Arjun Kumar",
      email: "arjun@example.com",
      mobile: "+919999999991",
      languageCode: "en",
      passwordHash: "",
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: "usr_user_2",
      role: "user",
      fullName: "Neha Sharma",
      email: "neha.s@example.com",
      mobile: "+919999999992",
      languageCode: "hi",
      passwordHash: "",
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: "usr_user_demo",
      role: "user",
      fullName: "Demo User",
      email: "demo.user@example.com",
      mobile: "+919999999999",
      languageCode: "en",
      passwordHash: "",
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: "usr_admin_real",
      role: "admin",
      fullName: "Designer Dharm",
      email: "dharm@mindheal.com",
      passwordHash: "",
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: "usr_admin",
      role: "admin",
      fullName: "System Admin",
      email: "admin@example.com",
      passwordHash: "",
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: "usr_counsellor_priya",
      role: "counsellor",
      fullName: "Dr. Priya Mehta",
      email: "priya.counsellor@example.com",
      passwordHash: "",
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: "usr_counsellor_rajesh",
      role: "counsellor",
      fullName: "Dr. Rajesh Singh",
      email: "dr.rajesh@example.com",
      passwordHash: "",
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ],
  counsellors: [
    {
      id: "cns_priya",
      userId: "usr_counsellor_priya",
      displayName: "Dr. Priya Mehta",
      title: "Clinical Psychologist",
      specializations: ["Anxiety", "CBT", "Relationship Counselling"],
      languagesSpoken: ["en", "hi", "gu"],
      hourlyRateInr: 900,
      ratingAvg: 4.9,
      verificationStatus: "approved",
      chatEnabled: true,
      audioEnabled: true,
      videoEnabled: true,
      showOnMap: true
    },
    {
      id: "cns_rajesh",
      userId: "usr_counsellor_rajesh",
      displayName: "Dr. Rajesh Singh",
      title: "Psychotherapist",
      specializations: ["Depression", "Trauma", "Mindfulness"],
      languagesSpoken: ["en", "hi"],
      hourlyRateInr: 1200,
      ratingAvg: 4.8,
      verificationStatus: "approved",
      chatEnabled: true,
      audioEnabled: true,
      videoEnabled: true,
      showOnMap: false
    }
  ],
  sessions: [],
  availabilitySlots: [
    { id: "slot_cns_priya_1", counsellorId: "cns_priya", date: "2026-06-05", startTime: "16:00", endTime: "17:00", sessionType: "video", isBooked: false, createdAt: new Date().toISOString() },
    { id: "slot_cns_priya_2", counsellorId: "cns_priya", date: "2026-06-06", startTime: "11:00", endTime: "12:00", sessionType: "video", isBooked: false, createdAt: new Date().toISOString() }
  ],
  analysisReports: [],
  contacts: [],
  counsellorApplications: [],
  wallets: [
    { id: "wal_demo_user", ownerType: "user", ownerId: "usr_demo_user", currency: "INR" },
    { id: "wal_platform", ownerType: "platform", ownerId: "platform", currency: "INR" }
  ],
  ledgerEntries: [
    { id: createId("led"), walletId: "wal_demo_user", direction: "credit", amountPaise: 125000, entryType: "seed_credit", createdAt: new Date().toISOString() }
  ],
  apiConfigurations: [
    { id: "cfg_ai_chat", serviceName: "AI Counselling Chat", aliases: ["chat", "ai-chat", "ai-counselling"], provider: "Gemini", modelName: "gemini-2.5-flash", apiKeyEncrypted: "", systemPrompt: "Warm reflective mental wellness support.", isActive: true },
    { id: "cfg_dream_pdf", serviceName: "Dream Analysis PDF Report", aliases: ["report_dream", "report-dream", "dream-analysis"], provider: "Gemini", modelName: "gemini-2.5-flash", apiKeyEncrypted: "", systemPrompt: "Reflective psychoanalytic dream analysis, not medical diagnosis.", isActive: true },
    { id: "cfg_handwriting", serviceName: "Handwriting Analysis", aliases: ["report_handwriting", "report-handwriting", "handwriting-analysis"], provider: "Gemini", modelName: "gemini-2.5-flash", apiKeyEncrypted: "", systemPrompt: "Graphological and personality profiling from handwriting strokes.", isActive: true },
    { id: "cfg_signature", serviceName: "Signature Analysis", aliases: ["report_signature", "report-signature", "signature-analysis"], provider: "Gemini", modelName: "gemini-2.5-flash", apiKeyEncrypted: "", systemPrompt: "Signature graphology, confidence, and behavioral indicators.", isActive: true },
    { id: "cfg_voice_transcribe", serviceName: "Voice Transcription", aliases: ["voice", "audio-transcribe"], provider: "Gemini", modelName: "gemini-2.5-flash", apiKeyEncrypted: "", systemPrompt: "Transcribe audio into text for analysis.", isActive: true },
    { id: "cfg_google_maps", serviceName: "Google Maps", aliases: ["google-maps", "maps"], provider: "Google", modelName: "", apiKeyEncrypted: "", systemPrompt: "", isActive: false }
  ],
  servicesCatalog: [
    { id: "svc_ai_chat", name: "AI Counselling Chat", isActive: true, isFree: true, priceInr: 0, category: "AI Support" },
    { id: "svc_dream", name: "Dream Analysis PDF Report", isActive: true, isFree: false, priceInr: 49, category: "Analysis Reports" }
  ],
  auditLogs: [],
  crisisEvents: [],
  notifications: []
};
