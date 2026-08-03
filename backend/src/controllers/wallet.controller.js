import { repositories } from "../repositories/index.js";
import { getBalance, ledger, createRazorpayOrder, verifyRazorpaySignature, verifyWebhookSignature, settlePaidPaymentOrder, debit } from "../services/wallet.service.js";
import { created, ok, badRequest } from "../utils/http.js";
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
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = body;
  const order = await repositories.paymentOrders.find(orderId || razorpay_order_id);
  if (!order || order.userId !== user.id) return badRequest("Payment order not found.");
  if (order.status === "paid") return ok({ verified: true, order, ledgerEntry: null });
  
  if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return badRequest("Invalid payment signature.");
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
