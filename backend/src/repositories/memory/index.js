import { store } from "../../data/store.js";
import { createId } from "../../utils/security.js";

export const memoryRepositories = {
  transactions: {
    async withTransaction(callback) {
      return await callback();
    }
  },

  users: {
    list() {
      return store.users.map((u) => ({
        ...u,
        onboardingStatus: u.onboardingStatus || u.onboarding_status || 'COMPLETED',
        onboarding_status: u.onboardingStatus || u.onboarding_status || 'COMPLETED'
      }));
    },
    findById(id) {
      const user = store.users.find((u) => u.id === id);
      if (!user) return null;
      if (!user.onboardingStatus && !user.onboarding_status) {
        user.onboardingStatus = 'COMPLETED';
        user.onboarding_status = 'COMPLETED';
      }
      return user;
    },
    findByEmailAndRole(email, role) {
      const user = store.users.find((u) => u.email === email && u.role === role);
      if (!user) return null;
      if (!user.onboardingStatus && !user.onboarding_status) {
        user.onboardingStatus = 'COMPLETED';
        user.onboarding_status = 'COMPLETED';
      }
      return user;
    },
    findByMobileAndRole(mobile, role) {
      const user = store.users.find((u) => u.mobile === mobile && u.role === role);
      if (!user) return null;
      if (!user.onboardingStatus && !user.onboarding_status) {
        user.onboardingStatus = 'COMPLETED';
        user.onboarding_status = 'COMPLETED';
      }
      return user;
    },
    create(user) {
      const mapped = {
        ...user,
        firebaseUid: user.firebaseUid || user.firebase_uid || null,
        firebase_uid: user.firebaseUid || user.firebase_uid || null,
        dateOfBirth: user.dateOfBirth || user.date_of_birth || null,
        date_of_birth: user.dateOfBirth || user.date_of_birth || null,
        profileCompletedAt: user.profileCompletedAt || user.profile_completed_at || null,
        profile_completed_at: user.profileCompletedAt || user.profile_completed_at || null,
        onboardingStatus: user.onboardingStatus || user.onboarding_status || 'COMPLETED',
        onboarding_status: user.onboardingStatus || user.onboarding_status || 'COMPLETED',
        emailVerifiedAt: user.emailVerifiedAt || user.email_verified_at || null,
        email_verified_at: user.emailVerifiedAt || user.email_verified_at || null,
        guardianConsentStatus: user.guardianConsentStatus || user.guardian_consent_status || 'APPROVED',
        guardian_consent_status: user.guardianConsentStatus || user.guardian_consent_status || 'APPROVED',
        totpSecret: user.totpSecret || user.totp_secret || null,
        totp_secret: user.totpSecret || user.totp_secret || null,
        isTotpEnabled: Boolean(user.isTotpEnabled || user.is_totp_enabled),
        is_totp_enabled: Boolean(user.isTotpEnabled || user.is_totp_enabled)
      };
      store.users.push(mapped);
      return mapped;
    },
    update(id, patch) {
      const user = this.findById(id);
      if (user) {
        Object.assign(user, patch, {
          firebaseUid: patch.firebaseUid !== undefined ? patch.firebaseUid : (patch.firebase_uid !== undefined ? patch.firebase_uid : user.firebaseUid),
          firebase_uid: patch.firebaseUid !== undefined ? patch.firebaseUid : (patch.firebase_uid !== undefined ? patch.firebase_uid : user.firebaseUid),
          dateOfBirth: patch.dateOfBirth !== undefined ? patch.dateOfBirth : (patch.date_of_birth !== undefined ? patch.date_of_birth : user.dateOfBirth),
          date_of_birth: patch.dateOfBirth !== undefined ? patch.dateOfBirth : (patch.date_of_birth !== undefined ? patch.date_of_birth : user.dateOfBirth),
          profileCompletedAt: patch.profileCompletedAt !== undefined ? patch.profileCompletedAt : (patch.profile_completed_at !== undefined ? patch.profile_completed_at : user.profileCompletedAt),
          profile_completed_at: patch.profileCompletedAt !== undefined ? patch.profileCompletedAt : (patch.profile_completed_at !== undefined ? patch.profile_completed_at : user.profileCompletedAt),
          onboardingStatus: patch.onboardingStatus !== undefined ? patch.onboardingStatus : (patch.onboarding_status !== undefined ? patch.onboarding_status : user.onboardingStatus),
          onboarding_status: patch.onboardingStatus !== undefined ? patch.onboardingStatus : (patch.onboarding_status !== undefined ? patch.onboarding_status : user.onboardingStatus),
          emailVerifiedAt: patch.emailVerifiedAt !== undefined ? patch.emailVerifiedAt : (patch.email_verified_at !== undefined ? patch.email_verified_at : user.emailVerifiedAt),
          email_verified_at: patch.emailVerifiedAt !== undefined ? patch.emailVerifiedAt : (patch.email_verified_at !== undefined ? patch.email_verified_at : user.emailVerifiedAt),
          guardianConsentStatus: patch.guardianConsentStatus !== undefined ? patch.guardianConsentStatus : (patch.guardian_consent_status !== undefined ? patch.guardian_consent_status : user.guardianConsentStatus),
          guardian_consent_status: patch.guardianConsentStatus !== undefined ? patch.guardian_consent_status : (patch.guardian_consent_status !== undefined ? patch.guardian_consent_status : user.guardianConsentStatus),
          totpSecret: patch.totpSecret !== undefined ? patch.totpSecret : (patch.totp_secret !== undefined ? patch.totp_secret : user.totpSecret),
          totp_secret: patch.totpSecret !== undefined ? patch.totpSecret : (patch.totp_secret !== undefined ? patch.totp_secret : user.totpSecret),
          isTotpEnabled: patch.isTotpEnabled !== undefined ? Boolean(patch.isTotpEnabled) : (patch.is_totp_enabled !== undefined ? Boolean(patch.is_totp_enabled) : Boolean(user.isTotpEnabled)),
          is_totp_enabled: patch.isTotpEnabled !== undefined ? Boolean(patch.isTotpEnabled) : (patch.is_totp_enabled !== undefined ? Boolean(patch.is_totp_enabled) : Boolean(user.isTotpEnabled)),
          updatedAt: new Date().toISOString()
        });
      }
      return user;
    }
  },

  counsellors: {
    listApproved({ specialty, language } = {}) {
      return store.counsellors.filter((item) => {
        const matchesSpecialty = !specialty || item.specializations.some((value) => value.toLowerCase().includes(specialty.toLowerCase()));
        const matchesLanguage = !language || item.languagesSpoken.includes(language);
        return item.verificationStatus === "approved" && matchesSpecialty && matchesLanguage;
      });
    },
    listAll() {
      return store.counsellors;
    },
    findById(id) {
      return store.counsellors.find((item) => item.id === id) || null;
    },
    findByUserId(userId) {
      return store.counsellors.find((item) => item.userId === userId) || null;
    },
    mapListings() {
      return store.counsellors.filter((item) => item.showOnMap && item.verificationStatus === "approved");
    },
    updateStatus(id, status) {
      const counsellor = this.findById(id);
      if (counsellor) counsellor.status = status;
      return counsellor || null;
    },
    updateStatusForUser(userId, status) {
      const counsellor = this.findByUserId(userId);
      if (counsellor) counsellor.status = status;
      return counsellor || null;
    },
    create(counsellor) {
      const record = {
        id: counsellor.id || createId("cns"),
        userId: counsellor.userId,
        accountType: counsellor.accountType || "individual",
        displayName: counsellor.displayName || counsellor.fullName || "Counsellor",
        title: counsellor.title || null,
        bio: counsellor.bio || null,
        specializations: Array.isArray(counsellor.specializations) ? counsellor.specializations : [],
        languagesSpoken: Array.isArray(counsellor.languagesSpoken) ? counsellor.languagesSpoken : ["en"],
        experienceYears: Number(counsellor.experienceYears || 0),
        licenseNumber: counsellor.licenseNumber || null,
        hasPrescriptionAuth: Boolean(counsellor.hasPrescriptionAuth),
        hourlyRateInr: Number(counsellor.hourlyRateInr || 0),
        perMinuteRateInr: counsellor.perMinuteRateInr ? Number(counsellor.perMinuteRateInr) : null,
        chatEnabled: counsellor.chatEnabled ?? true,
        audioEnabled: counsellor.audioEnabled ?? false,
        videoEnabled: counsellor.videoEnabled ?? false,
        showOnMap: counsellor.showOnMap ?? false,
        verificationStatus: counsellor.verificationStatus || "pending",
        status: counsellor.status || "offline",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      store.counsellors.push(record);
      return record;
    },
    update(id, patch) {
      const counsellor = this.findById(id);
      if (!counsellor) return null;
      Object.assign(counsellor, patch, { updatedAt: new Date().toISOString() });
      return counsellor;
    }
  },

  counsellorApplications: {
    list() {
      return store.counsellorApplications;
    },
    create(application) {
      store.counsellorApplications.push(application);
      return application;
    },
    updateVerification(id, action, reason = "") {
      const application = store.counsellorApplications.find((item) => item.id === id);
      if (application) {
        application.status = action === "approve" ? "approved" : "rejected";
        application.reviewReason = reason;
      }
      return application || null;
    }
  },

  moodLogs: {
    create(mood) {
      store.moodLogs ||= [];
      store.moodLogs.push(mood);
      return mood;
    },
    listByUser(userId) {
      return (store.moodLogs || []).filter((item) => item.userId === userId);
    }
  },

  sessions: {
    create(session) {
      store.sessions.push(session);
      return session;
    },
    listForUser(user) {
      if (user.role === "admin") return store.sessions;
      if (user.role === "counsellor") return store.sessions.filter((item) => item.counsellorUserId === user.id);
      return store.sessions.filter((item) => item.userId === user.id);
    },
    findById(id) {
      return store.sessions.find((item) => item.id === id) || null;
    },
    update(id, patch) {
      const session = this.findById(id);
      if (session) Object.assign(session, patch, { updatedAt: new Date().toISOString() });
      return session;
    }
  },

  availabilitySlots: {
    listForCounsellor(counsellorId) {
      return (store.availabilitySlots || [])
        .filter((slot) => slot.counsellorId === counsellorId)
        .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
    },
    replaceForCounsellor(counsellorId, slots = []) {
      store.availabilitySlots ||= [];
      store.availabilitySlots = store.availabilitySlots.filter((slot) => slot.counsellorId !== counsellorId || slot.isBooked);
      const now = new Date().toISOString();
      const nextSlots = slots.map((slot) => ({
        id: slot.id || createId("slot"),
        counsellorId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        sessionType: slot.sessionType || "video",
        isBooked: Boolean(slot.isBooked),
        createdAt: slot.createdAt || now
      }));
      store.availabilitySlots.push(...nextSlots);
      return this.listForCounsellor(counsellorId);
    },
    claimForBooking({ counsellorId, scheduledAt, sessionType }) {
      const date = scheduledAt.toISOString().slice(0, 10);
      const startTime = scheduledAt.toISOString().slice(11, 16);
      const slot = (store.availabilitySlots || []).find((item) =>
        item.counsellorId === counsellorId &&
        item.date === date &&
        item.startTime === startTime &&
        item.sessionType === sessionType &&
        !item.isBooked
      );
      if (!slot) return null;
      Object.assign(slot, { isBooked: true, updatedAt: new Date().toISOString() });
      return slot;
    },
    releaseBooking(id) {
      const slot = (store.availabilitySlots || []).find((item) => item.id === id);
      if (!slot) return null;
      Object.assign(slot, { isBooked: false, updatedAt: new Date().toISOString() });
      return slot;
    },
    create(slot) {
      store.availabilitySlots ||= [];
      const record = {
        id: slot.id || createId("slot"),
        counsellorId: slot.counsellorId,
        date: slot.slotDate || slot.date,
        slotDate: slot.slotDate || slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        sessionType: slot.sessionType || "video",
        isBooked: Boolean(slot.isBooked),
        createdAt: slot.createdAt || new Date().toISOString()
      };
      store.availabilitySlots.push(record);
      return record;
    },
    findById(id) {
      return (store.availabilitySlots || []).find((item) => item.id === id) || null;
    }
  },

  reports: {
    create(report) {
      store.analysisReports.push(report);
      return report;
    },
    listForUser(user) {
      return store.analysisReports.filter((item) => item.userId === user.id || user.role === "admin");
    },
    findById(id) {
      return store.analysisReports.find((item) => item.id === id) || null;
    },
    update(id, patch) {
      const report = this.findById(id);
      if (report) Object.assign(report, patch);
      return report;
    }
  },

  contacts: {
    create(contact) {
      store.contacts.push(contact);
      return contact;
    },
    list({ status } = {}) {
      return [...store.contacts]
        .filter((contact) => !status || contact.status === status)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    },
    updateStatus(id, status) {
      const contact = store.contacts.find((item) => item.id === id);
      if (contact) Object.assign(contact, { status, updatedAt: new Date().toISOString() });
      return contact || null;
    }
  },

  wallets: {
    findByOwner(ownerId) {
      return store.wallets.find((item) => item.ownerId === ownerId) || null;
    },
    createForOwner(ownerType, ownerId) {
      const wallet = { id: createId("wal"), ownerType, ownerId, currency: "INR" };
      store.wallets.push(wallet);
      return wallet;
    },
    ledgerEntries(walletId) {
      return store.ledgerEntries.filter((entry) => entry.walletId === walletId);
    },
    createLedgerEntry(entry) {
      store.ledgerEntries ||= [];
      if (entry.idempotencyKey) {
        const existing = store.ledgerEntries.find((e) => e.idempotencyKey === entry.idempotencyKey);
        if (existing) {
          const err = new Error("Unique constraint violation on idempotency_key");
          err.code = "23505";
          throw err;
        }
      }
      if (entry.referenceType === "payment_order" && entry.referenceId) {
        const existing = store.ledgerEntries.find((e) => e.referenceType === "payment_order" && e.referenceId === entry.referenceId);
        if (existing) {
          const err = new Error("Unique constraint violation on payment_order reference");
          err.code = "23505";
          throw err;
        }
      }
      store.ledgerEntries.push(entry);
      return entry;
    },
    allLedgerEntries() {
      return store.ledgerEntries;
    }
  },

  paymentOrders: {
    create(order) {
      store.paymentOrders ||= [];
      store.paymentOrders.push(order);
      return order;
    },
    find(idOrGatewayOrderId) {
      return (store.paymentOrders || []).find((order) => order.id === idOrGatewayOrderId || order.gatewayOrderId === idOrGatewayOrderId) || null;
    },
    findForUpdate(idOrGatewayOrderId) {
      return this.find(idOrGatewayOrderId);
    },
    findByPaymentId(gatewayPaymentId) {
      if (!gatewayPaymentId) return null;
      return (store.paymentOrders || []).find((order) => order.gatewayPaymentId === gatewayPaymentId) || null;
    },
    update(id, patch) {
      const order = this.find(id);
      if (order) Object.assign(order, patch, { updatedAt: new Date().toISOString() });
      return order;
    }
  },

  apiConfigurations: {
    list() {
      return store.apiConfigurations;
    },
    find(serviceNameOrId) {
      const lookupKey = normalizeConfigKey(serviceNameOrId);
      return store.apiConfigurations.find((item) => {
        const aliases = item.aliases || [];
        return item.id === serviceNameOrId ||
          normalizeConfigKey(item.serviceName) === lookupKey ||
          aliases.some((alias) => normalizeConfigKey(alias) === lookupKey);
      }) || null;
    },
    upsert(serviceName, patch) {
      let config = this.find(serviceName);
      if (!config) {
        config = { id: `cfg_${Date.now()}`, serviceName, isActive: false };
        store.apiConfigurations.push(config);
      }
      Object.assign(config, patch, { updatedAt: new Date().toISOString() });
      return config;
    }
  },

  aiServices: {
    list() {
      return store.aiServices || [];
    },
    findByKey(serviceKey) {
      return (store.aiServices || []).find((s) => s.serviceKey === serviceKey || s.id === serviceKey) || null;
    },
    upsert(serviceKey, patch) {
      store.aiServices ||= [];
      let item = this.findByKey(serviceKey);
      if (!item) {
        item = { id: `srv_${Date.now()}`, serviceKey, displayName: serviceKey, enabled: true, minimumAge: 18 };
        store.aiServices.push(item);
      }
      Object.assign(item, patch, { updatedAt: new Date().toISOString() });
      return item;
    }
  },

  aiInstructionFiles: {
    list(serviceId) {
      store.aiInstructionFiles ||= [];
      return serviceId ? store.aiInstructionFiles.filter((f) => f.serviceId === serviceId) : store.aiInstructionFiles;
    },
    create(file) {
      store.aiInstructionFiles ||= [];
      store.aiInstructionFiles.push(file);
      return file;
    },
    delete(id) {
      store.aiInstructionFiles ||= [];
      const idx = store.aiInstructionFiles.findIndex((f) => f.id === id);
      if (idx !== -1) store.aiInstructionFiles.splice(idx, 1);
      return true;
    }
  },

  aiInstructionBundles: {
    list(serviceId) {
      store.aiInstructionBundles ||= [];
      return serviceId ? store.aiInstructionBundles.filter((b) => b.serviceId === serviceId) : store.aiInstructionBundles;
    },
    findActive(serviceId) {
      store.aiInstructionBundles ||= [];
      return store.aiInstructionBundles.find((b) => b.serviceId === serviceId && b.status === "active") || null;
    },
    create(bundle) {
      store.aiInstructionBundles ||= [];
      store.aiInstructionBundles.push(bundle);
      return bundle;
    },
    activate(id) {
      store.aiInstructionBundles ||= [];
      const target = store.aiInstructionBundles.find((b) => b.id === id);
      if (!target) return null;
      store.aiInstructionBundles.forEach((b) => {
        if (b.serviceId === target.serviceId && b.status === "active") b.status = "archived";
      });
      target.status = "active";
      target.activatedAt = new Date().toISOString();
      return target;
    }
  },

  servicesCatalog: {
    list() {
      if (!store.servicesCatalog.find(s => s.id === 'svc_express_half_hour')) {
        store.servicesCatalog.push(
          { id: 'svc_express_half_hour', name: 'Express Yourself (Half Hour)', isActive: true, isFree: false, priceInr: 200, category: 'Community' },
          { id: 'svc_express_hourly', name: 'Express Yourself (Hourly)', isActive: true, isFree: false, priceInr: 400, category: 'Community' }
        );
      }
      return store.servicesCatalog;
    },
    update(id, patch) {
      const service = store.servicesCatalog.find((item) => item.id === id);
      if (service) Object.assign(service, patch, { updatedAt: new Date().toISOString() });
      return service || null;
    }
  },

  auditLogs: {
    create(entry) {
      const auditEntry = {
        id: entry.id || createId("aud"),
        createdAt: entry.createdAt || new Date().toISOString(),
        ...entry
      };
      store.auditLogs.push(auditEntry);
      return auditEntry;
    },
    list(limit = 50, offset = 0) {
      return [...store.auditLogs]
        .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0))
        .slice(offset, offset + limit);
    }
  },

  crisisEvents: {
    create(entry) {
      store.crisisEvents ||= [];
      const event = {
        id: entry.id || createId("cri"),
        createdAt: entry.createdAt || new Date().toISOString(),
        ...entry
      };
      store.crisisEvents.push(event);
      return event;
    },
    list(limit = 50, offset = 0) {
      return [...(store.crisisEvents || [])]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(offset, offset + limit);
    }
  },

  notifications: {
    create(payload) {
      store.notifications ||= [];
      const notification = {
        id: createId("ntf"),
        userId: payload.userId,
        role: payload.role,
        title: payload.title,
        message: payload.message,
        type: payload.type || "info",
        read: false,
        createdAt: new Date().toISOString()
      };
      store.notifications.push(notification);
      return notification;
    },
    listForUser(userId) {
      return (store.notifications || [])
        .filter((item) => item.userId === userId)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 50);
    },
    markAsRead(id, userId) {
      const notification = (store.notifications || []).find((item) => item.id === id && item.userId === userId);
      if (notification) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
      }
      return notification || null;
    }
  },

  ledgerAccounts: {
    async findByKey(accountKey) {
      store.ledgerAccounts ||= [];
      return store.ledgerAccounts.find(a => a.accountKey === accountKey) || null;
    },
    async findOrCreate(account) {
      store.ledgerAccounts ||= [];
      let existing = await this.findByKey(account.accountKey);
      if (existing) return existing;
      const acc = { id: account.id || createId("lac"), ...account, status: account.status || "active", createdAt: new Date().toISOString() };
      store.ledgerAccounts.push(acc);
      return acc;
    }
  },

  journalTransactions: {
    async list() {
      return store.journalTransactions || [];
    },
    async findByBusinessReference(businessReferenceType, businessReferenceId) {
      return (store.journalTransactions || []).filter(
        (j) => j.businessReferenceType === businessReferenceType && j.businessReferenceId === businessReferenceId
      );
    },
    async create(journal) {
      store.journalTransactions ||= [];
      store.doubleEntryLedger ||= [];
      const j = { id: journal.id || createId("jnl"), ...journal, createdAt: new Date().toISOString() };
      store.journalTransactions.push(j);
      if (journal.entries) {
        for (const entry of journal.entries) {
          const account = await memoryRepositories.ledgerAccounts.findOrCreate({
            accountKey: entry.accountKey,
            ownerType: "user",
            ownerId: entry.accountKey.split("_").pop(),
            accountType: "ASSET"
          });
          store.doubleEntryLedger.push({
            id: entry.id || createId("ent"),
            journalTransactionId: j.id,
            ledgerAccountId: account.id,
            entrySide: entry.entrySide,
            amountPaise: entry.amountPaise,
            sequenceNumber: entry.sequenceNumber || 1,
            createdAt: new Date().toISOString()
          });
        }
      }
      return j;
    }
  },

  peerListenerProfiles: {
    async findById(id) {
      store.peerListenerProfiles ||= [];
      return store.peerListenerProfiles.find(p => p.id === id) || null;
    },
    async findByUserId(userId) {
      store.peerListenerProfiles ||= [];
      return store.peerListenerProfiles.find(p => p.userId === userId) || null;
    },
    async create(profile) {
      store.peerListenerProfiles ||= [];
      store.peerListenerProfiles.push(profile);
      return profile;
    },
    async update(id, patch) {
      const profile = await this.findById(id);
      if (profile) Object.assign(profile, patch, { updatedAt: new Date().toISOString() });
      return profile;
    },
    async list({ status, verificationStatus } = {}) {
      store.peerListenerProfiles ||= [];
      return store.peerListenerProfiles.filter(p => {
        if (verificationStatus && p.verificationStatus !== verificationStatus) return false;
        return true;
      });
    },
    async listAll() {
      store.peerListenerProfiles ||= [];
      return [...store.peerListenerProfiles];
    }
  },

  peerListenerVerifications: {
    async findByProfileId(profileId) {
      store.peerListenerVerifications ||= [];
      return store.peerListenerVerifications.find(v => v.listenerProfileId === profileId) || null;
    },
    async create(verif) {
      store.peerListenerVerifications ||= [];
      store.peerListenerVerifications.push(verif);
      return verif;
    },
    async update(id, patch) {
      store.peerListenerVerifications ||= [];
      const verif = store.peerListenerVerifications.find(v => v.id === id);
      if (verif) Object.assign(verif, patch, { updatedAt: new Date().toISOString() });
      return verif;
    }
  },

  peerListenerRates: {
    async findByProfileId(profileId) {
      store.peerListenerRates ||= [];
      return store.peerListenerRates.filter(r => r.listenerProfileId === profileId && r.enabled !== false);
    },
    async createOrUpdate(rate) {
      store.peerListenerRates ||= [];
      let existing = store.peerListenerRates.find(r => r.listenerProfileId === rate.listenerProfileId && r.sessionDurationMinutes === rate.sessionDurationMinutes);
      if (existing) {
        Object.assign(existing, rate, { updatedAt: new Date().toISOString() });
        return existing;
      }
      const r = { id: rate.id || createId("plr"), ...rate, enabled: rate.enabled !== false, createdAt: new Date().toISOString() };
      store.peerListenerRates.push(r);
      return r;
    }
  },

  peerListenerPresence: {
    async findByProfileId(profileId) {
      store.peerListenerPresence ||= [];
      return store.peerListenerPresence.find(p => p.listenerProfileId === profileId) || null;
    },
    async createOrUpdate(presence) {
      store.peerListenerPresence ||= [];
      let existing = store.peerListenerPresence.find(p => p.listenerProfileId === presence.listenerProfileId);
      if (existing) {
        Object.assign(existing, presence, { version: (existing.version || 1) + 1, updatedAt: new Date().toISOString() });
        return existing;
      }
      const p = { ...presence, version: 1, updatedAt: new Date().toISOString() };
      store.peerListenerPresence.push(p);
      return p;
    },
    async reapExpiredHeartbeats(timeoutSeconds = 60) {
      store.peerListenerPresence ||= [];
      const cutoff = Date.now() - timeoutSeconds * 1000;
      const reaped = [];
      store.peerListenerPresence.forEach(p => {
        if (p.currentStatus !== 'offline' && new Date(p.heartbeatAt || 0).getTime() < cutoff) {
          p.currentStatus = 'offline';
          p.socketConnectionId = null;
          p.updatedAt = new Date().toISOString();
          reaped.push(p);
        }
      });
      return reaped;
    }
  },

  peerSessionRequests: {
    async findById(id) {
      store.peerSessionRequests ||= [];
      return store.peerSessionRequests.find(r => r.id === id) || null;
    },
    async create(request) {
      store.peerSessionRequests ||= [];
      store.peerSessionRequests.push(request);
      return request;
    },
    async update(id, patch) {
      const req = await this.findById(id);
      if (req) Object.assign(req, patch, { updatedAt: new Date().toISOString() });
      return req;
    },
    async listForUser(userId) {
      store.peerSessionRequests ||= [];
      return store.peerSessionRequests.filter(r => r.requesterUserId === userId);
    },
    async listForListener(profileId) {
      store.peerSessionRequests ||= [];
      return store.peerSessionRequests.filter(r => r.listenerProfileId === profileId);
    }
  },

  peerSessionQuotes: {
    async findById(id) {
      store.peerSessionQuotes ||= [];
      return store.peerSessionQuotes.find(q => q.id === id) || null;
    },
    async findByRequestId(requestId) {
      store.peerSessionQuotes ||= [];
      return store.peerSessionQuotes.find(q => q.peerSessionRequestId === requestId) || null;
    },
    async create(quote) {
      store.peerSessionQuotes ||= [];
      store.peerSessionQuotes.push(quote);
      return quote;
    },
    async updateStatus(id, status) {
      const q = await this.findById(id);
      if (q) q.status = status;
      return q;
    },
    async updatePaymentOrder(id, paymentOrderId, gatewayOrderId) {
      const q = await this.findById(id);
      if (q) {
        q.paymentOrderId = paymentOrderId;
        q.gatewayOrderId = gatewayOrderId;
      }
      return q;
    }
  },

  peerSessions: {
    async findById(id) {
      store.peerSessions ||= [];
      return store.peerSessions.find(s => s.id === id) || null;
    },
    async findByRequestId(requestId) {
      store.peerSessions ||= [];
      return store.peerSessions.find(s => s.requestId === requestId || s.peerSessionRequestId === requestId) || null;
    },
    async create(session) {
      store.peerSessions ||= [];
      store.peerSessions.push(session);
      return session;
    },
    async update(id, patch) {
      const s = await this.findById(id);
      if (s) Object.assign(s, patch, { updatedAt: new Date().toISOString() });
      return s;
    },
    async listForUser(userOrId) {
      store.peerSessions ||= [];
      const userObj = typeof userOrId === "object" ? userOrId : { id: userOrId };
      if (userObj.role === "admin") return store.peerSessions;
      const profile = (store.peerListenerProfiles || []).find(p => p.userId === userObj.id);
      const profileId = profile?.id;
      return store.peerSessions.filter(s => 
        s.requesterUserId === userObj.id || 
        (profileId && s.listenerProfileId === profileId) || 
        s.listenerProfileId === userObj.id
      );
    }
  },

  peerSessionConsents: {
    async findBySessionId(sessionId) {
      store.peerSessionConsents ||= [];
      return store.peerSessionConsents.filter(c => c.peerSessionId === sessionId);
    },
    async createOrUpdate(consent) {
      store.peerSessionConsents ||= [];
      let existing = store.peerSessionConsents.find(c => c.peerSessionId === consent.peerSessionId && c.userId === consent.userId && c.capability === consent.capability);
      if (existing) {
        Object.assign(existing, consent, { grantedAt: consent.consentStatus === 'granted' ? new Date().toISOString() : existing.grantedAt, revokedAt: consent.consentStatus === 'revoked' ? new Date().toISOString() : existing.revokedAt });
        return existing;
      }
      const c = { id: consent.id || createId("psc"), ...consent, createdAt: new Date().toISOString() };
      store.peerSessionConsents.push(c);
      return c;
    }
  },

  peerSessionEvents: {
    async create(event) {
      store.peerSessionEvents ||= [];
      const ev = { id: event.id || createId("pse"), ...event, createdAt: new Date().toISOString() };
      store.peerSessionEvents.push(ev);
      return ev;
    },
    async listForSession(sessionId) {
      store.peerSessionEvents ||= [];
      return store.peerSessionEvents.filter(e => e.peerSessionId === sessionId).sort((a,b) => a.sequenceNumber - b.sequenceNumber);
    }
  },

  peerFeedback: {
    async create(feedback) {
      store.peerFeedback ||= [];
      const f = { id: feedback.id || createId("pfb"), ...feedback, createdAt: new Date().toISOString() };
      store.peerFeedback.push(f);
      return f;
    },
    async findBySessionAndUser(sessionId, userId) {
      store.peerFeedback ||= [];
      return store.peerFeedback.find(f => f.peerSessionId === sessionId && f.userId === userId) || null;
    }
  },

  peerReports: {
    async create(report) {
      store.peerReports ||= [];
      const r = { id: report.id || createId("prp"), status: "open", ...report, createdAt: new Date().toISOString() };
      store.peerReports.push(r);
      return r;
    },
    async list() {
      store.peerReports ||= [];
      return store.peerReports;
    },
    async updateStatus(id, status, notes, resolvedBy) {
      store.peerReports ||= [];
      const r = store.peerReports.find(x => x.id === id);
      if (r) Object.assign(r, { status, resolutionNotes: notes, resolvedBy, resolvedAt: new Date().toISOString() });
      return r;
    }
  },

  peerBlocks: {
    async create(block) {
      store.peerBlocks ||= [];
      let existing = store.peerBlocks.find(b => b.blockerUserId === block.blockerUserId && b.blockedUserId === block.blockedUserId);
      if (existing) return existing;
      const b = { id: block.id || createId("pbk"), ...block, createdAt: new Date().toISOString() };
      store.peerBlocks.push(b);
      return b;
    },
    async remove(blockerUserId, blockedUserId) {
      store.peerBlocks ||= [];
      store.peerBlocks = store.peerBlocks.filter(b => !(b.blockerUserId === blockerUserId && b.blockedUserId === blockedUserId));
      return true;
    },
    async isBlocked(userA, userB) {
      store.peerBlocks ||= [];
      return store.peerBlocks.some(b => (b.blockerUserId === userA && b.blockedUserId === userB) || (b.blockerUserId === userB && b.blockedUserId === userA));
    }
  },

  peerPolicyAcceptances: {
    async create(acceptance) {
      store.peerPolicyAcceptances ||= [];
      let existing = store.peerPolicyAcceptances.find(a => a.userId === acceptance.userId && a.policyType === acceptance.policyType && a.policyVersion === acceptance.policyVersion);
      if (existing) return existing;
      const a = { id: acceptance.id || createId("ppa"), ...acceptance, acceptedAt: new Date().toISOString() };
      store.peerPolicyAcceptances.push(a);
      return a;
    },
    async findLatest(userId, policyType) {
      store.peerPolicyAcceptances ||= [];
      const userList = store.peerPolicyAcceptances.filter(a => a.userId === userId && a.policyType === policyType);
      return userList.sort((a,b) => new Date(b.acceptedAt) - new Date(a.acceptedAt))[0] || null;
    }
  },

  peerChatMessages: {
    async create(message) {
      store.peerChatMessages ||= [];
      const msg = { id: message.id || createId("msg"), ...message, createdAt: new Date().toISOString() };
      store.peerChatMessages.push(msg);
      return msg;
    },
    async listForSession(sessionId) {
      store.peerChatMessages ||= [];
      return store.peerChatMessages.filter(m => m.peerSessionId === sessionId);
    }
  },

  screenings: {
    async create(screening) {
      store.screenings ||= [];
      const scr = {
        id: screening.id || createId("scr"),
        ...screening,
        status: screening.status || "started",
        createdAt: new Date().toISOString()
      };
      store.screenings.push(scr);
      return scr;
    },
    async update(id, updates) {
      store.screenings ||= [];
      const scr = store.screenings.find(s => s.id === id);
      if (!scr) return null;
      if (updates.status !== undefined) scr.status = updates.status;
      if (updates.score !== undefined) scr.score = updates.score;
      if (updates.responsesJson !== undefined) scr.responsesJson = updates.responsesJson;
      if (updates.completedAt !== undefined) scr.completedAt = updates.completedAt;
      return scr;
    },
    async findById(id) {
      store.screenings ||= [];
      return store.screenings.find(s => s.id === id) || null;
    },
    async findByShareToken(token) {
      store.screenings ||= [];
      if (!token) return null;
      return store.screenings.find(s => {
        const json = s.responsesJson;
        return json && typeof json === "object" && json.shareToken === token;
      }) || null;
    },
    async listForUser(userId) {
      store.screenings ||= [];
      return store.screenings.filter(s => s.userId === userId).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    async delete(id) {
      store.screenings ||= [];
      const idx = store.screenings.findIndex(s => s.id === id);
      if (idx === -1) return false;
      store.screenings.splice(idx, 1);
      return true;
    }
  },

  analytics: {
    summary() {
      return {
        users: store.users.length,
        counsellors: store.counsellors.length,
        pendingApplications: store.counsellorApplications.filter((item) => item.status === "pending").length,
        sessions: store.sessions.length,
        reports: store.analysisReports.length,
        ledgerEntries: store.ledgerEntries.length
      };
    }
  },

  promotionalBanners: {
    async listAll() {
      store.promotionalBanners ||= [];
      return [...store.promotionalBanners].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    async getActive() {
      store.promotionalBanners ||= [];
      return store.promotionalBanners.filter(b => b.isActive).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    async create(data) {
      store.promotionalBanners ||= [];
      const banner = {
        id: data.id || createId("promo"),
        message: data.message,
        isActive: data.isActive || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      store.promotionalBanners.push(banner);
      return banner;
    },
    async update(id, updates) {
      store.promotionalBanners ||= [];
      const banner = store.promotionalBanners.find(b => b.id === id);
      if (!banner) return null;
      if (updates.message !== undefined) banner.message = updates.message;
      if (updates.isActive !== undefined) banner.isActive = updates.isActive;
      banner.updatedAt = new Date().toISOString();
      return banner;
    },
    async delete(id) {
      store.promotionalBanners ||= [];
      const initialLength = store.promotionalBanners.length;
      store.promotionalBanners = store.promotionalBanners.filter(b => b.id !== id);
      return store.promotionalBanners.length !== initialLength;
    }
  },

  payoutBatches: {
    async create(batch) {
      store.payoutBatches ||= [];
      const record = {
        ...batch,
        createdAt: batch.createdAt || new Date().toISOString()
      };
      store.payoutBatches.push(record);
      return record;
    },
    async findById(id) {
      store.payoutBatches ||= [];
      return store.payoutBatches.find(b => b.id === id) || null;
    },
    async findByReference(batchReference) {
      store.payoutBatches ||= [];
      return store.payoutBatches.find(b => b.batchReference === batchReference) || null;
    },
    async update(id, patch) {
      const batch = await this.findById(id);
      if (batch) {
        Object.assign(batch, patch, { updatedAt: new Date().toISOString() });
      }
      return batch;
    },
    async list({ status, payoutType } = {}) {
      store.payoutBatches ||= [];
      return store.payoutBatches.filter(b => {
        if (status && b.status !== status) return false;
        if (payoutType && b.payoutType !== payoutType) return false;
        return true;
      });
    }
  },

  payoutRecords: {
    async create(record) {
      store.payoutRecords ||= [];
      const item = {
        ...record,
        status: record.status || "pending",
        createdAt: record.createdAt || new Date().toISOString()
      };
      store.payoutRecords.push(item);
      return item;
    },
    async findById(id) {
      store.payoutRecords ||= [];
      return store.payoutRecords.find(r => r.id === id) || null;
    },
    async findByBatchId(batchId) {
      store.payoutRecords ||= [];
      return store.payoutRecords.filter(r => r.batchId === batchId);
    },
    async findByIdempotencyKey(key) {
      store.payoutRecords ||= [];
      return store.payoutRecords.find(r => r.idempotencyKey === key) || null;
    },
    async update(id, patch) {
      const record = await this.findById(id);
      if (record) {
        Object.assign(record, patch, { updatedAt: new Date().toISOString() });
      }
      return record;
    },
    async list({ status, userId, beneficiaryId, batchId } = {}) {
      store.payoutRecords ||= [];
      return store.payoutRecords.filter(r => {
        if (status && r.status !== status) return false;
        if (userId && r.userId !== userId) return false;
        if (beneficiaryId && r.beneficiaryId !== beneficiaryId) return false;
        if (batchId && r.batchId !== batchId) return false;
        return true;
      });
    }
  }
};

function normalizeConfigKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
