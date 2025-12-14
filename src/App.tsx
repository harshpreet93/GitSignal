import { useState, useEffect } from "react";
import { RepoInput } from "@/components/RepoInput";
import { CommitChart } from "@/components/CommitChart";
import { ContributorsChart } from "@/components/ContributorsChart";
import { StarHistoryChart } from "@/components/StarHistoryChart";
import { IssuesChart } from "@/components/IssuesChart";
import { IssuesClosedChart } from "@/components/IssuesClosedChart";
import { TokenInput } from "@/components/TokenInput";
import { type ParsedRepo } from "@/lib/github";

function getReposFromUrl(): ParsedRepo[] {
  const params = new URLSearchParams(window.location.search);
  const reposParam = params.get("repos");
  if (!reposParam) return [];

  return reposParam
    .split(",")
    .map((r) => {
      const [owner, name] = r.split("/");
      if (owner && name) {
        return { owner, name };
      }
      return null;
    })
    .filter((r): r is ParsedRepo => r !== null);
}

function updateUrl(repos: ParsedRepo[]) {
  const url = new URL(window.location.href);
  if (repos.length === 0) {
    url.searchParams.delete("repos");
  } else {
    url.searchParams.set(
      "repos",
      repos.map((r) => `${r.owner}/${r.name}`).join(",")
    );
  }
  window.history.replaceState({}, "", url.toString());
}

export function App() {
  const [repos, setRepos] = useState<ParsedRepo[]>(getReposFromUrl);
  const [tokenVersion, setTokenVersion] = useState(0);

  useEffect(() => {
    updateUrl(repos);
  }, [repos]);

  const handleAddRepo = (repo: ParsedRepo) => {
    setRepos((prev) => [...prev, repo]);
  };

  const handleRemoveRepo = (index: number) => {
    setRepos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTokenChange = () => {
    setTokenVersion((v) => v + 1);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">GitBoard</h1>
            <p className="text-muted-foreground text-sm">
              Compare GitHub repositories to find the right one for your project
            </p>
          </div>
          <TokenInput onTokenChange={handleTokenChange} />
        </header>

        <RepoInput
          repos={repos}
          onAddRepo={handleAddRepo}
          onRemoveRepo={handleRemoveRepo}
        />

        <CommitChart key={`commits-${tokenVersion}`} repos={repos} />

        <ContributorsChart key={`contributors-${tokenVersion}`} repos={repos} />

        <StarHistoryChart key={`stars-${tokenVersion}`} repos={repos} />

        <IssuesChart key={`issues-${tokenVersion}`} repos={repos} />

        <IssuesClosedChart key={`issues-closed-${tokenVersion}`} repos={repos} />
      </div>
    </div>
  );
}

export default App;
