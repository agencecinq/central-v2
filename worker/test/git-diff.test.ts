import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { simpleGit } from "simple-git";
import { captureRepoDiff } from "../src/lib/git-diff.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "git-diff-"));
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig("user.email", "test@example.com");
  await git.addConfig("user.name", "Test");
  await writeFile(path.join(dir, "README.md"), "# Initial\n");
  await git.add(["README.md"]);
  await git.commit("init");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("captureRepoDiff", () => {
  it("returns an empty diff on an untouched repo", async () => {
    const diff = await captureRepoDiff(dir);
    expect(diff.isEmpty).toBe(true);
    expect(diff.stats.filesChanged).toBe(0);
  });

  it("captures untracked files via stage-everything", async () => {
    await writeFile(path.join(dir, "new.txt"), "hello\nworld\n");
    const diff = await captureRepoDiff(dir);
    expect(diff.isEmpty).toBe(false);
    expect(diff.stats.files).toContain("new.txt");
    expect(diff.stats.insertions).toBe(2);
    expect(diff.stats.deletions).toBe(0);
  });

  it("counts edits to existing files", async () => {
    await writeFile(path.join(dir, "README.md"), "# Initial\n# Added line\n");
    const diff = await captureRepoDiff(dir);
    expect(diff.stats.filesChanged).toBe(1);
    expect(diff.stats.insertions).toBe(1);
  });

  it("collects multi-file stats", async () => {
    await writeFile(path.join(dir, "a.txt"), "a\n");
    await writeFile(path.join(dir, "b.txt"), "b1\nb2\n");
    const diff = await captureRepoDiff(dir);
    expect(diff.stats.filesChanged).toBe(2);
    expect(diff.stats.insertions).toBe(3);
    expect(diff.stats.files).toEqual(
      expect.arrayContaining(["a.txt", "b.txt"]),
    );
  });
});
