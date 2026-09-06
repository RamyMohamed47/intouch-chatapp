import type { RequestHandler } from "express";
import type { Logger } from "pino";

import createAuthenticatedRateLimit from "../../middleware/authenticatedRateLimit.js";
import type { AuthenticatedRateLimiter } from "../abuse-protection/index.js";
import { RateLimitAction } from "../abuse-protection/index.js";
import type { ConversationAccessScopeService } from "../conversations/conversation-access-scope.service.js";
import {
  createMembershipService,
  createMongooseMembershipRepository,
} from "../memberships/index.js";
import createOrganizationPolicy from "../organizations/organization.policy.js";
import createMongooseOrganizationRepository from "../organizations/organization.repository.js";
import { createMongooseMessageRepository } from "../message/index.js";
import {
  createMongooseSearchRepository,
  type SearchProvider,
} from "../search/index.js";
import { createMongooseUserRepository } from "../user/index.js";
import createAiController from "./ai.controller.js";
import { createInMemoryAiQuotaStore } from "./ai-quota.store.js";
import {
  createDisabledAiProvider,
  createGeminiAiProvider,
} from "./ai.provider.js";
import createMongooseAiRepository from "./ai.repository.js";
import createAiRouter from "./ai.routes.js";
import createAiService from "./ai.service.js";
import createMongooseAiUnitOfWork from "./ai.unit-of-work.js";
import type { AiProvider, AiQuotaStore } from "./ai.types.js";

export type AiRuntimeConfig =
  | {
      provider: "disabled";
      model: string;
      serviceTier: "free" | "paid";
      dailyUserRequests: number;
      dailyOrganizationRequests: number;
      maxConcurrentRequests: number;
    }
  | {
      provider: "gemini";
      apiKey: string;
      model: string;
      serviceTier: "free" | "paid";
      dailyUserRequests: number;
      dailyOrganizationRequests: number;
      maxConcurrentRequests: number;
    };

export interface AiModuleDependencies {
  accessScope: ConversationAccessScopeService;
  config: AiRuntimeConfig;
  logger: Logger;
  quota?: AiQuotaStore;
  rateLimits: AuthenticatedRateLimiter;
  requireAccessToken: RequestHandler;
  searchProvider: SearchProvider;
  telemetry?: Parameters<typeof createAiService>[0]["telemetry"];
}

const createAiModule = ({
  accessScope,
  config,
  logger,
  quota,
  rateLimits,
  requireAccessToken,
  searchProvider,
  telemetry,
}: AiModuleDependencies) => {
  const provider: AiProvider =
    config.provider === "gemini"
      ? createGeminiAiProvider({ apiKey: config.apiKey, model: config.model })
      : createDisabledAiProvider();
  const quotaStore =
    quota ??
    createInMemoryAiQuotaStore({
      dailyUserRequests: config.dailyUserRequests,
      dailyOrganizationRequests: config.dailyOrganizationRequests,
      maxConcurrentRequests: config.maxConcurrentRequests,
    });
  const service = createAiService({
    accessScope,
    dailyOrganizationRequests: config.dailyOrganizationRequests,
    dailyUserRequests: config.dailyUserRequests,
    logger,
    memberships: createMembershipService(createMongooseMembershipRepository()),
    messages: createMongooseMessageRepository(),
    model: config.model,
    organizationPolicy: createOrganizationPolicy(),
    organizations: createMongooseOrganizationRepository(),
    provider,
    quota: quotaStore,
    repository: createMongooseAiRepository(),
    search: createMongooseSearchRepository(searchProvider),
    serviceTier: config.serviceTier,
    ...(telemetry ? { telemetry } : {}),
    unitOfWork: createMongooseAiUnitOfWork(),
    users: createMongooseUserRepository(),
  });
  const controller = createAiController(service, logger);
  const aiLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.AI_REQUEST,
    "Too many AI assistant requests",
  );
  return {
    close: () => quotaStore.close(),
    router: createAiRouter(controller, requireAccessToken, aiLimit),
    service,
  };
};

export { createInMemoryAiQuotaStore } from "./ai-quota.store.js";
export { createRedisAiQuotaStore } from "./redis-ai-quota.store.js";
export { default as createMongooseAiRepository } from "./ai.repository.js";
export type { AiQuotaStore } from "./ai.types.js";
export default createAiModule;
