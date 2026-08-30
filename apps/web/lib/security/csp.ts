const toConnectSources = (socketOrigin: string) => {
  const socketUrl = new URL(socketOrigin);
  if (!["http:", "https:", "ws:", "wss:"].includes(socketUrl.protocol)) {
    throw new Error(
      "NEXT_PUBLIC_SOCKET_ORIGIN must be an HTTP(S) or WS(S) URL",
    );
  }

  const httpUrl = new URL(socketUrl.origin);
  const websocketUrl = new URL(socketUrl.origin);
  if (socketUrl.protocol === "ws:" || socketUrl.protocol === "wss:") {
    httpUrl.protocol = socketUrl.protocol === "wss:" ? "https:" : "http:";
  }
  websocketUrl.protocol = httpUrl.protocol === "https:" ? "wss:" : "ws:";
  return [httpUrl.origin, websocketUrl.origin];
};

export const buildContentSecurityPolicy = ({
  isDevelopment,
  nonce,
  socketOrigin,
  storageOrigin,
}: {
  isDevelopment: boolean;
  nonce: string;
  socketOrigin: string;
  storageOrigin?: string;
}) => {
  const normalizedStorageOrigin = storageOrigin
    ? new URL(storageOrigin).origin
    : undefined;
  const connectSources = [
    "'self'",
    ...toConnectSources(socketOrigin),
    ...(normalizedStorageOrigin ? [normalizedStorageOrigin] : []),
  ];
  const imageSources = [
    "'self'",
    "data:",
    "blob:",
    "https://lh3.googleusercontent.com",
    ...(normalizedStorageOrigin ? [normalizedStorageOrigin] : []),
  ];
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "style-src-elem 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    `img-src ${imageSources.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "media-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
  ];
  if (!isDevelopment) directives.push("upgrade-insecure-requests");
  return `${directives.join("; ")};`;
};
