import { mkdir, rm } from "fs/promises";
import path from "path";
import { simpleGit } from "simple-git";
import { getEnv } from "../config/env.js";
import { logger } from "./logger.js";

const ALLOWED_HOST = "github.com";
const ALLOWED_OWNER = "agencecinq";

export class RepoNotAllowedError extends Error {}

export type CloneOptions = {
  repoUrl: string;
  branch: string;
  /** Subfolder name under WORK_DIR. Caller must guarantee uniqueness. */
  workdirSlug: string;
  depth?: number;
};

export type ClonedRepo = {
  path: string;
  cleanup: () => Promise<void>;
};

/**
 * Shallow-clone a public/private GitHub repo using the worker's GITHUB_PAT.
 * Enforces that the repo lives under github.com/agencecinq/* — anything else
 * is rejected to keep V1 within the agreed scope (spec §14.1).
 */
export async function cloneRepo(opts: CloneOptions): Promise<ClonedRepo> {
  const env = getEnv();
  assertAgenceCinqRepo(opts.repoUrl);

  const dest = path.join(env.WORK_DIR, opts.workdirSlug);
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });

  const authedUrl = injectPat(opts.repoUrl, env.GITHUB_PAT);
  const git = simpleGit();

  logger.info(
    { repoUrl: opts.repoUrl, branch: opts.branch, dest },
    "cloning repo",
  );

  await git.clone(authedUrl, dest, [
    "--depth",
    String(opts.depth ?? 1),
    "--single-branch",
    "--branch",
    opts.branch,
  ]);

  return {
    path: dest,
    cleanup: async () => {
      await rm(dest, { recursive: true, force: true });
    },
  };
}

export function assertAgenceCinqRepo(repoUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(repoUrl);
  } catch {
    throw new RepoNotAllowedError(`Invalid repo URL: ${repoUrl}`);
  }
  if (parsed.hostname.toLowerCase() !== ALLOWED_HOST) {
    throw new RepoNotAllowedError(
      `Only ${ALLOWED_HOST} repos are allowed, got ${parsed.hostname}`,
    );
  }
  const segments = parsed.pathname.replace(/^\/+/, "").split("/");
  const owner = segments[0]?.toLowerCase();
  if (owner !== ALLOWED_OWNER) {
    throw new RepoNotAllowedError(
      `Only repos under ${ALLOWED_OWNER}/* are allowed, got owner "${owner}"`,
    );
  }
}

export function injectPat(repoUrl: string, pat: string): string {
  const url = new URL(repoUrl);
  // GitHub accepts x-access-token as the username for token auth.
  url.username = "x-access-token";
  url.password = pat;
  return url.toString();
}
