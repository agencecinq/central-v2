import { readFile, stat } from "fs/promises";
import path from "path";

export type DetectedStack = {
  /** ISO timestamp of when this detection was made. */
  detected_at: string;
  /** Indicators we report on. False is explicit (vs. undefined = unknown). */
  shopify: boolean;
  tailwind: boolean;
  wordpress: boolean;
  next: boolean;
  /** "node", "php", or "unknown". */
  primary_runtime: "node" | "php" | "unknown";
  node_version: string | null;
  php_version: string | null;
  package_manager:
    | "pnpm"
    | "yarn"
    | "npm"
    | "composer"
    | "mixed"
    | "unknown";
  /** Names of frameworks/tools we positively detected, for prompt context. */
  flags: string[];
};

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonSafe<T = unknown>(p: string): Promise<T | null> {
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: { node?: string };
};

type ComposerJson = {
  require?: Record<string, string>;
};

export async function detectStack(repoPath: string): Promise<DetectedStack> {
  const flags: string[] = [];
  let nodeVersion: string | null = null;
  let phpVersion: string | null = null;
  let packageManager: DetectedStack["package_manager"] = "unknown";

  // ── Node side ──
  const pkg = await readJsonSafe<PackageJson>(
    path.join(repoPath, "package.json"),
  );
  const allNodeDeps = pkg
    ? { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
    : null;

  const tailwind = !!allNodeDeps && "tailwindcss" in allNodeDeps;
  if (tailwind) flags.push("tailwind");

  const next =
    (!!allNodeDeps && "next" in allNodeDeps) ||
    (await exists(path.join(repoPath, "next.config.js"))) ||
    (await exists(path.join(repoPath, "next.config.ts"))) ||
    (await exists(path.join(repoPath, "next.config.mjs")));
  if (next) flags.push("next");

  const shopifyByDeps =
    !!allNodeDeps && ("@shopify/cli" in allNodeDeps || "@shopify/cli-kit" in allNodeDeps);
  const shopifyByFiles =
    (await exists(path.join(repoPath, "shopify.theme.toml"))) ||
    (await exists(path.join(repoPath, "shopify.app.toml")));
  const shopify = shopifyByDeps || shopifyByFiles;
  if (shopify) flags.push("shopify");

  if (pkg?.engines?.node) {
    nodeVersion = pkg.engines.node;
  }

  // Package manager detection (lockfile-based — most reliable)
  const hasPnpm = await exists(path.join(repoPath, "pnpm-lock.yaml"));
  const hasYarn = await exists(path.join(repoPath, "yarn.lock"));
  const hasNpm = await exists(path.join(repoPath, "package-lock.json"));
  const lockCount = [hasPnpm, hasYarn, hasNpm].filter(Boolean).length;
  if (lockCount > 1) {
    packageManager = "mixed";
  } else if (hasPnpm) {
    packageManager = "pnpm";
  } else if (hasYarn) {
    packageManager = "yarn";
  } else if (hasNpm) {
    packageManager = "npm";
  }

  // ── PHP / WordPress side ──
  const composer = await readJsonSafe<ComposerJson>(
    path.join(repoPath, "composer.json"),
  );
  const hasComposer = composer !== null;
  const hasComposerLock = await exists(path.join(repoPath, "composer.lock"));
  if (hasComposer) {
    flags.push("php");
    phpVersion = composer.require?.php ?? null;
  }
  if (hasComposerLock && packageManager === "unknown") {
    packageManager = "composer";
  }

  const wordpress =
    (await exists(path.join(repoPath, "wp-config.php"))) ||
    (await exists(path.join(repoPath, "wp-config-sample.php"))) ||
    (await exists(path.join(repoPath, "wp-content")));
  if (wordpress) flags.push("wordpress");

  let primaryRuntime: DetectedStack["primary_runtime"] = "unknown";
  if (pkg && hasComposer) {
    primaryRuntime = wordpress ? "php" : "node";
  } else if (pkg) {
    primaryRuntime = "node";
  } else if (hasComposer || wordpress) {
    primaryRuntime = "php";
  }

  return {
    detected_at: new Date().toISOString(),
    shopify,
    tailwind,
    wordpress,
    next,
    primary_runtime: primaryRuntime,
    node_version: nodeVersion,
    php_version: phpVersion,
    package_manager: packageManager,
    flags,
  };
}

/**
 * Returns true if the cached detection is still fresh per the configured TTL.
 */
export function isStackCacheFresh(
  detectedStackAt: string | Date | null | undefined,
  ttlDays: number,
  now: Date = new Date(),
): boolean {
  if (!detectedStackAt) return false;
  const cachedAt =
    typeof detectedStackAt === "string"
      ? new Date(detectedStackAt)
      : detectedStackAt;
  if (Number.isNaN(cachedAt.getTime())) return false;
  const ageMs = now.getTime() - cachedAt.getTime();
  return ageMs < ttlDays * 24 * 3600 * 1000;
}
