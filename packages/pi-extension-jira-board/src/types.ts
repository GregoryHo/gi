export interface JiraCurrentUser {
  name?: string;
  key?: string;
  displayName?: string;
  emailAddress?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssueStatus {
  name: string;
  statusCategory: {
    key: string;
    name?: string;
  };
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    status: JiraIssueStatus;
    labels?: string[];
    assignee?: {
      displayName?: string;
      name?: string;
      emailAddress?: string;
    };
    priority?: {
      id: string;
      name: string;
    };
    issuetype?: {
      name: string;
    };
  };
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
  startAt?: number;
  maxResults?: number;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
}

export interface JiraPagedValues<T> {
  values: T[];
  startAt?: number;
  maxResults?: number;
  total?: number;
  isLast?: boolean;
}

export interface JiraTransition {
  id: string;
  name: string;
  to?: {
    name: string;
    statusCategory?: {
      key: string;
      name?: string;
    };
  };
}

export interface JiraTransitionsResult {
  transitions: JiraTransition[];
}
