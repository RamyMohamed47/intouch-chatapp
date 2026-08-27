import { Types } from "mongoose";

import ConversationParticipantModel from "../conversations/conversation-participant.model.js";
import MembershipModel from "../memberships/membership.model.js";

export interface ConversationActivityAudienceRepository {
  listOrganizationMemberUserIds(
    organizationId: string,
    excludedUserId: string,
  ): Promise<string[]>;
  listParticipantMemberUserIds(
    organizationId: string,
    conversationId: string,
    excludedUserId: string,
  ): Promise<string[]>;
}

interface ParticipantAudienceResult {
  userId: Types.ObjectId;
}

const createMongooseConversationActivityAudienceRepository =
  (): ConversationActivityAudienceRepository => ({
    async listOrganizationMemberUserIds(organizationId, excludedUserId) {
      const userIds = await MembershipModel.distinct("userId", {
        organizationId,
        userId: { $ne: excludedUserId },
      }).exec();
      return userIds.map((userId) => userId.toString());
    },

    async listParticipantMemberUserIds(
      organizationId,
      conversationId,
      excludedUserId,
    ) {
      const results =
        await ConversationParticipantModel.aggregate<ParticipantAudienceResult>(
          [
            {
              $match: {
                organizationId: new Types.ObjectId(organizationId),
                conversationId: new Types.ObjectId(conversationId),
                userId: { $ne: new Types.ObjectId(excludedUserId) },
              },
            },
            {
              $lookup: {
                from: MembershipModel.collection.name,
                let: { participantUserId: "$userId" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          {
                            $eq: [
                              "$organizationId",
                              new Types.ObjectId(organizationId),
                            ],
                          },
                          { $eq: ["$userId", "$$participantUserId"] },
                        ],
                      },
                    },
                  },
                  { $limit: 1 },
                ],
                as: "membership",
              },
            },
            { $match: { "membership.0": { $exists: true } } },
            { $project: { _id: 0, userId: 1 } },
          ],
        ).exec();
      return results.map(({ userId }) => userId.toString());
    },
  });

export default createMongooseConversationActivityAudienceRepository;
