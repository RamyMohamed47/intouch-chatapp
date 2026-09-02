import express, { type RequestHandler } from "express";
import {
  callIdParamsSchema,
  joinVoiceSessionSchema,
  voiceParticipantParamsSchema,
} from "@intouch/shared/voice";

import {
  validateBody,
  validateParams,
} from "../../middleware/validateRequest.js";
import { conversationParamsSchema } from "../conversations/conversation.schemas.js";
import type { VoiceController } from "./voice.controller.js";

export const createConversationVoiceRouter = (
  controller: VoiceController,
  requireAccessToken: RequestHandler,
  joinLimit: RequestHandler,
  moderateLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router.post(
    "/:conversationId/voice/join",
    joinLimit,
    validateParams(conversationParamsSchema),
    validateBody(joinVoiceSessionSchema),
    controller.joinChannel,
  );
  router.post(
    "/:conversationId/voice/participants/:userId/mute",
    moderateLimit,
    validateParams(voiceParticipantParamsSchema),
    controller.muteParticipant,
  );
  router.delete(
    "/:conversationId/voice/participants/:userId",
    moderateLimit,
    validateParams(voiceParticipantParamsSchema),
    controller.disconnectParticipant,
  );
  router.post(
    "/:conversationId/calls",
    joinLimit,
    validateParams(conversationParamsSchema),
    validateBody(joinVoiceSessionSchema),
    controller.startCall,
  );
  return router;
};

export const createVoiceSessionRouter = (
  controller: VoiceController,
  requireAccessToken: RequestHandler,
  joinLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router.get("/sessions/me", controller.getActiveSession);
  router.post("/sessions/me/resume", joinLimit, controller.resumeSession);
  router.delete("/sessions/me", controller.leaveCurrentSession);
  return router;
};

export const createCallRouter = (
  controller: VoiceController,
  requireAccessToken: RequestHandler,
  lifecycleLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router.get(
    "/:callId",
    validateParams(callIdParamsSchema),
    controller.getCall,
  );
  for (const [action, handler] of [
    ["accept", controller.acceptCall],
    ["decline", controller.declineCall],
    ["cancel", controller.cancelCall],
    ["end", controller.endCall],
  ] as const) {
    router.post(
      `/:callId/${action}`,
      lifecycleLimit,
      validateParams(callIdParamsSchema),
      handler,
    );
  }
  return router;
};

export const createVoiceWebhookRouter = (controller: VoiceController) => {
  const router = express.Router();
  router.post(
    "/webhook",
    express.raw({ type: ["application/webhook+json", "application/json"] }),
    controller.webhook,
  );
  return router;
};
