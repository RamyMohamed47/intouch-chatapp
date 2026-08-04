export const formatTime = (value: string) =>
  new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export const formatShortDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));

export const formatRelativePresence = (value: string | null) => {
  if (!value) return "Online now";
  return `Last seen ${formatShortDate(value)} at ${formatTime(value)}`;
};
