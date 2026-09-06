import type { AiTask, AiWorkspaceSource } from "@intouch/shared/ai";
import type { Types } from "mongoose";

export interface AiOrganizationSettings {
  organizationId: Types.ObjectId;
  enabled: boolean;
  disclosureVersion: string;
  enabledByUserId: Types.ObjectId;
  enabledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiUserConsent {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  disclosureVersion: string;
  acceptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiSettingsRecord {
  organizationId: string;
  enabled: boolean;
  disclosureVersion: string;
  enabledByUserId: string;
  enabledAt: Date;
}

export interface AiConsentRecord {
  organizationId: string;
  userId: string;
  disclosureVersion: string;
  acceptedAt: Date;
}

export interface AiProviderRequest {
  task: keyof typeof AiTask;
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
}

export type AiProviderChunk =
  | { type: "delta"; text: string }
  | {
      type: "completed";
      finishReason: string;
      usage?: { inputTokens: number; outputTokens: number };
    };

export interface AiProvider {
  readonly name: "disabled" | "gemini";
  streamText(
    request: AiProviderRequest,
    signal: AbortSignal,
  ): Promise<AsyncIterable<AiProviderChunk>>;
}

export interface AiPreparedResponse {
  requestId: string;
  sources: AiWorkspaceSource[];
  stream: AsyncIterable<AiProviderChunk>;
  release(): Promise<void>;
}

export interface AiQuotaStatus {
  userRemaining: number;
  organizationRemaining: number;
  resetsAt: Date;
}

export type AiAdmission =
  | { allowed: true; leaseId: string; status: AiQuotaStatus }
  | {
      allowed: false;
      reason: "USER_DAILY" | "ORGANIZATION_DAILY" | "CONCURRENCY";
      retryAfterSeconds: number;
      status: AiQuotaStatus;
    };

export interface AiQuotaStore {
  admit(userId: string, organizationId: string): Promise<AiAdmission>;
  getStatus(userId: string, organizationId: string): Promise<AiQuotaStatus>;
  release(leaseId: string): Promise<void>;
  close(): void;
}
