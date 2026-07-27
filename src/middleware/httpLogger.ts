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

const genReqId: NonNullable<Options<Request, Response>["genReqId"]> = (
  req,
  res,
) => {
  const requestId =
    getIncomingRequestId(req.headers["x-request-id"]) ?? randomUUID();

  res.setHeader("X-Request-Id", requestId);

  return requestId;
};

const customLogLevel: NonNullable<
  Options<Request, Response>["customLogLevel"]
> = (_req, res, err) => {
  if (res.statusCode >= 500 || err) {
    return "error";
  }

  if (res.statusCode >= 400) {
    return "warn";
  }

  return "info";
};

const createHttpLogger = (
  logger: Logger = getLogger(),
): HttpLogger<Request, Response> => {
  const options: Options<Request, Response> = {
    logger,
    genReqId,
    customLogLevel,
  };

  return pinoHttp<Request, Response>(options);
};

export default createHttpLogger;
