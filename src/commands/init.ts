import chalk from "chalk";
import { input, password, select } from "@inquirer/prompts";
import ora from "ora";
import { getConfig, setConfig, getConfigPath } from "../lib/config.js";
import { validateCredentials, initJira, getMyself, getProjects } from "../lib/jira.js";

export async function initCommand(): Promise<void> {
  const existing = getConfig();

  console.log(chalk.bold("\n🎫  CTM — Colo Ticket Manager\n"));
  console.log(chalk.dim("Configure your Jira connection. Press Enter to keep existing values.\n"));

  const jiraBaseUrl = await input({
    message: "Jira base URL",
    default: existing.jiraBaseUrl || undefined,
    validate: (v) => (v.startsWith("https://") ? true : "Must start with https://"),
  });

  const jiraEmail = await input({
    message: "Jira email",
    default: existing.jiraEmail || undefined,
    validate: (v) => (v.includes("@") ? true : "Enter a valid email"),
  });

  const jiraApiToken = await password({
    message: "Jira API token (hidden)",
    mask: "•",
    validate: (v) => (v.length > 0 ? true : "Required"),
  });

  // Validate credentials
  const spinner = ora("Validating credentials…").start();
  const valid = await validateCredentials(jiraBaseUrl, jiraEmail, jiraApiToken);
  if (!valid) {
    spinner.fail(chalk.red("Invalid credentials. Check your email and API token."));
    console.log(
      chalk.dim(
        "  Get a token: https://id.atlassian.com/manage-profile/security/api-tokens",
      ),
    );
    process.exit(1);
  }

  // Initialize client temporarily to fetch user/project data
  initJira({ baseUrl: jiraBaseUrl, email: jiraEmail, apiToken: jiraApiToken });
  const me = await getMyself();
  spinner.succeed(
    `Authenticated as ${chalk.green(me.displayName)} ${chalk.dim(`(${me.emailAddress})`)}`,
  );

  // Load projects
  const projectSpinner = ora("Loading projects…").start();
  const projects = await getProjects();
  projectSpinner.stop();

  if (projects.length === 0) {
    console.log(chalk.yellow("No projects found. Check your Jira permissions."));
    process.exit(1);
  }

  const jiraProjectKey = await select({
    message: "Default Jira project",
    choices: projects.map((p) => ({
      value: p.key,
      name: `${chalk.cyan(p.key.padEnd(10))} ${p.name}`,
    })),
    default: existing.jiraProjectKey || projects[0]?.key,
    pageSize: 12,
  });

  const baseBranch = await input({
    message: "Base branch",
    default: existing.baseBranch || "main",
  });

  const branchPrefix = await input({
    message: "Default branch prefix (e.g. feat, fix — leave empty for none)",
    default: existing.branchPrefix || "",
  });

  setConfig({
    jiraBaseUrl,
    jiraEmail,
    jiraApiToken,
    jiraAccountId: me.accountId,
    jiraProjectKey,
    baseBranch,
    branchPrefix,
  });

  console.log();
  console.log(chalk.green("✓ CTM configured successfully!"));
  console.log(`  ${chalk.dim("Config:")} ${chalk.cyan(getConfigPath())}`);
  console.log();
  console.log(chalk.dim("  Next: ctm ls        — view your Jira issues"));
  console.log(chalk.dim("        ctm start 123  — create a branch for issue 123"));
  console.log();
}
