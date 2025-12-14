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
  fetchContributorsOverTime,
  formatWeekDate,
  getRepoColor,
  StatsComputingError,
  POLL_INTERVAL_MS,
  type ParsedRepo,
  type ContributorWeek,
} from "@/lib/github";

interface ContributorsChartProps {
  repos: ParsedRepo[];
}

interface ChartDataPoint {
  week: string;
  weekTimestamp: number;
  [key: string]: string | number;
}

interface RepoData {
  repo: ParsedRepo;
  data: ContributorWeek[] | null;
  error: string | null;
  loading: boolean;
  computing: boolean;
}

export function ContributorsChart({ repos }: ContributorsChartProps) {
  const [repoData, setRepoData] = useState<Map<string, RepoData>>(new Map());
  const pollTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const fetchRepo = (repo: ParsedRepo, isRetry = false) => {
      const key = `${repo.owner}/${repo.name}`;

      setRepoData((prev) => {
        const next = new Map(prev);
        const existing = prev.get(key);
        next.set(key, {
          repo,
          data: existing?.data ?? null,
          error: null,
          loading: !isRetry,
          computing: isRetry,
        });
        return next;
      });

      fetchContributorsOverTime(repo.owner, repo.name)
        .then((data) => {
          const timer = pollTimers.current.get(key);
          if (timer) {
            clearTimeout(timer);
            pollTimers.current.delete(key);
          }

          setRepoData((prev) => {
            const next = new Map(prev);
            next.set(key, {
              repo,
              data,
              error: null,
              loading: false,
              computing: false,
            });
            return next;
          });
        })
        .catch((err) => {
          if (err instanceof StatsComputingError) {
            setRepoData((prev) => {
              const next = new Map(prev);
              next.set(key, {
                repo,
                data: null,
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
                data: null,
                error: err.message,
                loading: false,
                computing: false,
              });
              return next;
            });
          }
        });
    };

    repos.forEach((repo) => {
      const key = `${repo.owner}/${repo.name}`;
      const existing = repoData.get(key);
      if (existing && (existing.data || existing.loading || existing.computing)) {
        return;
      }
      fetchRepo(repo);
    });

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

    for (const [key, timer] of pollTimers.current.entries()) {
      if (!currentKeys.has(key)) {
        clearTimeout(timer);
        pollTimers.current.delete(key);
      }
    }

    return () => {
      for (const timer of pollTimers.current.values()) {
        clearTimeout(timer);
      }
      pollTimers.current.clear();
    };
  }, [repos]);

  // Transform data for the chart - only show last 52 weeks
  const chartData: ChartDataPoint[] = [];
  const repoKeys = repos.map((r) => `${r.owner}/${r.name}`);

  // Find the repo with data to use as base for timestamps
  const baseRepoData = Array.from(repoData.values()).find(
    (d) => d.data && d.data.length > 0
  );

  if (baseRepoData?.data) {
    // Only show last 52 weeks
    const last52Weeks = baseRepoData.data.slice(-52);

    last52Weeks.forEach((week) => {
      const point: ChartDataPoint = {
        week: formatWeekDate(week.week),
        weekTimestamp: week.week,
      };

      repoKeys.forEach((key) => {
        const data = repoData.get(key);
        if (data?.data) {
          // Find the data point for this week (or closest)
          const weekData = data.data.find((w) => w.week === week.week);
          if (weekData) {
            point[key] = weekData.contributors;
          }
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
          <CardTitle>Weekly Active Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Add repositories to see weekly contributor activity
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Active Contributors (Last 52 Weeks)</CardTitle>
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
            <span>Computing stats for {computingRepos.join(", ")}...</span>
          </div>
        )}

        {isLoading && (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground gap-2">
            <IconLoader2 className="size-5 animate-spin" />
            <span>Loading contributor data...</span>
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
                domain={[0, "dataMax"]}
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
            No contributor data available
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
