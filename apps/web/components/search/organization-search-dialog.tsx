"use client";

import { SearchType } from "@intouch/shared/search";
import { ArrowRight, Command, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SearchResults } from "@/components/search/search-results";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { useOrganizationSearch } from "@/lib/query/hooks";

const useDebouncedValue = <T,>(value: T, delayMs: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);
  return debounced;
};

export function OrganizationSearchDialog({
  organizationId,
  open,
  onOpenChange,
}: {
  organizationId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const search = useOrganizationSearch(
    organizationId ?? "",
    { q: debouncedQuery, type: SearchType.ALL, limit: 20 },
    open,
  );
  const results = search.data?.pages[0]?.results ?? [];

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[8vh] max-h-[84dvh] max-w-2xl translate-y-0 overflow-hidden p-0 sm:top-[12vh]">
        <DialogHeader className="border-b border-border p-5 pr-14">
          <DialogTitle>Find anything</DialogTitle>
          <DialogDescription>
            Search messages, channels, and people in this organization.
          </DialogDescription>
        </DialogHeader>
        <div className="relative border-b border-border p-4">
          <Search className="absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              organizationId
                ? "Search this organization..."
                : "Open an organization to search"
            }
            disabled={!organizationId}
            className="h-12 rounded-2xl pl-10 pr-16"
            aria-label="Search organization"
          />
          <span className="absolute top-1/2 right-7 hidden -translate-y-1/2 items-center gap-1 rounded-lg border border-border px-2 py-1 font-mono text-[9px] text-muted-foreground sm:flex">
            <Command className="size-3" /> K
          </span>
        </div>
        <div className="min-h-56 overflow-y-auto p-4">
          {!organizationId ? (
            <div className="grid min-h-52 place-items-center px-6 text-center">
              <div>
                <p className="font-medium">Choose an organization first</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Search is scoped to one organization so private conversations
                  stay private.
                </p>
              </div>
            </div>
          ) : query.trim().length < 2 ? (
            <div className="grid min-h-52 place-items-center text-center text-sm text-muted-foreground">
              Enter at least two characters to begin.
            </div>
          ) : search.isPending || debouncedQuery !== query.trim() ? (
            <div className="grid min-h-52 place-items-center text-sm text-muted-foreground">
              Searching...
            </div>
          ) : search.isError ? (
            <div className="grid min-h-52 place-items-center text-center">
              <div>
                <p className="font-medium text-destructive">
                  {search.error instanceof ApiError &&
                  search.error.status === 429
                    ? "Search is moving too quickly"
                    : "Search is temporarily unavailable"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 rounded-full"
                  onClick={() => void search.refetch()}
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="grid min-h-52 place-items-center text-center text-sm text-muted-foreground">
              No accessible results for “{debouncedQuery}”.
            </div>
          ) : (
            <div className="grid gap-5">
              {(
                [
                  ["MESSAGE", "Messages"],
                  ["CHANNEL", "Channels"],
                  ["PERSON", "People"],
                ] as const
              ).map(([kind, label]) => {
                const groupedResults = results.filter(
                  (result) => result.kind === kind,
                );
                if (groupedResults.length === 0) return null;
                return (
                  <section key={kind}>
                    <h3 className="mb-2 px-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                      {label}
                    </h3>
                    <SearchResults
                      organizationId={organizationId}
                      results={groupedResults}
                      compact
                      onNavigate={() => onOpenChange(false)}
                    />
                  </section>
                );
              })}
            </div>
          )}
        </div>
        {organizationId && debouncedQuery.length >= 2 && (
          <div className="border-t border-border p-3">
            <Link
              href={`/app/${organizationId}/search?q=${encodeURIComponent(debouncedQuery)}&type=ALL`}
              onClick={() => onOpenChange(false)}
              className="flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-medium text-primary hover:bg-primary/10"
            >
              Open full search <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
