import {
  ChatWallpaperId,
  ChatWallpaperSource,
  chatWallpaperDtoSchema,
  type ChatWallpaperDto,
  type ChatWallpaperSourceType,
  type UpdateChatWallpaperInput,
} from "@intouch/shared/chat-wallpapers";

import type { ConversationParticipantRepository } from "../conversations/conversation-participant.repository.js";
import { ConversationNotFoundError } from "../conversations/conversation.errors.js";
import type { ConversationPolicy } from "../conversations/conversation.policy.js";
import type { ConversationRepository } from "../conversations/conversation.repository.js";
import type { MembershipService } from "../memberships/index.js";
import type { OrganizationUnitOfWork } from "../organizations/organization.unit-of-work.js";
import type { ChatWallpaperRepository } from "./chat-wallpaper.repository.js";
import type { ChatWallpaperPreferenceRecord } from "./chat-wallpaper.types.js";

const FALLBACK_WALLPAPER = {
  wallpaperId: ChatWallpaperId.INTOUCH_DOODLE,
  dimming: 35,
} as const;

export interface ChatWallpaperServiceDependencies {
  conversations: ConversationRepository;
  memberships: MembershipService;
  participants: ConversationParticipantRepository;
  policy: ConversationPolicy;
  preferences: ChatWallpaperRepository;
  unitOfWork: OrganizationUnitOfWork;
}

const toDto = (
  preference: Pick<
    ChatWallpaperPreferenceRecord,
    "wallpaperId" | "dimming"
  > | null,
  source: ChatWallpaperSourceType,
): ChatWallpaperDto => {
  const resolved = preference ?? FALLBACK_WALLPAPER;
  return chatWallpaperDtoSchema.parse({
    wallpaperId: resolved.wallpaperId,
    dimming: resolved.dimming,
    source,
  });
};

const createChatWallpaperService = ({
  conversations,
  memberships,
  participants,
  policy,
  preferences,
  unitOfWork,
}: ChatWallpaperServiceDependencies) => {
  const assertAccessible = async (
    userId: string,
    conversationId: string,
    context: {
      conversations: ConversationRepository;
      memberships: MembershipService;
      participants: ConversationParticipantRepository;
    } = { conversations, memberships, participants },
  ) => {
    const conversation = await context.conversations.findById(conversationId);
    const [membership, participant] = conversation
      ? await Promise.all([
          context.memberships.findForUser(userId, conversation.organizationId),
          context.participants.find(conversationId, userId),
        ])
      : [null, null];
    return policy.assertAccessible(conversation, membership, participant);
  };

  const getDefault = async (userId: string) =>
    toDto(await preferences.findDefault(userId), ChatWallpaperSource.DEFAULT);

  return {
    getDefault,

    async setDefault(userId: string, input: UpdateChatWallpaperInput) {
      return toDto(
        await preferences.upsert({ ...input, userId, conversationId: null }),
        ChatWallpaperSource.DEFAULT,
      );
    },

    async getForConversation(userId: string, conversationId: string) {
      await assertAccessible(userId, conversationId);
      const override = await preferences.findForConversation(
        userId,
        conversationId,
      );
      return override
        ? toDto(override, ChatWallpaperSource.CONVERSATION)
        : getDefault(userId);
    },

    async setForConversation(
      userId: string,
      conversationId: string,
      input: UpdateChatWallpaperInput,
    ) {
      return unitOfWork.run(async (context) => {
        const conversation = await assertAccessible(userId, conversationId, {
          conversations: context.conversations,
          memberships: context.memberships,
          participants: context.conversationParticipants,
        });
        if (
          !(await context.organizations.lockForMutation(
            conversation.organizationId,
          ))
        ) {
          throw new ConversationNotFoundError();
        }
        return toDto(
          await context.chatWallpapers.upsert({
            ...input,
            userId,
            conversationId,
          }),
          ChatWallpaperSource.CONVERSATION,
        );
      });
    },

    async resetConversation(userId: string, conversationId: string) {
      await unitOfWork.run(async (context) => {
        const conversation = await assertAccessible(userId, conversationId, {
          conversations: context.conversations,
          memberships: context.memberships,
          participants: context.conversationParticipants,
        });
        if (
          !(await context.organizations.lockForMutation(
            conversation.organizationId,
          ))
        ) {
          throw new ConversationNotFoundError();
        }
        await context.chatWallpapers.deleteForConversation(
          userId,
          conversationId,
        );
      });
    },
  };
};

export type ChatWallpaperService = ReturnType<
  typeof createChatWallpaperService
>;
export default createChatWallpaperService;
