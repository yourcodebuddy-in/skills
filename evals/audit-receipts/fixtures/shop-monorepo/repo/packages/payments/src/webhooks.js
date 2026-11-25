import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "fakepay-signature";
export const DEFAULT_TOLERANCE_SECONDS = 300;

export class WebhookError extends Error {
  constructor(message) {
    super(message);
    this.name = "WebhookError";
  }
}

export const computeSignature = (secret, timestamp, body) =>
  createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

export const signatureHeader = (secret, timestamp, body) => `t=${timestamp},v1=${computeSignature(secret, timestamp, body)}`;

// "t=1790000000,v1=abc…,v1=def…": several v1 values arrive while the provider rotates secrets.
const parseHeader = (header) => {
  if (typeof header !== "string" || header.length === 0) {
    throw new WebhookError("Missing signature header");
  }
  let timestamp = null;
  const signatures = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2).map((piece) => piece?.trim());
    if (key === "t" && /^\d+$/.test(value ?? "")) {
      timestamp = Number(value);
    } else if (key === "v1" && /^[0-9a-f]{64}$/.test(value ?? "")) {
      signatures.push(value);
    }
  }
  if (timestamp === null || signatures.length === 0) {
    throw new WebhookError("Malformed signature header");
  }
  return { timestamp, signatures };
};

export const verifyWebhook = ({
  secret,
  header,
  body,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
}) => {
  const { timestamp, signatures } = parseHeader(header);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    throw new WebhookError("Signature timestamp is outside the tolerance");
  }
  const expected = Buffer.from(computeSignature(secret, timestamp, body), "hex");
  const matches = signatures.some((signature) => timingSafeEqual(Buffer.from(signature, "hex"), expected));
  if (!matches) {
    throw new WebhookError("No signature matches the payload");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new WebhookError("Payload isn't JSON");
  }
};
