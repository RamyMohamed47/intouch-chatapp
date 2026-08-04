import { ConversationPage } from "@/components/conversations/conversation-page";

export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string; conversationId: string }>;
}) {
  const { organizationId, conversationId } = await params;
  return (
    <ConversationPage
      organizationId={organizationId}
      conversationId={conversationId}
      expectedType="DIRECT"
    />
  );
}
