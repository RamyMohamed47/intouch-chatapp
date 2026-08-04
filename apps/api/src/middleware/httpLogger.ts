import { randomUUID } from "node:crypto";

import { pinoHttp } from "pino-http";

import { getLogger } from "../config/logger.js";

import type { Logger } from "pino";
import type { HttpLogger, Options } from "pino-http";
import type { Request, Response } from "express";

const getIncomingRequestId = (header: string | string[] | undefined) => {
  const requestId = Array.isArray(header) ? header[0] : header;

  return requestId?.trim() ? requestId : undefined;
};

export const shouldAutoLogHttpRequests = false;

const genReqId: NonNullable<Options<Request, Response>["genReqId"]> = (
  req,
  res,
) => {
  const requestId =
    getIncomingRequestId(req.headers["x-request-id"]) ?? randomUUID();

  res.setHeader("X-Request-Id", requestId);

  return requestId;
};

const createHttpLogger = (
  logger: Logger = getLogger(),
): HttpLogger<Request, Response> => {
  const options: Options<Request, Response> = {
    logger,
    genReqId,
    autoLogging: shouldAutoLogHttpRequests,
  };

  return pinoHttp<Request, Response>(options);
};

export default createHttpLogger;
