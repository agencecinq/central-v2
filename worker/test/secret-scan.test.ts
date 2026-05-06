import { describe, it, expect } from "vitest";
import {
  redactedContext,
  scanDiffForSecrets,
} from "../src/lib/secret-scan.js";

describe("redactedContext", () => {
  it("redacts the secret and keeps surrounding context", () => {
    const text = "before TOKEN_VALUE_XYZ after";
    const idx = text.indexOf("TOKEN_VALUE_XYZ");
    const ctx = redactedContext(text, idx, "TOKEN_VALUE_XYZ".length);
    expect(ctx).toContain("[REDACTED:15c]");
    expect(ctx).toContain("before ");
    expect(ctx).toContain(" after");
    expect(ctx).not.toContain("TOKEN_VALUE_XYZ");
  });

  it("collapses newlines so loggers stay on one line", () => {
    const text = "line1\nSECRET\nline2";
    const idx = text.indexOf("SECRET");
    const ctx = redactedContext(text, idx, 6);
    expect(ctx).not.toContain("\n");
  });
});

describe("scanDiffForSecrets (regex rules)", () => {
  it("flags an Anthropic API key", async () => {
    const diff = `+const key = "sk-ant-api03-${"x".repeat(40)}";`;
    const res = await scanDiffForSecrets(diff);
    expect(res.findings.some((f) => f.rule === "anthropic-api-key")).toBe(
      true,
    );
  });

  it("flags a classic GitHub PAT", async () => {
    const diff = `+GITHUB_TOKEN=ghp_${"a".repeat(36)}`;
    const res = await scanDiffForSecrets(diff);
    expect(res.findings.some((f) => f.rule === "github-pat-classic")).toBe(
      true,
    );
  });

  it("flags a Slack bot token", async () => {
    // String built at runtime so GitHub Push Protection doesn't flag this file.
    const fakeSlack = "xoxb" + "-" + "1234567890" + "-" + "1234567890" + "-" + "A".repeat(24);
    const diff = `+slack: "${fakeSlack}"`;
    const res = await scanDiffForSecrets(diff);
    expect(res.findings.some((f) => f.rule === "slack-bot-token")).toBe(true);
  });

  it("flags an AWS access key id", async () => {
    const fakeAws = "AK" + "IA" + "TESTSECRETSCAN42";
    const diff = `+AWS_ACCESS_KEY_ID=${fakeAws}`;
    const res = await scanDiffForSecrets(diff);
    expect(res.findings.some((f) => f.rule === "aws-access-key-id")).toBe(
      true,
    );
  });

  it("flags a PEM private key header", async () => {
    const diff = `+-----BEGIN RSA PRIVATE KEY-----`;
    const res = await scanDiffForSecrets(diff);
    expect(res.findings.some((f) => f.rule === "private-key-pem")).toBe(true);
  });

  it("returns no findings on a clean diff", async () => {
    const diff = `+console.log("hello world");\n+const config = { name: "milia" };`;
    const res = await scanDiffForSecrets(diff);
    const regexFindings = res.findings.filter((f) => f.source === "regex");
    expect(regexFindings).toHaveLength(0);
  });

  it("never includes the actual secret in the redacted context", async () => {
    const secret = `sk-ant-api03-${"k".repeat(40)}`;
    const diff = `+const k = "${secret}";`;
    const res = await scanDiffForSecrets(diff);
    for (const f of res.findings) {
      expect(f.context).not.toContain(secret);
    }
  });
});
