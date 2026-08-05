import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InTouch - Team communication",
    short_name: "InTouch",
    description:
      "A focused workspace for teams to talk, decide, and move work forward.",
    start_url: "/app",
    display: "standalone",
    background_color: "#080b17",
    theme_color: "#0b63f6",
    icons: [
      {
        src: "/brand/intouch-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/intouch-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
