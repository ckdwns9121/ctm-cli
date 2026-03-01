import chalk from "chalk";
import ora from "ora";
import { confirm } from "@inquirer/prompts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ensureConfig,
  resolveIssueKey,
  extractIssueKeyFromBranch,
} from "../lib/config.js";
import { initJira, getIssue, addComment } from "../lib/jira.js";
import {
  getCurrentBranch,
  getRepoRoot,
  pushBranch,
  hasNewCommits,
  createPR,
  hasUncommittedChanges,
} from "../lib/git.js";
import { printIssue, printSuccess, printWarn, printError } from "../lib/ui.js";

export async function doneCommand(keyArg: string | undefined): Promise<void> {
  const config = ensureConfig();
  initJira({
    baseUrl: config.jiraBaseUrl,
    email: config.jiraEmail,
    apiToken: config.jiraApiToken,
  });

  const currentBranch = await getCurrentBranch();

  // ── Resolve issue key ──────────────────────────────────────────────────
  let issueKey: string;
  if (keyArg) {
    issueKey = resolveIssueKey(keyArg, config.jiraProjectKey);
  } else {
    const extracted = extractIssueKeyFromBranch(currentBranch);
    if (!extracted) {
      printError(
        `Cannot detect issue key from branch "${currentBranch}". Pass it explicitly: ctm done CTM-123`,
      );
      process.exit(1);
    }
    issueKey = extracted;
  }

  // ── Fetch issue ────────────────────────────────────────────────────────
  const issueSpinner = ora(`Fetching ${issueKey}…`).start();
  const issue = await getIssue(issueKey);
  issueSpinner.stop();

  printIssue(issue);

  // ── Pre-flight checks ──────────────────────────────────────────────────
  if (await hasUncommittedChanges()) {
    printError("You have uncommitted changes. Commit or stash them first.");
    process.exit(1);
  }

  if (!(await hasNewCommits(config.baseBranch))) {
    printWarn(`No new commits on "${currentBranch}" vs origin/${config.baseBranch}.`);
    const proceed = await confirm({ message: "Create PR anyway?", default: false });
    if (!proceed) process.exit(0);
  }

  const go = await confirm({
    message: `Push "${currentBranch}" and create PR for "${issueKey}"?`,
    default: true,
  });
  if (!go) process.exit(0);

  // ── Push ───────────────────────────────────────────────────────────────
  const pushSpinner = ora(`Pushing ${chalk.cyan(currentBranch)}…`).start();
  try {
    await pushBranch(currentBranch);
    pushSpinner.succeed(`Pushed ${chalk.cyan(currentBranch)}`);
  } catch (err) {
    pushSpinner.fail(`Push failed: ${String(err)}`);
    process.exit(1);
  }

  // ── PR body: use repo template if present ─────────────────────────────
  const prTitle = `${issue.key}: ${issue.title}`;
  let prBody: string;
  try {
    const repoRoot = await getRepoRoot();
    prBody = await readFile(join(repoRoot, ".github", "pull_request_template.md"), "utf-8");
  } catch {
    // No template found — use a minimal fallback
    prBody = `Jira: [${issue.key}](${issue.url})`;
  }

  const prSpinner = ora("Creating PR…").start();
  let prUrl: string;
  try {
    prUrl = await createPR(prTitle, prBody);
    prSpinner.succeed(`PR created: ${chalk.cyan(prUrl)}`);
  } catch (err) {
    prSpinner.fail(`Failed to create PR: ${String(err)}`);
    console.log(chalk.dim("  Ensure `gh` is installed and authenticated: gh auth login"));
    process.exit(1);
  }

  // ── Jira comment with PR URL (automation handles status) ─────────────
  try {
    await addComment(issue.key, `PR: ${prUrl}`);
    printSuccess("PR URL added to Jira issue.");
  } catch {
    // Non-critical
  }

  console.log();
  console.log(`${chalk.green("✓")} Done!`);
  console.log(`  PR:     ${chalk.cyan(prUrl)}`);
  console.log(`  Ticket: ${chalk.dim(issue.url)}`);
  console.log();
}
