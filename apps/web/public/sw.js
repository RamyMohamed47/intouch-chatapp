const fallbackPath = "/app";

const sameOriginUrl = (value) => {
  try {
    const url = new URL(
      typeof value === "string" ? value : fallbackPath,
      globalThis.location.origin,
    );
    return url.origin === globalThis.location.origin
      ? url.href
      : new URL(fallbackPath, globalThis.location.origin).href;
  } catch {
    return new URL(fallbackPath, globalThis.location.origin).href;
  }
};

globalThis.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = sameOriginUrl(event.notification.data?.href);

  event.waitUntil(
    globalThis.clients
      .matchAll({ includeUncontrolled: true, type: "window" })
      .then(async (windowClients) => {
        const existingClient = windowClients.find(
          (client) => new URL(client.url).origin === globalThis.location.origin,
        );
        if (existingClient) {
          await existingClient.navigate(targetUrl);
          return existingClient.focus();
        }
        return globalThis.clients.openWindow(targetUrl);
      }),
  );
});
