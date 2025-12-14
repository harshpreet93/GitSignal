import { useEffect, useState, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { IconLoader2 } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchCommitActivity,
  formatWeekDate,
  getRepoColor,
  StatsComputingError,
  POLL_INTERVAL_MS,
  type ParsedRepo,
  type CommitActivity,
} from "@/lib/github";

interface CommitChartProps {
  repos: ParsedRepo[];
}

interface ChartDataPoint {
  week: string;
  weekTimestamp: number;
  [key: string]: string | number;
}

interface RepoData {
  repo: ParsedRepo;
  activity: CommitActivity[] | null;
  error: string | null;
  loading: boolean;
  computing: boolean;
}

export function CommitChart({ repos }: CommitChartProps) {
  const [repoData, setRepoData] = useState<Map<string, RepoData>>(new Map());
  const pollTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const fetchRepo = (repo: ParsedRepo, isRetry = false) => {
      const key = `${repo.owner}/${repo.name}`;

      // Set loading/computing state
      setRepoData((prev) => {
        const next = new Map(prev);
        const existing = prev.get(key);
        next.set(key, {
          repo,
          activity: existing?.activity ?? null,
          error: null,
          loading: !isRetry,
          computing: isRetry,
        });
        return next;
      });

      fetchCommitActivity(repo.owner, repo.name)
        .then((activity) => {
          // Clear any pending poll timer
          const timer = pollTimers.current.get(key);
          if (timer) {
            clearTimeout(timer);
            pollTimers.current.delete(key);
          }

          setRepoData((prev) => {
            const next = new Map(prev);
            next.set(key, {
              repo,
              activity,
              error: null,
              loading: false,
              computing: false,
            });
            return next;
          });
        })
        .catch((err) => {
          if (err instanceof StatsComputingError) {
            // Schedule retry poll
            setRepoData((prev) => {
              const next = new Map(prev);
              next.set(key, {
                repo,
                activity: null,
                error: null,
                loading: false,
                computing: true,
              });
              return next;
            });

            const timer = setTimeout(() => {
              fetchRepo(repo, true);
            }, POLL_INTERVAL_MS);
            pollTimers.current.set(key, timer);
          } else {
            setRepoData((prev) => {
              const next = new Map(prev);
              next.set(key, {
                repo,
                activity: null,
                error: err.message,
                loading: false,
                computing: false,
              });
              return next;
            });
          }
        });
    };

    // Fetch data for each repo
    repos.forEach((repo) => {
      const key = `${repo.owner}/${repo.name}`;

      // Skip if already fetched successfully or currently loading/computing
      const existing = repoData.get(key);
      if (existing && (existing.activity || existing.loading || existing.computing)) {
        return;
      }

      fetchRepo(repo);
    });

    // Clean up data and timers for removed repos
    const currentKeys = new Set(repos.map((r) => `${r.owner}/${r.name}`));

    setRepoData((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!currentKeys.has(key)) {
          next.delete(key);
        }
      }
      return next;
    });

    // Clear timers for removed repos
    for (const [key, timer] of pollTimers.current.entries()) {
      if (!currentKeys.has(key)) {
        clearTimeout(timer);
        pollTimers.current.delete(key);
      }
    }

    // Cleanup all timers on unmount
    return () => {
      for (const timer of pollTimers.current.values()) {
        clearTimeout(timer);
      }
      pollTimers.current.clear();
    };
  }, [repos]);

  // Transform data for the chart
  const chartData: ChartDataPoint[] = [];
  const repoKeys = repos.map((r) => `${r.owner}/${r.name}`);

  // Find the repo with data to use as the base for timestamps
  const baseRepoData = Array.from(repoData.values()).find(
    (d) => d.activity && d.activity.length > 0
  );

  if (baseRepoData?.activity) {
    baseRepoData.activity.forEach((week, index) => {
      const point: ChartDataPoint = {
        week: formatWeekDate(week.week),
        weekTimestamp: week.week,
      };

      // Add data from each repo
      repoKeys.forEach((key) => {
        const data = repoData.get(key);
        if (data?.activity && data.activity[index]) {
          point[key] = data.activity[index].total;
        }
      });

      chartData.push(point);
    });
  }

  const isLoading = Array.from(repoData.values()).some((d) => d.loading);
  const computingRepos = Array.from(repoData.values())
    .filter((d) => d.computing)
    .map((d) => `${d.repo.owner}/${d.repo.name}`);
  const errors = Array.from(repoData.values())
    .filter((d) => d.error)
    .map((d) => ({ repo: `${d.repo.owner}/${d.repo.name}`, error: d.error }));

  if (repos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Commits Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Add repositories to see commit activity
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commits Over Time (Last 52 Weeks)</CardTitle>
      </CardHeader>
      <CardContent>
        {errors.length > 0 && (
          <div className="mb-4 space-y-1">
            {errors.map(({ repo, error }) => (
              <p key={repo} className="text-destructive text-xs">
                {repo}: {error}
              </p>
            ))}
          </div>
        )}

        {computingRepos.length > 0 && (
          <div className="mb-4 flex items-center gap-2 text-muted-foreground text-xs">
            <IconLoader2 className="size-4 animate-spin" />
            <span>
              Computing stats for {computingRepos.join(", ")}...
            </span>
          </div>
        )}

        {isLoading && (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground gap-2">
            <IconLoader2 className="size-5 animate-spin" />
            <span>Loading commit activity...</span>
          </div>
        )}

        {!isLoading && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0",
                  fontSize: "12px",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px" }}
                iconType="plainline"
              />
              {repoKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={key}
                  stroke={getRepoColor(index)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {!isLoading && chartData.length === 0 && repos.length > 0 && computingRepos.length === 0 && (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No commit data available
          </div>
        )}

        {!isLoading && chartData.length === 0 && computingRepos.length > 0 && (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground gap-2">
            <IconLoader2 className="size-5 animate-spin" />
            <span>Waiting for GitHub to compute stats...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
