import { appConfig } from "../config/app.js";
import { repositories } from "../repositories/index.js";
import { createId } from "../utils/security.js";
import { toPaise } from "../utils/validation.js";
import { razorpay } from "../config/razorpay.js";
import crypto from "node:crypto";

export async function getWallet(ownerId) {
  let wallet = await repositories.wallets.findByOwner(ownerId);
  if (!wallet) {
    wallet = await repositories.wallets.createForOwner("user", ownerId);
  }
  return wallet;
}

export async function getBalance(ownerId) {
  const wallet = await getWallet(ownerId);
  return (await repositories.wallets.ledgerEntries(wallet.id))
    .reduce((sum, entry) => sum + (entry.direction === "credit" ? entry.amountPaise : -entry.amountPaise), 0);
}

export async function ledger(ownerId) {
  const wallet = await getWallet(ownerId);
  return await repositories.wallets.ledgerEntries(wallet.id);
}

export async function credit(ownerId, amountInr, entryType, reference = {}) {
  const wallet = await getWallet(ownerId);
  const entry = {
    id: createId("led"),
    walletId: wallet.id,
    direction: "credit",
    amountPaise: toPaise(amountInr),
    entryType,
    ...reference,
    createdAt: new Date().toISOString()
  };
  return await repositories.wallets.createLedgerEntry(entry);
}

export async function debit(ownerId, amountInr, entryType, reference = {}) {
  const balance = await getBalance(ownerId);
  const amountPaise = toPaise(amountInr);
  if (balance < amountPaise) {
    const error = new Error("Insufficient wallet balance.");
    error.code = "INSUFFICIENT_BALANCE";
    throw error;
  }
  const wallet = await getWallet(ownerId);
  const entry = {
    id: createId("led"),
    walletId: wallet.id,
    direction: "debit",
    amountPaise,
    entryType,
    ...reference,
    createdAt: new Date().toISOString()
  };
  return await repositories.wallets.createLedgerEntry(entry);
}

export async function reserveCredits(ownerId, amountInr, serviceKey) {
  if (amountInr <= 0) return { reservationId: null, isFree: true };

  const reservationId = createId("res");
  await debit(ownerId, amountInr, "ai_credit_reserve", {
    referenceType: "AiService",
    referenceId: serviceKey,
    idempotencyKey: reservationId
  });

  return { reservationId, isFree: false };
}

export async function releaseCredits(ownerId, amountInr, reservationId, reason = "service_failure") {
  if (!reservationId || amountInr <= 0) return null;

  return await credit(ownerId, amountInr, "ai_credit_release", {
    referenceType: "AiServiceReservation",
    referenceId: reservationId,
    notes: `Credits released due to: ${reason}`
  });
}

export function calculateCommission(grossAmountInr) {
  const grossPaise = Math.round(Number(grossAmountInr || 0) * 100);
  const commissionRateBps = appConfig.commissionRateBps || 1000; // 1000 BPS = 10%
  
  // Integer paise arithmetic: commission = floor(gross * bps / 10000)
  const commissionPaise = Math.floor((grossPaise * commissionRateBps) / 10000);
  const counsellorEarningPaise = grossPaise - commissionPaise;

  return {
    grossAmountInr: grossPaise / 100,
    platformCommissionInr: commissionPaise / 100,
    counsellorEarningInr: counsellorEarningPaise / 100,
    grossAmountPaise: grossPaise,
    commissionAmountPaise: commissionPaise,
    counsellorEarningPaise: counsellorEarningPaise,
    commissionRateBps
  };
}

export async function createRazorpayOrder(amountPaise, receiptId) {
  if (!razorpay) {
    if (appConfig.env === "production") {
      throw new Error("Razorpay is not configured.");
    }
    return { id: createId("order_mock"), amount: amountPaise, currency: "INR", receipt: receiptId };
  }
  return await razorpay.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: receiptId,
    payment_capture: 1
  });
}

export function verifyRazorpaySignature(orderId, paymentId, signature) {
  if (!razorpay) return appConfig.env !== "production";
  if (!orderId || !paymentId || !signature) return false;
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return safeHexEqual(expectedSignature, signature);
}

export function verifyWebhookSignature(bodyRaw, signature) {
  if (!bodyRaw || !signature) return false;
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || "";
  if (!razorpay && !secret) return appConfig.env !== "production";
  if (!secret) return false;
  const expectedSignature = crypto.createHmac("sha256", secret).update(bodyRaw).digest("hex");
  return safeHexEqual(expectedSignature, signature);
}

import { postJournalTransaction } from "./double_entry.service.js";

export async function settlePaidPaymentOrder(order, gatewayPaymentId, reason = "wallet_topup") {
  if (!order) {
    const error = new Error("Payment order not found.");
    error.code = "PAYMENT_ORDER_NOT_FOUND";
    throw error;
  }

  if (order.status === "paid") {
    return { order, ledgerEntry: null, alreadyPaid: true };
  }

  const amountInr = order.amountPaise / 100;
  const ledgerEntry = await credit(order.userId, amountInr, reason, {
    referenceType: "payment_order",
    referenceId: order.id,
    gatewayPaymentId
  });

  // Post balanced Double-Entry Journal (Debit GATEWAY_RECEIVABLE, Credit USER_AVAILABLE_BALANCE)
  let journal = null;
  try {
    journal = await postJournalTransaction({
      journalType: "WALLET_TOPUP",
      businessReferenceType: "payment_order",
      businessReferenceId: order.id,
      idempotencyKey: `topup_${order.id}`,
      description: `Wallet top-up via Razorpay payment ${gatewayPaymentId}`,
      entries: [
        { accountKey: "GATEWAY_RECEIVABLE", entrySide: "debit", amountPaise: order.amountPaise },
        { accountKey: `USER_AVAILABLE_${order.userId}`, entrySide: "credit", amountPaise: order.amountPaise }
      ]
    });
  } catch (jErr) {
    console.error("[DoubleEntry] Failed to post topup journal:", jErr);
  }

  const updatedOrder = await repositories.paymentOrders.update(order.id, {
    status: "paid",
    gatewayPaymentId,
    paidAt: new Date().toISOString()
  });

  return { order: updatedOrder, ledgerEntry, journal, alreadyPaid: false };
}

function safeHexEqual(expected, actual) {
  if (typeof expected !== "string" || typeof actual !== "string") return false;
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
