import { Router } from "express";
import { initSSE } from "../utils/sse.js";
import { isCodingTask, runCodingAgent } from "../services/codingAgent.js";
import { prepareChat, runStream } from "../services/chatEngine.js";

const router = Router();

router.post("/", async (req, res) => {
  const { send } = initSSE(res);

  try {
    const prepared = prepareChat({
      messages: req.body?.messages,
      personality: req.body?.personality,
    });

    if (prepared.validationError) {
      send("error", { message: prepared.validationError });
      return res.end();
    }

    if (prepared.memoryRequest) {
      send("done", {
        reply: "Got it. I will remember that for future conversations.",
        title: prepared.title,
        memoryStored: true,
      });
      return res.end();
    }

    if (
      prepared.latestUserMessage &&
      isCodingTask(prepared.latestUserMessage.content) &&
      process.env.BOBAI_CODING_AGENTS_DIR
    ) {
      const result = await runCodingAgent(prepared.latestUserMessage.content);
      send("done", {
        reply: result.output || "The coding agent completed without output.",
        title: prepared.title,
        agent: "coding",
        warnings: result.warnings,
      });
      return res.end();
    }

    const full = await runStream(prepared.ollamaMessages, (token) => {
      send("token", { token });
    });

    send("done", {
      reply: full,
      title: prepared.title,
    });
    return res.end();
  } catch (error) {
    console.error("STREAM ROUTE ERROR:", error);

    if (!res.writableEnded) {
      send("error", {
        message: error instanceof Error ? error.message : "stream failed",
      });
      res.end();
    }
  }
});

export default router;
