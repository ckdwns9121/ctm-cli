import { createRequire } from "node:module";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");
import { issuesCommand } from "./commands/issues.js";
import { startCommand } from "./commands/start.js";
import { doneCommand } from "./commands/done.js";
import { statusCommand } from "./commands/status.js";
import { cleanCommand } from "./commands/clean.js";
import { checkoutCommand } from "./commands/checkout.js";
import { helpCommand } from "./commands/help.js";
import { worktreeListCommand, worktreeRemoveCommand } from "./commands/worktree.js";

const program = new Command();

program
  .name("ctm")
  .description("Colo Ticket Manager — Jira-driven branch management")
  .version(version);

program
  .command("init")
  .description("Configure CTM with Jira credentials and project settings")
  .action(initCommand);

program
  .command("issues")
  .alias("ls")
  .description("List Jira issues assigned to you")
  .option("-a, --all", "Show issues from all projects")
  .option("-s, --status <status>", "Filter by status")
  .option("-p, --project <project>", "Filter by project key")
  .action(issuesCommand);

program
  .command("start [key]")
  .description("Create and checkout a branch for a Jira issue (e.g. CTM-123 or just 123)")
  .option("-w, --worktree", "Create a linked worktree instead of switching branches")
  .action(startCommand);

program
  .command("done [key]")
  .description("Push branch, create PR, and mark the Jira issue as Done")
  .action(doneCommand);

program
  .command("status")
  .alias("st")
  .description("Show current branch status and linked Jira issue")
  .action(statusCommand);

program
  .command("checkout [key]")
  .alias("co")
  .description("Checkout a branch by Jira issue key (e.g. CTM-123 or just 123)")
  .action(checkoutCommand);

program
  .command("clean [key]")
  .description("Delete local (and optionally remote) branch for a Jira issue")
  .action(cleanCommand);

program
  .command("help [command]")
  .description("명령어 도움말 출력")
  .action(helpCommand);

const wt = program
  .command("worktree")
  .alias("wt")
  .description("Manage git worktrees created by ctm start --worktree");

wt
  .command("list", { isDefault: true })
  .description("List all worktrees for the current repo")
  .action(worktreeListCommand);

wt
  .command("rm [key]")
  .description("Remove a worktree (optionally also delete the branch)")
  .option("-b, --branch", "Also delete the git branch")
  .option("-f, --force", "Force remove even with untracked changes")
  .action(worktreeRemoveCommand);

program.parseAsync().catch((err: unknown) => {
  if (err instanceof Error && err.name === "ExitPromptError") {
    process.exit(0);
  }
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
