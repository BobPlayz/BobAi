import { createGateway, loadConfig } from "./gateway.js";

const config = loadConfig();
const host = process.env.GATEWAY_HOST || "127.0.0.1";
const port = Number(process.env.GATEWAY_PORT || 11435);

const server = createGateway(config);
server.listen(port, host, () => {
  console.log(`Jarvis Ollama gateway on http://${host}:${port} → ${config.ollamaUrl}`);
  console.log(`Allowed models: ${config.allowedModels.join(", ")} · max ${config.maxConcurrent} at a time`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => server.close(() => process.exit(0)));
