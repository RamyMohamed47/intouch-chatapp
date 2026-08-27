interface TypingIndicatorProps {
  names: readonly (string | null | undefined)[];
}

export const formatTypingMessage = (
  names: readonly (string | null | undefined)[],
) => {
  if (names.length === 0) return null;

  const knownNames = names
    .map((name) => name?.trim())
    .filter((name): name is string => Boolean(name));

  if (names.length === 1) {
    return `${knownNames[0] ?? "Someone"} is typing`;
  }
  if (names.length === 2) {
    if (knownNames.length === 2) {
      return `${knownNames[0]} and ${knownNames[1]} are typing`;
    }
    if (knownNames.length === 1) {
      return `${knownNames[0]} and someone else are typing`;
    }
    return "Two people are typing";
  }
  if (knownNames.length >= 2) {
    const otherCount = names.length - 2;
    return `${knownNames[0]}, ${knownNames[1]}, and ${otherCount} ${
      otherCount === 1 ? "other" : "others"
    } are typing`;
  }
  if (knownNames.length === 1) {
    return `${knownNames[0]} and ${names.length - 1} others are typing`;
  }
  return `${names.length} people are typing`;
};

export function TypingIndicator({ names }: TypingIndicatorProps) {
  const message = formatTypingMessage(names);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex h-6 items-center gap-2 px-1 text-xs text-muted-foreground"
      data-testid="typing-indicator"
    >
      {message && (
        <>
          <span
            className="typing-indicator-dots inline-flex items-center gap-0.5"
            aria-hidden="true"
          >
            <span className="typing-indicator-dot" />
            <span className="typing-indicator-dot" />
            <span className="typing-indicator-dot" />
          </span>
          <span>{message}</span>
        </>
      )}
    </div>
  );
}
