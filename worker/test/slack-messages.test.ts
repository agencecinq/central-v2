import { describe, expect, it } from "vitest";
import {
  buildDryRunBlocks,
  buildDryRunPlainText,
  fmtDuration,
} from "../src/lib/slack-messages.js";

const baseInput = {
  ticketId: 1234,
  ticketTitle: "Ajouter un lien Instagram dans le footer",
  repoFullName: "agencecinq/milia-matcha",
  branchName: "cinq/ticket-1234-instagram-footer",
  agentSummary:
    "Ajout du lien Instagram dans sections/footer.liquid + locales/fr.default.json.",
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
};

describe("fmtDuration", () => {
  it("renders sub-minute durations as seconds only", () => {
    expect(fmtDuration(45_000)).toBe("45s");
  });
  it("renders multi-minute durations", () => {
    expect(fmtDuration(4 * 60_000 + 12_000)).toBe("4m 12s");
  });
});

describe("buildDryRunBlocks", () => {
  it("contains a header with the ticket id and the DRY-RUN tag", () => {
    const blocks = buildDryRunBlocks(baseInput);
    const header = blocks.find((b) => b.type === "header") as
      | { text: { text: string } }
      | undefined;
    expect(header?.text.text).toContain("TKT-1234");
    expect(header?.text.text).toContain("DRY-RUN");
  });

  it("includes file count, line stats, duration and cost as fields", () => {
    const blocks = buildDryRunBlocks(baseInput);
    const json = JSON.stringify(blocks);
    expect(json).toContain("2 modifiés");
    expect(json).toContain("+18 / -2");
    expect(json).toContain("4m 12s");
    expect(json).toContain("$0.31");
  });

  it("lists modified files with backtick formatting", () => {
    const blocks = buildDryRunBlocks(baseInput);
    const json = JSON.stringify(blocks);
    expect(json).toContain("`sections/footer.liquid`");
    expect(json).toContain("`locales/fr.default.json`");
  });

  it("truncates the file list and shows a +N more hint when long", () => {
    const longFiles = Array.from({ length: 12 }, (_, i) => `file-${i}.ts`);
    const blocks = buildDryRunBlocks({
      ...baseInput,
      diffStats: { ...baseInput.diffStats, files: longFiles },
    });
    const json = JSON.stringify(blocks);
    expect(json).toContain("+4 fichiers");
  });

  it("handles an empty file list gracefully", () => {
    const blocks = buildDryRunBlocks({
      ...baseInput,
      diffStats: {
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
        files: [],
      },
    });
    const json = JSON.stringify(blocks);
    expect(json).toContain("Aucun fichier modifié");
  });
});

describe("buildDryRunPlainText", () => {
  it("packs the essentials in 4 short lines", () => {
    const txt = buildDryRunPlainText(baseInput);
    expect(txt).toContain("TKT-1234");
    expect(txt).toContain("agencecinq/milia-matcha");
    expect(txt).toContain("2 fichiers");
    expect(txt.split("\n")).toHaveLength(4);
  });
});
