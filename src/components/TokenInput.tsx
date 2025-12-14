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
      <div className="flex items-center gap-2 text-xs">
        <IconKey className="size-3.5 text-muted-foreground" />
        {hasToken ? (
          <>
            <span className="text-muted-foreground">API token configured</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-6 px-2 text-xs"
            >
              Change
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
            >
              Remove
            </Button>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">
              No API token (60 requests/hour)
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-6 px-2 text-xs"
            >
              Add token
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <IconKey className="size-3.5 text-muted-foreground" />
      <Input
        type="password"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="ghp_xxxxxxxxxxxx"
        className="h-7 w-64 text-xs"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") handleCancel();
        }}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSave}
        className="h-6 w-6 p-0"
      >
        <IconCheck className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCancel}
        className="h-6 w-6 p-0"
      >
        <IconX className="size-3.5" />
      </Button>
    </div>
  );
}
