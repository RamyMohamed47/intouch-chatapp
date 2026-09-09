const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|token|secret|password|body|content|prompt|response|filename|uploadurl/i;

export const sanitizeSentryText = (value: string) =>
  value.replace(EMAIL_PATTERN, "[email]").replace(/\?.*$/, "?[redacted]");

export const sanitizeSentryRecord = (
  value: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) return [];
      if (typeof entry === "string") return [[key, sanitizeSentryText(entry)]];
      if (Array.isArray(entry)) return [[key, "[redacted-array]"]];
      if (entry && typeof entry === "object") {
        return [[key, sanitizeSentryRecord(entry as Record<string, unknown>)]];
      }
      return [[key, entry]];
    }),
  );
