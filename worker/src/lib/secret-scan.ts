import { spawn } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

export type SecretFinding = {
  rule: string;
  /** Up to ~80 chars around the match for human review. Never the secret itself. */
  context: string;
  source: "gitleaks" | "regex";
};

export type ScanResult = {
  findings: SecretFinding[];
  scanner: "gitleaks" | "regex";
};

/**
 * Patterns we always check, even when gitleaks is available — they cover
 * tokens we issue ourselves (Anthropic, GitHub PAT, Slack) so the worker
 * can't leak its own credentials in a diff.
 */
const REGEX_RULES: Array<{ name: string; pattern: RegExp }> = [
  { name: "anthropic-api-key", pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/g },
  { name: "github-pat-classic", pattern: /ghp_[A-Za-z0-9]{30,}/g },
  { name: "github-pat-fine-grained", pattern: /github_pat_[A-Za-z0-9_]{40,}/g },
  { name: "github-oauth", pattern: /gho_[A-Za-z0-9]{30,}/g },
  { name: "slack-bot-token", pattern: /xoxb-[A-Za-z0-9-]{20,}/g },
  { name: "slack-user-token", pattern: /xoxp-[A-Za-z0-9-]{20,}/g },
  { name: "aws-access-key-id", pattern: /AKIA[0-9A-Z]{16}/g },
  {
    name: "aws-secret-access-key",
    // Match an explicit assignment of a 40-char secret, common case in code.
    pattern:
      /(?:aws_secret_access_key|aws-secret-access-key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/g,
  },
  { name: "stripe-secret-key", pattern: /sk_live_[A-Za-z0-9]{24,}/g },
  { name: "google-api-key", pattern: /AIza[0-9A-Za-z\-_]{35}/g },
  {
    name: "private-key-pem",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  },
];

/**
 * Scan a unified diff for secrets. Tries gitleaks first if it's available
 * on PATH; otherwise (and additionally) runs the regex rules above.
 */
export async function scanDiffForSecrets(diff: string): Promise<ScanResult> {
  const gitleaksAvailable = await isGitleaksAvailable();
  const findings: SecretFinding[] = [];

  if (gitleaksAvailable) {
    const gitleaksFindings = await runGitleaks(diff);
    findings.push(...gitleaksFindings);
  }

  // Regex rules ALWAYS run — they're the last line of defence on our own creds.
  findings.push(...regexScan(diff));

  return {
    findings: dedupeFindings(findings),
    scanner: gitleaksAvailable ? "gitleaks" : "regex",
  };
}

function regexScan(diff: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const { name, pattern } of REGEX_RULES) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(diff)) !== null) {
      findings.push({
        rule: name,
        context: redactedContext(diff, match.index, match[0].length),
        source: "regex",
      });
      if (match[0].length === 0) pattern.lastIndex++;
    }
  }
  return findings;
}

/**
 * Returns up to ~40 chars of surrounding context with the actual secret
 * masked, so we can log the location without leaking the value.
 */
export function redactedContext(
  text: string,
  matchStart: number,
  matchLength: number,
): string {
  const start = Math.max(0, matchStart - 20);
  const end = Math.min(text.length, matchStart + matchLength + 20);
  const before = text.slice(start, matchStart).replace(/\n/g, " ");
  const after = text.slice(matchStart + matchLength, end).replace(/\n/g, " ");
  return `${before}[REDACTED:${matchLength}c]${after}`;
}

function dedupeFindings(findings: SecretFinding[]): SecretFinding[] {
  const seen = new Set<string>();
  const out: SecretFinding[] = [];
  for (const f of findings) {
    const key = `${f.rule}::${f.context}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

async function isGitleaksAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("gitleaks", ["version"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

type GitleaksFinding = {
  RuleID?: string;
  Description?: string;
  Match?: string;
  StartLine?: number;
  File?: string;
};

async function runGitleaks(diff: string): Promise<SecretFinding[]> {
  const dir = await mkdtemp(path.join(tmpdir(), "gitleaks-"));
  const diffFile = path.join(dir, "scan.patch");
  const reportFile = path.join(dir, "report.json");

  try {
    await writeFile(diffFile, diff, "utf8");
    const exitCode = await runChild(
      "gitleaks",
      [
        "detect",
        "--no-git",
        "--source",
        diffFile,
        "--report-format",
        "json",
        "--report-path",
        reportFile,
        "--exit-code",
        "0",
      ],
      30_000,
    );
    if (exitCode !== 0) return [];

    const report = await readReport(reportFile);
    return report.map((f) => ({
      rule: f.RuleID ?? f.Description ?? "gitleaks",
      context: f.Match
        ? `[REDACTED:${f.Match.length}c] @ line ${f.StartLine ?? "?"}`
        : `gitleaks rule ${f.RuleID ?? "?"}`,
      source: "gitleaks" as const,
    }));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function readReport(file: string): Promise<GitleaksFinding[]> {
  try {
    const { readFile } = await import("fs/promises");
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function runChild(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve(124);
    }, timeoutMs);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(1);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });
}
