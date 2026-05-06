import { createHmac, timingSafeEqual } from "crypto";

const SCHEME_PREFIX = "sha256=";

export function signPayload(secret: string, payload: string): string {
  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  return `${SCHEME_PREFIX}${digest}`;
}

/**
 * Verify the `x-cinqcentral-signature` header. Returns true if and only if
 * the header is `sha256=<hex>` and matches HMAC-SHA256(secret, rawBody).
 */
export function verifySignature(
  secret: string,
  rawBody: string,
  header: string | undefined | null,
): boolean {
  if (!header || !header.startsWith(SCHEME_PREFIX)) return false;

  const expected = signPayload(secret, rawBody);
  if (header.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
