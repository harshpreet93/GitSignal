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
  fetchIssuesOverTime,
  formatWeekDate,
  getRepoColor,
  type ParsedRepo,
  type IssueWeek,
} from "@/lib/github";

interface IssuesChartProps {
  repos: ParsedRepo[];
}

interface ChartDataPoint {
  week: string;
  weekTimestamp: number;
  [key: string]: string | number;
}

interface RepoData {
  repo: ParsedRepo;
  data: IssueWeek[] | null;
  error: string | null;
  loading: boolean;
}

export function IssuesChart({ repos }: IssuesChartProps) {
  const [repoData, setRepoData] = useState<Map<string, RepoData>>(new Map());
  const fetchedRepos = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchRepo = (repo: ParsedRepo) => {
      const key = `${repo.owner}/${repo.name}`;

      if (fetchedRepos.current.has(key)) {
        return;
      }
      fetchedRepos.current.add(key);

      setRepoData((prev) => {
        const next = new Map(prev);
        next.set(key, {
          repo,
          data: null,
          error: null,
          loading: true,
        });
        return next;
      });

      fetchIssuesOverTime(repo.owner, repo.name)
        .then((data) => {
          setRepoData((prev) => {
            const next = new Map(prev);
            next.set(key, {
              repo,
              data,
              error: null,
              loading: false,
            });
            return next;
          });
        })
        .catch((err) => {
          setRepoData((prev) => {
            const next = new Map(prev);
            next.set(key, {
              repo,
              data: null,
              error: err.message,
              loading: false,
            });
            return next;
          });
        });
    };

    repos.forEach((repo) => {
      const key = `${repo.owner}/${repo.name}`;
      const existing = repoData.get(key);
      if (!existing) {
        fetchRepo(repo);
      }
    });

    // Clean up removed repos
    const currentKeys = new Set(repos.map((r) => `${r.owner}/${r.name}`));

    setRepoData((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!currentKeys.has(key)) {
          next.delete(key);
          fetchedRepos.current.delete(key);
        }
      }
      return next;
    });
  }, [repos]);

  // Transform data for the chart
  const chartData: ChartDataPoint[] = [];
  const repoKeys = repos.map((r) => `${r.owner}/${r.name}`);

  // Find the repo with data to use as base for timestamps
  const baseRepoData = Array.from(repoData.values()).find(
    (d) => d.data && d.data.length > 0
  );

  if (baseRepoData?.data) {
    baseRepoData.data.forEach((week) => {
      const point: ChartDataPoint = {
        week: formatWeekDate(week.week),
        weekTimestamp: week.week,
      };

      repoKeys.forEach((key) => {
        const data = repoData.get(key);
        if (data?.data) {
          const weekData = data.data.find((w) => w.week === week.week);
          point[key] = weekData?.issues ?? 0;
        }
      });

      chartData.push(point);
    });
  }

  const isLoading = Array.from(repoData.values()).some((d) => d.loading);
  const errors = Array.from(repoData.values())
    .filter((d) => d.error)
    .map((d) => ({ repo: `${d.repo.owner}/${d.repo.name}`, error: d.error }));

  if (repos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Issues Opened</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Add repositories to see issue activity
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Issues Opened (Last 52 Weeks)</CardTitle>
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

        {isLoading && (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground gap-2">
            <IconLoader2 className="size-5 animate-spin" />
            <span>Loading issue data...</span>
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

        {!isLoading && chartData.length === 0 && repos.length > 0 && (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No issue data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
