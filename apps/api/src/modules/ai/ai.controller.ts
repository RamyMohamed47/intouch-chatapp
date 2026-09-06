import {
  aiSettingsResponseSchema,
  aiSseEventSchema,
  type AiConsentUpdate,
  type AiOrganizationSettingsUpdate,
  type AiResponseRequest,
  type AiSseEvent,
} from "@intouch/shared/ai";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Logger } from "pino";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type { AiOrganizationParams } from "./ai.schemas.js";
import type { AiService } from "./ai.service.js";

export interface AiController {
  getSettings: RequestHandler;
  updateSettings: RequestHandler;
  acceptConsent: RequestHandler;
  revokeConsent: RequestHandler;
  createResponse: RequestHandler;
}

const getUserId = (res: Response) => {
  const userId = (res.locals as AuthLocals).userId;
  if (!userId) throw new UnauthorizedError();
  return userId;
};

const writeEvent = (res: Response, event: AiSseEvent) => {
  const parsed = aiSseEventSchema.parse(event);
  res.write(`event: ${parsed.type}\ndata: ${JSON.stringify(parsed)}\n\n`);
};

const publicStreamError = (requestId: string, error: unknown): AiSseEvent => {
  const operational =
    error instanceof Error &&
    "isOperational" in error &&
    error.isOperational === true &&
    "code" in error &&
    typeof error.code === "string";
  return {
    type: "error",
    requestId,
    code: operational ? String(error.code) : "AI_UNAVAILABLE",
    message:
      operational && error instanceof Error
        ? error.message
        : "The AI response could not be completed",
  };
};

const createAiController = (
  service: AiService,
  logger: Logger,
): AiController => {
  const handle =
    (work: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next) => {
      void work(req, res).catch(next);
    };

  return {
    getSettings: handle(async (req, res) => {
      const { organizationId } = req.params as unknown as AiOrganizationParams;
      const aiSettings = await service.getSettings(
        getUserId(res),
        organizationId,
      );
      res.status(200).json(aiSettingsResponseSchema.parse({ aiSettings }));
    }),
    updateSettings: handle(async (req, res) => {
      const { organizationId } = req.params as unknown as AiOrganizationParams;
      const aiSettings = await service.updateSettings(
        getUserId(res),
        organizationId,
        req.body as AiOrganizationSettingsUpdate,
      );
      res.status(200).json(aiSettingsResponseSchema.parse({ aiSettings }));
    }),
    acceptConsent: handle(async (req, res) => {
      const { organizationId } = req.params as unknown as AiOrganizationParams;
      const aiSettings = await service.acceptConsent(
        getUserId(res),
        organizationId,
        req.body as AiConsentUpdate,
      );
      res.status(200).json(aiSettingsResponseSchema.parse({ aiSettings }));
    }),
    revokeConsent: handle(async (req, res) => {
      const { organizationId } = req.params as unknown as AiOrganizationParams;
      const aiSettings = await service.revokeConsent(
        getUserId(res),
        organizationId,
      );
      res.status(200).json(aiSettingsResponseSchema.parse({ aiSettings }));
    }),
    createResponse(req, res, next: NextFunction) {
      const abortController = new AbortController();
      let prepared:
        Awaited<ReturnType<AiService["createResponse"]>> | undefined;
      let heartbeat: NodeJS.Timeout | undefined;
      const close = () => abortController.abort();
      res.once("close", close);

      void (async () => {
        try {
          const { organizationId } =
            req.params as unknown as AiOrganizationParams;
          prepared = await service.createResponse(
            getUserId(res),
            organizationId,
            req.body as AiResponseRequest,
            abortController.signal,
          );
          res.status(200);
          res.set({
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          });
          res.flushHeaders();
          writeEvent(res, {
            type: "started",
            requestId: prepared.requestId,
            task: (req.body as AiResponseRequest).task,
          });
          writeEvent(res, { type: "sources", sources: prepared.sources });
          heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
          heartbeat.unref();
          for await (const chunk of prepared.stream) {
            if (abortController.signal.aborted) break;
            writeEvent(res, chunk);
          }
          if (!res.writableEnded) res.end();
        } catch (error) {
          if (abortController.signal.aborted) return;
          if (!res.headersSent) {
            next(error);
            return;
          }
          const requestId = prepared?.requestId ?? "unknown";
          logger.warn(
            { err: error, aiRequestId: requestId },
            "AI streaming response failed",
          );
          writeEvent(res, publicStreamError(requestId, error));
          res.end();
        } finally {
          if (heartbeat) clearInterval(heartbeat);
          res.off("close", close);
          await prepared?.release();
        }
      })();
    },
  };
};

export default createAiController;
