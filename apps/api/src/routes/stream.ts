import { Router } from "express";
import { initSSE } from "../utils/sse.js";
import { streamSession } from "../services/streamSession.js";

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
`.trim();

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