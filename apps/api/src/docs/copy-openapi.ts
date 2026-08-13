import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { canonicalContractPath } from "./openapi.contract.js";

export const bundledContractPath = () =>
  fileURLToPath(new URL("./openapi.yaml", import.meta.url));

export const copyOpenApiContract = (
  source = canonicalContractPath(),
  destination = bundledContractPath(),
) => {
  try {
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  } catch (cause) {
    throw new Error(
      `OpenAPI contract could not be copied from ${source} to ${destination}`,
      { cause },
    );
  }
};

const entryPath = process.argv[1];
if (
  entryPath !== undefined &&
  pathToFileURL(resolve(entryPath)).href === import.meta.url
) {
  copyOpenApiContract();
}
