import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";
import { publicUserSummaryDtoSchema } from "../users/index.js";

const mongoIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ID");

export const AiTask = {
  ASK: "ASK",
  SUMMARIZE: "SUMMARIZE",
  COMPOSE: "COMPOSE",
} as const;

export const AiSummaryMode = {
  SUMMARY: "SUMMARY",
  ACTION_ITEMS: "ACTION_ITEMS",
} as const;

export const AiComposeAction = {
  REWRITE_PROFESSIONAL: "REWRITE_PROFESSIONAL",
  SHORTEN: "SHORTEN",
  FIX_GRAMMAR: "FIX_GRAMMAR",
  TRANSLATE: "TRANSLATE",
} as const;

export const AiScopeKind = {
  CONVERSATION: "CONVERSATION",
  ORGANIZATION: "ORGANIZATION",
} as const;

export const aiHistoryMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(2_000),
  })
  .strict();

const conversationScopeSchema = z
  .object({
    kind: z.literal(AiScopeKind.CONVERSATION),
    conversationId: mongoIdSchema,
  })
  .strict();

const organizationScopeSchema = z
  .object({ kind: z.literal(AiScopeKind.ORGANIZATION) })
  .strict();

const askSchema = z
  .object({
    task: z.literal(AiTask.ASK),
    prompt: z.string().trim().min(2).max(1_000),
    scope: z.discriminatedUnion("kind", [
      conversationScopeSchema,
      organizationScopeSchema,
    ]),
    history: z.array(aiHistoryMessageSchema).max(6).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const historyLength = (value.history ?? []).reduce(
      (total, message) => total + message.content.length,
      0,
    );
    if (historyLength > 6_000) {
      context.addIssue({
        code: "custom",
        path: ["history"],
        message: "AI history cannot exceed 6,000 characters",
      });
    }
  });

const summarizeSchema = z
  .object({
    task: z.literal(AiTask.SUMMARIZE),
    conversationId: mongoIdSchema,
    mode: z.enum(AiSummaryMode),
  })
  .strict();

const composeSchema = z
  .object({
    task: z.literal(AiTask.COMPOSE),
    action: z.enum(AiComposeAction),
    text: z.string().trim().min(1).max(4_000),
    targetLanguage: z.string().trim().min(2).max(40).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === AiComposeAction.TRANSLATE && !value.targetLanguage) {
      context.addIssue({
        code: "custom",
        path: ["targetLanguage"],
        message: "A target language is required for translation",
      });
    }
    if (
      value.action !== AiComposeAction.TRANSLATE &&
      value.targetLanguage !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["targetLanguage"],
        message: "A target language is only valid for translation",
      });
    }
  });

export const aiResponseRequestSchema = z.discriminatedUnion("task", [
  askSchema,
  summarizeSchema,
  composeSchema,
]);

export const aiOrganizationSettingsUpdateSchema = z
  .object({
    enabled: z.boolean(),
    disclosureVersion: z.string().min(1).max(50),
    acceptsProviderDataUse: z.literal(true).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.enabled && value.acceptsProviderDataUse !== true) {
      context.addIssue({
        code: "custom",
        path: ["acceptsProviderDataUse"],
        message: "Provider data-use acknowledgement is required",
      });
    }
  });

export const aiConsentUpdateSchema = z
  .object({
    disclosureVersion: z.string().min(1).max(50),
    acceptsProviderDataUse: z.literal(true),
  })
  .strict();

export const aiQuotaDtoSchema = z
  .object({
    userRemaining: z.number().int().nonnegative(),
    organizationRemaining: z.number().int().nonnegative(),
    resetsAt: dateTimeDtoSchema,
  })
  .strict();

export const aiSettingsDtoSchema = z
  .object({
    available: z.boolean(),
    organizationEnabled: z.boolean(),
    userConsentAccepted: z.boolean(),
    canManage: z.boolean(),
    disclosureVersion: z.string(),
    provider: z.literal("GEMINI"),
    serviceTier: z.enum(["FREE", "PAID"]),
    dataUseNotice: z.string(),
    quota: aiQuotaDtoSchema,
  })
  .strict();

export const aiSettingsResponseSchema = z
  .object({ aiSettings: aiSettingsDtoSchema })
  .strict();

export const aiWorkspaceSourceSchema = z
  .object({
    sourceId: z.string().min(1),
    messageId: identifierDtoSchema,
    conversationId: identifierDtoSchema,
    conversationType: z.enum(["CHANNEL", "DIRECT"]),
    conversationLabel: z.string().min(1),
    sender: publicUserSummaryDtoSchema,
    createdAt: dateTimeDtoSchema,
    excerpt: z.string().max(220),
  })
  .strict();

export const aiSseEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("started"),
      requestId: z.string().min(1),
      task: z.enum(AiTask),
    })
    .strict(),
  z.object({ type: z.literal("delta"), text: z.string() }).strict(),
  z
    .object({
      type: z.literal("sources"),
      sources: z.array(aiWorkspaceSourceSchema),
    })
    .strict(),
  z
    .object({
      type: z.literal("completed"),
      finishReason: z.string(),
      usage: z
        .object({
          inputTokens: z.number().int().nonnegative(),
          outputTokens: z.number().int().nonnegative(),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("error"),
      requestId: z.string().min(1),
      code: z.string().min(1),
      message: z.string(),
    })
    .strict(),
]);

export type AiResponseRequest = z.infer<typeof aiResponseRequestSchema>;
export type AiHistoryMessage = z.infer<typeof aiHistoryMessageSchema>;
export type AiOrganizationSettingsUpdate = z.infer<
  typeof aiOrganizationSettingsUpdateSchema
>;
export type AiConsentUpdate = z.infer<typeof aiConsentUpdateSchema>;
export type AiSettingsDto = z.infer<typeof aiSettingsDtoSchema>;
export type AiWorkspaceSource = z.infer<typeof aiWorkspaceSourceSchema>;
export type AiSseEvent = z.infer<typeof aiSseEventSchema>;
