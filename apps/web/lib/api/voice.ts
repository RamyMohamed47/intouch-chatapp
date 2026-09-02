import {
  activeVoiceSessionResponseSchema,
  callJoinResponseSchema,
  callResponseSchema,
  voiceJoinResponseSchema,
  type JoinVoiceSessionInput,
} from "@intouch/shared/voice";

import { apiRequest, noContentSchema } from "@/lib/api/client";

export const voiceApi = {
  async activeSession() {
    return (
      await apiRequest(
        "/api/v1/voice/sessions/me",
        activeVoiceSessionResponseSchema,
      )
    ).session;
  },
  resume() {
    return apiRequest(
      "/api/v1/voice/sessions/me/resume",
      voiceJoinResponseSchema,
      { method: "POST" },
    );
  },
  leave() {
    return apiRequest("/api/v1/voice/sessions/me", noContentSchema, {
      method: "DELETE",
    });
  },
  joinChannel(conversationId: string, input: JoinVoiceSessionInput) {
    return apiRequest(
      `/api/v1/conversations/${conversationId}/voice/join`,
      voiceJoinResponseSchema,
      { method: "POST", body: JSON.stringify(input) },
    );
  },
  startCall(conversationId: string, input: JoinVoiceSessionInput) {
    return apiRequest(
      `/api/v1/conversations/${conversationId}/calls`,
      callJoinResponseSchema,
      { method: "POST", body: JSON.stringify(input) },
    );
  },
  async getCall(callId: string) {
    return (await apiRequest(`/api/v1/calls/${callId}`, callResponseSchema))
      .call;
  },
  accept(callId: string) {
    return apiRequest(
      `/api/v1/calls/${callId}/accept`,
      callJoinResponseSchema,
      { method: "POST" },
    );
  },
  async transition(callId: string, action: "decline" | "cancel" | "end") {
    return (
      await apiRequest(
        `/api/v1/calls/${callId}/${action}`,
        callResponseSchema,
        { method: "POST" },
      )
    ).call;
  },
  muteParticipant(conversationId: string, userId: string) {
    return apiRequest(
      `/api/v1/conversations/${conversationId}/voice/participants/${userId}/mute`,
      noContentSchema,
      { method: "POST" },
    );
  },
  disconnectParticipant(conversationId: string, userId: string) {
    return apiRequest(
      `/api/v1/conversations/${conversationId}/voice/participants/${userId}`,
      noContentSchema,
      { method: "DELETE" },
    );
  },
};
