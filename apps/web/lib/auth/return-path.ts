const APP_PATH_PREFIX = "/app";

export const getSafeReturnPath = (value: string | null | undefined) => {
  if (!value) return "/app";

  try {
    const url = new URL(value, "https://intouch.local");
    if (url.origin !== "https://intouch.local") return "/app";
    if (
      url.pathname !== APP_PATH_PREFIX &&
      !url.pathname.startsWith(`${APP_PATH_PREFIX}/`)
    ) {
      return "/app";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/app";
  }
};
