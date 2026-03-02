export interface GlobalConfig {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  jiraAccountId: string;
  jiraProjectKey: string;
  baseBranch: string;
  branchPrefix: string;
}

export interface CtmIssue {
  id: string;
  key: string;
  title: string;
  description?: string;
  priority: { id: string; name: string };
  status: {
    id: string;
    name: string;
    statusCategory?: { key: string };
  };
  url: string;
  issuetype: { id: string; name: string };
  labels: string[];
  assignee?: {
    accountId: string;
    displayName: string;
    emailAddress: string;
  };
}

export interface WorktreeEntry {
  path: string;    // absolute path to the worktree directory
  branch: string;  // e.g. refs/heads/feat/CGKR-1423  (or "detached" if HEAD)
  head: string;    // commit SHA
  isMain: boolean; // true for the primary worktree
}
