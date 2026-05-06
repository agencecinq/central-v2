import { describe, expect, it } from "vitest";
import {
  buildPrOpenedBlocks,
  buildPrOpenedPlainText,
} from "../src/lib/slack-messages.js";

const baseInput = {
  ticketId: 1234,
  ticketTitle: "Ajouter un lien Instagram dans le footer",
  repoFullName: "agencecinq/milia-matcha",
  branchName: "cinq/ticket-1234-instagram-footer",
  agentSummary: "Ajout du lien dans footer.liquid + locales.",
  diffStats: {
    filesChanged: 2,
    insertions: 18,
    deletions: 2,
    files: ["sections/footer.liquid", "locales/fr.default.json"],
  },
  durationMs: 4 * 60_000 + 12_000,
  costUsd: 0.31,
  tokensInput: 78_000,
  tokensOutput: 4_000,
  prUrl: "https://github.com/agencecinq/milia-matcha/pull/42",
  prNumber: 42,
};

describe("buildPrOpenedBlocks", () => {
  it("renders a header WITHOUT the DRY-RUN tag", () => {
    const blocks = buildPrOpenedBlocks(baseInput);
    const header = blocks.find((b) => b.type === "header") as
      | { text: { text: string } }
      | undefined;
    expect(header?.text.text).toContain("TKT-1234");
    expect(header?.text.text).not.toContain("DRY-RUN");
  });

  it("includes a section linking to the PR with a primary button", () => {
    const blocks = buildPrOpenedBlocks(baseInput);
    const json = JSON.stringify(blocks);
    expect(json).toContain("PR #42");
    expect(json).toContain(baseInput.prUrl);
    expect(json).toContain("Voir la PR");
    expect(json).toContain('"style":"primary"');
  });

  it("preserves the file/line/duration/cost fields", () => {
    const blocks = buildPrOpenedBlocks(baseInput);
    const json = JSON.stringify(blocks);
    expect(json).toContain("2 modifiés");
    expect(json).toContain("+18 / -2");
    expect(json).toContain("4m 12s");
    expect(json).toContain("$0.31");
  });
});

describe("buildPrOpenedPlainText", () => {
  it("includes ticket title, branch, PR URL and stats on 4 lines", () => {
    const txt = buildPrOpenedPlainText(baseInput);
    const lines = txt.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain(baseInput.prUrl);
    expect(lines[2]).toContain("PR #42");
  });
});
