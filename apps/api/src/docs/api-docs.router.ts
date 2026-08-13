import { createRequire } from "node:module";
import { dirname } from "node:path";

import express from "express";

import type { OpenApiContract } from "./openapi.contract.js";

const docsContentSecurityPolicy = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "manifest-src 'none'",
].join("; ");

const documentationHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Public, read-only documentation for the InTouch REST API." />
    <title>InTouch API Documentation</title>
    <link rel="icon" type="image/png" sizes="32x32" href="/api/docs/assets/favicon-32x32.png" />
    <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css" />
    <link rel="stylesheet" href="/api/docs/intouch.css" />
  </head>
  <body>
    <header class="intouch-header">
      <a class="intouch-brand" href="/api/docs" aria-label="InTouch API documentation">
        <span class="intouch-brand-warm">In</span><span class="intouch-brand-cool">Touch</span>
        <span class="intouch-brand-label">API</span>
      </a>
      <span class="intouch-read-only">Documentation only</span>
    </header>
    <aside class="intouch-notice" role="note">
      This public explorer is read-only. Use the application or an authorized API client to execute requests.
      Socket.IO events are documented separately in the repository.
    </aside>
    <main id="swagger-ui"></main>
    <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
    <script src="/api/docs/assets/swagger-ui-standalone-preset.js"></script>
    <script src="/api/docs/swagger-initializer.js"></script>
  </body>
</html>`;

const documentationInitializer = `window.addEventListener("load", () => {
  window.ui = SwaggerUIBundle({
    url: "/api/openapi.json",
    dom_id: "#swagger-ui",
    deepLinking: true,
    displayRequestDuration: true,
    docExpansion: "list",
    filter: true,
    persistAuthorization: false,
    supportedSubmitMethods: [],
    tryItOutEnabled: false,
    validatorUrl: null,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: "StandaloneLayout"
  });
});`;

const documentationCss = `
:root {
  color-scheme: dark;
  --intouch-ink: #071020;
  --intouch-surface: #0d1b31;
  --intouch-border: #1d3b66;
  --intouch-blue: #2da8ff;
  --intouch-orange: #ff9b21;
}

html, body { margin: 0; min-height: 100%; background: var(--intouch-ink); }
body { font-family: ui-sans-serif, system-ui, sans-serif; }
.intouch-header {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 1rem clamp(1rem, 4vw, 3rem); border-bottom: 1px solid var(--intouch-border);
  background: linear-gradient(110deg, #0d1b31 0%, #091326 65%, #201509 140%);
}
.intouch-brand { color: white; font-size: 1.35rem; font-weight: 750; letter-spacing: -.04em; text-decoration: none; }
.intouch-brand-warm { color: var(--intouch-orange); }
.intouch-brand-cool { color: var(--intouch-blue); }
.intouch-brand-label { margin-left: .65rem; color: #9fb1c9; font: 600 .68rem ui-monospace, monospace; letter-spacing: .18em; }
.intouch-read-only {
  border: 1px solid #315e8e; border-radius: 999px; padding: .4rem .7rem;
  color: #b9ddff; background: #123153; font: 600 .65rem ui-monospace, monospace;
  letter-spacing: .12em; text-transform: uppercase;
}
.intouch-notice {
  margin: 1.25rem auto 0; width: min(90rem, calc(100% - 2rem)); box-sizing: border-box;
  border: 1px solid #315e8e; border-radius: 1rem; padding: .9rem 1rem;
  color: #c8d8ec; background: #0f2845; font-size: .9rem; line-height: 1.5;
}
.swagger-ui { color: #d9e6f5; }
.swagger-ui .topbar { display: none; }
.swagger-ui .info .title, .swagger-ui .info p, .swagger-ui .info li,
.swagger-ui .opblock-tag, .swagger-ui .model-title, .swagger-ui .model,
.swagger-ui .parameter__name, .swagger-ui table thead tr th,
.swagger-ui table thead tr td, .swagger-ui .response-col_status,
.swagger-ui .response-col_description, .swagger-ui label { color: #d9e6f5; }
.swagger-ui .info a, .swagger-ui .markdown code { color: #65c1ff; }
.swagger-ui .scheme-container, .swagger-ui section.models,
.swagger-ui .opblock .opblock-section-header { background: var(--intouch-surface); box-shadow: none; }
.swagger-ui section.models, .swagger-ui .model-container { border-color: var(--intouch-border); }
.swagger-ui .model-container { background: #10233e; }
.swagger-ui .btn.authorize { display: none; }
.swagger-ui select, .swagger-ui input[type=text] { color: #102036; }
@media (max-width: 640px) {
  .intouch-header { align-items: flex-start; }
  .intouch-read-only { font-size: .55rem; }
}
`;

const cacheBriefly = "public, max-age=300, must-revalidate";

export const createApiDocsRouter = ({ document, yaml }: OpenApiContract) => {
  const router = express.Router();
  const require = createRequire(import.meta.url);
  const swaggerAssetsPath = dirname(
    require.resolve("swagger-ui-dist/swagger-ui.css"),
  );

  router.get("/openapi.yaml", (_req, res) => {
    res.set("Cache-Control", cacheBriefly);
    res.type("application/yaml").send(yaml);
  });

  router.get("/openapi.json", (_req, res) => {
    res.set("Cache-Control", cacheBriefly);
    res.json(document);
  });

  router.use("/docs", (_req, res, next) => {
    res.set("Content-Security-Policy", docsContentSecurityPolicy);
    next();
  });

  router.get(/^\/docs\/?$/, (_req, res) => {
    res.set("Cache-Control", "no-cache");
    res.type("html").send(documentationHtml);
  });

  router.get("/docs/swagger-initializer.js", (_req, res) => {
    res.set("Cache-Control", cacheBriefly);
    res.type("application/javascript").send(documentationInitializer);
  });

  router.get("/docs/intouch.css", (_req, res) => {
    res.set("Cache-Control", cacheBriefly);
    res.type("text/css").send(documentationCss);
  });

  router.use(
    "/docs/assets",
    express.static(swaggerAssetsPath, {
      index: false,
      maxAge: "1h",
    }),
  );

  return router;
};

export { docsContentSecurityPolicy };
