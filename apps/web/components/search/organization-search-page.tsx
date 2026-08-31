"use client";

import { SearchType, type SearchTypeValue } from "@intouch/shared/search";
import type { ChannelConversationDto } from "@intouch/shared/conversations";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { SearchResults } from "@/components/search/search-results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/workspace/page-header";
import { ResourceState } from "@/components/workspace/resource-state";
import { ApiError } from "@/lib/api/client";
import {
  useChannels,
  useDirectMessages,
  useOrganization,
  useOrganizationSearch,
} from "@/lib/query/hooks";

const searchTypes = Object.values(SearchType);

export function OrganizationSearchPage({
  organizationId,
}: {
  organizationId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const requestedType = searchParams.get("type");
  const type: SearchTypeValue = searchTypes.includes(
    requestedType as SearchTypeValue,
  )
    ? (requestedType as SearchTypeValue)
    : SearchType.ALL;
  const conversationId =
    type === SearchType.MESSAGES
      ? (searchParams.get("conversationId") ?? undefined)
      : undefined;
  const [input, setInput] = useState(urlQuery);
  const organization = useOrganization(organizationId);
  const channels = useChannels(organizationId);
  const directMessages = useDirectMessages(organizationId);
  const search = useOrganizationSearch(
    organizationId,
    {
      q: urlQuery.trim(),
      type,
      limit: 20,
      ...(conversationId ? { conversationId } : {}),
    },
    urlQuery.trim().length >= 2,
  );
  const results = search.data?.pages.flatMap((page) => page.results) ?? [];

  const replaceSearch = (
    nextQuery: string,
    nextType: SearchTypeValue,
    nextConversationId?: string,
  ) => {
    const params = new URLSearchParams({ q: nextQuery, type: nextType });
    if (nextConversationId && nextType === SearchType.MESSAGES) {
      params.set("conversationId", nextConversationId);
    }
    router.replace(`/app/${organizationId}/search?${params.toString()}`);
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const normalized = input.trim();
      if (normalized !== urlQuery) {
        const params = new URLSearchParams({ q: normalized, type });
        if (conversationId && type === SearchType.MESSAGES) {
          params.set("conversationId", conversationId);
        }
        router.replace(`/app/${organizationId}/search?${params.toString()}`);
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [conversationId, input, organizationId, router, type, urlQuery]);

  if (organization.isPending) {
    return (
      <ResourceState
        title="Opening search"
        description="Confirming organization access."
      />
    );
  }
  if (organization.isError || !organization.data) {
    return (
      <ResourceState
        title="Organization not found"
        description="This organization is unavailable or you no longer have access."
      />
    );
  }

  const directOptions =
    directMessages.data?.pages.flatMap((page) => page.directMessages) ?? [];

  return (
    <>
      <PageHeader
        eyebrow={organization.data.name}
        title="Search"
        description="Messages, channels, and people you can access."
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="relative">
            <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="organization-search-query"
              name="q"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="h-14 rounded-2xl pl-12 text-base"
              placeholder="Search this organization..."
              aria-label="Search organization"
            />
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              defaultValue={SearchType.ALL}
              value={type}
              onValueChange={(value) =>
                replaceSearch(input.trim(), value as SearchTypeValue)
              }
            >
              <TabsList>
                {searchTypes.map((value) => (
                  <TabsTrigger key={value} value={value}>
                    {value === "ALL"
                      ? "All"
                      : value.charAt(0) + value.slice(1).toLowerCase()}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {type === SearchType.MESSAGES && (
              <Select
                id="organization-search-conversation"
                name="conversationId"
                aria-label="Filter messages by conversation"
                className="min-w-56"
                value={conversationId ?? ""}
                onChange={(event) =>
                  replaceSearch(
                    input.trim(),
                    SearchType.MESSAGES,
                    event.target.value || undefined,
                  )
                }
              >
                <option value="">All conversations</option>
                {channels.data
                  ?.filter(
                    (channel): channel is ChannelConversationDto =>
                      channel.type === "CHANNEL",
                  )
                  .map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      # {channel.name}
                    </option>
                  ))}
                {directOptions.map((conversation) => (
                  <option key={conversation.id} value={conversation.id}>
                    DM: {conversation.peer.displayName}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <section className="mt-8" aria-live="polite">
            {urlQuery.trim().length < 2 ? (
              <div className="rounded-[2rem] border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                Enter at least two characters to search.
              </div>
            ) : search.isPending ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Searching...
              </p>
            ) : search.isError ? (
              <div className="rounded-[2rem] border border-destructive/30 p-8 text-center">
                <p className="text-sm text-destructive">
                  {search.error instanceof ApiError &&
                  search.error.status === 429
                    ? "Too many searches. Pause briefly and try again."
                    : search.error.message}
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
            ) : results.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-border p-12 text-center">
                <p className="font-medium">No results found</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try a different word or broaden the active filter.
                </p>
              </div>
            ) : (
              <SearchResults
                organizationId={organizationId}
                results={results}
              />
            )}
          </section>

          {search.hasNextPage && (
            <div className="mt-6 text-center">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={search.isFetchingNextPage}
                onClick={() => void search.fetchNextPage()}
              >
                {search.isFetchingNextPage ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
