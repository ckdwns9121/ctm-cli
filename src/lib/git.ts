import simpleGit from "simple-git";
import { execa } from "execa";
import { basename, dirname, join } from "node:path";
import type { WorktreeEntry } from "../types/index.js";

export function getGit(cwd = process.cwd()) {
  return simpleGit(cwd);
}

export async function getCurrentBranch(): Promise<string> {
  const result = await getGit().revparse(["--abbrev-ref", "HEAD"]);
  return result.trim();
}

export async function getRepoRoot(): Promise<string> {
  const result = await getGit().revparse(["--show-toplevel"]);
  return result.trim();
}

export async function hasUncommittedChanges(): Promise<boolean> {
  const status = await getGit().status();
  return !status.isClean();
}

export async function stashChanges(message: string): Promise<void> {
  await getGit().stash(["push", "-m", message]);
}

export async function createAndCheckout(branchName: string, baseBranch: string): Promise<void> {
  const git = getGit();

  // Fetch latest remote state
  await git.fetch(["--prune"]);

  // If branch already exists locally, just check it out
  const local = await git.branchLocal();
  if (local.all.includes(branchName)) {
    await git.checkout(branchName);
    return;
  }

  // Create new branch from origin/base
  await git.checkoutBranch(branchName, `origin/${baseBranch}`);
}

export async function checkoutBranch(branchName: string): Promise<void> {
  await getGit().checkout(branchName);
}

export async function pushBranch(branchName: string): Promise<void> {
  await getGit().push(["-u", "origin", branchName]);
}

export async function getLocalBranches(): Promise<string[]> {
  const result = await getGit().branchLocal();
  return result.all;
}

export async function deleteLocalBranch(branchName: string): Promise<void> {
  await getGit().deleteLocalBranch(branchName, true);
}

export async function deleteRemoteBranch(branchName: string): Promise<void> {
  await getGit().push(["origin", "--delete", branchName]);
}

export async function getDiffStat(baseBranch: string): Promise<{
  files: number;
  insertions: number;
  deletions: number;
}> {
  try {
    const stat = await getGit().diffSummary([`origin/${baseBranch}..HEAD`]);
    return { files: stat.files.length, insertions: stat.insertions, deletions: stat.deletions };
  } catch {
    return { files: 0, insertions: 0, deletions: 0 };
  }
}

export async function hasNewCommits(baseBranch: string): Promise<boolean> {
  try {
    const log = await getGit().log([`origin/${baseBranch}..HEAD`]);
    return log.total > 0;
  } catch {
    return false;
  }
}

/** Runs `gh pr create` and returns the PR URL */
export async function createPR(title: string, body: string): Promise<string> {
  const result = await execa("gh", ["pr", "create", "--title", title, "--body", body]);
  // gh outputs the PR URL as the last line
  const lines = result.stdout.trim().split("\n");
  return lines[lines.length - 1];
}

// ── Worktree helpers ──────────────────────────────────────────────────────

/**
 * Computes the sibling-directory path for a worktree.
 * e.g. repo=/Users/dev/my-app, branch=feat/CGKR-1423
 *   → /Users/dev/my-app--feat-CGKR-1423
 */
export function getWorktreePath(repoRoot: string, branchName: string): string {
  const repoName = basename(repoRoot);
  const safeBranch = branchName.replace(/\//g, "-");
  return join(dirname(repoRoot), `${repoName}--${safeBranch}`);
}

/**
 * `git worktree add -b <branch> <path> origin/<base>`
 * Falls back to checking out an existing local branch if it already exists.
 */
export async function addWorktree(
  worktreePath: string,
  branchName: string,
  baseBranch: string,
): Promise<void> {
  const git = getGit();
  await git.fetch(["--prune"]);

  const local = await git.branchLocal();
  if (local.all.includes(branchName)) {
    // Branch already exists — just attach a new worktree to it
    await git.raw(["worktree", "add", worktreePath, branchName]);
  } else {
    await git.raw(["worktree", "add", "-b", branchName, worktreePath, `origin/${baseBranch}`]);
  }
}

/**
 * Parses `git worktree list --porcelain` into structured entries.
 */
export async function listWorktrees(): Promise<WorktreeEntry[]> {
  const git = getGit();
  const raw = await git.raw(["worktree", "list", "--porcelain"]);

  const entries: WorktreeEntry[] = [];
  let current: Partial<WorktreeEntry> = {};

  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) entries.push(current as WorktreeEntry);
      current = { path: line.slice(9), isMain: entries.length === 0 };
    } else if (line.startsWith("HEAD ")) {
      current.head = line.slice(5);
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice(7); // e.g. refs/heads/feat/CGKR-1423
    } else if (line === "detached") {
      current.branch = "detached";
    }
  }
  if (current.path) entries.push(current as WorktreeEntry);

  return entries;
}

/**
 * `git worktree remove [--force] <path>` then prunes stale metadata.
 */
export async function removeWorktree(worktreePath: string, force = false): Promise<void> {
  const git = getGit();
  const args = ["worktree", "remove", ...(force ? ["--force"] : []), worktreePath];
  await git.raw(args);
  await git.raw(["worktree", "prune"]);
}

/**
 * Returns the worktree entry whose branch matches the given branch name, if any.
 */
export async function findWorktreeForBranch(branchName: string): Promise<WorktreeEntry | undefined> {
  const trees = await listWorktrees();
  return trees.find((t) => t.branch === `refs/heads/${branchName}`);
}
