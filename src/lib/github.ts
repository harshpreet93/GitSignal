const GITHUB_API_BASE = "https://api.github.com";
const TOKEN_STORAGE_KEY = "gitsignal_github_token";

export const POLL_INTERVAL_MS = 10000;

/**
 * Get stored GitHub token from localStorage
 */
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Store GitHub token in localStorage
 */
export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

/**
 * Build headers for GitHub API requests
 */
function buildHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
  };
  const token = getStoredToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export class StatsComputingError extends Error {
  constructor() {
    super("Stats are being computed");
    this.name = "StatsComputingError";
  }
}

export interface RepoInfo {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  updatedAt: string;
}

export interface CommitActivity {
  week: number; // Unix timestamp
  total: number;
  days: number[]; // Sun-Sat
}

export interface ContributorWeek {
  week: number; // Unix timestamp
  contributors: number; // Cumulative count of contributors up to this week
}

export interface StarWeek {
  week: number; // Unix timestamp
  stars: number; // Stars in this week
}

export interface IssueWeek {
  week: number; // Unix timestamp
  issues: number; // Issues opened in this week
}

export interface ParsedRepo {
  owner: string;
  name: string;
}

/**
 * Parse a GitHub URL or owner/repo string into owner and repo name
 */
export function parseRepoInput(input: string): ParsedRepo | null {
  const trimmed = input.trim();

  // Handle full GitHub URLs
  // https://github.com/owner/repo or https://github.com/owner/repo.git
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/i
  );
  if (urlMatch) {
    return { owner: urlMatch[1], name: urlMatch[2] };
  }

  // Handle owner/repo format
  const shortMatch = trimmed.match(/^([^\/]+)\/([^\/]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], name: shortMatch[2] };
  }

  return null;
}

/**
 * Fetch basic repository information
 */
export async function fetchRepoInfo(
  owner: string,
  name: string
): Promise<RepoInfo> {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${name}`, {
    headers: buildHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Repository ${owner}/${name} not found`);
    }
    if (response.status === 403) {
      throw new Error("GitHub API rate limit exceeded. Try again later.");
    }
    throw new Error(`Failed to fetch repository: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    owner: data.owner.login,
    name: data.name,
    fullName: data.full_name,
    description: data.description,
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    language: data.language,
    updatedAt: data.updated_at,
  };
}

/**
 * Fetch commit activity for the last 52 weeks
 * Returns weekly commit counts
 */
export async function fetchCommitActivity(
  owner: string,
  name: string
): Promise<CommitActivity[]> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${name}/stats/commit_activity`,
    { headers: buildHeaders() }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Repository ${owner}/${name} not found`);
    }
    if (response.status === 403) {
      throw new Error("GitHub API rate limit exceeded. Try again later.");
    }
    // GitHub returns 202 when stats are being computed
    if (response.status === 202) {
      throw new StatsComputingError();
    }
    throw new Error(`Failed to fetch commit activity: ${response.statusText}`);
  }

  const data = await response.json();

  // GitHub may return empty array while computing
  if (!Array.isArray(data) || data.length === 0) {
    throw new StatsComputingError();
  }

  return data.map((week: { week: number; total: number; days: number[] }) => ({
    week: week.week,
    total: week.total,
    days: week.days,
  }));
}

/**
 * Fetch weekly active contributors
 * Returns the number of unique contributors per week
 */
export async function fetchContributorsOverTime(
  owner: string,
  name: string
): Promise<ContributorWeek[]> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${name}/stats/contributors`,
    { headers: buildHeaders() }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Repository ${owner}/${name} not found`);
    }
    if (response.status === 403) {
      throw new Error("GitHub API rate limit exceeded. Try again later.");
    }
    if (response.status === 202) {
      throw new StatsComputingError();
    }
    throw new Error(`Failed to fetch contributors: ${response.statusText}`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new StatsComputingError();
  }

  // Collect all weeks and count active contributors per week
  const allWeeks = new Set<number>();
  const weekToContributors = new Map<number, number>();

  // For each contributor, count them in each week they made commits
  data.forEach((contributor: { author: { login: string }; weeks: { w: number; c: number }[] }) => {
    for (const week of contributor.weeks) {
      allWeeks.add(week.w);
      if (week.c > 0) {
        weekToContributors.set(week.w, (weekToContributors.get(week.w) || 0) + 1);
      }
    }
  });

  // Sort weeks and build result, including 0 for weeks with no contributors
  const sortedWeeks = Array.from(allWeeks).sort((a, b) => a - b);

  return sortedWeeks.map((week) => ({
    week,
    contributors: weekToContributors.get(week) || 0,
  }));
}

/**
 * Fetch star history over time
 * Returns cumulative star count per week
 * Note: This can be slow for repos with many stars due to pagination
 */
export async function fetchStarHistory(
  owner: string,
  name: string,
  maxPages = 10
): Promise<StarWeek[]> {
  const starDates: Date[] = [];
  let page = 1;
  let hasMore = true;

  // Fetch stargazers with timestamps (paginated)
  while (hasMore && page <= maxPages) {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${name}/stargazers?per_page=100&page=${page}`,
      {
        headers: {
          ...buildHeaders(),
          Accept: "application/vnd.github.star+json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository ${owner}/${name} not found`);
      }
      if (response.status === 403) {
        throw new Error("GitHub API rate limit exceeded. Try again later.");
      }
      throw new Error(`Failed to fetch star history: ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach((star: { starred_at: string }) => {
        if (star.starred_at) {
          starDates.push(new Date(star.starred_at));
        }
      });
      page++;
      if (data.length < 100) {
        hasMore = false;
      }
    }
  }

  if (starDates.length === 0) {
    return [];
  }

  // Sort dates and aggregate by week
  starDates.sort((a, b) => a.getTime() - b.getTime());

  const secondsPerWeek = 7 * 24 * 60 * 60;
  const weekToStars = new Map<number, number>();

  // Get the range of weeks we need to cover
  const now = Math.floor(Date.now() / 1000);
  const currentWeekStart = now - (now % secondsPerWeek);
  const firstStarTime = Math.floor(starDates[0].getTime() / 1000);
  const firstWeekStart = firstStarTime - (firstStarTime % secondsPerWeek);

  // Count stars per week
  starDates.forEach((date) => {
    const timestamp = Math.floor(date.getTime() / 1000);
    const weekStart = timestamp - (timestamp % secondsPerWeek);
    weekToStars.set(weekStart, (weekToStars.get(weekStart) || 0) + 1);
  });

  // Build result with all weeks, including 0 for weeks with no stars
  const result: StarWeek[] = [];
  let weekStart = firstWeekStart;

  while (weekStart <= currentWeekStart) {
    result.push({
      week: weekStart,
      stars: weekToStars.get(weekStart) || 0,
    });
    weekStart += secondsPerWeek;
  }

  return result;
}

/**
 * Fetch issues opened over time
 * Returns the number of issues opened per week
 */
export async function fetchIssuesOverTime(
  owner: string,
  name: string,
  maxPages = 10
): Promise<IssueWeek[]> {
  const issueDates: Date[] = [];
  let page = 1;
  let hasMore = true;

  // Calculate date 52 weeks ago
  const fiftyTwoWeeksAgo = new Date();
  fiftyTwoWeeksAgo.setDate(fiftyTwoWeeksAgo.getDate() - 52 * 7);
  const sinceDate = fiftyTwoWeeksAgo.toISOString();

  // Fetch issues (paginated)
  while (hasMore && page <= maxPages) {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${name}/issues?state=all&per_page=100&page=${page}&since=${sinceDate}&sort=created&direction=desc`,
      { headers: buildHeaders() }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository ${owner}/${name} not found`);
      }
      if (response.status === 403) {
        throw new Error("GitHub API rate limit exceeded. Try again later.");
      }
      throw new Error(`Failed to fetch issues: ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach((issue: { created_at: string; pull_request?: unknown }) => {
        // Exclude pull requests (they show up in issues endpoint)
        if (!issue.pull_request && issue.created_at) {
          const createdAt = new Date(issue.created_at);
          // Only include issues from the last 52 weeks
          if (createdAt >= fiftyTwoWeeksAgo) {
            issueDates.push(createdAt);
          }
        }
      });
      page++;
      if (data.length < 100) {
        hasMore = false;
      }
    }
  }

  // Build weekly counts
  const secondsPerWeek = 7 * 24 * 60 * 60;
  const weekToIssues = new Map<number, number>();

  // Get week range
  const now = Math.floor(Date.now() / 1000);
  const currentWeekStart = now - (now % secondsPerWeek);
  const startWeek = Math.floor(fiftyTwoWeeksAgo.getTime() / 1000);
  const firstWeekStart = startWeek - (startWeek % secondsPerWeek);

  // Count issues per week
  issueDates.forEach((date) => {
    const timestamp = Math.floor(date.getTime() / 1000);
    const weekStart = timestamp - (timestamp % secondsPerWeek);
    weekToIssues.set(weekStart, (weekToIssues.get(weekStart) || 0) + 1);
  });

  // Build result with all weeks
  const result: IssueWeek[] = [];
  let weekStart = firstWeekStart;

  while (weekStart <= currentWeekStart) {
    result.push({
      week: weekStart,
      issues: weekToIssues.get(weekStart) || 0,
    });
    weekStart += secondsPerWeek;
  }

  return result;
}

/**
 * Fetch issues closed over time
 * Returns the number of issues closed per week
 */
export async function fetchIssuesClosedOverTime(
  owner: string,
  name: string,
  maxPages = 10
): Promise<IssueWeek[]> {
  const closedDates: Date[] = [];
  let page = 1;
  let hasMore = true;

  // Calculate date 52 weeks ago
  const fiftyTwoWeeksAgo = new Date();
  fiftyTwoWeeksAgo.setDate(fiftyTwoWeeksAgo.getDate() - 52 * 7);
  const sinceDate = fiftyTwoWeeksAgo.toISOString();

  // Fetch closed issues (paginated)
  while (hasMore && page <= maxPages) {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${name}/issues?state=closed&per_page=100&page=${page}&since=${sinceDate}&sort=updated&direction=desc`,
      { headers: buildHeaders() }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository ${owner}/${name} not found`);
      }
      if (response.status === 403) {
        throw new Error("GitHub API rate limit exceeded. Try again later.");
      }
      throw new Error(`Failed to fetch issues: ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach((issue: { closed_at: string | null; pull_request?: unknown }) => {
        // Exclude pull requests (they show up in issues endpoint)
        if (!issue.pull_request && issue.closed_at) {
          const closedAt = new Date(issue.closed_at);
          // Only include issues closed in the last 52 weeks
          if (closedAt >= fiftyTwoWeeksAgo) {
            closedDates.push(closedAt);
          }
        }
      });
      page++;
      if (data.length < 100) {
        hasMore = false;
      }
    }
  }

  // Build weekly counts
  const secondsPerWeek = 7 * 24 * 60 * 60;
  const weekToIssues = new Map<number, number>();

  // Get week range
  const now = Math.floor(Date.now() / 1000);
  const currentWeekStart = now - (now % secondsPerWeek);
  const startWeek = Math.floor(fiftyTwoWeeksAgo.getTime() / 1000);
  const firstWeekStart = startWeek - (startWeek % secondsPerWeek);

  // Count issues per week
  closedDates.forEach((date) => {
    const timestamp = Math.floor(date.getTime() / 1000);
    const weekStart = timestamp - (timestamp % secondsPerWeek);
    weekToIssues.set(weekStart, (weekToIssues.get(weekStart) || 0) + 1);
  });

  // Build result with all weeks
  const result: IssueWeek[] = [];
  let weekStart = firstWeekStart;

  while (weekStart <= currentWeekStart) {
    result.push({
      week: weekStart,
      issues: weekToIssues.get(weekStart) || 0,
    });
    weekStart += secondsPerWeek;
  }

  return result;
}

/**
 * Format a Unix timestamp to a readable date
 */
export function formatWeekDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Get a consistent color for a repository based on its name
 */
const REPO_COLORS = [
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#10b981", // emerald
  "#f43f5e", // rose
  "#6366f1", // indigo
];

export function getRepoColor(index: number): string {
  return REPO_COLORS[index % REPO_COLORS.length];
}
