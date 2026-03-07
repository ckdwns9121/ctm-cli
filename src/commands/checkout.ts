import chalk from "chalk";
import { select, confirm } from "@inquirer/prompts";
import { resolveIssueKey, ensureConfig } from "../lib/config.js";
import {
  getLocalBranches,
  checkoutBranch,
  hasUncommittedChanges,
  stashChanges,
  getCurrentBranch,
} from "../lib/git.js";
import { printSuccess, printWarn } from "../lib/ui.js";

export async function checkoutCommand(keyArg: string | undefined): Promise<void> {
  if (!keyArg) {
    console.error(chalk.red("Usage: ctm co <ticket-key>"));
    process.exit(1);
  }

  const config = ensureConfig();
  const issueKey = resolveIssueKey(keyArg, config.jiraProjectKey);

  const allBranches = await getLocalBranches();
  const matching = allBranches.filter((b) => b.toUpperCase().includes(issueKey));

  if (matching.length === 0) {
    console.error(chalk.red(`No local branch found for ${issueKey}`));
    process.exit(1);
  }

  let target: string;

  if (matching.length === 1) {
    target = matching[0];
  } else {
    target = await select<string>({
      message: `Multiple branches found for ${chalk.cyan(issueKey)}:`,
      choices: matching.map((b) => ({ value: b, name: b })),
    });
  }

  const currentBranch = await getCurrentBranch();
  if (currentBranch === target) {
    printWarn(`Already on ${chalk.cyan(target)}`);
    return;
  }

  if (await hasUncommittedChanges()) {
    printWarn(`Uncommitted changes on "${currentBranch}".`);
    const shouldStash = await confirm({
      message: "Stash them before switching?",
      default: true,
    });
    if (shouldStash) {
      await stashChanges(`ctm: stash before ${target}`);
      printSuccess("Changes stashed.");
    }
  }

  await checkoutBranch(target);
  printSuccess(`Switched to ${chalk.cyan(target)}`);
}
