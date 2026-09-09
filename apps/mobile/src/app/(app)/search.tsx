import {
  SearchType,
  type OrganizationSearchResultDto,
  type SearchTypeValue,
} from "@intouch/shared/search";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Hash,
  MessageSquareText,
  Search,
  UserRound,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BackButton, Button, Card, Muted } from "@/components/ui/controls";
import { Screen, StateView } from "@/components/ui/screen";
import { UserAvatar } from "@/components/user-avatar";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { conversationsApi } from "@/features/conversations/conversations-api";
import { useWorkspace } from "@/features/organizations/workspace-provider";
import { searchApi } from "@/features/search/search-api";

const FILTERS = Object.values(SearchType);

export default function SearchScreen() {
  const { theme } = useAppearance();
  const { activeOrganizationId } = useWorkspace();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SearchTypeValue>(SearchType.ALL);
  const [openingPersonId, setOpeningPersonId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const results = useInfiniteQuery({
    queryKey: ["organizations", activeOrganizationId, "search", query, type],
    queryFn: ({ pageParam }) =>
      searchApi.search(activeOrganizationId ?? "", {
        q: query,
        type,
        limit: 20,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: ({ nextCursor }) => nextCursor ?? undefined,
    enabled: Boolean(activeOrganizationId && query.length >= 2),
  });
  const items = results.data?.pages.flatMap((page) => page.results) ?? [];

  const open = async (item: OrganizationSearchResultDto) => {
    if (item.kind === "MESSAGE") {
      router.push({
        pathname: "/conversation/[conversationId]",
        params: { conversationId: item.conversation.id, messageId: item.id },
      });
      return;
    }
    if (item.kind === "CHANNEL") {
      router.push({
        pathname: "/conversation/[conversationId]",
        params: { conversationId: item.id },
      });
      return;
    }
    if (!activeOrganizationId) return;
    setOpeningPersonId(item.user.id);
    try {
      const conversationId =
        item.directConversationId ??
        (
          await conversationsApi.createDirectMessage(activeOrganizationId, {
            recipientUserId: item.user.id,
          })
        ).id;
      router.push({
        pathname: "/conversation/[conversationId]",
        params: { conversationId },
      });
    } finally {
      setOpeningPersonId(null);
    }
  };

  return (
    <Screen scroll={false}>
      <View style={styles.page}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <View style={styles.grow}>
            <Text style={[styles.title, { color: theme.text }]}>Search</Text>
            <Muted>Messages, channels, and people in this workspace</Muted>
          </View>
        </View>
        <View
          style={[
            styles.search,
            { backgroundColor: theme.panel, borderColor: theme.border },
          ]}
        >
          <Search color={theme.muted} size={20} />
          <TextInput
            accessibilityLabel="Search workspace"
            autoFocus
            onChangeText={setInput}
            placeholder="Search at least two characters"
            placeholderTextColor={theme.muted}
            style={[styles.input, { color: theme.text }]}
            value={input}
          />
        </View>
        <View style={styles.filters}>
          {FILTERS.map((filter) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: filter === type }}
              key={filter}
              onPress={() => setType(filter)}
              style={[
                styles.filter,
                {
                  backgroundColor:
                    filter === type ? theme.accentSoft : theme.panel,
                  borderColor: filter === type ? theme.accent : theme.border,
                },
              ]}
            >
              <Text style={{ color: theme.text, fontWeight: "800" }}>
                {filter[0] + filter.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </View>
        {query.length < 2 ? (
          <StateView
            title="Find anything"
            message="Enter two or more characters to search."
          />
        ) : results.isLoading ? (
          <StateView
            loading
            title="Searching"
            message="Checking accessible workspace content."
          />
        ) : results.isError ? (
          <StateView
            title="Search unavailable"
            message={
              results.error instanceof Error
                ? results.error.message
                : "Try again."
            }
            action={
              <Button onPress={() => void results.refetch()}>Retry</Button>
            }
          />
        ) : items.length === 0 ? (
          <StateView
            title="No results"
            message={`Nothing accessible matched “${query}”.`}
          />
        ) : (
          <FlatList
            contentContainerStyle={styles.list}
            data={items}
            keyExtractor={(item) =>
              `${item.kind}:${item.kind === "PERSON" ? item.membershipId : item.id}`
            }
            onEndReached={() => {
              if (results.hasNextPage && !results.isFetchingNextPage) {
                void results.fetchNextPage();
              }
            }}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                disabled={
                  item.kind === "PERSON" && openingPersonId === item.user.id
                }
                onPress={() => void open(item)}
              >
                <Card style={styles.result}>
                  {item.kind === "PERSON" ? (
                    <UserAvatar
                      assetId={item.user.avatarAssetId}
                      displayName={item.user.displayName}
                      externalUrl={item.user.avatarUrl}
                    />
                  ) : item.kind === "CHANNEL" ? (
                    <Hash color={theme.accent} size={24} />
                  ) : (
                    <MessageSquareText color={theme.accent} size={24} />
                  )}
                  <View style={styles.grow}>
                    {item.kind === "PERSON" ? (
                      <>
                        <Text
                          style={[styles.resultTitle, { color: theme.text }]}
                        >
                          {item.user.displayName}
                        </Text>
                        <Muted>@{item.user.username}</Muted>
                      </>
                    ) : item.kind === "CHANNEL" ? (
                      <>
                        <Text
                          style={[styles.resultTitle, { color: theme.text }]}
                        >
                          #{item.name}
                        </Text>
                        <Muted>{item.visibility.toLowerCase()} channel</Muted>
                      </>
                    ) : (
                      <>
                        <Text
                          style={[styles.resultTitle, { color: theme.text }]}
                        >
                          {item.sender.displayName} in {item.conversation.label}
                        </Text>
                        <Text numberOfLines={2} style={{ color: theme.muted }}>
                          {item.snippet.map((segment) => segment.text).join("")}
                        </Text>
                      </>
                    )}
                  </View>
                  {item.kind === "PERSON" ? (
                    <UserRound color={theme.muted} size={18} />
                  ) : null}
                </Card>
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, gap: 14, padding: 16 },
  header: { alignItems: "center", flexDirection: "row", gap: 12 },
  grow: { flex: 1 },
  title: { fontSize: 26, fontWeight: "900" },
  search: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 13,
  },
  input: { flex: 1, minHeight: 50 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  filter: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  list: { gap: 9, paddingBottom: 24 },
  result: { alignItems: "center", flexDirection: "row" },
  resultTitle: { fontSize: 15, fontWeight: "900" },
});
