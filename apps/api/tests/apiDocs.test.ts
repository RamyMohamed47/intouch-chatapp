import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { after, before, describe, test } from "node:test";

import createApp from "../src/app.js";
import {
  createApiDocsRouter,
  docsContentSecurityPolicy,
} from "../src/docs/api-docs.router.js";
import { copyOpenApiContract } from "../src/docs/copy-openapi.js";
import {
  loadOpenApiContract,
  parseOpenApiContract,
} from "../src/docs/openapi.contract.js";

process.env.NODE_ENV = "test";

let server: http.Server;
let baseUrl: string;

const listen = (httpServer: http.Server) =>
  new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });

const closeServer = (httpServer: http.Server) =>
  new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

before(async () => {
  const docs = loadOpenApiContract();
  server = http.createServer(
    createApp({ apiDocsRouter: createApiDocsRouter(docs) }),
  );
  await listen(server);

  const address = server.address();
  assert.notEqual(address, null);
  assert.notEqual(typeof address, "string");
  baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
});

after(async () => {
  await closeServer(server);
});

describe("API documentation", () => {
  const assertDocumentationShell = async (path: string) => {
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
    });
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
    assert.match(html, /<title>InTouch API Documentation<\/title>/);
    assert.match(html, /Documentation only/);
    assert.match(html, /\/api\/docs\/swagger-initializer\.js/);
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/i);
  };

  test("serves the branded shell at the canonical URL", async () => {
    await assertDocumentationShell("/api/docs");
  });

  test("also serves the branded shell with a trailing slash", async () => {
    await assertDocumentationShell("/api/docs/");
  });

  test("serves self-hosted Swagger assets with their expected MIME types", async () => {
    const [scriptResponse, styleResponse] = await Promise.all([
      fetch(`${baseUrl}/api/docs/assets/swagger-ui-bundle.js`),
      fetch(`${baseUrl}/api/docs/assets/swagger-ui.css`),
    ]);

    assert.equal(scriptResponse.status, 200);
    assert.match(
      scriptResponse.headers.get("content-type") ?? "",
      /javascript/,
    );
    assert.equal(styleResponse.status, 200);
    assert.match(styleResponse.headers.get("content-type") ?? "", /text\/css/);
  });

  test("configures Swagger as a read-only contract browser", async () => {
    const response = await fetch(`${baseUrl}/api/docs/swagger-initializer.js`);
    const initializer = await response.text();

    assert.equal(response.status, 200);
    assert.match(initializer, /supportedSubmitMethods: \[\]/);
    assert.match(initializer, /tryItOutEnabled: false/);
    assert.match(initializer, /persistAuthorization: false/);
    assert.match(initializer, /validatorUrl: null/);
  });

  test("applies a docs-specific CSP without executable inline allowances", async () => {
    const response = await fetch(`${baseUrl}/api/docs/`);
    const csp = response.headers.get("content-security-policy");

    assert.equal(csp, docsContentSecurityPolicy);
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /style-src 'self' 'unsafe-inline'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
    assert.doesNotMatch(csp, /'unsafe-eval'/);
    assert.doesNotMatch(csp, /https?:/);
  });

  test("serves equivalent YAML and JSON contracts", async () => {
    const [yamlResponse, jsonResponse] = await Promise.all([
      fetch(`${baseUrl}/api/openapi.yaml`),
      fetch(`${baseUrl}/api/openapi.json`),
    ]);
    const yaml = await yamlResponse.text();
    const document = (await jsonResponse.json()) as Record<string, unknown>;

    assert.equal(yamlResponse.status, 200);
    assert.match(
      yamlResponse.headers.get("content-type") ?? "",
      /application\/yaml/,
    );
    assert.equal(jsonResponse.status, 200);
    assert.match(
      jsonResponse.headers.get("content-type") ?? "",
      /application\/json/,
    );
    assert.deepEqual(document, parseOpenApiContract(yaml));
    assert.equal(document.openapi, "3.1.0");
    assert.deepEqual(document.servers, [
      {
        description: "Current host through the API or frontend proxy",
        url: "/api/v1",
      },
      {
        description: "Local API development",
        url: "http://localhost:3000/api/v1",
      },
    ]);
  });

  test("reports missing and malformed contracts clearly", () => {
    assert.throws(
      () => loadOpenApiContract(join(tmpdir(), "missing-openapi.yaml")),
      /OpenAPI contract could not be loaded/,
    );
    assert.throws(
      () => parseOpenApiContract("openapi: ["),
      /OpenAPI contract contains malformed YAML/,
    );
  });

  test("copies the canonical contract into a deployable destination", () => {
    const directory = mkdtempSync(join(tmpdir(), "intouch-openapi-"));
    const destination = join(directory, "docs", "openapi.yaml");

    try {
      copyOpenApiContract(undefined, destination);
      const copiedYaml = readFileSync(destination, "utf8");

      assert.equal(copiedYaml, loadOpenApiContract().yaml);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
