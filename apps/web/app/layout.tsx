import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "InTouch — Team communication",
  description:
    "A focused workspace for teams to talk, decide, and move work forward.",
  generator: "v0.app",
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className="bg-background"
      data-theme="ink"
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#0d1120" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TooltipProvider>{children}</TooltipProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
