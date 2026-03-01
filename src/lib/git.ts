import simpleGit from "simple-git";
import { execa } from "execa";

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
