import { describe, expect, it } from "vitest";
import {
  getRepoFullNameFromUrl,
  makeBranchName,
  slugify,
} from "../src/lib/branch-name.js";

describe("slugify", () => {
  it("strips diacritics and lowercases", () => {
    expect(slugify("Ajouter le lien Façade")).toBe("ajouter-le-lien-facade");
  });

  it("collapses spaces and special chars to single dashes", () => {
    expect(slugify("Fix:: button   hover & focus!!")).toBe(
      "fix-button-hover-focus",
    );
  });

  it("trims trailing dashes after truncation", () => {
    const long = "abcdefghij ".repeat(5).trim(); // 50 chars
    const slug = slugify(long);
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug).not.toMatch(/-$/);
  });
});

describe("makeBranchName", () => {
  it("produces the spec'd `cinq/ticket-{id}-{slug}` format", () => {
    expect(
      makeBranchName(1234, "Ajouter un lien Instagram dans le footer"),
    ).toBe("cinq/ticket-1234-ajouter-un-lien-instagram-dans-le-footer");
  });

  it("truncates slug at the configured limit", () => {
    const longTitle =
      "Réécrire complètement le composant principal du dashboard utilisateur";
    const branch = makeBranchName(42, longTitle);
    expect(branch.startsWith("cinq/ticket-42-")).toBe(true);
    const slugPart = branch.replace("cinq/ticket-42-", "");
    expect(slugPart.length).toBeLessThanOrEqual(40);
  });

  it("falls back to 'ticket' if the title slugs to empty", () => {
    expect(makeBranchName(99, "!!!")).toBe("cinq/ticket-99-ticket");
  });
});

describe("getRepoFullNameFromUrl", () => {
  it("extracts owner/repo from a GitHub URL", () => {
    expect(
      getRepoFullNameFromUrl("https://github.com/agencecinq/milia-matcha"),
    ).toBe("agencecinq/milia-matcha");
  });

  it("strips a trailing .git", () => {
    expect(
      getRepoFullNameFromUrl("https://github.com/agencecinq/milia-matcha.git"),
    ).toBe("agencecinq/milia-matcha");
  });

  it("returns the input on a malformed URL", () => {
    expect(getRepoFullNameFromUrl("not a url")).toBe("not a url");
  });
});
