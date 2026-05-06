import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { simpleGit } from "simple-git";
import {
  buildCommitMessage,
  commitAndPush,
} from "../src/lib/git-commit-push.js";

let workdir: string;
let originDir: string;
let cloneDir: string;

beforeEach(async () => {
  workdir = await mkdtemp(path.join(tmpdir(), "commit-push-"));
  originDir = path.join(workdir, "origin.git");
  cloneDir = path.join(workdir, "clone");

  // Set up a bare remote and a clone with one initial commit on `main`.
  await mkdir(originDir, { recursive: true });
  await simpleGit(originDir).init(true);

  const seed = path.join(workdir, "seed");
  await mkdir(seed, { recursive: true });
  const seedGit = simpleGit(seed);
  await seedGit.init();
  await seedGit.addConfig("user.email", "seed@example.com");
  await seedGit.addConfig("user.name", "Seed");
  await writeFile(path.join(seed, "README.md"), "# initial\n");
  await seedGit.add(["-A"]);
  await seedGit.commit("initial");
  await seedGit.branch(["-M", "main"]);
  await seedGit.addRemote("origin", originDir);
  await seedGit.push(["-u", "origin", "main"]);

  await simpleGit().clone(originDir, cloneDir, ["--branch", "main"]);
});
afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("commitAndPush", () => {
  it("creates a new branch, commits the diff, and pushes to origin", async () => {
    await writeFile(path.join(cloneDir, "new.txt"), "hello\n");

    const result = await commitAndPush({
      repoPath: cloneDir,
      branchName: "cinq/ticket-42-test",
      ticketId: 42,
      prTitle: "feat(test): add new file",
      prBody:
        "## Résumé\nAdd a hello file.\n\n## Modifications\n- new.txt: créé\n\n## À tester\n- run cat",
    });

    expect(result.commitSha).toMatch(/^[a-f0-9]{40}$/);

    // Verify the branch landed on origin.
    const remoteBranches = await simpleGit(originDir).branch();
    expect(remoteBranches.all).toContain("cinq/ticket-42-test");

    // The remote commit should be the same SHA we returned.
    const remoteSha = (
      await simpleGit(originDir).revparse(["cinq/ticket-42-test"])
    ).trim();
    expect(remoteSha).toBe(result.commitSha);
  });

  it("uses the cinq-auto-resolve identity in the commit", async () => {
    await writeFile(path.join(cloneDir, "x.txt"), "x\n");
    await commitAndPush({
      repoPath: cloneDir,
      branchName: "cinq/ticket-7-x",
      ticketId: 7,
      prTitle: "chore(x): add x",
      prBody: "## Résumé\nadd x",
    });
    const log = await simpleGit(cloneDir).log({ maxCount: 1 });
    expect(log.latest?.author_name).toBe("cinq-auto-resolve");
    expect(log.latest?.author_email).toBe("auto-resolve@agencecinq.com");
  });
});

describe("buildCommitMessage", () => {
  it("uses the PR title as subject and adds the resolves footer", () => {
    const msg = buildCommitMessage({
      ticketId: 1234,
      prTitle: "feat(footer): ajoute lien Instagram",
      prBody:
        "## Résumé\nLien Instagram\n\n## Modifications\n- a.liquid : icône\n- b.json : clé\n\n## À tester\n- ok",
    });
    const lines = msg.split("\n");
    expect(lines[0]).toBe("feat(footer): ajoute lien Instagram");
    expect(msg).toContain("Résout le ticket #1234.");
    expect(msg).toContain("- a.liquid : icône");
    expect(msg).toContain("- b.json : clé");
    expect(msg).toContain(
      "Co-Authored-By: cinq-auto-resolve <auto-resolve@agencecinq.com>",
    );
  });

  it("works without a Modifications section", () => {
    const msg = buildCommitMessage({
      ticketId: 9,
      prTitle: "chore: tidy",
      prBody: "## Résumé\njust tidy",
    });
    expect(msg).toContain("Résout le ticket #9.");
    expect(msg).not.toContain("Modifications:");
  });
});
