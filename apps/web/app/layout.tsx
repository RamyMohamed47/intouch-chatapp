import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
  ),
  title: {
    default: "InTouch - Team communication",
    template: "%s | InTouch",
  },
  description:
    "A focused workspace for teams to talk, decide, and move work forward.",
  applicationName: "InTouch",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "32x32" }],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "InTouch",
    title: "InTouch - Team communication",
    description:
      "Conversations, decisions, and people together in one focused workspace.",
    images: [{ url: "/brand/intouch-og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "InTouch - Team communication",
    description:
      "Conversations, decisions, and people together in one focused workspace.",
    images: ["/brand/intouch-og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const themeScript = `(() => {
  const themes = ['ink', 'cloud', 'aurora', 'ember'];
  const saved = localStorage.getItem('intouch-theme');
  const theme = themes.includes(saved) ? saved : 'ink';
  document.documentElement.dataset.theme = theme;
  const colors = { ink: '#0d1120', cloud: '#f5f7fb', aurora: '#171328', ember: '#211317' };
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors[theme]);
})()`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      className="bg-background"
      data-theme="ink"
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#0d1120" />
        <Script
          id="intouch-theme-bootstrap"
          nonce={nonce}
          strategy="beforeInteractive"
        >
          {themeScript}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
        </Providers>
        {process.env.VERCEL === "1" && <Analytics />}
      </body>
    </html>
  );
}
