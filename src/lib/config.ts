import Conf from "conf";
import type { GlobalConfig } from "../types/index.js";

const conf = new Conf<GlobalConfig>({
  projectName: "ctm",
  schema: {
    jiraBaseUrl: { type: "string", default: "" },
    jiraEmail: { type: "string", default: "" },
    jiraApiToken: { type: "string", default: "" },
    jiraAccountId: { type: "string", default: "" },
    jiraProjectKey: { type: "string", default: "" },
    baseBranch: { type: "string", default: "main" },
    branchPrefix: { type: "string", default: "" },
  },
});

export function getConfig(): GlobalConfig {
  return {
    jiraBaseUrl: conf.get("jiraBaseUrl"),
    jiraEmail: conf.get("jiraEmail"),
    jiraApiToken: conf.get("jiraApiToken"),
    jiraAccountId: conf.get("jiraAccountId"),
    jiraProjectKey: conf.get("jiraProjectKey"),
    baseBranch: conf.get("baseBranch"),
    branchPrefix: conf.get("branchPrefix"),
  };
}

export function setConfig(config: Partial<GlobalConfig>): void {
  for (const [key, value] of Object.entries(config)) {
    conf.set(key as keyof GlobalConfig, value as string);
  }
}

export function getConfigPath(): string {
  return conf.path;
}

export function ensureConfig(): GlobalConfig {
  const config = getConfig();
  const missing: string[] = [];
  if (!config.jiraBaseUrl) missing.push("jiraBaseUrl");
  if (!config.jiraEmail) missing.push("jiraEmail");
  if (!config.jiraApiToken) missing.push("jiraApiToken");
  if (!config.jiraAccountId) missing.push("jiraAccountId");
  if (!config.jiraProjectKey) missing.push("jiraProjectKey");
  if (missing.length > 0) {
    throw new Error(
      `CTM not configured (missing: ${missing.join(", ")}). Run \`ctm init\` first.`,
    );
  }
  return config;
}

/** "123" → "CTM-123", "CTM-123" → "CTM-123" */
export function resolveIssueKey(input: string, projectKey: string): string {
  if (/^\d+$/.test(input)) return `${projectKey}-${input}`;
  return input.toUpperCase();
}

/** Extract "CTM-123" from branch names like "feat/CTM-123-user-auth" */
export function extractIssueKeyFromBranch(branch: string): string | null {
  const match = branch.match(/([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

/** Turn issue title into a URL-safe slug, max 50 chars */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/** Branch prefix options */
export const BRANCH_PREFIXES = ["feat", "fix", "refactor", "qa", "chore", "docs", "ktlo", "test"] as const;
export type BranchPrefix = (typeof BRANCH_PREFIXES)[number];

/** Build branch name: "feat/CTM-123" */
export function buildBranchName(prefix: string, issueKey: string): string {
  if (prefix) return `${prefix}/${issueKey}`;
  return issueKey;
}

/** Smart prefix based on Jira issue type */
/** Smart default prefix based on Jira issue type */
export function smartBranchPrefix(issueType: string, defaultPrefix: string): BranchPrefix {
  const type = issueType.toLowerCase();
  if (type.includes("bug")) return "fix";
  if (type.includes("story") || type.includes("feature") || type.includes("improvement"))
    return "feat";
  if (type.includes("refactor")) return "refactor";
  if (type.includes("qa")) return "qa";
  if (type.includes("test")) return "test";
  if (type.includes("doc")) return "docs";
  if (type.includes("ktlo") || type.includes("maintenance")) return "ktlo";
  if (type.includes("task") || type.includes("epic") || type.includes("chore")) return "chore";
  const match = BRANCH_PREFIXES.find((p) => p === defaultPrefix);
  return match ?? "feat";
}
