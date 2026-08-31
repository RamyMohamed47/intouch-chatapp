import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const required = ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"];
const configured = required.filter((name) => process.env[name]);

if (configured.length === 0) {
  console.log("Sentry API source-map upload skipped (not configured)");
  process.exit(0);
}
if (configured.length !== required.length) {
  throw new Error(
    `Sentry API source-map upload requires ${required.join(", ")}`,
  );
}

const release =
  process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.SENTRY_RELEASE;
if (!release) {
  throw new Error(
    "Sentry API source-map upload requires RAILWAY_GIT_COMMIT_SHA or SENTRY_RELEASE",
  );
}

const executable = path.resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "sentry-cli.cmd" : "sentry-cli",
);
const run = (args) => {
  const result = spawnSync(executable, args, {
    env: { ...process.env, SENTRY_RELEASE: release },
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`sentry-cli ${args[0]} failed`);
  }
};

run(["sourcemaps", "inject", "apps/api/dist"]);
run([
  "sourcemaps",
  "upload",
  "--org",
  process.env.SENTRY_ORG,
  "--project",
  process.env.SENTRY_PROJECT,
  "--release",
  release,
  "apps/api/dist",
]);
