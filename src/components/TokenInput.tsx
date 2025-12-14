import { useState } from "react";
import { IconKey, IconCheck, IconX } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getStoredToken, setStoredToken } from "@/lib/github";

interface TokenInputProps {
  onTokenChange?: () => void;
}

export function TokenInput({ onTokenChange }: TokenInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const hasToken = !!getStoredToken();

  const handleSave = () => {
    const trimmed = inputValue.trim();
    setStoredToken(trimmed || null);
    setInputValue("");
    setIsEditing(false);
    onTokenChange?.();
  };

  const handleClear = () => {
    setStoredToken(null);
    setInputValue("");
    setIsEditing(false);
    onTokenChange?.();
  };

  const handleCancel = () => {
    setInputValue("");
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2.5">
        <IconKey className="size-4 text-foreground" />
        {hasToken ? (
          <>
            <span className="text-sm font-medium text-foreground">API token configured</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-7 px-3 text-xs"
              >
                Change
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 px-3 text-xs text-destructive hover:text-destructive"
              >
                Remove
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                No API token
              </span>
              <span className="text-xs text-muted-foreground">
                Limited to 60 requests/hour
              </span>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-8 px-4"
            >
              Add token
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2.5">
      <IconKey className="size-4 text-foreground" />
      <Input
        type="password"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="ghp_xxxxxxxxxxxx"
        className="h-8 w-64 text-sm"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") handleCancel();
        }}
      />
      <Button
        variant="default"
        size="sm"
        onClick={handleSave}
        className="h-8 w-8 p-0"
      >
        <IconCheck className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCancel}
        className="h-8 w-8 p-0"
      >
        <IconX className="size-4" />
      </Button>
    </div>
  );
}
