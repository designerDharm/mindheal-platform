import { repositories } from "../repositories/index.js";
import { getBalance, ledger, createRazorpayOrder, verifyRazorpaySignature, verifyWebhookSignature, settlePaidPaymentOrder, fetchRazorpayPayment, debit } from "../services/wallet.service.js";
import { created, ok, badRequest, forbidden } from "../utils/http.js";
import { createId } from "../utils/security.js";
import { toPaise } from "../utils/validation.js";

export async function balance({ user }) {
  return ok({ ownerId: user.id, currency: "INR", balancePaise: await getBalance(user.id) });
}

export async function initiateTopup({ body, user }) {
  const amountInr = Number(body.amountInr || 0);
  if (amountInr <= 0) return badRequest("Invalid amount.");
  
  const receiptId = createId("rec");
  const amountPaise = toPaise(amountInr);
  
  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrder(amountPaise, receiptId);
  } catch (error) {
    return badRequest(error.message);
  }

  const order = {
    id: createId("ord"),
    gateway: "razorpay",
    gatewayOrderId: razorpayOrder.id,
    userId: user.id,
    amountPaise: amountPaise,
    status: "created",
    createdAt: new Date().toISOString()
  };
  return created(await repositories.paymentOrders.create(order));
}

export async function verifyTopup({ body, user }) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = body || {};
  if (!razorpay_payment_id || !razorpay_signature) {
    return badRequest("Missing payment verification details.");
  }
  const identifier = orderId || razorpay_order_id;
  if (!identifier) {
    return badRequest("Missing payment order identifier.");
  }

  const order = await repositories.paymentOrders.find(identifier);
  if (!order) return badRequest("Payment order not found.");
  if (order.userId !== user.id) {
    return forbidden("Payment order does not belong to the authenticated user.");
  }

  if (order.status === "paid") {
    if (order.gatewayPaymentId && order.gatewayPaymentId !== razorpay_payment_id) {
      return badRequest("Payment order has already been settled with a different payment identifier.");
    }
    return ok({ verified: true, order, ledgerEntry: null, alreadyPaid: true });
  }

  if (order.status !== "created") {
    return badRequest(`Payment order cannot be settled in status '${order.status}'.`);
  }

  if (!order.gatewayOrderId) {
    return badRequest("Payment order is missing gateway order reference.");
  }

  if (razorpay_order_id && razorpay_order_id !== order.gatewayOrderId) {
    return badRequest("Payment proof does not match this order's gateway order identifier.");
  }

  if (typeof repositories.paymentOrders.findByPaymentId === "function") {
    const existingOrderWithPayment = await repositories.paymentOrders.findByPaymentId(razorpay_payment_id);
    if (existingOrderWithPayment && existingOrderWithPayment.id !== order.id) {
      return badRequest("Payment identifier has already been used for another order.");
    }
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

  const settlement = await settlePaidPaymentOrder(order, razorpay_payment_id);
  return ok({ verified: true, order: settlement.order, ledgerEntry: settlement.ledgerEntry });
}

export async function transactions({ user }) {
  return ok(await ledger(user.id));
}

export async function paymentWebhook({ body, req }) {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody;
  if (typeof rawBody !== "string" || rawBody.length === 0) {
    await repositories.auditLogs.create({
      id: createId("aud"),
      action: "payment_webhook_rejected",
      entityType: "payment",
      newValue: { reason: "missing_raw_body", event: body.event },
      createdAt: new Date().toISOString()
    });
    return badRequest("Missing raw webhook body.");
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    await repositories.auditLogs.create({
      id: createId("aud"),
      action: "payment_webhook_rejected",
      entityType: "payment",
      newValue: { reason: "invalid_signature", event: body.event },
      createdAt: new Date().toISOString()
    });
    return badRequest("Invalid webhook signature.");
  }

  const payment = body.payload?.payment?.entity;
  const gatewayOrderId = payment?.order_id;
  const gatewayPaymentId = payment?.id;
  const amountPaise = Number(payment?.amount || 0);

  return await withPaymentTransaction(async () => {
    const order = gatewayOrderId ? await repositories.paymentOrders.find(gatewayOrderId) : null;
    let settlement = null;

    if (body.event === "payment.captured" && order) {
      if (amountPaise !== order.amountPaise) {
        await repositories.auditLogs.create({
          id: createId("aud"),
          action: "payment_webhook_rejected",
          entityType: "payment",
          entityId: order.id,
          newValue: { reason: "amount_mismatch", gatewayOrderId, amountPaise, expectedAmountPaise: order.amountPaise },
          createdAt: new Date().toISOString()
        });
        return badRequest("Payment amount mismatch.");
      }
      if (payment?.currency && payment.currency.toUpperCase() !== "INR") {
        await repositories.auditLogs.create({
          id: createId("aud"),
          action: "payment_webhook_rejected",
          entityType: "payment",
          entityId: order.id,
          newValue: { reason: "currency_mismatch", gatewayOrderId, currency: payment.currency },
          createdAt: new Date().toISOString()
        });
        return badRequest("Payment currency mismatch.");
      }
      if (typeof repositories.paymentOrders.findByPaymentId === "function") {
        const existing = await repositories.paymentOrders.findByPaymentId(gatewayPaymentId);
        if (existing && existing.id !== order.id) {
          await repositories.auditLogs.create({
            id: createId("aud"),
            action: "payment_webhook_rejected",
            entityType: "payment",
            entityId: order.id,
            newValue: { reason: "payment_id_already_used", gatewayOrderId, gatewayPaymentId },
            createdAt: new Date().toISOString()
          });
          return badRequest("Payment identifier has already been used for another order.");
        }
      }
      settlement = await settlePaidPaymentOrder(order, gatewayPaymentId, "wallet_topup_webhook");
    }

    await repositories.auditLogs.create({
      id: createId("aud"),
      action: "payment_webhook_received",
      entityType: "payment",
      entityId: order?.id || gatewayOrderId || null,
      newValue: {
        event: body.event,
        gatewayOrderId,
        gatewayPaymentId,
        settled: Boolean(settlement),
        alreadyPaid: settlement?.alreadyPaid || false
      },
      createdAt: new Date().toISOString()
    });

    return ok({ received: true, settled: Boolean(settlement), order: settlement?.order || order || null, ledgerEntry: settlement?.ledgerEntry || null });
  });
}

async function withPaymentTransaction(callback) {
  if (repositories.transactions?.withTransaction) {
    return await repositories.transactions.withTransaction(callback);
  }
  return await callback();
}

export async function payExpressSession({ body, user }) {
  const amountInr = Number(body.amountInr);
  if (!amountInr || amountInr <= 0) return badRequest("Invalid amount.");
  
  try {
    const entry = await debit(user.id, amountInr, "express_yourself_payment", {
      referenceType: "express_yourself",
      referenceId: createId("exp_pay"),
      notes: `Payment for anonymous peer session: ${body.plan || "Half Hour"}`
    });
    return ok({ success: true, ledgerEntry: entry });
  } catch (error) {
    return badRequest(error.message);
  }
}
