import type { RequestHandler } from "express";
import {
  activeVoiceSessionResponseSchema,
  callJoinResponseSchema,
  callResponseSchema,
  voiceJoinResponseSchema,
  type JoinVoiceSessionInput,
} from "@intouch/shared/voice";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import catchAsync from "../../utils/catchAsync.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type { VoiceService } from "./voice.service.js";

const getUserId = (locals: AuthLocals) => {
  if (!locals.userId) throw new UnauthorizedError();
  return locals.userId;
};

export interface VoiceController {
  acceptCall: RequestHandler;
  cancelCall: RequestHandler;
  declineCall: RequestHandler;
  disconnectParticipant: RequestHandler;
  endCall: RequestHandler;
  getActiveSession: RequestHandler;
  getCall: RequestHandler;
  joinChannel: RequestHandler;
  leaveCurrentSession: RequestHandler;
  muteParticipant: RequestHandler;
  resumeSession: RequestHandler;
  startCall: RequestHandler;
  webhook: RequestHandler;
}

const createVoiceController = (service: VoiceService): VoiceController => ({
  joinChannel: catchAsync(async (req, res) => {
    const result = await service.joinChannel(
      getUserId(res.locals as AuthLocals),
      String(req.params.conversationId),
      req.body as JoinVoiceSessionInput,
    );
    res.status(200).json(voiceJoinResponseSchema.parse(result));
  }),
  getActiveSession: catchAsync(async (_req, res) => {
    const session = await service.getActiveSession(
      getUserId(res.locals as AuthLocals),
    );
    res.status(200).json(activeVoiceSessionResponseSchema.parse({ session }));
  }),
  resumeSession: catchAsync(async (_req, res) => {
    const result = await service.resumeSession(
      getUserId(res.locals as AuthLocals),
    );
    res.status(200).json(voiceJoinResponseSchema.parse(result));
  }),
  leaveCurrentSession: catchAsync(async (_req, res) => {
    await service.leaveCurrentSession(getUserId(res.locals as AuthLocals));
    res.status(204).send();
  }),
  muteParticipant: catchAsync(async (req, res) => {
    await service.muteParticipant(
      getUserId(res.locals as AuthLocals),
      String(req.params.conversationId),
      String(req.params.userId),
    );
    res.status(204).send();
  }),
  disconnectParticipant: catchAsync(async (req, res) => {
    await service.disconnectParticipant(
      getUserId(res.locals as AuthLocals),
      String(req.params.conversationId),
      String(req.params.userId),
    );
    res.status(204).send();
  }),
  startCall: catchAsync(async (req, res) => {
    const result = await service.startCall(
      getUserId(res.locals as AuthLocals),
      String(req.params.conversationId),
      req.body as JoinVoiceSessionInput,
    );
    res.status(201).json(callJoinResponseSchema.parse(result));
  }),
  getCall: catchAsync(async (req, res) => {
    const call = await service.getCall(
      getUserId(res.locals as AuthLocals),
      String(req.params.callId),
    );
    res.status(200).json(callResponseSchema.parse({ call }));
  }),
  acceptCall: catchAsync(async (req, res) => {
    const result = await service.acceptCall(
      getUserId(res.locals as AuthLocals),
      String(req.params.callId),
    );
    res.status(200).json(callJoinResponseSchema.parse(result));
  }),
  declineCall: catchAsync(async (req, res) => {
    const call = await service.declineCall(
      getUserId(res.locals as AuthLocals),
      String(req.params.callId),
    );
    res.status(200).json(callResponseSchema.parse({ call }));
  }),
  cancelCall: catchAsync(async (req, res) => {
    const call = await service.cancelCall(
      getUserId(res.locals as AuthLocals),
      String(req.params.callId),
    );
    res.status(200).json(callResponseSchema.parse({ call }));
  }),
  endCall: catchAsync(async (req, res) => {
    const call = await service.endCall(
      getUserId(res.locals as AuthLocals),
      String(req.params.callId),
    );
    res.status(200).json(callResponseSchema.parse({ call }));
  }),
  webhook: catchAsync(async (req, res) => {
    const body = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : String(req.body);
    await service.handleWebhook(body, req.get("authorization") ?? undefined);
    res.status(204).send();
  }),
});

export default createVoiceController;
