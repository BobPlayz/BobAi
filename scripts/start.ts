import { spawn, ChildProcess } from "child_process";

function run(name: string, script: "api" | "web"): ChildProcess {
  console.log(`[${name}] starting...`);
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", `npm run ${script}`], { stdio: "inherit" });
  }
  return spawn("npm", ["run", script], { stdio: "inherit" });
}

async function main() {
  const api = run("API", "api");
  const web = run("WEB", "web");

  function shutdown() {
    console.log("\n[BobAI] shutting down...");
    api.kill();
    web.kill();
    process.exit();
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
