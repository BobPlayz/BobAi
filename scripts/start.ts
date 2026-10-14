import { spawn, spawnSync, ChildProcess } from "node:child_process";
import { platform } from "node:os";
import { resolve } from "node:path";

type Service = "api" | "web";

function runTests(): boolean {
  console.log("\n[Jarvis] Running the configured automated test suite before startup.\n");
  const result = spawnSync("npm", ["test"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.error) {
    console.error("[Jarvis] Could not start the test command:", result.error.message);
    return false;
  }

  if (result.status !== 0) {
    console.error(
      `\n[Jarvis] Tests failed (exit code ${result.status ?? "unknown"}). Services were not started. Fix the failures, then run npm run ai again.\n`,
    );
    return false;
  }

  console.log("\n[Jarvis] All configured tests passed. Starting the development services...\n");
  return true;
}

function run(name: string, script: Service): ChildProcess {
  console.log(`[${name}] starting...`);
  // The root .env may set PORT=3001 for the API. Do not let that setting make Next.js
  // use the API's port too. WEB_PORT can override the web port intentionally.
  const serviceEnv =
    script === "web"
      ? { ...process.env, PORT: process.env.WEB_PORT || "3000" }
      : process.env;

  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", `npm run ${script}`], {
      stdio: "inherit",
      env: serviceEnv,
    });
  }

  return spawn("npm", ["run", script], {
    stdio: "inherit",
    env: serviceEnv,
  });
}

function openBrowser(url: string): void {
  const os = platform();
  let command: string;
  let args: string[];

  if (os === "win32") {
    command = "cmd.exe";
    args = ["/d", "/s", "/c", `start "" "${url}"`];
  } else if (os === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const browser = spawn(command, args, { stdio: "ignore", detached: true });
  browser.on("error", () => {
    console.log(`[Jarvis] Open your browser manually at ${url}`);
  });
  browser.unref();
}

async function main(): Promise<void> {
  if (!runTests()) {
    process.exitCode = 1;
    return;
  }

  // Load the root .env only after tests finish, so test processes keep their isolated test configuration.
  // Child workspace commands run from apps/api and apps/web, so load the root file here and pass it down.
  try {
    process.loadEnvFile(resolve(process.cwd(), ".env"));
    console.log("[Jarvis] Loaded root .env configuration.");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
    console.warn("[Jarvis] No root .env file found. Services will use the environment variables already set.");
  }

  const api = run("API", "api");
  const web = run("WEB", "web");
  let shuttingDown = false;

  function shutdown(exitCode = 0): void {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\n[Jarvis] Shutting down API and web services...");
    api.kill();
    web.kill();
    process.exitCode = exitCode;
  }

  api.on("error", (error) => {
    console.error("[API] Failed to start:", error.message);
    shutdown(1);
  });
  web.on("error", (error) => {
    console.error("[WEB] Failed to start:", error.message);
    shutdown(1);
  });

  api.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[API] Exited unexpectedly with code ${code}.`);
      shutdown(code ?? 1);
    }
  });
  web.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[WEB] Exited unexpectedly with code ${code}.`);
      shutdown(code ?? 1);
    }
  });

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  console.log("\n[Jarvis] Web app: http://localhost:3000");
  console.log("[Jarvis] Keep this terminal open. Press Ctrl+C to stop both services.\n");
  setTimeout(() => openBrowser("http://localhost:3000"), 2000);
}

main().catch((error: unknown) => {
  console.error("[Jarvis] Startup failed:", error);
  process.exitCode = 1;
});
