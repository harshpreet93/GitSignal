import { useState, useEffect } from "react";
import { RepoInput } from "@/components/RepoInput";
import { CommitChart } from "@/components/CommitChart";
import { ContributorsChart } from "@/components/ContributorsChart";
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
        <header className="flex items-start justify-between gap-4" role="banner">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">GitBoard</h1>
              <a
                href="https://github.com/harshpreet93/gitboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="View GitBoard on GitHub"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
            </div>
            <p className="text-muted-foreground text-sm">
              Compare GitHub repositories to find the right one for your project
            </p>
          </div>
          <TokenInput onTokenChange={handleTokenChange} />
        </header>

        <main className="space-y-6">
          <section className="text-sm text-muted-foreground space-y-2">
          <h2 className="font-medium text-foreground">Why GitBoard?</h2>
          <p>
            Choosing between open source libraries can be difficult. Many tools offer similar features,
            making the decision seem straightforward. However, adopting a dead or dying project can
            cause long term problems. Dependencies become deeply embedded in your app and are hard to
            remove or replace.
          </p>
          <p>
            GitHub doesn't make it easy to compare the vital signals of repositories: commit activity,
            contributor trends, issue velocity, and more. GitBoard gives you a single page view of
            these metrics so you can make informed decisions about which projects are actively
            maintained and worth depending on.
          </p>
        </section>

        <section className="text-sm text-muted-foreground space-y-2 rounded-md border border-border bg-muted/50 p-4">
          <h2 className="font-medium text-foreground">Note on API Rate Limits</h2>
          <p>
            GitBoard uses the GitHub API which limits unauthenticated requests to 60 per hour. If you're
            comparing multiple repositories, you may hit this limit quickly. To avoid throttling, add your
            own GitHub personal access token using the "Add token" button above. With a token, the limit
            increases to 5,000 requests per hour. Your token is stored locally in your browser and never
            sent to any server other than GitHub.
          </p>
        </section>

        <RepoInput
          repos={repos}
          onAddRepo={handleAddRepo}
          onRemoveRepo={handleRemoveRepo}
        />

        <CommitChart key={`commits-${tokenVersion}`} repos={repos} />

        <ContributorsChart key={`contributors-${tokenVersion}`} repos={repos} />

        <IssuesChart key={`issues-${tokenVersion}`} repos={repos} />

        <IssuesClosedChart key={`issues-closed-${tokenVersion}`} repos={repos} />
        </main>
      </div>
    </div>
  );
}

export default App;
