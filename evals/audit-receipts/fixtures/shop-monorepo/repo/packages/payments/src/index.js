import { providers } from "./registry.js";

export { ProviderError } from "./errors.js";
export { SIGNATURE_HEADER, WebhookError, signatureHeader, verifyWebhook } from "./webhooks.js";

export const createPaymentProvider = (name, options) => providers.create(name, options);
