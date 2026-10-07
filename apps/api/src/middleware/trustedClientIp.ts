import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

import type { RequestHandler } from "express";

export const CLIENT_IP_HEADER = "x-intouch-client-ip";
export const PROXY_SECRET_HEADER = "x-intouch-proxy-secret";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * The web application proxies browser requests server-side, so the network
 * peer is the web service rather than the browser. A proxy that proves
 * knowledge of the shared secret may state the browser address instead.
 */
const createTrustedClientIp = (secret?: string): RequestHandler => {
  const expectedSecret = secret ? digest(secret) : undefined;

  return (req, _res, next) => {
    const presentedSecret = req.get(PROXY_SECRET_HEADER);
    const clientIp = req.get(CLIENT_IP_HEADER)?.trim();
    delete req.headers[PROXY_SECRET_HEADER];
    delete req.headers[CLIENT_IP_HEADER];

    if (
      expectedSecret &&
      presentedSecret &&
      clientIp &&
      isIP(clientIp) !== 0 &&
      timingSafeEqual(digest(presentedSecret), expectedSecret)
    ) {
      Object.defineProperty(req, "ip", {
        configurable: true,
        enumerable: true,
        value: clientIp,
      });
    }

    next();
  };
};

export default createTrustedClientIp;
