import chalk from "chalk";
import { confirm } from "@inquirer/prompts";
import ora from "ora";
import { ensureConfig, resolveIssueKey, extractIssueKeyFromBranch } from "../lib/config.js";
import {
  listWorktrees,
  removeWorktree,
  deleteLocalBranch,
  deleteRemoteBranch,
  findWorktreeForBranch,
  getLocalBranches,
} from "../lib/git.js";
import { printSuccess, printError, printWarn } from "../lib/ui.js";
import type { WorktreeEntry } from "../types/index.js";

// ── List ──────────────────────────────────────────────────────────────────

export async function worktreeListCommand(): Promise<void> {
  let trees: WorktreeEntry[];
  try {
    trees = await listWorktrees();
  } catch (err) {
    printError(`Failed to list worktrees: ${String(err)}`);
    process.exit(1);
  }

  console.log();

  if (trees.length === 0) {
    console.log(chalk.dim("  No worktrees found.\n"));
    return;
  }

  // Header
  console.log(
    `  ${"PATH".padEnd(52)} ${"BRANCH".padEnd(30)} HEAD`,
  );
  console.log(chalk.dim(`  ${"─".repeat(52)} ${"─".repeat(30)} ${"─".repeat(7)}`));

  for (const t of trees) {
    const pathLabel = t.isMain ? `${t.path}  ${chalk.dim("(main)")}` : t.path;
    // strip refs/heads/ prefix for display
    const branchDisplay = t.branch.replace("refs/heads/", "");
    const shortHead = t.head.slice(0, 7);

    const pathCol = chalk.cyan(pathLabel.length > 50 ? "…" + pathLabel.slice(-49) : pathLabel);
    const branchCol = t.isMain ? chalk.dim(branchDisplay) : chalk.white(branchDisplay);

    console.log(`  ${pathCol.padEnd(52)} ${branchCol.padEnd(30)} ${chalk.dim(shortHead)}`);
  }

  console.log();
  console.log(chalk.dim(`  ${trees.length} worktree(s)  ·  ctm wt rm [key] to remove`));
  console.log();
}

// ── Remove ────────────────────────────────────────────────────────────────

interface RemoveOptions {
  branch?: boolean; // -b: also delete the git branch
  force?: boolean;  // -f: force remove even with untracked files
}

export async function worktreeRemoveCommand(
  keyArg: string | undefined,
  options: RemoveOptions,
): Promise<void> {
  const config = ensureConfig();

  // ── Resolve which branch we're targeting ──────────────────────────────
  let branchName: string;

  if (keyArg) {
    const issueKey = resolveIssueKey(keyArg, config.jiraProjectKey);
    // Find a local branch that contains this issue key
    const branches = await getLocalBranches();
    const match = branches.find((b) => b.includes(issueKey));
    if (!match) {
      printError(`No local branch found matching issue key "${issueKey}".`);
      process.exit(1);
    }
    branchName = match;
  } else {
    // Try to detect from worktrees: list non-main worktrees and let user pick
    // For now, require an explicit key
    printError("Please specify an issue key: ctm wt rm <key>");
    console.log(chalk.dim("  Example: ctm wt rm CGKR-1423  or  ctm wt rm 1423"));
    process.exit(1);
  }

  // ── Find the worktree ─────────────────────────────────────────────────
  const tree = await findWorktreeForBranch(branchName);
  if (!tree) {
    // Maybe the issue key is in the branch name differently
    // Try matching by issue key substring in the branch
    const issueKey = extractIssueKeyFromBranch(branchName) ?? branchName;
    const all = await listWorktrees();
    const fuzzy = all.find(
      (t) => !t.isMain && t.branch.includes(issueKey),
    );
    if (!fuzzy) {
      printWarn(`No worktree found for branch "${branchName}".`);
      console.log(chalk.dim("  Use ctm wt to see existing worktrees."));
      process.exit(0);
    }
    return doRemove(fuzzy, branchName, options);
  }

  return doRemove(tree, branchName, options);
}

async function doRemove(
  tree: WorktreeEntry,
  branchName: string,
  options: RemoveOptions,
): Promise<void> {
  const branchDisplay = tree.branch.replace("refs/heads/", "");

  console.log();
  console.log(`  ${chalk.bold("Worktree:")} ${chalk.cyan(tree.path)}`);
  console.log(`  ${chalk.bold("Branch:")}   ${chalk.cyan(branchDisplay)}`);
  console.log();

  const confirmed = await confirm({
    message: `Remove worktree at "${tree.path}"?`,
    default: false,
  });
  if (!confirmed) process.exit(0);

  // ── Remove worktree directory ─────────────────────────────────────────
  const spinner = ora("Removing worktree…").start();
  try {
    await removeWorktree(tree.path, options.force);
    spinner.succeed(`Worktree removed: ${chalk.cyan(tree.path)}`);
  } catch (err) {
    spinner.fail(`Failed to remove worktree: ${String(err)}`);
    console.log(chalk.dim("  Try: ctm wt rm <key> --force"));
    process.exit(1);
  }

  // ── Optionally delete the branch too ─────────────────────────────────
  const deleteBranch =
    options.branch ??
    (await confirm({
      message: `Also delete branch "${branchDisplay}"?`,
      default: false,
    }));

  if (deleteBranch) {
    try {
      await deleteLocalBranch(branchName);
      printSuccess(`Local branch "${branchDisplay}" deleted.`);
    } catch (err) {
      printWarn(`Could not delete local branch: ${String(err)}`);
    }

    const deleteRemote = await confirm({
      message: `Also delete remote branch origin/${branchDisplay}?`,
      default: false,
    });
    if (deleteRemote) {
      try {
        await deleteRemoteBranch(branchName);
        printSuccess("Remote branch deleted.");
      } catch (err) {
        printWarn(`Could not delete remote branch: ${String(err)}`);
      }
    }
  }

  console.log();
  printSuccess("Done.");
  console.log();
}
