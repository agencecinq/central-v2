import { simpleGit } from "simple-git";

const COMMITTER_NAME = "cinq-auto-resolve";
const COMMITTER_EMAIL = "auto-resolve@agencecinq.com";
const COMMIT_TRAILER = `Co-Authored-By: ${COMMITTER_NAME} <${COMMITTER_EMAIL}>`;

export type CommitPushInput = {
  repoPath: string;
  branchName: string;
  ticketId: number;
  prTitle: string;
  prBody: string;
};

export type CommitPushResult = {
  commitSha: string;
};

/**
 * Commit the agent's changes onto a fresh branch and push it to origin.
 * Assumes the clone's remote was set with credentials at clone-time
 * (cf. cloneRepo) so no extra auth handshake is required here.
 */
export async function commitAndPush(
  input: CommitPushInput,
): Promise<CommitPushResult> {
  const git = simpleGit(input.repoPath);

  await git.addConfig("user.name", COMMITTER_NAME, false, "local");
  await git.addConfig("user.email", COMMITTER_EMAIL, false, "local");

  await git.checkoutLocalBranch(input.branchName);
  await git.add(["-A"]);

  const message = buildCommitMessage(input);
  await git.commit(message);

  await git.push(["-u", "origin", input.branchName]);

  const sha = (await git.revparse(["HEAD"])).trim();
  return { commitSha: sha };
}

export function buildCommitMessage(input: {
  ticketId: number;
  prTitle: string;
  prBody: string;
}): string {
  const subject = input.prTitle.trim();
  // Take only the "## Modifications" block from the PR body if present, to
  // keep the commit message tight (under ~30 lines).
  const modifications = extractModificationsBullets(input.prBody);
  const bodyLines: string[] = [];
  bodyLines.push(`Résout le ticket #${input.ticketId}.`);
  if (modifications.length > 0) {
    bodyLines.push("");
    bodyLines.push("Modifications:");
    bodyLines.push(...modifications);
  }
  bodyLines.push("");
  bodyLines.push("Généré automatiquement par cinq-auto-resolve.");
  bodyLines.push("");
  bodyLines.push(COMMIT_TRAILER);
  return [subject, "", ...bodyLines].join("\n");
}

function extractModificationsBullets(body: string): string[] {
  const m = body.match(
    /^##\s+Modifications\s*\n([\s\S]*?)(?=^##\s+|\Z)/m,
  );
  if (!m) return [];
  return m[1]!
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- ") || l.startsWith("* "))
    .map((l) => `- ${l.replace(/^[-*]\s+/, "")}`);
}
