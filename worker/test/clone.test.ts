import { describe, expect, it } from "vitest";
import {
  assertAgenceCinqRepo,
  injectPat,
  RepoNotAllowedError,
} from "../src/lib/clone.js";

describe("assertAgenceCinqRepo", () => {
  it("accepts repos under github.com/agencecinq/*", () => {
    expect(() =>
      assertAgenceCinqRepo("https://github.com/agencecinq/milia-matcha"),
    ).not.toThrow();
    expect(() =>
      assertAgenceCinqRepo("https://github.com/agencecinq/Milia-Matcha.git"),
    ).not.toThrow();
  });

  it("rejects repos hosted elsewhere", () => {
    expect(() =>
      assertAgenceCinqRepo("https://gitlab.com/agencecinq/foo"),
    ).toThrow(RepoNotAllowedError);
    expect(() =>
      assertAgenceCinqRepo("https://bitbucket.org/agencecinq/foo"),
    ).toThrow(RepoNotAllowedError);
  });

  it("rejects repos under other GitHub orgs", () => {
    expect(() =>
      assertAgenceCinqRepo("https://github.com/someclient/their-repo"),
    ).toThrow(RepoNotAllowedError);
  });

  it("rejects malformed URLs", () => {
    expect(() => assertAgenceCinqRepo("not a url")).toThrow(
      RepoNotAllowedError,
    );
  });
});

describe("injectPat", () => {
  it("injects the PAT as x-access-token credentials", () => {
    const url = injectPat(
      "https://github.com/agencecinq/foo",
      "ghp_secret123",
    );
    expect(url).toBe("https://x-access-token:ghp_secret123@github.com/agencecinq/foo");
  });

  it("URL-encodes special characters in the PAT", () => {
    const url = injectPat(
      "https://github.com/agencecinq/foo",
      "ghp:weird@chars",
    );
    // password gets URL-encoded by the URL API
    expect(url).toContain("x-access-token:");
    expect(url).toContain("@github.com/agencecinq/foo");
    expect(url).not.toContain(":weird@chars@");
  });
});
