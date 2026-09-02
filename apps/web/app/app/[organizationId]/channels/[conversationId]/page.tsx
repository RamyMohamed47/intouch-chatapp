import { ChannelPage } from "@/components/conversations/channel-page";

export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string; conversationId: string }>;
}) {
  const { organizationId, conversationId } = await params;
  return (
    <ChannelPage
      organizationId={organizationId}
      conversationId={conversationId}
    />
  );
}
