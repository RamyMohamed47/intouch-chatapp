import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";

const baseUrl = "http://localhost:3001/login";

const isReady = async () => {
  try {
    const response = await fetch(baseUrl);
    return response.ok;
  } catch {
    return false;
  }
};

const waitForServer = async (server: ChildProcess) => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(
        `Next.js test server exited with code ${server.exitCode}`,
      );
    }
    if (await isReady()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error("Timed out waiting for the Next.js test server");
};

const stopServer = (server: ChildProcess) => {
  if (!server.pid || server.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  server.kill("SIGTERM");
};

export default async function globalSetup() {
  if (await isReady()) return;

  const nextBin = resolve(
    process.cwd(),
    "../../node_modules/next/dist/bin/next",
  );
  const server = spawn(process.execPath, [nextBin, "dev", "--port", "3001"], {
    cwd: process.cwd(),
    stdio: "ignore",
    windowsHide: true,
  });

  await waitForServer(server);
  return () => stopServer(server);
}
