import {
  aiSettingsResponseSchema,
  type AiConsentUpdate,
  type AiOrganizationSettingsUpdate,
  type AiResponseRequest,
  type AiSseEvent,
} from "@intouch/shared/ai";
import { fetch as expoFetch } from "expo/fetch";

import { apiRequest, authenticatedFetch, parseError } from "@/core/api/client";
import { consumeAiSseStream } from "@/features/ai/ai-stream";

export const streamAiResponse = async (
  organizationId: string,
  input: AiResponseRequest,
  signal: AbortSignal,
  onEvent: (event: AiSseEvent) => void,
) => {
  const response = await authenticatedFetch(
    `/api/v1/organizations/${organizationId}/ai/responses`,
    {
      method: "POST",
      headers: { Accept: "text/event-stream" },
      body: JSON.stringify(input),
      signal,
    },
    expoFetch,
  );
  if (!response.ok) throw await parseError(response);
  if (!response.body) throw new Error("Echo response stream is unavailable");

  await consumeAiSseStream(response.body, onEvent);
};

export const aiApi = {
  async getSettings(organizationId: string) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/ai/settings`,
        aiSettingsResponseSchema,
      )
    ).aiSettings;
  },
  async updateSettings(
    organizationId: string,
    input: AiOrganizationSettingsUpdate,
  ) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/ai/settings`,
        aiSettingsResponseSchema,
        { method: "PUT", body: JSON.stringify(input) },
      )
    ).aiSettings;
  },
  async acceptConsent(organizationId: string, input: AiConsentUpdate) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/ai/consent`,
        aiSettingsResponseSchema,
        { method: "PUT", body: JSON.stringify(input) },
      )
    ).aiSettings;
  },
  async revokeConsent(organizationId: string) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/ai/consent`,
        aiSettingsResponseSchema,
        { method: "DELETE" },
      )
    ).aiSettings;
  },
};
