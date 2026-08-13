import { existsSync, readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

export type OpenApiDocument = Record<string, unknown>;

export interface OpenApiContract {
  document: OpenApiDocument;
  yaml: string;
}

const bundledContractPath = () =>
  fileURLToPath(new URL("./openapi.yaml", import.meta.url));

const runsFromCompiledBuild = () =>
  basename(dirname(dirname(fileURLToPath(import.meta.url)))) === "dist";

export const canonicalContractPath = () =>
  fileURLToPath(
    new URL("../../../../.agents/api/openapi.yaml", import.meta.url),
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseOpenApiContract = (yaml: string): OpenApiDocument => {
  let parsed: unknown;

  try {
    parsed = parse(yaml);
  } catch (cause) {
    throw new Error("OpenAPI contract contains malformed YAML", { cause });
  }

  if (!isRecord(parsed) || parsed.openapi !== "3.1.0") {
    throw new Error("OpenAPI contract must be an OpenAPI 3.1.0 document");
  }

  if (!isRecord(parsed.info) || !isRecord(parsed.paths)) {
    throw new Error("OpenAPI contract must define info and paths objects");
  }

  return parsed;
};

export const loadOpenApiContract = (
  path = runsFromCompiledBuild() || existsSync(bundledContractPath())
    ? bundledContractPath()
    : canonicalContractPath(),
): OpenApiContract => {
  let yaml: string;

  try {
    yaml = readFileSync(path, "utf8");
  } catch (cause) {
    throw new Error(`OpenAPI contract could not be loaded from ${path}`, {
      cause,
    });
  }

  return { document: parseOpenApiContract(yaml), yaml };
};
