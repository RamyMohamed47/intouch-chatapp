export const organizations = [
  { id: "northstar", label: "Northstar", initials: "N" },
  { id: "pixel", label: "Pixel Labs", initials: "P" },
  { id: "studio", label: "Studio 47", initials: "S" },
];

type Channel = { name: string; unread?: number; active?: boolean };
type ChannelGroup = { label: string; channels: Channel[] };

export const channelGroups: ChannelGroup[] = [
  {
    label: "Company",
    channels: [
      { name: "announcements", unread: 3 },
      { name: "general" },
      { name: "wins" },
    ],
  },
  {
    label: "Product",
    channels: [
      { name: "product-design", active: true },
      { name: "engineering" },
      { name: "research" },
    ],
  },
];

export const directMessages = [
  { name: "Maya Chen", initials: "MC", status: "online" },
  { name: "Theo Martin", initials: "TM", status: "online" },
  { name: "Lina Okafor", initials: "LO", status: "away" },
];

export const messages = [
  {
    id: 1,
    author: "Maya Chen",
    initials: "MC",
    role: "Product Design",
    time: "9:42 AM",
    text: "Morning team — I pushed the latest onboarding flow into the review file. The new path trims two screens and makes workspace setup feel much lighter.",
    reaction: "Looks good",
    count: 6,
  },
  {
    id: 2,
    author: "Theo Martin",
    initials: "TM",
    role: "Engineering",
    time: "9:48 AM",
    text: "Just walked through it. The progressive disclosure is a big improvement. I can have the prototype wired up for tomorrow’s review.",
    reaction: "Ship it",
    count: 4,
  },
  {
    id: 3,
    author: "Lina Okafor",
    initials: "LO",
    role: "Research",
    time: "10:03 AM",
    text: "This lines up with what we heard in the last five sessions. People understood the workspace model once they saw a real channel, not during the empty setup step.",
    reaction: "Insightful",
    count: 3,
  },
  {
    id: 4,
    author: "Alex Rivera",
    initials: "AR",
    role: "Product",
    time: "10:16 AM",
    text: "Great work. Let’s use the product sync to settle the final copy and then move this into the next release candidate.",
    reaction: "On it",
    count: 5,
  },
];

export const members = [
  {
    name: "Alex Rivera",
    initials: "AR",
    role: "Product Lead",
    status: "online",
  },
  {
    name: "Maya Chen",
    initials: "MC",
    role: "Product Designer",
    status: "online",
  },
  {
    name: "Theo Martin",
    initials: "TM",
    role: "Senior Engineer",
    status: "online",
  },
  {
    name: "Lina Okafor",
    initials: "LO",
    role: "UX Researcher",
    status: "away",
  },
  {
    name: "Sam Wilson",
    initials: "SW",
    role: "Frontend Engineer",
    status: "offline",
  },
  { name: "Noah Kim", initials: "NK", role: "Data Analyst", status: "offline" },
];
