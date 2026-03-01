import chalk from "chalk";
import ora from "ora";
import { ensureConfig } from "../lib/config.js";
import { initJira, getMyIssues } from "../lib/jira.js";
import { priorityBadge } from "../lib/ui.js";
import type { CtmIssue } from "../types/index.js";

interface IssuesOptions {
  all?: boolean;
  status?: string;
  project?: string;
}

const STATUS_PRIORITY = ["In Progress", "To Do", "Open", "Backlog", "Selected for Development"];

function groupByStatus(issues: CtmIssue[]): Map<string, CtmIssue[]> {
  const map = new Map<string, CtmIssue[]>();
  for (const issue of issues) {
    const s = issue.status.name;
    if (!map.has(s)) map.set(s, []);
    map.get(s)!.push(issue);
  }

  // Sort groups: known statuses first, then the rest
  const sorted = new Map<string, CtmIssue[]>();
  for (const s of STATUS_PRIORITY) {
    if (map.has(s)) sorted.set(s, map.get(s)!);
  }
  for (const [k, v] of map) {
    if (!sorted.has(k)) sorted.set(k, v);
  }
  return sorted;
}

export async function issuesCommand(options: IssuesOptions): Promise<void> {
  const config = ensureConfig();
  initJira({
    baseUrl: config.jiraBaseUrl,
    email: config.jiraEmail,
    apiToken: config.jiraApiToken,
  });

  const spinner = ora("Fetching issues…").start();
  const issues = await getMyIssues(config.jiraAccountId, {
    projectKey: options.all ? undefined : (options.project ?? config.jiraProjectKey),
    statusFilter: options.status,
  });
  spinner.stop();

  if (issues.length === 0) {
    console.log(chalk.dim("\nNo open issues assigned to you.\n"));
    return;
  }

  const grouped = groupByStatus(issues);
  console.log();

  for (const [status, group] of grouped) {
    // Status header
    console.log(chalk.bold(status));
    for (const issue of group) {
      const badge = priorityBadge(issue.priority.name);
      const key = chalk.cyan(issue.key.padEnd(12));
      const title = issue.title.length > 55
        ? issue.title.slice(0, 54) + "…"
        : issue.title.padEnd(55);
      const type = chalk.dim(`[${issue.issuetype.name}]`);
      console.log(`  ${badge} ${key} ${title} ${type}`);
    }
    console.log();
  }

  console.log(
    chalk.dim(`${issues.length} issue(s)  ·  ctm start [key] to begin working`),
  );
  console.log();
}
