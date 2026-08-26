import { spawn, ChildProcess } from "child_process";

const OLLAMA_PATH = `${process.env.LOCALAPPDATA}\\Programs\\Ollama\\ollama.exe`;

async function isOllamaRunning(): Promise<boolean> {
  try {
    return (await fetch("http://127.0.0.1:11434/api/version")).ok;
  } catch {
    return false;
  }
}

async function waitForOllama(timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isOllamaRunning()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function run(name: string, command: string, args: string[]): ChildProcess {
  console.log(`[${name}] starting...`);
  return spawn(command, args, { stdio: "inherit", shell: false });
}

async function main() {
  if (await isOllamaRunning()) console.log("[OLLAMA] already running");
  else {
    console.log("[OLLAMA] starting...");
    spawn(OLLAMA_PATH, ["serve"], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    if (!(await waitForOllama())) {
      console.error("[OLLAMA] failed to start within 15 seconds");
      process.exit(1);
    }
    console.log("[OLLAMA] ready");
  }

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const api = run("API", npm, ["run", "api"]);
  const web = run("WEB", npm, ["run", "web"]);

  function shutdown() {
    console.log("\n[BobAI] shutting down...");
    api.kill();
    web.kill();
    process.exit();
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});