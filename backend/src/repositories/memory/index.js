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
      return store.users;
    },
    findById(id) {
      return store.users.find((user) => user.id === id) || null;
    },
    findByEmailAndRole(email, role) {
      return store.users.find((user) => user.email === email && user.role === role) || null;
    },
    findByMobileAndRole(mobile, role) {
      return store.users.find((user) => user.mobile === mobile && user.role === role) || null;
    },
    create(user) {
      store.users.push(user);
      return user;
    },
    update(id, patch) {
      const user = this.findById(id);
      if (user) Object.assign(user, patch, { updatedAt: new Date().toISOString() });
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
  }
};

function normalizeConfigKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
