// Client for the card payment provider's REST API. Amounts are in minor units, as the provider expects.

export class PaymentDeclinedError extends Error {
  constructor(reason) {
    super(`payment declined: ${reason}`);
    this.reason = reason;
  }
}

class PaymentProviderError extends Error {}

export function createGateway(config) {
  const { url, apiKey, timeoutMs } = config.payments;

  const call = async (path, body, idempotencyKey) => {
    const headers = { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` };
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
    let response;
    try {
      response = await fetch(`${url}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new PaymentProviderError(`payment provider unreachable: ${error.message}`);
    }
    const payload = await response.json().catch(() => ({}));
    if (response.status === 402) throw new PaymentDeclinedError(payload.reason ?? 'card_declined');
    if (!response.ok) throw new PaymentProviderError(`payment provider answered ${response.status}`);
    return payload;
  };

  return {
    async charge({ amountCents, currency, paymentToken, idempotencyKey, description }) {
      const payload = await call(
        '/v1/charges',
        { amount: amountCents, currency, source: paymentToken, description },
        idempotencyKey,
      );
      return { id: payload.id };
    },

    async refund({ paymentId, amountCents, idempotencyKey }) {
      const payload = await call('/v1/refunds', { charge: paymentId, amount: amountCents }, idempotencyKey);
      return { id: payload.id };
    },
  };
}
