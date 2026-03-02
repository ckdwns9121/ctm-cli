import chalk from "chalk";
import { confirm } from "@inquirer/prompts";
import ora from "ora";
import { ensureConfig, resolveIssueKey, extractIssueKeyFromBranch } from "../lib/config.js";
import {
  getCurrentBranch,
  getLocalBranches,
  deleteLocalBranch,
  deleteRemoteBranch,
  checkoutBranch,
  findWorktreeForBranch,
  removeWorktree,
} from "../lib/git.js";
import { printSuccess, printError, printWarn } from "../lib/ui.js";

export async function cleanCommand(keyArg: string | undefined): Promise<void> {
  const config = ensureConfig();
  const currentBranch = await getCurrentBranch();

  // ── Resolve which branch to clean ─────────────────────────────────────
  let branchToClean: string;

  if (keyArg) {
    const key = resolveIssueKey(keyArg, config.jiraProjectKey);
    const branches = await getLocalBranches();
    const match = branches.find((b) => b.includes(key));
    if (!match) {
      printError(`No local branch found matching issue key "${key}".`);
      console.log(chalk.dim(`  Local branches: ${branches.slice(0, 5).join(", ")}`));
      process.exit(1);
    }
    branchToClean = match;
  } else {
    // Infer from current branch
    const key = extractIssueKeyFromBranch(currentBranch);
    if (!key) {
      printError(
        `Cannot detect issue key from branch "${currentBranch}". Pass it explicitly: ctm clean CTM-123`,
      );
      process.exit(1);
    }
    branchToClean = currentBranch;
  }

  console.log();
  console.log(`Branch to delete: ${chalk.cyan(branchToClean)}`);
  console.log();

  const confirmed = await confirm({
    message: `Delete branch "${branchToClean}"?`,
    default: false,
  });
  if (!confirmed) process.exit(0);

  // ── If we're on the branch, switch to base first ───────────────────────
  if (branchToClean === currentBranch) {
    const switchSpinner = ora(`Switching to ${chalk.cyan(config.baseBranch)}…`).start();
    try {
      await checkoutBranch(config.baseBranch);
      switchSpinner.succeed(`Switched to ${chalk.cyan(config.baseBranch)}`);
    } catch (err) {
      switchSpinner.fail(`Cannot switch to base branch: ${String(err)}`);
      process.exit(1);
    }
  }

  // ── Worktree check: remove before deleting branch ────────────────────
  const worktree = await findWorktreeForBranch(branchToClean);
  if (worktree) {
    printWarn(`Worktree found: ${chalk.cyan(worktree.path)}`);
    const removeWt = await confirm({
      message: `Remove worktree directory as well?`,
      default: true,
    });
    if (removeWt) {
      const wtSpinner = ora("Removing worktree…").start();
      try {
        await removeWorktree(worktree.path);
        wtSpinner.succeed(`Worktree removed: ${chalk.cyan(worktree.path)}`);
      } catch (err) {
        wtSpinner.fail(`Could not remove worktree: ${String(err)}`);
        printWarn("Continuing with branch deletion anyway.");
      }
    }
  }

  // ── Delete local branch ────────────────────────────────────────────────
  const localSpinner = ora("Deleting local branch…").start();
  try {
    await deleteLocalBranch(branchToClean);
    localSpinner.succeed(`Deleted local branch ${chalk.cyan(branchToClean)}`);
  } catch (err) {
    localSpinner.fail(`Failed: ${String(err)}`);
  }

  // ── Optionally delete remote ───────────────────────────────────────────
  const deleteRemote = await confirm({
    message: `Also delete remote branch origin/${branchToClean}?`,
    default: false,
  });

  if (deleteRemote) {
    const remoteSpinner = ora("Deleting remote branch…").start();
    try {
      await deleteRemoteBranch(branchToClean);
      remoteSpinner.succeed("Remote branch deleted.");
    } catch (err) {
      remoteSpinner.fail(`Failed: ${String(err)}`);
    }
  }

  console.log();
  printSuccess("Cleanup complete.");
  console.log();
}
