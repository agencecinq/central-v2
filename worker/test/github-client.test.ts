import { describe, expect, it } from "vitest";
import { parseRepoCoords } from "../src/clients/github.js";

describe("parseRepoCoords", () => {
  it("extracts owner and repo from a vanilla GitHub URL", () => {
    const c = parseRepoCoords("https://github.com/agencecinq/milia-matcha");
    expect(c.owner).toBe("agencecinq");
    expect(c.repo).toBe("milia-matcha");
  });

  it("strips a trailing .git", () => {
    const c = parseRepoCoords(
      "https://github.com/agencecinq/milia-matcha.git",
    );
    expect(c.repo).toBe("milia-matcha");
  });

  it("handles a URL with a trailing slash", () => {
    const c = parseRepoCoords("https://github.com/agencecinq/milia-matcha/");
    expect(c.owner).toBe("agencecinq");
    expect(c.repo).toBe("milia-matcha");
  });

  it("throws on a URL without owner/repo segments", () => {
    expect(() =>
      parseRepoCoords("https://github.com/"),
    ).toThrow(/Cannot parse owner/);
  });
});
