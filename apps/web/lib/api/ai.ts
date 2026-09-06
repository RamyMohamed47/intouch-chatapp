import {
  aiSettingsResponseSchema,
  aiSseEventSchema,
  type AiConsentUpdate,
  type AiOrganizationSettingsUpdate,
  type AiResponseRequest,
  type AiSseEvent,
} from "@intouch/shared/ai";

import { getAccessToken } from "@/lib/auth/access-token";
import { apiRequest, parseError, refreshAccessToken } from "@/lib/api/client";

const openStream = async (
  organizationId: string,
  input: AiResponseRequest,
  signal: AbortSignal,
  retryAfterRefresh = true,
) => {
  const headers = new Headers({
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  });
  const accessToken = getAccessToken();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(
    `/api/v1/organizations/${organizationId}/ai/responses`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(input),
      credentials: "same-origin",
      signal,
    },
  );
  if (response.status === 401 && retryAfterRefresh) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      return openStream(organizationId, input, signal, false);
    }
  }
  if (!response.ok) throw await parseError(response);
  if (!response.body) throw new Error("AI response stream is unavailable");
  return response.body;
};

const parseEvent = (block: string): AiSseEvent | null => {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;
  return aiSseEventSchema.parse(JSON.parse(data));
};

export const streamAiResponse = async (
  organizationId: string,
  input: AiResponseRequest,
  signal: AbortSignal,
  onEvent: (event: AiSseEvent) => void,
) => {
  const body = await openStream(organizationId, input, signal);
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseEvent(block);
        if (event) onEvent(event);
        boundary = buffer.indexOf("\n\n");
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const event = parseEvent(buffer);
      if (event) onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }
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
