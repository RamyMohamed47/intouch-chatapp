import {
  activeVoiceSessionResponseSchema,
  callJoinResponseSchema,
  callResponseSchema,
  voiceJoinResponseSchema,
  type CallMediaModeValue,
} from "@intouch/shared/voice";

import { apiRequest, noContentSchema } from "@/core/api/client";

export const voiceApi = {
  joinChannel: (conversationId: string, replaceActiveSession = false) =>
    apiRequest(
      `/api/v1/conversations/${conversationId}/voice/join`,
      voiceJoinResponseSchema,
      {
        method: "POST",
        body: JSON.stringify({ replaceActiveSession }),
      },
    ),
  activeSession: () =>
    apiRequest("/api/v1/voice/sessions/me", activeVoiceSessionResponseSchema),
  resumeSession: () =>
    apiRequest("/api/v1/voice/sessions/me/resume", voiceJoinResponseSchema, {
      method: "POST",
    }),
  leaveSession: () =>
    apiRequest("/api/v1/voice/sessions/me", noContentSchema, {
      method: "DELETE",
    }),
  startCall: (
    conversationId: string,
    mediaMode: CallMediaModeValue,
    replaceActiveSession = false,
  ) =>
    apiRequest(
      `/api/v1/conversations/${conversationId}/calls`,
      callJoinResponseSchema,
      {
        method: "POST",
        body: JSON.stringify({ mediaMode, replaceActiveSession }),
      },
    ),
  getCall: async (callId: string) =>
    (await apiRequest(`/api/v1/calls/${callId}`, callResponseSchema)).call,
  acceptCall: (callId: string) =>
    apiRequest(`/api/v1/calls/${callId}/accept`, callJoinResponseSchema, {
      method: "POST",
    }),
  declineCall: async (callId: string) =>
    (
      await apiRequest(`/api/v1/calls/${callId}/decline`, callResponseSchema, {
        method: "POST",
      })
    ).call,
  cancelCall: async (callId: string) =>
    (
      await apiRequest(`/api/v1/calls/${callId}/cancel`, callResponseSchema, {
        method: "POST",
      })
    ).call,
  endCall: async (callId: string) =>
    (
      await apiRequest(`/api/v1/calls/${callId}/end`, callResponseSchema, {
        method: "POST",
      })
    ).call,
  muteParticipant: (conversationId: string, userId: string) =>
    apiRequest(
      `/api/v1/conversations/${conversationId}/voice/participants/${userId}/mute`,
      noContentSchema,
      { method: "POST" },
    ),
  disconnectParticipant: (conversationId: string, userId: string) =>
    apiRequest(
      `/api/v1/conversations/${conversationId}/voice/participants/${userId}`,
      noContentSchema,
      { method: "DELETE" },
    ),
  stopScreenShare: (conversationId: string, userId: string) =>
    apiRequest(
      `/api/v1/conversations/${conversationId}/voice/participants/${userId}/screen-share`,
      noContentSchema,
      { method: "DELETE" },
    ),
};
