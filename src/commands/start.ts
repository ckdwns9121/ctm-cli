import chalk from "chalk";
import ora from "ora";
import { select, input, confirm } from "@inquirer/prompts";
import {
  ensureConfig,
  resolveIssueKey,
  buildBranchName,
  smartBranchPrefix,
  BRANCH_PREFIXES,
} from "../lib/config.js";
import { initJira, getMyIssues, getIssue, updateIssueStatus } from "../lib/jira.js";
import {
  getCurrentBranch,
  createAndCheckout,
  hasUncommittedChanges,
  stashChanges,
} from "../lib/git.js";
import { printIssue, printSuccess, printWarn } from "../lib/ui.js";
import type { CtmIssue } from "../types/index.js";

async function pickIssueInteractively(
  config: ReturnType<typeof ensureConfig>,
): Promise<CtmIssue> {
  const spinner = ora("Loading your issues…").start();
  const issues = await getMyIssues(config.jiraAccountId, {
    projectKey: config.jiraProjectKey,
  });
  spinner.stop();

  if (issues.length === 0) {
    throw new Error("No open issues assigned to you in this project.");
  }

  const key = await select<string>({
    message: "Select an issue to start:",
    choices: issues.map((i) => ({
      value: i.key,
      name: `${chalk.cyan(i.key.padEnd(12))} ${
        (i.title.length > 54 ? i.title.slice(0, 53) + "…" : i.title).padEnd(55)
      } ${chalk.dim(i.priority.name)}`,
    })),
    pageSize: 12,
  });

  return issues.find((i) => i.key === key)!;
}

export async function startCommand(keyArg: string | undefined): Promise<void> {
  const config = ensureConfig();
  initJira({
    baseUrl: config.jiraBaseUrl,
    email: config.jiraEmail,
    apiToken: config.jiraApiToken,
  });

  // ── Resolve issue ──────────────────────────────────────────────────────
  let issue: CtmIssue;
  if (!keyArg) {
    issue = await pickIssueInteractively(config);
  } else {
    const key = resolveIssueKey(keyArg, config.jiraProjectKey);
    const spinner = ora(`Fetching ${key}…`).start();
    issue = await getIssue(key);
    spinner.succeed(`Found: ${chalk.cyan(issue.key)} — ${issue.title}`);
  }

  printIssue(issue);

  // ── Branch prefix selection ────────────────────────────────────────────
  const defaultPrefix = smartBranchPrefix(issue.issuetype.name, config.branchPrefix);

  const prefix = await select<string>({
    message: "Branch type",
    choices: BRANCH_PREFIXES.map((p) => ({
      value: p,
      name: p,
    })),
    default: defaultPrefix,
  });

  const suggestedBranch = buildBranchName(prefix, issue.key);
  const branchName = await input({
    message: "Branch name (edit if needed)",
    default: suggestedBranch,
    validate: (v) => {
      if (!v) return "Required";
      if (/\s/.test(v)) return "No spaces allowed";
      return true;
    },
  });

  // ── Git state ──────────────────────────────────────────────────────────
  const currentBranch = await getCurrentBranch();
  if (await hasUncommittedChanges()) {
    printWarn(`Uncommitted changes on "${currentBranch}".`);
    const shouldStash = await confirm({
      message: "Stash them before switching?",
      default: true,
    });
    if (shouldStash) {
      await stashChanges(`ctm: stash before ${branchName}`);
      printSuccess("Changes stashed.");
    }
  }

  // ── Create & checkout branch ───────────────────────────────────────────
  const spinner = ora(`Creating branch ${chalk.cyan(branchName)}…`).start();
  try {
    await createAndCheckout(branchName, config.baseBranch);
    spinner.succeed(`Switched to ${chalk.cyan(branchName)}`);
  } catch (err) {
    spinner.fail(`Failed to create branch: ${String(err)}`);
    process.exit(1);
  }

  // ── Update Jira status ─────────────────────────────────────────────────
  try {
    await updateIssueStatus(issue.key, "In Progress");
    printSuccess(`Jira status → ${chalk.green("In Progress")}`);
  } catch (err) {
    printWarn(`Could not update Jira status: ${String(err)}`);
  }

  console.log();
  console.log(`${chalk.green("✓")} Ready! Branch: ${chalk.cyan(branchName)}`);
  console.log(`  Ticket: ${chalk.dim(issue.url)}`);
  console.log();
}
