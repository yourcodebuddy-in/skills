import { randomBytes } from "node:crypto";
import { ProviderError } from "./errors.js";
import { signatureHeader } from "./webhooks.js";

const DELIVERY_ATTEMPTS = 3;

const newId = (prefix) => `${prefix}_${randomBytes(12).toString("base64url")}`;

// An in-process stand-in for the card provider's API. It keeps the provider's shapes (intents,
// charges, refunds, signed webhooks) so the shop code can't tell the difference.
export const createFakePay = ({ webhookSecret, deliver, now = () => Date.now() }) => {
  if (!webhookSecret) {
    throw new TypeError("fakepay needs a webhookSecret");
  }
  const intents = new Map();
  const charges = new Map();

  const send = async (type, data) => {
    const created = Math.floor(now() / 1000);
    const event = { id: newId("evt"), type, created, data };
    const body = JSON.stringify(event);
    for (let attempt = 1; attempt <= DELIVERY_ATTEMPTS; attempt += 1) {
      const signature = signatureHeader(webhookSecret, Math.floor(now() / 1000), body);
      try {
        if (await deliver({ body, signature })) {
          return event;
        }
      } catch {
        // The receiver was unreachable; try again.
      }
    }
    return event;
  };

  const requireIntent = (intentId) => {
    const intent = intents.get(intentId);
    if (!intent) {
      throw new ProviderError(`No such payment intent: ${intentId}`, "resource_missing");
    }
    return intent;
  };

  return {
    name: "fakepay",

    createIntent: async ({ amountCents, reference }) => {
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
        throw new ProviderError("Amount must be a positive whole number of cents", "invalid_amount");
      }
      const intent = { id: newId("pi"), amountCents, reference, status: "requires_payment", chargeId: null };
      intents.set(intent.id, intent);
      return { id: intent.id, amountCents, status: intent.status };
    },

    cancelIntent: async (intentId) => {
      const intent = requireIntent(intentId);
      if (intent.status !== "requires_payment") {
        throw new ProviderError(`Intent is ${intent.status}`, "intent_unexpected_state");
      }
      intent.status = "cancelled";
      return { id: intent.id, status: intent.status };
    },

    // What happens when the shopper completes the provider's payment page.
    simulatePayment: async (intentId) => {
      const intent = requireIntent(intentId);
      if (intent.status !== "requires_payment") {
        throw new ProviderError(`Intent is ${intent.status}`, "intent_unexpected_state");
      }
      const charge = { id: newId("ch"), intentId, amountCents: intent.amountCents, refundedCents: 0 };
      charges.set(charge.id, charge);
      intent.status = "succeeded";
      intent.chargeId = charge.id;
      await send("payment.succeeded", {
        intent_id: intent.id,
        charge_id: charge.id,
        amount: charge.amountCents,
        reference: intent.reference,
      });
      return { chargeId: charge.id };
    },

    simulateDecline: async (intentId, reason = "card_declined") => {
      const intent = requireIntent(intentId);
      await send("payment.failed", { intent_id: intent.id, reason, reference: intent.reference });
    },

    refund: async ({ chargeId, amountCents }) => {
      const charge = charges.get(chargeId);
      if (!charge) {
        throw new ProviderError(`No such charge: ${chargeId}`, "resource_missing");
      }
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
        throw new ProviderError("Amount must be a positive whole number of cents", "invalid_amount");
      }
      if (charge.refundedCents + amountCents > charge.amountCents) {
        throw new ProviderError("Refund exceeds what's left on the charge", "amount_too_large");
      }
      charge.refundedCents += amountCents;
      return { id: newId("re"), chargeId, amountCents, status: "succeeded" };
    },
  };
};
