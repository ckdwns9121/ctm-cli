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
