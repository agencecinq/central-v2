import { describe, expect, it } from "vitest";
import {
  buildCiFailureBlocks,
  buildCiFailurePlainText,
  buildPrCommentMarkdown,
} from "../src/lib/ci-feedback-messages.js";

const input = {
  ticketId: 1234,
  ticketTitle: "Ajouter un lien Instagram",
  workflowName: "lint",
  conclusion: "failure",
  workflowUrl: "https://github.com/agencecinq/foo/actions/runs/1",
  prUrl: "https://github.com/agencecinq/foo/pull/42",
  prNumber: 42,
};

describe("buildCiFailureBlocks", () => {
  it("uses the warning emoji and references the PR + ticket", () => {
    const blocks = buildCiFailureBlocks(input);
    const json = JSON.stringify(blocks);
    expect(json).toContain("⚠️");
    expect(json).toContain("PR #42");
    expect(json).toContain("TKT-1234");
  });

  it("links to the GitHub workflow run", () => {
    const blocks = buildCiFailureBlocks(input);
    const json = JSON.stringify(blocks);
    expect(json).toContain(input.workflowUrl);
    expect(json).toContain("Voir le run GitHub");
  });

  it("falls back to 'la PR' when prNumber is null", () => {
    const blocks = buildCiFailureBlocks({ ...input, prNumber: null });
    const json = JSON.stringify(blocks);
    expect(json).toContain("CI rouge sur la PR");
    expect(json).not.toContain("PR #");
  });
});

describe("buildCiFailurePlainText", () => {
  it("packs the essentials in a single line", () => {
    const txt = buildCiFailurePlainText(input);
    expect(txt).toContain("⚠️");
    expect(txt).toContain("TKT-1234");
    expect(txt).toContain("PR #42");
    expect(txt).toContain("workflow lint");
    expect(txt).toContain("failure");
    expect(txt).toContain(input.workflowUrl);
    expect(txt.split("\n")).toHaveLength(1);
  });
});

describe("buildPrCommentMarkdown", () => {
  it("includes the workflow name, conclusion and a link", () => {
    const md = buildPrCommentMarkdown(input);
    expect(md).toContain("⚠️ Auto-resolve · CI rouge");
    expect(md).toContain("`lint`");
    expect(md).toContain("`failure`");
    expect(md).toContain(input.workflowUrl);
  });

  it("warns the human reader before merging", () => {
    const md = buildPrCommentMarkdown(input);
    expect(md.toLowerCase()).toContain("humain");
  });
});
