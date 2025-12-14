import { useState } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { parseRepoInput, type ParsedRepo } from "@/lib/github";

interface RepoInputProps {
  repos: ParsedRepo[];
  onAddRepo: (repo: ParsedRepo) => void;
  onRemoveRepo: (index: number) => void;
  maxRepos?: number;
}

export function RepoInput({
  repos,
  onAddRepo,
  onRemoveRepo,
  maxRepos = 3,
}: RepoInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    setError(null);

    const parsed = parseRepoInput(inputValue);
    if (!parsed) {
      setError("Invalid format. Use owner/repo or a GitHub URL");
      return;
    }

    // Check for duplicates
    const isDuplicate = repos.some(
      (r) =>
        r.owner.toLowerCase() === parsed.owner.toLowerCase() &&
        r.name.toLowerCase() === parsed.name.toLowerCase()
    );
    if (isDuplicate) {
      setError("Repository already added");
      return;
    }

    onAddRepo(parsed);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="owner/repo or GitHub URL"
          disabled={repos.length >= maxRepos}
          className="flex-1"
        />
        <Button
          onClick={handleAdd}
          disabled={repos.length >= maxRepos || !inputValue.trim()}
          size="sm"
        >
          <IconPlus className="size-4" />
          Add
        </Button>
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      {repos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {repos.map((repo, index) => (
            <div
              key={`${repo.owner}/${repo.name}`}
              className="flex items-center gap-1.5 rounded-sm bg-muted px-2 py-1 text-xs"
            >
              <span className="font-medium">
                {repo.owner}/{repo.name}
              </span>
              <button
                onClick={() => onRemoveRepo(index)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <IconX className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {repos.length === 0 && (
        <p className="text-muted-foreground text-xs">
          Add up to {maxRepos} repositories to compare
        </p>
      )}
    </div>
  );
}
