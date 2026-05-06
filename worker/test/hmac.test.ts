import { describe, it, expect } from "vitest";
import { signPayload, verifySignature } from "../src/lib/hmac.js";

const SECRET = "test-secret-please-be-long-enough";

describe("hmac", () => {
  it("signs and verifies a payload", () => {
    const body = JSON.stringify({ event: "ticket.created", ticket_id: 42 });
    const sig = signPayload(SECRET, body);
    expect(sig.startsWith("sha256=")).toBe(true);
    expect(verifySignature(SECRET, body, sig)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const body = JSON.stringify({ ticket_id: 42 });
    const sig = signPayload(SECRET, body);
    const tampered = JSON.stringify({ ticket_id: 43 });
    expect(verifySignature(SECRET, tampered, sig)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const body = "{}";
    const sig = signPayload(SECRET, body);
    expect(verifySignature("other-secret-of-same-len-yes", body, sig)).toBe(
      false,
    );
  });

  it("rejects missing or malformed signature header", () => {
    const body = "{}";
    expect(verifySignature(SECRET, body, undefined)).toBe(false);
    expect(verifySignature(SECRET, body, null)).toBe(false);
    expect(verifySignature(SECRET, body, "not-a-valid-sig")).toBe(false);
    expect(verifySignature(SECRET, body, "sha256=zzzz")).toBe(false);
  });
});
