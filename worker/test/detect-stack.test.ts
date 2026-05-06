import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import {
  detectStack,
  isStackCacheFresh,
} from "../src/jobs/detect-stack.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "detect-stack-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writePkg(content: object) {
  await writeFile(path.join(dir, "package.json"), JSON.stringify(content));
}
async function writeFileAt(rel: string, content = "") {
  const full = path.join(dir, rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content);
}

describe("detectStack", () => {
  it("detects a Shopify theme with Tailwind", async () => {
    await writePkg({
      dependencies: {
        "@shopify/cli": "^3.0.0",
        tailwindcss: "^3.4.0",
      },
      engines: { node: ">=20" },
    });
    await writeFileAt("shopify.theme.toml");
    await writeFileAt("pnpm-lock.yaml");

    const stack = await detectStack(dir);
    expect(stack.shopify).toBe(true);
    expect(stack.tailwind).toBe(true);
    expect(stack.next).toBe(false);
    expect(stack.wordpress).toBe(false);
    expect(stack.primary_runtime).toBe("node");
    expect(stack.node_version).toBe(">=20");
    expect(stack.package_manager).toBe("pnpm");
    expect(stack.flags).toEqual(
      expect.arrayContaining(["shopify", "tailwind"]),
    );
  });

  it("detects a Next.js project via config file alone", async () => {
    await writePkg({ dependencies: { react: "19.0.0" } });
    await writeFileAt("next.config.ts", "export default {};");
    await writeFileAt("package-lock.json");

    const stack = await detectStack(dir);
    expect(stack.next).toBe(true);
    expect(stack.package_manager).toBe("npm");
  });

  it("detects WordPress with composer", async () => {
    await writeFile(
      path.join(dir, "composer.json"),
      JSON.stringify({ require: { php: "^8.2" } }),
    );
    await writeFileAt("composer.lock");
    await writeFileAt("wp-config.php", "<?php // sample");
    await mkdir(path.join(dir, "wp-content"), { recursive: true });

    const stack = await detectStack(dir);
    expect(stack.wordpress).toBe(true);
    expect(stack.primary_runtime).toBe("php");
    expect(stack.php_version).toBe("^8.2");
    expect(stack.package_manager).toBe("composer");
    expect(stack.flags).toEqual(expect.arrayContaining(["wordpress", "php"]));
  });

  it("flags package manager as 'mixed' when multiple lockfiles coexist", async () => {
    await writePkg({});
    await writeFileAt("pnpm-lock.yaml");
    await writeFileAt("yarn.lock");

    const stack = await detectStack(dir);
    expect(stack.package_manager).toBe("mixed");
  });

  it("returns sensible defaults on an empty repo", async () => {
    const stack = await detectStack(dir);
    expect(stack.shopify).toBe(false);
    expect(stack.tailwind).toBe(false);
    expect(stack.wordpress).toBe(false);
    expect(stack.next).toBe(false);
    expect(stack.primary_runtime).toBe("unknown");
    expect(stack.package_manager).toBe("unknown");
    expect(stack.flags).toEqual([]);
  });

  it("survives a malformed package.json without throwing", async () => {
    await writeFile(path.join(dir, "package.json"), "{not valid json");
    const stack = await detectStack(dir);
    expect(stack.primary_runtime).toBe("unknown");
  });
});

describe("isStackCacheFresh", () => {
  const ttl = 7;
  const now = new Date("2026-05-06T12:00:00.000Z");

  it("treats null/undefined as stale", () => {
    expect(isStackCacheFresh(null, ttl, now)).toBe(false);
    expect(isStackCacheFresh(undefined, ttl, now)).toBe(false);
  });

  it("treats a 1-day-old cache as fresh", () => {
    const oneDayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
    expect(isStackCacheFresh(oneDayAgo.toISOString(), ttl, now)).toBe(true);
  });

  it("treats a 10-day-old cache as stale", () => {
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 3600 * 1000);
    expect(isStackCacheFresh(tenDaysAgo.toISOString(), ttl, now)).toBe(false);
  });

  it("rejects malformed dates as stale", () => {
    expect(isStackCacheFresh("not-a-date", ttl, now)).toBe(false);
  });
});
