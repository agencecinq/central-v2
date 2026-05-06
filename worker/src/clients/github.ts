import { Octokit } from "@octokit/rest";
import { getEnv } from "../config/env.js";

let client: Octokit | null = null;

export function getOctokit(): Octokit {
  if (client) return client;
  const env = getEnv();
  client = new Octokit({
    auth: env.GITHUB_PAT,
    userAgent: "cinq-auto-resolve/0.1",
  });
  return client;
}

export type RepoCoords = { owner: string; repo: string };

export function parseRepoCoords(repoUrl: string): RepoCoords {
  const u = new URL(repoUrl);
  const segments = u.pathname.replace(/^\/+/, "").split("/");
  const owner = segments[0];
  const repoSeg = segments[1];
  if (!owner || !repoSeg) {
    throw new Error(`Cannot parse owner/repo from URL: ${repoUrl}`);
  }
  const repo = repoSeg.replace(/\.git$/, "");
  return { owner, repo };
}

export type CreatedPullRequest = {
  number: number;
  url: string;
};

export async function createDraftPullRequest(opts: {
  repoUrl: string;
  branch: string;
  baseBranch: string;
  title: string;
  body: string;
}): Promise<CreatedPullRequest> {
  const octokit = getOctokit();
  const { owner, repo } = parseRepoCoords(opts.repoUrl);

  const res = await octokit.rest.pulls.create({
    owner,
    repo,
    title: opts.title,
    body: opts.body,
    head: opts.branch,
    base: opts.baseBranch,
    draft: true,
  });

  return {
    number: res.data.number,
    url: res.data.html_url,
  };
}

/**
 * Post a comment on an existing PR (uses the issues API since PR comments
 * and issue comments share the same endpoint on GitHub).
 */
export async function commentOnPullRequest(opts: {
  repoUrl: string;
  prNumber: number;
  body: string;
}): Promise<void> {
  const octokit = getOctokit();
  const { owner, repo } = parseRepoCoords(opts.repoUrl);
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: opts.prNumber,
    body: opts.body,
  });
}
