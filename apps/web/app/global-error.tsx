"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          background: "#0d1120",
          color: "#f5f7fb",
          display: "flex",
          fontFamily: "sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <p style={{ color: "#2da8ff", letterSpacing: "0.16em" }}>INTOUCH</p>
          <h1>Something interrupted this view.</h1>
          <p style={{ color: "#aab2c8", lineHeight: 1.7 }}>
            The failure has been recorded. Try rendering the page again.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#2da8ff",
              border: 0,
              borderRadius: "999px",
              cursor: "pointer",
              fontWeight: 700,
              marginTop: "1rem",
              padding: "0.8rem 1.25rem",
            }}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
