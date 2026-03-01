import chalk from "chalk";
import type { CtmIssue } from "../types/index.js";

const PRIORITY_COLOR: Record<string, (s: string) => string> = {
  highest: chalk.red,
  high: chalk.yellow,
  medium: chalk.blue,
  low: chalk.gray,
  lowest: chalk.gray,
};

export function priorityBadge(name: string): string {
  const color = PRIORITY_COLOR[name.toLowerCase()] ?? chalk.white;
  return color("●");
}

export function priorityLabel(name: string): string {
  const color = PRIORITY_COLOR[name.toLowerCase()] ?? chalk.white;
  return color(name);
}

export function printIssue(issue: CtmIssue): void {
  console.log();
  console.log(chalk.bold("─────────────────────────────────────────────────────────"));
  console.log(`  ${chalk.cyan("Key:")}      ${chalk.bold(issue.key)}`);
  console.log(`  ${chalk.cyan("Title:")}    ${issue.title}`);
  console.log(`  ${chalk.cyan("Type:")}     ${issue.issuetype.name}`);
  console.log(`  ${chalk.cyan("Priority:")} ${priorityLabel(issue.priority.name)}`);
  console.log(`  ${chalk.cyan("Status:")}   ${issue.status.name}`);
  if (issue.assignee) {
    console.log(`  ${chalk.cyan("Assignee:")} ${issue.assignee.displayName}`);
  }
  if (issue.labels.length > 0) {
    console.log(`  ${chalk.cyan("Labels:")}   ${issue.labels.join(", ")}`);
  }
  console.log(`  ${chalk.cyan("URL:")}      ${chalk.underline(chalk.dim(issue.url))}`);
  if (issue.description) {
    const preview = issue.description.slice(0, 200);
    const suffix = issue.description.length > 200 ? " …" : "";
    console.log(`  ${chalk.cyan("Desc:")}`);
    for (const line of preview.split("\n").slice(0, 4)) {
      console.log(`    ${chalk.dim(line)}`);
    }
    if (suffix) console.log(chalk.dim("    …"));
  }
  console.log(chalk.bold("─────────────────────────────────────────────────────────"));
  console.log();
}

export function printSuccess(msg: string): void {
  console.log(`${chalk.green("✓")} ${msg}`);
}

export function printWarn(msg: string): void {
  console.log(`${chalk.yellow("⚠")} ${msg}`);
}

export function printError(msg: string): void {
  console.error(`${chalk.red("✗")} ${msg}`);
}
