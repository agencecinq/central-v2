import { simpleGit } from "simple-git";

export type DiffStats = {
  filesChanged: number;
  insertions: number;
  deletions: number;
  files: string[];
};

export type RepoDiff = {
  patch: string;
  stats: DiffStats;
  isEmpty: boolean;
};

/**
 * Snapshot the agent's modifications: stage everything (so untracked files
 * are included) and capture the unified diff and shortstat against HEAD.
 *
 * The repo state is left as-is; we don't unstage. The caller is responsible
 * for cleaning up the clone afterwards.
 */
export async function captureRepoDiff(repoPath: string): Promise<RepoDiff> {
  const git = simpleGit(repoPath);

  // Stage everything so untracked files appear in the diff.
  await git.add(["-A"]);

  const patch = await git.diff(["--cached", "--no-color"]);
  const stats = await parseDiffStats(repoPath);

  return {
    patch,
    stats,
    isEmpty: patch.trim().length === 0,
  };
}

async function parseDiffStats(repoPath: string): Promise<DiffStats> {
  const git = simpleGit(repoPath);
  const numstat = await git.diff(["--cached", "--numstat"]);

  const files: string[] = [];
  let insertions = 0;
  let deletions = 0;

  for (const line of numstat.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [adds, dels, ...rest] = trimmed.split("\t");
    const path = rest.join("\t");
    if (!path) continue;
    files.push(path);
    if (adds && adds !== "-") insertions += Number(adds) || 0;
    if (dels && dels !== "-") deletions += Number(dels) || 0;
  }

  return {
    filesChanged: files.length,
    insertions,
    deletions,
    files,
  };
}
