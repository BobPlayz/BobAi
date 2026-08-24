import { Router } from "express";
import { initSSE } from "../utils/sse.js";
import { streamSession } from "../services/streamSession.js";
import { isCodingTask, runCodingAgent } from "../services/codingAgent.js";
import { memoryAsPrompt } from "../memory/memory.js";
import { extractMemory } from "../utils/memoryExtractor.js";

const router = Router();

router.post("/", async (req, res) => {
  const { send } = initSSE(res);

  try {
    const {
      messages,
      personality = "",
    } = req.body as {
      messages: {
        role: "system" | "user" | "assistant";
        content: string;
      }[];
      personality?: string;
    };

    const systemPrompt = `
you are bobai.

default language: english only unless the user explicitly changes language.

talk naturally, casually, and like a real person.
keep grammar relaxed.
avoid sounding like a textbook.
adapt to the user's writing style over time.

never randomly switch languages.
never pretend to remember things outside the current conversation unless memory provides them.

user customization:
${personality || "none"}

relevant saved memory:
${memoryAsPrompt()}
`.trim();

    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (latestUserMessage && extractMemory(latestUserMessage.content)) {
      send("done", { reply: "Got it. I will remember that for future conversations.", memoryStored: true });
      return res.end();
    }

    if (latestUserMessage && isCodingTask(latestUserMessage.content) && process.env.BOBAI_CODING_AGENTS_DIR) {
      const result = await runCodingAgent(latestUserMessage.content);
      send("done", { reply: result.output || "The coding agent completed without output.", agent: "coding", warnings: result.warnings });
      return res.end();
    }

    const full = await streamSession(
      [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages,
      ],
      (token) => {
        send("token", { token });
      }
    );

    send("done", { reply: full });
    res.end();
  } catch (error) {
    console.error(error);

    send("error", {
      message: "stream failed",
    });

    res.end();
  }
});

export default router;