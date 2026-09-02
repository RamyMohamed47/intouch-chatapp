"use client";

import { ConversationPage } from "@/components/conversations/conversation-page";
import { VoiceChannelPage } from "@/components/voice/voice-channel-page";
import { ResourceState } from "@/components/workspace/resource-state";
import { useConversation } from "@/lib/query/hooks";

export function ChannelPage({
  organizationId,
  conversationId,
}: {
  organizationId: string;
  conversationId: string;
}) {
  const conversation = useConversation(conversationId);
  if (conversation.isPending) {
    return (
      <ResourceState
        title="Loading channel"
        description="Preparing this workspace channel."
      />
    );
  }
  if (!conversation.data || conversation.data.type !== "CHANNEL") {
    return (
      <ResourceState
        title="Channel not found"
        description="This channel is unavailable or inaccessible."
        href={`/app/${organizationId}`}
      />
    );
  }
  return conversation.data.kind === "VOICE" ? (
    <VoiceChannelPage
      organizationId={organizationId}
      conversation={conversation.data}
    />
  ) : (
    <ConversationPage
      organizationId={organizationId}
      conversationId={conversationId}
      expectedType="CHANNEL"
    />
  );
}
