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
  getRepoRoot,
  getWorktreePath,
  addWorktree,
  findWorktreeForBranch,
} from "../lib/git.js";
import { printIssue, printSuccess, printWarn } from "../lib/ui.js";
import type { CtmIssue } from "../types/index.js";

interface StartOptions {
  worktree?: boolean;
}

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

export async function startCommand(
  keyArg: string | undefined,
  options: StartOptions,
): Promise<void> {
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

  const CUSTOM_VALUE = "__custom__";
  const selected = await select<string>({
    message: "Branch type",
    choices: [
      ...BRANCH_PREFIXES.map((p) => ({ value: p, name: p })),
      { value: CUSTOM_VALUE, name: "custom (직접 입력)" },
    ],
    default: defaultPrefix,
  });

  const prefix = selected === CUSTOM_VALUE
    ? await input({
        message: "Custom branch prefix",
        validate: (v) => (v ? true : "Required"),
      })
    : selected;

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

  // ── Worktree mode ──────────────────────────────────────────────────────
  if (options.worktree) {
    await runWorktreeMode(branchName, issue.key, config.baseBranch);
  } else {
    await runBranchMode(branchName, config.baseBranch);
  }

  // ── Update Jira status (공통) ──────────────────────────────────────────
  try {
    await updateIssueStatus(issue.key, "In Progress");
    printSuccess(`Jira status → ${chalk.green("In Progress")}`);
  } catch (err) {
    printWarn(`Could not update Jira status: ${String(err)}`);
  }

  console.log();
  console.log(`  Ticket: ${chalk.dim(issue.url)}`);
  console.log();
}

// ── Branch mode (기존 동작) ────────────────────────────────────────────────

async function runBranchMode(branchName: string, baseBranch: string): Promise<void> {
  // Warn about uncommitted changes before switching
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

  const spinner = ora(`Creating branch ${chalk.cyan(branchName)}…`).start();
  try {
    await createAndCheckout(branchName, baseBranch);
    spinner.succeed(`Switched to ${chalk.cyan(branchName)}`);
  } catch (err) {
    spinner.fail(`Failed to create branch: ${String(err)}`);
    process.exit(1);
  }

  console.log();
  console.log(`${chalk.green("✓")} Ready! Branch: ${chalk.cyan(branchName)}`);
}

// ── Worktree mode (신규) ───────────────────────────────────────────────────

async function runWorktreeMode(
  branchName: string,
  issueKey: string,
  baseBranch: string,
): Promise<void> {
  const repoRoot = await getRepoRoot();
  const worktreePath = getWorktreePath(repoRoot, branchName);

  // 이미 같은 브랜치용 worktree가 존재하면 안내 후 종료
  const existing = await findWorktreeForBranch(branchName);
  if (existing) {
    printWarn(`Worktree already exists for "${branchName}"`);
    console.log(`  ${chalk.cyan(existing.path)}`);
    console.log();
    console.log(`  ${chalk.dim("cd")} ${chalk.cyan(existing.path)}`);
    console.log();
    process.exit(0);
  }

  const spinner = ora(
    `Creating worktree ${chalk.cyan(branchName)} at ${chalk.dim(worktreePath)}…`,
  ).start();
  try {
    await addWorktree(worktreePath, branchName, baseBranch);
    spinner.succeed(`Worktree created for ${chalk.cyan(branchName)}`);
  } catch (err) {
    spinner.fail(`Failed to create worktree: ${String(err)}`);
    process.exit(1);
  }

  console.log();
  console.log(`${chalk.green("✓")} Ready!`);
  console.log(`  ${chalk.bold("Worktree:")} ${chalk.cyan(worktreePath)}`);
  console.log(`  ${chalk.bold("Branch:")}   ${chalk.cyan(branchName)}`);
  console.log();
  console.log(`  ${chalk.dim("Move into the worktree:")}`);
  console.log(`  ${chalk.cyan(`cd ${worktreePath}`)}`);
  void issueKey; // referenced above via printIssue/Jira update
}
