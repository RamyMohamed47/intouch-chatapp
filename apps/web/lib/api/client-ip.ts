export const CLIENT_IP_HEADER = "x-intouch-client-ip";
export const PROXY_SECRET_HEADER = "x-intouch-proxy-secret";

/**
 * Tells the API which browser address a proxied request came from. The
 * right-most forwarded entry is the one appended by the platform edge, so it
 * cannot be chosen by the browser.
 */
export const applyProxyClientIp = (
  headers: Headers,
  secret = process.env.PROXY_CLIENT_IP_SECRET,
) => {
  const clientIp =
    headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    headers.get("x-real-ip")?.trim();
  headers.delete(CLIENT_IP_HEADER);
  headers.delete(PROXY_SECRET_HEADER);

  if (!secret || !clientIp) return;

  headers.set(CLIENT_IP_HEADER, clientIp);
  headers.set(PROXY_SECRET_HEADER, secret);
};
