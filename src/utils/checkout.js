/**
 * MindHeal Razorpay Checkout Integration
 * Provides dynamic SDK loading, modal lifecycle orchestration, and signature forwarding.
 */

let customCheckoutLauncher = null;

/**
 * Configure a custom checkout launcher for unit/integration testing in headless environments.
 * @param {Function|null} launcher 
 */
export function setCheckoutLauncherForTesting(launcher) {
  customCheckoutLauncher = launcher;
}

/**
 * Dynamically injects the Razorpay checkout script if not already present.
 * @returns {Promise<boolean>}
 */
export function loadRazorpaySdk(sdkUrl = "https://checkout.razorpay.com/v1/checkout.js") {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(false);
  }

  if (typeof window.Razorpay === "function") {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let finished = false;
    const timeoutId = setTimeout(() => {
      if (!finished) {
        finished = true;
        resolve(typeof window.Razorpay === "function");
      }
    }, 5000);

    const finish = (result) => {
      if (!finished) {
        finished = true;
        clearTimeout(timeoutId);
        resolve(result);
      }
    };

    const existing = document.querySelector(`script[src*="checkout.razorpay.com"]`);
    if (existing) {
      if (typeof window.Razorpay === "function") return finish(true);
      existing.addEventListener("load", () => finish(true), { once: true });
      existing.addEventListener("error", () => finish(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = sdkUrl;
    script.async = true;
    script.onload = () => finish(typeof window.Razorpay === "function");
    script.onerror = () => finish(false);

    (document.head || document.body || document.documentElement).appendChild(script);
  });
}

/**
 * Opens authentic Razorpay modal checkout and resolves ONLY with gateway-returned credentials.
 * Handles user dismissal, gateway error events, and verification constraints.
 * 
 * @param {Object} params
 * @param {string} params.keyId - Gateway key ID supplied dynamically from backend
 * @param {Object} params.order - Payment order object from /wallet/topup/initiate or session quote
 * @param {Object} [params.user] - Authenticated user details for prefilling customer fields
 * @param {string} [params.title] - Checkout modal title
 * @param {string} [params.description] - Checkout modal description
 * @param {string} [params.themeColor] - Primary branding hex color
 * @returns {Promise<{ razorpay_payment_id: string, razorpay_order_id: string, razorpay_signature: string }>}
 */
export async function openRazorpayCheckout({
  keyId,
  order,
  user = null,
  title = "MindHeal",
  description = "Wallet Top-up",
  themeColor = "#DA7756"
}) {
  if (!order) {
    throw new Error("Missing payment order details.");
  }

  if (typeof customCheckoutLauncher === "function") {
    return await customCheckoutLauncher({ keyId, order, user, title, description, themeColor });
  }

  const loaded = await loadRazorpaySdk();
  if (!loaded || typeof window.Razorpay !== "function") {
    const error = new Error("Payment gateway SDK failed to load. Please check your network connection and try again.");
    error.code = "GATEWAY_SDK_LOAD_FAILED";
    throw error;
  }

  const resolvedKey = keyId || order.keyId;
  if (!resolvedKey) {
    const error = new Error("Payment gateway key is not configured.");
    error.code = "GATEWAY_KEY_MISSING";
    throw error;
  }

  return new Promise((resolve, reject) => {
    let completed = false;

    const options = {
      key: resolvedKey,
      amount: order.amountPaise,
      currency: order.currency || "INR",
      name: title,
      description: description || `Payment for order ${order.id}`,
      order_id: order.gatewayOrderId,
      prefill: {
        name: user?.name || "",
        email: user?.email || "",
        contact: user?.mobile || user?.phone || ""
      },
      theme: {
        color: themeColor
      },
      handler: function (response) {
        completed = true;
        if (!response || !response.razorpay_payment_id || !response.razorpay_signature) {
          const error = new Error("Incomplete payment response received from gateway.");
          error.code = "INCOMPLETE_GATEWAY_RESPONSE";
          return reject(error);
        }

        // Return strictly gateway-returned parameters
        resolve({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id || order.gatewayOrderId,
          razorpay_signature: response.razorpay_signature
        });
      },
      modal: {
        ondismiss: function () {
          if (!completed) {
            completed = true;
            const error = new Error("Payment checkout was cancelled by user.");
            error.code = "PAYMENT_CANCELLED";
            reject(error);
          }
        }
      }
    };

    try {
      const rzpInstance = new window.Razorpay(options);

      if (typeof rzpInstance.on === "function") {
        rzpInstance.on("payment.failed", function (failResponse) {
          completed = true;
          const gatewayMessage = failResponse?.error?.description || failResponse?.error?.reason || "Payment was declined by payment gateway.";
          const error = new Error(gatewayMessage);
          error.code = "PAYMENT_FAILED";
          error.gatewayError = failResponse?.error;
          reject(error);
        });
      }

      rzpInstance.open();
    } catch (launchError) {
      completed = true;
      reject(launchError);
    }
  });
}
