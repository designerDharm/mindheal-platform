import { repositories } from "../repositories/index.js";
import { getIO } from "../socket.js";
import { appConfig } from "../config/app.js";
import { createRazorpayOrder, verifyRazorpaySignature, fetchRazorpayPayment, credit, debit, calculateCommission } from "../services/wallet.service.js";
import { postJournalTransaction } from "../services/double_entry.service.js";
import { rtcService } from "../services/rtc.service.js";
import { badRequest, created, forbidden, ok } from "../utils/http.js";
import { createId } from "../utils/security.js";

function notFound(message) {
  return { status: 404, body: { success: false, error: { code: "NOT_FOUND", message } } };
}
import { calculateAgeFromDob, requireFields } from "../utils/validation.js";

// Check if peer talk feature is enabled globally
function checkFeatureEnabled() {
  if (!appConfig.peerTalk.enabled) {
    throw new Error("Talk to Someone feature is currently disabled.");
  }
}

export async function listListeners({ query = {}, user }) {
  try {
    checkFeatureEnabled();
  } catch (err) {
    return forbidden(err.message);
  }

  const age = calculateAgeFromDob(user.dateOfBirth || user.date_of_birth);
  if (age === null || age < 18) {
    return forbidden("You must be 18 years or older to browse Peer Listeners.");
  }

  const status = query.status || "available";
  const profiles = await repositories.peerListenerProfiles.list({ status, verificationStatus: "approved" });

  const detailed = [];
  for (const profile of profiles) {
    const isBlocked = await repositories.peerBlocks.isBlocked(user.id, profile.userId);
    if (isBlocked) continue;

    const rates = await repositories.peerListenerRates.findByProfileId(profile.id);
    const presence = await repositories.peerListenerPresence.findByProfileId(profile.id);
    detailed.push({
      ...profile,
      rates,
      presence
    });
  }

  return ok(detailed);
}

export async function applyListener({ body, user }) {
  try {
    checkFeatureEnabled();
  } catch (err) {
    return forbidden(err.message);
  }

  // 1. Double-check age 18+
  const age = calculateAgeFromDob(user.dateOfBirth || user.date_of_birth);
  if (age === null || age < 18) {
    return badRequest("You must be 18 years or older to register as a Peer Listener.");
  }

  const missing = requireFields(body, ["publicDisplayName", "shortBio", "languages", "conversationInterests"]);
  if (missing) return badRequest("Missing required onboarding fields.", missing);

  // Check if profile already exists
  const existing = await repositories.peerListenerProfiles.findByUserId(user.id);
  if (existing) {
    return badRequest("You have already applied or created a Peer Listener profile.");
  }

  const profileId = createId("plp");
  const ageBand = getAgeBand(age);

  // Build profile
  const profile = {
    id: profileId,
    userId: user.id,
    publicDisplayName: body.publicDisplayName,
    publicAvatarAssetId: body.publicAvatarAssetId || null,
    ageBand,
    genderDisplay: body.genderDisplay || null,
    cityDisplay: body.cityDisplay || null,
    shortBio: body.shortBio,
    languages: body.languages || [],
    conversationInterests: body.conversationInterests || [],
    excludedTopics: body.excludedTopics || [],
    verificationStatus: "approved",
    moderationStatus: "active",
    acceptingRequests: false
  };

  const createdProfile = await repositories.peerListenerProfiles.create(profile);

  // Build verification checklist (Auto-approved per user request)
  const verification = {
    id: createId("plv"),
    listenerProfileId: profileId,
    identityVerificationStatus: "approved",
    ageVerificationStatus: "approved", // derived from DOB
    selfieLivenessStatus: "approved",
    panVerificationStatus: "approved",
    payoutAccountStatus: "approved",
    communityPolicyStatus: "approved", // agreed on signup
    trainingAcknowledgementStatus: "approved"
  };
  await repositories.peerListenerVerifications.create(verification);

  // Initialize rates if provided
  if (body.rates && typeof body.rates === "object") {
    for (const [durationStr, amountInr] of Object.entries(body.rates)) {
      const duration = Number(durationStr);
      if ([15, 30, 45, 60].includes(duration) && amountInr >= 0) {
        const feePaise = Math.round(Number(amountInr) * 100);
        const hourlyEquivalentPaise = Math.round((feePaise / duration) * 60);
        await repositories.peerListenerRates.createOrUpdate({
          listenerProfileId: profileId,
          sessionDurationMinutes: duration,
          feePaise,
          hourlyEquivalentPaise,
          enabled: true
        });
      }
    }
  }

  // Initialize presence
  await repositories.peerListenerPresence.createOrUpdate({
    listenerProfileId: profileId,
    currentStatus: "offline"
  });

  return created({ profile: createdProfile, verification });
}

export async function getMyProfile({ user }) {
  try {
    checkFeatureEnabled();
  } catch (err) {
    return forbidden(err.message);
  }

  const profile = await repositories.peerListenerProfiles.findByUserId(user.id);
  if (!profile) return notFound("Peer Listener profile not found for this user.");

  const verification = await repositories.peerListenerVerifications.findByProfileId(profile.id);
  const rates = await repositories.peerListenerRates.findByProfileId(profile.id);
  const presence = await repositories.peerListenerPresence.findByProfileId(profile.id);

  return ok({ profile, verification, rates, presence });
}

export async function updateMyProfile({ body, user }) {
  try {
    checkFeatureEnabled();
  } catch (err) {
    return forbidden(err.message);
  }

  const profile = await repositories.peerListenerProfiles.findByUserId(user.id);
  if (!profile) return notFound("Peer Listener profile not found.");

  // Exclude fields that must not be edited directly
  const patch = {};
  if (body.publicDisplayName !== undefined) patch.publicDisplayName = body.publicDisplayName;
  if (body.publicAvatarAssetId !== undefined) patch.publicAvatarAssetId = body.publicAvatarAssetId;
  if (body.genderDisplay !== undefined) patch.genderDisplay = body.genderDisplay;
  if (body.cityDisplay !== undefined) patch.cityDisplay = body.cityDisplay;
  if (body.shortBio !== undefined) patch.shortBio = body.shortBio;
  if (body.languages !== undefined) patch.languages = body.languages;
  if (body.conversationInterests !== undefined) patch.conversationInterests = body.conversationInterests;
  if (body.excludedTopics !== undefined) patch.excludedTopics = body.excludedTopics;
  if (body.acceptingRequests !== undefined) patch.acceptingRequests = body.acceptingRequests;

  const updatedProfile = await repositories.peerListenerProfiles.update(profile.id, patch);

  if (body.rates && typeof body.rates === "object") {
    for (const [durationStr, amountInr] of Object.entries(body.rates)) {
      const duration = Number(durationStr);
      if ([15, 30, 45, 60].includes(duration) && amountInr >= 0) {
        const feePaise = Math.round(Number(amountInr) * 100);
        const hourlyEquivalentPaise = Math.round((feePaise / duration) * 60);
        await repositories.peerListenerRates.createOrUpdate({
          listenerProfileId: profile.id,
          sessionDurationMinutes: duration,
          feePaise,
          hourlyEquivalentPaise,
          enabled: true
        });
      }
    }
  }

  return ok(updatedProfile);
}

export async function submitMyProfile({ user }) {
  const profile = await repositories.peerListenerProfiles.findByUserId(user.id);
  if (!profile) return notFound("Peer Listener profile not found.");

  const updated = await repositories.peerListenerProfiles.update(profile.id, { verificationStatus: "pending" });
  return ok({ message: "Profile submitted for review successfully.", profile: updated });
}

export async function goLive({ user }) {
  const profile = await repositories.peerListenerProfiles.findByUserId(user.id);
  if (!profile) return notFound("Peer Listener profile not found.");

  if (profile.verificationStatus !== "approved") {
    return badRequest("Your Peer Listener profile must be approved before going live.");
  }
  if (profile.moderationStatus === "suspended") {
    return forbidden("Your profile is suspended. Please contact support.");
  }

  const presence = await repositories.peerListenerPresence.createOrUpdate({
    listenerProfileId: profile.id,
    currentStatus: "available",
    availableSince: new Date().toISOString()
  });

  return ok({ presence });
}

export async function goOffline({ user }) {
  const profile = await repositories.peerListenerProfiles.findByUserId(user.id);
  if (!profile) return notFound("Peer Listener profile not found.");

  const presence = await repositories.peerListenerPresence.createOrUpdate({
    listenerProfileId: profile.id,
    currentStatus: "offline",
    socketConnectionId: null
  });

  return ok({ presence });
}

export async function getEarnings({ user }) {
  const profile = await repositories.peerListenerProfiles.findByUserId(user.id);
  if (!profile) return notFound("Peer Listener profile not found.");

  // Fetch all transactions involving this listener
  const wallet = await repositories.wallets.findByOwner(user.id);
  const ledgerEntries = wallet ? await repositories.wallets.ledgerEntries(wallet.id) : [];

  // Group and summarize
  const earnings = ledgerEntries.filter(e => e.entryType === "peer_session_earning");
  const pendingEarnings = ledgerEntries.filter(e => e.entryType === "peer_session_pending_earning");
  const totalEarnedPaise = earnings.reduce((sum, e) => sum + (e.direction === "credit" ? e.amountPaise : -e.amountPaise), 0);
  const totalPendingPaise = pendingEarnings.reduce((sum, e) => sum + (e.direction === "credit" ? e.amountPaise : -e.amountPaise), 0);

  return ok({
    balanceInr: (totalEarnedPaise + totalPendingPaise) / 100,
    availableEarningInr: totalEarnedPaise / 100,
    pendingEarningInr: totalPendingPaise / 100,
    transactions: ledgerEntries.slice(0, 10)
  });
}

export async function getConfig() {
  return ok({
    featureFlags: appConfig.peerTalk,
    pricingRules: {
      allowedDurationsMinutes: [15, 30, 45, 60],
      minimumFeeInr: 100,
      maximumFeeInr: 2000,
      commissionRateBps: 1000 // 10%
    },
    timeouts: {
      requestExpirySeconds: 60,
      paymentExpirySeconds: 300,
      joinGracePeriodSeconds: 180,
      consentGateSeconds: 300 // 5 minutes
    }
  });
}

export async function getDisclaimer() {
  return ok({
    policyVersion: "v1.0",
    disclaimer: {
      en: "This is a paid peer-to-peer conversation service. Peer Listeners are not acting as counsellors, therapists or medical professionals. This service is not therapy, diagnosis, treatment, prescription, crisis support or emergency care.",
      hi: "यह एक सशुल्क पीयर-टू-पीयर (आपसी) बातचीत सेवा है। पीयर लिसनर्स (सुनने वाले साथी) काउंसलर, थेरेपिस्ट या चिकित्सा पेशेवरों के रूप में कार्य नहीं कर रहे हैं। यह सेवा थेरेपी, निदान, उपचार, नुस्खे, संकट सहायता या आपातकालीन देखभाल नहीं है।"
    }
  });
}

export async function acceptDisclaimer({ body, user }) {
  const missing = requireFields(body, ["policyVersion"]);
  if (missing) return badRequest("Missing required disclaimer policyVersion.", missing);

  const acceptance = {
    id: createId("ppa"),
    userId: user.id,
    policyType: "marketplace_disclaimer",
    policyVersion: body.policyVersion,
    language: body.language || "en"
  };

  const created = await repositories.peerPolicyAcceptances.create(acceptance);
  return ok({ success: true, acceptance: created });
}

async function executeTransaction(callback) {
  if (repositories.transactions?.withTransaction) {
    return await repositories.transactions.withTransaction(callback);
  }
  return await callback();
}

export async function createSessionRequest({ body, user }) {
  try {
    checkFeatureEnabled();
  } catch (err) {
    return forbidden(err.message);
  }

  const missing = requireFields(body, ["listenerProfileId", "durationMinutes"]);
  if (missing) return badRequest("Missing required booking fields.", missing);

  const duration = Number(body.durationMinutes);
  if (![15, 30, 45, 60].includes(duration)) {
    return badRequest("Invalid session duration. Must be 15, 30, 45, or 60 minutes.");
  }

  const disclaimer = await repositories.peerPolicyAcceptances.findLatest(user.id, "marketplace_disclaimer");
  if (!disclaimer) {
    return forbidden("You must accept the peer marketplace disclaimer policy before requesting a session.");
  }

  const age = calculateAgeFromDob(user.dateOfBirth || user.date_of_birth);
  if (age === null || age < 18) {
    return forbidden("You must be 18 years or older to request a session.");
  }

  const listener = await repositories.peerListenerProfiles.findById(body.listenerProfileId);
  if (!listener) return notFound("Peer Listener profile not found.");

  if (listener.verificationStatus !== "approved" || listener.moderationStatus === "suspended") {
    return badRequest("This Peer Listener is currently unavailable.");
  }

  const isBlocked = await repositories.peerBlocks.isBlocked(user.id, listener.userId);
  if (isBlocked) {
    return forbidden("This session cannot be requested due to user block restrictions.");
  }

  const rates = await repositories.peerListenerRates.findByProfileId(listener.id);
  const rate = rates.find(r => r.sessionDurationMinutes === duration);
  if (!rate) {
    return badRequest(`This listener does not offer ${duration} minute sessions.`);
  }

  const wallet = await repositories.wallets.findByOwner(user.id);
  if (!wallet) return badRequest("User wallet not found.");

  const balancePaise = await repositories.wallets.balance(wallet.id);
  if (balancePaise < rate.feePaise) {
    return badRequest(`Insufficient wallet balance. Session cost is ₹${rate.feePaise / 100}, but your balance is ₹${balancePaise / 100}. Please top up first.`);
  }

  return await executeTransaction(async () => {
    const driver = process.env.REPOSITORY_DRIVER || "memory";
    let activeRequest = null;
    let activeSession = null;

    if (driver === "postgres") {
      const { query } = await import("../data/db.js");
      const activeReqRes = await query(
        `SELECT * FROM peer_session_requests 
         WHERE (requester_user_id = $1 OR listener_profile_id = $2) 
           AND request_status IN ('pending', 'accepted') LIMIT 1`,
        [user.id, listener.id]
      );
      if (activeReqRes.rows.length) activeRequest = activeReqRes.rows[0];

      const activeSesRes = await query(
        `SELECT * FROM peer_sessions 
         WHERE (requester_user_id = $1 OR listener_profile_id = $2) 
           AND session_status IN ('active', 'paused') LIMIT 1`,
        [user.id, listener.id]
      );
      if (activeSesRes.rows.length) activeSession = activeSesRes.rows[0];
    } else {
      const { store } = await import("../data/store.js");
      activeRequest = (store.peerSessionRequests || []).find(r => 
        (r.requesterUserId === user.id || r.listenerProfileId === listener.id) &&
        ["pending", "accepted"].includes(r.requestStatus)
      );
      activeSession = (store.peerSessions || []).find(s => 
        (s.requesterUserId === user.id || s.listenerProfileId === listener.id) &&
        ["active", "paused"].includes(s.sessionStatus)
      );
    }

    if (activeRequest) {
      return badRequest("Either you or the listener has another active session request in progress.");
    }
    if (activeSession) {
      return badRequest("Either you or the listener is currently in an active session.");
    }

    const requestId = createId("psr");
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    const request = await repositories.peerSessionRequests.create({
      id: requestId,
      requesterUserId: user.id,
      listenerProfileId: listener.id,
      requestedDurationMinutes: duration,
      requestedMode: body.requestedMode || "text",
      requestStatus: "pending",
      expiresAt
    });

    const quoteId = createId("psq");
    const commissionPaise = Math.round(rate.feePaise * 0.10);
    const totalAmountPaise = rate.feePaise;

    await repositories.peerSessionQuotes.create({
      id: quoteId,
      peerSessionRequestId: requestId,
      requesterUserId: user.id,
      listenerProfileId: listener.id,
      durationMinutes: duration,
      grossAmountPaise: totalAmountPaise,
      baseFeePaise: rate.feePaise,
      discountPaise: 0,
      commissionPaise,
      totalAmountPaise,
      expiresAt
    });

    try {
      const io = getIO();
      io.to(listener.userId).emit("incoming_peer_request", {
        request,
        quote: { baseFeePaise: rate.feePaise, totalAmountPaise }
      });
    } catch (err) {
      console.error("[Socket] Failed to emit incoming_peer_request event:", err.message);
    }

    return created({ request, totalAmountPaise });
  });
}

export async function authorizePeerRequestParticipant(request, user) {
  if (!user) {
    return { authorized: false, status: 401, error: "Authentication required." };
  }

  // Admins have platform-wide access
  if (user.role === "admin") {
    return { authorized: true, role: "admin" };
  }

  // Requester
  if (request.requesterUserId === user.id) {
    return { authorized: true, role: "requester" };
  }

  // Listener
  if (request.listenerProfileId) {
    if (request.listenerProfileId === user.id) {
      return { authorized: true, role: "listener" };
    }
    if (typeof repositories.peerListenerProfiles?.findById === "function") {
      const listener = await repositories.peerListenerProfiles.findById(request.listenerProfileId);
      if (listener && (listener.userId === user.id || listener.id === user.id)) {
        return { authorized: true, role: "listener" };
      }
    }
    if (typeof repositories.peerListenerProfiles?.findByUserId === "function") {
      const myProfile = await repositories.peerListenerProfiles.findByUserId(user.id);
      if (myProfile && myProfile.id === request.listenerProfileId) {
        return { authorized: true, role: "listener" };
      }
    }
  }

  return { authorized: false, status: 403, error: "You are not authorized to access this peer session request." };
}

export async function authorizePeerQuoteParticipant(quote, user) {
  if (!user) {
    return { authorized: false, status: 401, error: "Authentication required." };
  }

  // Admins have platform-wide access
  if (user.role === "admin") {
    return { authorized: true, role: "admin" };
  }

  // Check direct quote fields if available
  if (quote.requesterUserId && quote.requesterUserId === user.id) {
    return { authorized: true, role: "requester" };
  }

  if (quote.listenerProfileId) {
    if (quote.listenerProfileId === user.id) {
      return { authorized: true, role: "listener" };
    }
    if (typeof repositories.peerListenerProfiles?.findById === "function") {
      const listener = await repositories.peerListenerProfiles.findById(quote.listenerProfileId);
      if (listener && (listener.userId === user.id || listener.id === user.id)) {
        return { authorized: true, role: "listener" };
      }
    }
    if (typeof repositories.peerListenerProfiles?.findByUserId === "function") {
      const myProfile = await repositories.peerListenerProfiles.findByUserId(user.id);
      if (myProfile && myProfile.id === quote.listenerProfileId) {
        return { authorized: true, role: "listener" };
      }
    }
  }

  // Fallback to associated request if quote references one
  if (quote.peerSessionRequestId && typeof repositories.peerSessionRequests?.findById === "function") {
    const request = await repositories.peerSessionRequests.findById(quote.peerSessionRequestId);
    if (request) {
      return await authorizePeerRequestParticipant(request, user);
    }
  }

  return { authorized: false, status: 403, error: "You are not authorized to access this peer session quote." };
}

export async function authorizePeerSessionParticipant(session, user) {
  if (!user) {
    return { authorized: false, status: 401, error: "Authentication required." };
  }

  // Resolve listener user ID and profile
  let listenerUserId = session.listenerUserId || null;
  let listenerProfile = null;

  if (session.listenerProfileId) {
    if (typeof repositories.peerListenerProfiles?.findById === "function") {
      listenerProfile = await repositories.peerListenerProfiles.findById(session.listenerProfileId);
      if (listenerProfile && listenerProfile.userId) {
        listenerUserId = listenerProfile.userId;
      }
    }
    if (!listenerUserId && session.listenerProfileId) {
      listenerUserId = session.listenerProfileId;
    }
  }

  if (user.role === "admin") {
    return {
      authorized: true,
      role: "admin",
      requesterUserId: session.requesterUserId,
      listenerUserId: listenerUserId || session.listenerProfileId,
      listenerProfileId: session.listenerProfileId
    };
  }

  // Check requester
  if (session.requesterUserId === user.id) {
    return {
      authorized: true,
      role: "requester",
      requesterUserId: session.requesterUserId,
      listenerUserId: listenerUserId || session.listenerProfileId,
      listenerProfileId: session.listenerProfileId
    };
  }

  // Check listener: either user.id matches resolved listenerUserId, or user.id matches session.listenerProfileId directly,
  // or user's listener profile id matches session.listenerProfileId
  let isListener = false;
  if (listenerUserId && listenerUserId === user.id) {
    isListener = true;
  }
  if (!isListener && session.listenerProfileId === user.id) {
    isListener = true;
    listenerUserId = user.id;
  }
  if (!isListener && typeof repositories.peerListenerProfiles?.findByUserId === "function") {
    const userLp = await repositories.peerListenerProfiles.findByUserId(user.id);
    if (userLp && userLp.id === session.listenerProfileId) {
      isListener = true;
      listenerUserId = user.id;
    }
  }

  if (isListener) {
    return {
      authorized: true,
      role: "listener",
      requesterUserId: session.requesterUserId,
      listenerUserId: user.id,
      listenerProfileId: session.listenerProfileId
    };
  }

  return { authorized: false, status: 403, error: "You are not authorized for this peer session." };
}

export async function getSessionRequest({ params, user }) {
  const request = await repositories.peerSessionRequests.findById(params.id);
  if (!request) return notFound("Session request not found.");

  const auth = await authorizePeerRequestParticipant(request, user);
  if (!auth.authorized) {
    return forbidden(auth.error);
  }

  const quote = await repositories.peerSessionQuotes.findByRequestId(params.id);
  return ok({ ...request, quote });
}

export async function getSessionRequestQuote({ params, user }) {
  const request = await repositories.peerSessionRequests.findById(params.id);
  if (!request) return notFound("Session request not found.");

  const auth = await authorizePeerRequestParticipant(request, user);
  if (!auth.authorized) {
    return forbidden(auth.error);
  }

  const quote = await repositories.peerSessionQuotes.findByRequestId(params.id);
  if (!quote) return notFound("Session quote not found.");
  return ok(quote);
}

export async function getPeerQuote({ params, user }) {
  const quote = await repositories.peerSessionQuotes.findById(params.id);
  if (!quote) return notFound("Session quote not found.");

  const auth = await authorizePeerQuoteParticipant(quote, user);
  if (!auth.authorized) {
    return forbidden(auth.error);
  }

  return ok(quote);
}

export async function acceptSessionRequest({ params, user }) {
  const request = await repositories.peerSessionRequests.findById(params.id);
  if (!request) return notFound("Session request not found.");

  const listener = await repositories.peerListenerProfiles.findByUserId(user.id);
  if (!listener || request.listenerProfileId !== listener.id) {
    return forbidden("You are not authorized to accept this request.");
  }

  if (request.requestStatus !== "pending") {
    return badRequest(`Request cannot be accepted. Current status is '${request.requestStatus}'.`);
  }

  if (new Date(request.expiresAt) < new Date()) {
    await repositories.peerSessionRequests.update(request.id, { requestStatus: "expired" });
    return badRequest("Request has expired.");
  }

  const updated = await repositories.peerSessionRequests.update(request.id, { requestStatus: "accepted" });

  try {
    const io = getIO();
    io.to(request.requesterUserId).emit("peer_request_accepted", { requestId: request.id });
  } catch (err) {
    console.error("[Socket] Failed to emit peer_request_accepted event:", err.message);
  }

  return ok(updated);
}

export async function declineSessionRequest({ params, body, user }) {
  const request = await repositories.peerSessionRequests.findById(params.id);
  if (!request) return notFound("Session request not found.");

  const listener = await repositories.peerListenerProfiles.findByUserId(user.id);
  const isRequester = request.requesterUserId === user.id;
  const isListener = listener && request.listenerProfileId === listener.id;

  if (!isRequester && !isListener) {
    return forbidden("You are not authorized to decline this request.");
  }

  if (!["pending", "accepted"].includes(request.requestStatus)) {
    return badRequest(`Request cannot be cancelled/declined. Current status is '${request.requestStatus}'.`);
  }

  const updated = await repositories.peerSessionRequests.update(request.id, {
    requestStatus: "declined",
    declineReason: body.reason || (isRequester ? "Cancelled by user" : "Declined by listener")
  });

  try {
    const io = getIO();
    const targetUserId = isRequester ? (listener ? listener.userId : null) : request.requesterUserId;
    if (targetUserId) {
      io.to(targetUserId).emit("peer_request_declined", {
        requestId: request.id,
        reason: updated.declineReason
      });
    }
  } catch (err) {
    console.error("[Socket] Failed to emit peer_request_declined event:", err.message);
  }

  return ok(updated);
}

export async function initiateRequestPaymentOrder({ params, user }) {
  const request = await repositories.peerSessionRequests.findById(params.id);
  if (!request) return notFound("Session request not found.");

  if (request.requesterUserId !== user.id) {
    return forbidden("You are not authorized to pay for this request.");
  }

  if (request.requestStatus !== "accepted") {
    return badRequest(`Payment can only be initiated for accepted requests. Current status is '${request.requestStatus}'.`);
  }

  const quote = await repositories.peerSessionQuotes.findByRequestId(request.id);
  if (!quote) return notFound("Session quote not found.");

  if (quote.status === "paid") {
    return badRequest("Session quote has already been paid.");
  }

  if (quote.expiresAt && new Date(quote.expiresAt) < new Date()) {
    return badRequest("Session quote has expired.");
  }

  if (typeof repositories.peerSessions?.findByRequestId === "function") {
    const existingSession = await repositories.peerSessions.findByRequestId(request.id);
    if (existingSession && (existingSession.status === "active" || existingSession.sessionStatus === "active")) {
      return badRequest("A session has already been activated for this request.");
    }
  }

  // If this quote already has an active unpaid payment order, return it
  if (quote.paymentOrderId) {
    const existingOrder = await repositories.paymentOrders.find(quote.paymentOrderId);
    if (existingOrder && existingOrder.status === "created") {
      return created({ order: existingOrder });
    }
  }

  const receiptId = createId("rec");
  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrder(quote.totalAmountPaise, receiptId);
  } catch (error) {
    return badRequest(error.message);
  }

  const order = {
    id: createId("ord"),
    gateway: "razorpay",
    gatewayOrderId: razorpayOrder.id,
    userId: user.id,
    amountPaise: quote.totalAmountPaise,
    quoteId: quote.id,
    peerSessionRequestId: request.id,
    status: "created",
    createdAt: new Date().toISOString()
  };

  const createdOrder = await repositories.paymentOrders.create(order);
  if (typeof repositories.peerSessionQuotes.updatePaymentOrder === "function") {
    await repositories.peerSessionQuotes.updatePaymentOrder(quote.id, createdOrder.id, razorpayOrder.id);
  }
  return created({ order: createdOrder });
}

export async function verifyRequestPayment({ params, body, user }) {
  const request = await repositories.peerSessionRequests.findById(params.id);
  if (!request) return notFound("Session request not found.");

  if (request.requesterUserId !== user.id) {
    return forbidden("You are not authorized to pay for this request.");
  }

  if (request.requestStatus !== "accepted") {
    return badRequest(`Request status must be 'accepted'. Current status is '${request.requestStatus}'.`);
  }

  const quote = await repositories.peerSessionQuotes.findByRequestId(request.id);
  if (!quote) return notFound("Session quote not found.");

  if (quote.status === "paid") {
    return badRequest("Session quote has already been paid.");
  }

  if (typeof repositories.peerSessions?.findByRequestId === "function") {
    const existingSession = await repositories.peerSessions.findByRequestId(request.id);
    if (existingSession) {
      return badRequest("A session has already been activated for this request.");
    }
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = body || {};
  if (!razorpay_payment_id || !razorpay_signature) {
    return badRequest("Missing payment verification details.");
  }

  const identifier = orderId || razorpay_order_id;
  if (!identifier) {
    return badRequest("Missing payment order identifier.");
  }

  const order = await repositories.paymentOrders.find(identifier);
  if (!order) {
    return badRequest("Payment order not found.");
  }

  if (order.userId !== user.id) {
    return forbidden("You are not authorized to use this payment order.");
  }

  const expectedAmountPaise = Number(quote.totalAmountPaise || quote.grossAmountPaise || 0);
  if (Number(order.amountPaise) !== expectedAmountPaise) {
    return badRequest("Payment order amount does not match session quote amount.");
  }

  // Cross-request & quote binding: verify the payment order was created specifically for this quote and request
  if (order.quoteId && order.quoteId !== quote.id) {
    return badRequest("Payment order is associated with a different session quote.");
  }
  if (order.peerSessionRequestId && order.peerSessionRequestId !== request.id) {
    return badRequest("Payment order is associated with a different session request.");
  }
  if (quote.paymentOrderId && order.id !== quote.paymentOrderId && order.gatewayOrderId !== quote.gatewayOrderId) {
    return badRequest("Payment order does not match the order initiated for this session quote.");
  }

  if (!order.gatewayOrderId) {
    return badRequest("Missing gateway order reference.");
  }

  if (razorpay_order_id && order.gatewayOrderId !== razorpay_order_id) {
    return badRequest("Payment proof does not match this order's gateway order identifier.");
  }

  if (typeof repositories.paymentOrders.findByPaymentId === "function") {
    const existingPayment = await repositories.paymentOrders.findByPaymentId(razorpay_payment_id);
    if (existingPayment && existingPayment.id !== order.id) {
      return badRequest("Payment identifier has already been used for another order.");
    }
  }

  if (order.status !== "created") {
    return badRequest("Payment order is already processed.");
  }

  if (!verifyRazorpaySignature(order.gatewayOrderId, razorpay_payment_id, razorpay_signature)) {
    return badRequest("Invalid payment signature.");
  }

  let gatewayPayment = null;
  try {
    gatewayPayment = await fetchRazorpayPayment(razorpay_payment_id);
  } catch (err) {
    return badRequest(`Failed to verify payment with gateway: ${err.message}`);
  }

  if (gatewayPayment) {
    if (gatewayPayment.order_id && gatewayPayment.order_id !== order.gatewayOrderId) {
      return badRequest("Gateway payment order ID does not match order.");
    }
    if (gatewayPayment.amount && Number(gatewayPayment.amount) !== Number(order.amountPaise)) {
      return badRequest("Gateway payment amount does not match order amount.");
    }
    if (gatewayPayment.currency && gatewayPayment.currency.toUpperCase() !== "INR") {
      return badRequest("Gateway payment currency mismatch.");
    }
    if (gatewayPayment.status && gatewayPayment.status !== "captured") {
      return badRequest(`Gateway payment is not captured (status: ${gatewayPayment.status}).`);
    }
  }

  return await executeTransaction(async () => {
    await repositories.paymentOrders.update(order.id, {
      status: "paid",
      gatewayPaymentId: razorpay_payment_id,
      paidAt: new Date().toISOString()
    });

    if (typeof repositories.peerSessionQuotes.updateStatus === "function") {
      await repositories.peerSessionQuotes.updateStatus(quote.id, "paid");
    }

    await credit(user.id, expectedAmountPaise / 100, "peer_session_topup", {
      referenceType: "payment_order",
      referenceId: order.id,
      gatewayPaymentId: razorpay_payment_id
    });

    const topupJournal = await postJournalTransaction({
      journalType: "WALLET_TOPUP",
      businessReferenceType: "payment_order",
      businessReferenceId: order.id,
      idempotencyKey: `topup_${order.id}`,
      description: `Wallet top-up via Razorpay payment ${razorpay_payment_id} for peer session request ${request.id}`,
      entries: [
        { accountKey: "GATEWAY_RECEIVABLE", entrySide: "debit", amountPaise: expectedAmountPaise },
        { accountKey: `USER_AVAILABLE_${user.id}`, entrySide: "credit", amountPaise: expectedAmountPaise }
      ]
    });
    if (topupJournal && repositories.journalTransactions?.create) {
      await repositories.journalTransactions.create(topupJournal);
    }

    await debit(user.id, expectedAmountPaise / 100, "peer_session_payment", {
      referenceType: "PeerSessionRequest",
      referenceId: request.id
    });

    const sessionId = createId("pss");
    const startedAt = new Date().toISOString();
    const duration = request.requestedDurationMinutes || quote.durationMinutes || 15;
    const expiresAt = new Date(Date.now() + duration * 60 * 1000).toISOString();

    const session = await repositories.peerSessions.create({
      id: sessionId,
      requestId: request.id,
      peerSessionRequestId: request.id,
      quoteId: quote.id,
      requesterUserId: request.requesterUserId,
      listenerProfileId: request.listenerProfileId,
      sessionDurationMinutes: duration,
      status: "active",
      sessionStatus: "active",
      paymentState: "escrowed",
      settlementState: "unsettled",
      startedAt,
      sessionStartedAt: startedAt,
      expiresAt
    });

    await repositories.peerSessionRequests.update(request.id, { requestStatus: "completed" });

    const escrowJournal = await postJournalTransaction({
      journalType: "PEER_SESSION_RESERVE",
      businessReferenceType: "PeerSession",
      businessReferenceId: sessionId,
      idempotencyKey: `reserve_${sessionId}`,
      description: `Peer session ${sessionId} payment escrow hold`,
      entries: [
        { accountKey: `USER_AVAILABLE_${user.id}`, entrySide: "debit", amountPaise: quote.totalAmountPaise },
        { accountKey: "PLATFORM_ESCROW", entrySide: "credit", amountPaise: quote.totalAmountPaise }
      ]
    });
    if (escrowJournal && repositories.journalTransactions?.create) {
      await repositories.journalTransactions.create(escrowJournal);
    }

    return ok({ verified: true, session });
  });
}

export async function grantSessionConsent({ params, body, user }) {
  const missing = requireFields(body, ["capability", "status"]);
  if (missing) return badRequest("Missing required consent fields.", missing);

  if (!["voice", "video", "file_sharing"].includes(body.capability)) {
    return badRequest("Invalid capability. Must be 'voice', 'video', or 'file_sharing'.");
  }
  if (!["granted", "denied", "revoked"].includes(body.status)) {
    return badRequest("Invalid status. Must be 'granted', 'denied', or 'revoked'.");
  }

  const session = await repositories.peerSessions.findById(params.id);
  if (!session) return notFound("Peer Session not found.");

  const auth = await authorizePeerSessionParticipant(session, user);
  if (!auth.authorized) {
    return forbidden(auth.error);
  }

  const consent = await repositories.peerSessionConsents.createOrUpdate({
    peerSessionId: session.id,
    userId: user.id,
    capability: body.capability,
    consentStatus: body.status,
    policyVersion: "v1.0"
  });

  try {
    const io = getIO();
    const targetUserId = user.id === session.requesterUserId 
      ? auth.listenerUserId 
      : session.requesterUserId;
    
    if (targetUserId) {
      io.to(targetUserId).emit("peer_consent_updated", {
        sessionId: session.id,
        userId: user.id,
        capability: body.capability,
        status: body.status
      });
    }
  } catch (err) {
    console.error("[Socket] Failed to emit peer_consent_updated event:", err.message);
  }

  return ok(consent);
}

export async function getSessionConsents({ params, user }) {
  const session = await repositories.peerSessions.findById(params.id);
  if (!session) return notFound("Peer Session not found.");

  const auth = await authorizePeerSessionParticipant(session, user);
  if (!auth.authorized) {
    return forbidden(auth.error);
  }

  const consents = await repositories.peerSessionConsents.findBySessionId(session.id);
  return ok(consents);
}

export async function generatePeerRtcToken({ params, user }) {
  const session = await repositories.peerSessions.findById(params.id);
  if (!session) return notFound("Peer Session not found.");

  const auth = await authorizePeerSessionParticipant(session, user);
  if (!auth.authorized) {
    return forbidden(auth.error);
  }

  const sessionStart = session.startedAt || session.sessionStartedAt || session.createdAt;
  const timeElapsedSeconds = sessionStart ? (Date.now() - new Date(sessionStart).getTime()) / 1000 : 0;
  if (timeElapsedSeconds < 300) {
    return forbidden(`Voice/Video features are locked during the first 5 minutes of the session. ${Math.round(300 - timeElapsedSeconds)} seconds remaining.`);
  }

  const consents = await repositories.peerSessionConsents.findBySessionId(session.id);
  const listenerUserId = auth.listenerUserId;

  const requesterConsent = consents.find(c => c.userId === session.requesterUserId && c.capability === "voice" && c.consentStatus === "granted");
  const listenerConsent = consents.find(c => c.userId === listenerUserId && c.capability === "voice" && c.consentStatus === "granted");

  if (!requesterConsent || !listenerConsent) {
    return forbidden("Both users must explicitly grant mutual consent before voice/video transmission can start.");
  }

  const rtcData = rtcService.generateToken(session.id, user.id);
  return ok(rtcData);
}

export async function endPeerSession({ params, user }) {
  const session = await repositories.peerSessions.findById(params.id);
  if (!session) return notFound("Peer Session not found.");

  if (session.sessionStatus !== "active" && session.sessionStatus !== "paused") {
    return badRequest(`Session cannot be ended from status '${session.sessionStatus}'.`);
  }

  const auth = await authorizePeerSessionParticipant(session, user);
  if (!auth.authorized) {
    return forbidden(auth.error);
  }

  const listenerUserId = auth.listenerUserId;

  return await executeTransaction(async () => {
    const endedAt = new Date().toISOString();
    const updated = await repositories.peerSessions.update(session.id, {
      sessionStatus: "completed",
      endedAt
    });

    const request = await repositories.peerSessionRequests.findById(session.peerSessionRequestId);
    const quote = await repositories.peerSessionQuotes.findByRequestId(request.id);
    
    const grossInr = quote.totalAmountPaise / 100;
    const { commissionAmountPaise, counsellorEarningPaise } = calculateCommission(grossInr);

    await credit(listenerUserId, counsellorEarningPaise / 100, "peer_session_earning", {
      referenceType: "PeerSession",
      referenceId: session.id
    });

    const settleJournal = await postJournalTransaction({
      journalType: "PEER_SESSION_SETTLE",
      businessReferenceType: "PeerSession",
      businessReferenceId: session.id,
      idempotencyKey: `settle_${session.id}`,
      description: `Settle peer session ${session.id} payout split`,
      entries: [
        { accountKey: "PLATFORM_ESCROW", entrySide: "debit", amountPaise: quote.totalAmountPaise },
        { accountKey: `USER_AVAILABLE_${listenerUserId}`, entrySide: "credit", amountPaise: counsellorEarningPaise },
        { accountKey: "PLATFORM_REVENUE", entrySide: "credit", amountPaise: commissionAmountPaise }
      ]
    });
    await repositories.journalTransactions.create(settleJournal);

    try {
      const io = getIO();
      io.to(`session_${session.id}`).emit("peer_session_ended", {
        sessionId: session.id,
        endedAt
      });
    } catch (err) {
      console.error("[Socket] Failed to emit peer_session_ended event:", err.message);
    }

    return ok(updated);
  });
}

export async function blockPeerUser({ params, body, user }) {
  const targetUserId = params.id;
  if (targetUserId === user.id) {
    return badRequest("You cannot block yourself.");
  }

  const blocked = await repositories.peerBlocks.create({
    id: createId("blk"),
    blockerUserId: user.id,
    blockedUserId: targetUserId,
    reason: body.reason || null
  });

  return ok({ success: true, blocked });
}

export async function reportPeerUser({ params, body, user }) {
  const missing = requireFields(body, ["category", "description"]);
  if (missing) return badRequest("Missing required report fields.", missing);

  const targetUserId = params.id;
  if (targetUserId === user.id) {
    return badRequest("You cannot report yourself.");
  }

  const report = await repositories.peerReports.create({
    id: createId("rep"),
    reporterUserId: user.id,
    reportedUserId: targetUserId,
    peerSessionId: body.peerSessionId || null,
    category: body.category,
    description: body.description,
    evidenceMediaKeys: body.evidenceMediaKeys || [],
    status: "open"
  });

  return created(report);
}

export async function submitPeerFeedback({ params, body, user }) {
  const missing = requireFields(body, ["rating", "listeningQuality", "comfort"]);
  if (missing) return badRequest("Missing required feedback fields.", missing);

  const session = await repositories.peerSessions.findById(params.id);
  if (!session) return notFound("Peer Session not found.");

  const auth = await authorizePeerSessionParticipant(session, user);
  if (!auth.authorized) {
    return forbidden(auth.error);
  }

  const targetUserId = user.id === session.requesterUserId 
    ? auth.listenerUserId
    : session.requesterUserId;

  const feedback = await repositories.peerFeedback.create({
    id: createId("fdb"),
    peerSessionId: session.id,
    userId: user.id,
    targetUserId,
    rating: Number(body.rating),
    listeningQuality: Number(body.listeningQuality),
    comfort: Number(body.comfort),
    respectfulness: Number(body.respectfulness || 5),
    reliability: Number(body.reliability || 5),
    wouldTalkAgain: body.wouldTalkAgain !== false,
    reviewText: body.reviewText || "",
    moderationStatus: "pending",
    isSafetyReport: body.isSafetyReport === true,
    safetyReportCategory: body.safetyReportCategory || null
  });

  return created(feedback);
}

export async function getPeerSession({ params, user }) {
  const session = await repositories.peerSessions.findById(params.id);
  if (!session) return notFound("Peer Session not found.");

  const auth = await authorizePeerSessionParticipant(session, user);
  if (!auth.authorized) {
    return forbidden(auth.error);
  }

  return ok(session);
}

export async function listPeerSessions({ user }) {
  const sessions = await repositories.peerSessions.listForUser(user);
  return ok(sessions);
}

export async function autoCleanExpiredPeerRequests() {
  try {
    const driver = process.env.REPOSITORY_DRIVER || "memory";
    if (driver === "postgres") {
      const { query } = await import("../data/db.js");
      const expiredRes = await query(
        `UPDATE peer_session_requests 
         SET request_status = 'expired', updated_at = NOW() 
         WHERE request_status IN ('pending', 'accepted') 
           AND request_expires_at < NOW() 
         RETURNING *`
      );
      if (expiredRes.rows.length) {
        console.log(`[Cleaner] Expired ${expiredRes.rows.length} peer session requests`);
      }
    } else {
      const { store } = await import("../data/store.js");
      const now = new Date();
      let count = 0;
      (store.peerSessionRequests || []).forEach(r => {
        if (["pending", "accepted"].includes(r.requestStatus) && new Date(r.expiresAt) < now) {
          r.requestStatus = "expired";
          r.updatedAt = now.toISOString();
          count++;
        }
      });
      if (count > 0) {
        console.log(`[Cleaner] Expired ${count} memory peer session requests`);
      }
    }
  } catch (err) {
    console.error("[Cleaner] Failed to clean expired peer requests:", err.message);
  }
}

// Helper to assign age bands
function getAgeBand(age) {
  if (age >= 18 && age <= 20) return "18-20";
  if (age >= 21 && age <= 24) return "21-24";
  if (age >= 25 && age <= 29) return "25-29";
  if (age >= 30 && age <= 34) return "30-34";
  if (age >= 35 && age <= 39) return "35-39";
  if (age >= 40 && age <= 49) return "40-49";
  return "50+";
}

export async function getDashboardState({ user }) {
  try {
    checkFeatureEnabled();
  } catch (err) {
    return forbidden(err.message);
  }

  const disclaimerRecord = await repositories.peerPolicyAcceptances.findLatest(user.id, "marketplace_disclaimer");
  const disclaimerAccepted = !!disclaimerRecord;

  const profile = await repositories.peerListenerProfiles.findByUserId(user.id);
  let listenerProfile = null;
  if (profile) {
    const rates = await repositories.peerListenerRates.findByProfileId(profile.id);
    const presence = await repositories.peerListenerPresence.findByProfileId(profile.id);
    const verification = await repositories.peerListenerVerifications.findByProfileId(profile.id);
    listenerProfile = {
      ...profile,
      rates,
      presence,
      verification
    };
  }

  const allSessions = await repositories.peerSessions.listForUser(user);
  const activeSession = allSessions.find(s => 
    ["requested", "text_only", "voice_video", "active"].includes(s.status)
  ) || null;

  const outgoingRequests = await repositories.peerSessionRequests.listForUser(user.id);
  let activeRequest = outgoingRequests.find(r => 
    ["pending", "accepted"].includes(r.requestStatus)
  ) || null;

  if (!activeRequest && profile) {
    const incomingRequests = await repositories.peerSessionRequests.listForListener(profile.id);
    activeRequest = incomingRequests.find(r => 
      ["pending"].includes(r.requestStatus)
    ) || null;
  }

  const wallet = await repositories.wallets.findByOwner(user.id);
  const walletBalance = wallet ? Math.round((wallet.balancePaise || 0) / 100) : 0;

  return ok({
    disclaimerAccepted,
    listenerProfile,
    activeSession,
    activeRequest,
    walletBalance
  });
}
