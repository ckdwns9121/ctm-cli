import type { CtmIssue } from "../types/index.js";

interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

let _config: JiraConfig | null = null;

export function initJira(config: JiraConfig): void {
  _config = config;
}

function cfg(): JiraConfig {
  if (!_config) throw new Error("Jira client not initialized. Call initJira() first.");
  return _config;
}

function auth(email: string, token: string): string {
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

async function req<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const { baseUrl, email, apiToken } = cfg();
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: auth(email, apiToken),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jira ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function validateCredentials(
  baseUrl: string,
  email: string,
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/rest/api/3/myself`, {
      headers: { Authorization: auth(email, token) },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getMyself(): Promise<{
  accountId: string;
  displayName: string;
  emailAddress: string;
}> {
  return req("/rest/api/3/myself");
}

export async function getProjects(): Promise<Array<{ key: string; name: string }>> {
  const data = await req<{ values: Array<{ key: string; name: string }> }>(
    "/rest/api/3/project/search?maxResults=100&orderBy=name",
  );
  return data.values.map((p) => ({ key: p.key, name: p.name }));
}

// ── Jira doc-format parser ─────────────────────────────────────────────────

type JiraNode = {
  type?: string;
  text?: string;
  content?: JiraNode[];
};

function parseNode(node: JiraNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.content) return node.content.map(parseNode).join("");
  return "";
}

function parseDescription(desc: unknown): string {
  if (!desc) return "";
  if (typeof desc === "string") return desc;
  try {
    const node = desc as JiraNode;
    if (node.content) {
      return node.content
        .map((child) => parseNode(child))
        .join("\n")
        .trim();
    }
  } catch {
    // ignore
  }
  return "";
}

// ── Raw API types ──────────────────────────────────────────────────────────

interface RawFields {
  summary: string;
  description?: unknown;
  priority?: { id: string; name: string };
  status: { id: string; name: string; statusCategory?: { key: string } };
  assignee?: { accountId: string; displayName: string; emailAddress: string };
  labels?: string[];
  issuetype?: { id: string; name: string };
}

interface RawIssue {
  id: string;
  key: string;
  fields: RawFields;
}

function toCtmIssue(raw: RawIssue, baseUrl: string): CtmIssue {
  return {
    id: raw.id,
    key: raw.key,
    title: raw.fields.summary,
    description: parseDescription(raw.fields.description) || undefined,
    priority: raw.fields.priority ?? { id: "", name: "None" },
    status: raw.fields.status,
    url: `${baseUrl}/browse/${raw.key}`,
    issuetype: raw.fields.issuetype ?? { id: "", name: "Task" },
    labels: raw.fields.labels ?? [],
    assignee: raw.fields.assignee,
  };
}

const ISSUE_FIELDS = [
  "summary",
  "description",
  "priority",
  "status",
  "assignee",
  "labels",
  "issuetype",
];

export async function getMyIssues(
  accountId: string,
  opts: { projectKey?: string; statusFilter?: string } = {},
): Promise<CtmIssue[]> {
  const parts = [`assignee = "${accountId}"`];
  if (opts.projectKey) parts.push(`project = "${opts.projectKey}"`);
  if (opts.statusFilter) {
    parts.push(`status = "${opts.statusFilter}"`);
  } else {
    // statusCategory = Done covers all "done" statuses regardless of language/name
    parts.push(`statusCategory != Done`);
  }
  const jql = `${parts.join(" AND ")} ORDER BY updated DESC`;

  const data = await req<{ issues: RawIssue[] }>("/rest/api/3/search/jql", "POST", {
    jql,
    fields: ISSUE_FIELDS,
    maxResults: 50,
  });

  const { baseUrl } = cfg();
  return data.issues.map((i) => toCtmIssue(i, baseUrl));
}

export async function getIssue(key: string): Promise<CtmIssue> {
  const data = await req<RawIssue>(
    `/rest/api/3/issue/${key}?fields=${ISSUE_FIELDS.join(",")}`,
  );
  const { baseUrl } = cfg();
  return toCtmIssue(data, baseUrl);
}

export async function updateIssueStatus(issueKey: string, targetStatus: string): Promise<void> {
  const data = await req<{
    transitions: Array<{ id: string; name: string; to?: { name: string } }>;
  }>(`/rest/api/3/issue/${issueKey}/transitions`);

  const transition = data.transitions.find((t) => {
    const name = (t.to?.name ?? t.name).toLowerCase();
    return name === targetStatus.toLowerCase();
  });

  if (!transition) {
    const available = data.transitions.map((t) => t.to?.name ?? t.name).join(", ");
    throw new Error(`No transition to "${targetStatus}". Available: ${available}`);
  }

  await req(`/rest/api/3/issue/${issueKey}/transitions`, "POST", {
    transition: { id: transition.id },
  });
}

export async function addComment(issueKey: string, text: string): Promise<void> {
  await req(`/rest/api/3/issue/${issueKey}/comment`, "POST", {
    body: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text }],
        },
      ],
    },
  });
}
