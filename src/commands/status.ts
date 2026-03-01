import chalk from "chalk";
import ora from "ora";
import { ensureConfig, extractIssueKeyFromBranch } from "../lib/config.js";
import { initJira, getIssue } from "../lib/jira.js";
import { getCurrentBranch, getDiffStat } from "../lib/git.js";
import { priorityLabel } from "../lib/ui.js";

export async function statusCommand(): Promise<void> {
  const config = ensureConfig();
  const currentBranch = await getCurrentBranch();
  const issueKey = extractIssueKeyFromBranch(currentBranch);

  console.log();
  console.log(`${chalk.cyan("Branch:")} ${chalk.white(currentBranch)}`);

  if (!issueKey) {
    console.log(chalk.dim("  No Jira ticket detected in branch name."));
    console.log();
    return;
  }

  initJira({
    baseUrl: config.jiraBaseUrl,
    email: config.jiraEmail,
    apiToken: config.jiraApiToken,
  });

  const spinner = ora(`Fetching ${issueKey}…`).start();
  let issue;
  try {
    issue = await getIssue(issueKey);
    spinner.stop();
  } catch (err) {
    spinner.fail(`Could not fetch issue: ${String(err)}`);
    return;
  }

  const diff = await getDiffStat(config.baseBranch);

  console.log(`${chalk.cyan("Ticket:")} ${chalk.bold(issue.key)} — ${issue.title}`);
  console.log(`${chalk.cyan("Status:")} ${issue.status.name}`);
  console.log(`${chalk.cyan("Priority:")} ${priorityLabel(issue.priority.name)}`);
  console.log(`${chalk.cyan("URL:")}    ${chalk.underline(chalk.dim(issue.url))}`);
  console.log();

  if (diff.files > 0) {
    console.log(
      `${chalk.cyan("Changes:")} ${diff.files} file(s)  ` +
        `${chalk.green(`+${diff.insertions}`)}  ${chalk.red(`-${diff.deletions}`)}`,
    );
  } else {
    console.log(chalk.dim("No changes vs base branch yet."));
  }
  console.log();
}
