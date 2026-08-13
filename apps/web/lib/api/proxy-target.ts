interface ProxyRequestUrl {
  pathname: string;
  search: string;
}

export const buildBackendProxyTarget = (
  requestUrl: ProxyRequestUrl,
  configuredOrigin = process.env.BACKEND_ORIGIN ?? "http://localhost:3000",
) => {
  const backendUrl = new URL(configuredOrigin);

  if (!["http:", "https:"].includes(backendUrl.protocol)) {
    throw new Error("BACKEND_ORIGIN must be an HTTP(S) origin");
  }

  const target = new URL(requestUrl.pathname, backendUrl.origin);
  target.search = requestUrl.search;
  return target;
};
