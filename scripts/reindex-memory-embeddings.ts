import "dotenv/config";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, memories, memoryEmbeddings } from "@bobai/db";
import { generateModelEmbeddingWithModel } from "../apps/api/src/services/embeddings.js";
import { isSensitiveMemory } from "../apps/api/src/store/memoryDb.js";
import { ollamaStatus } from "../apps/api/src/services/ollamaProvider.js";

const BATCH_SIZE = Math.min(100, Math.max(1, Number(process.env.BOBAI_MEMORY_REINDEX_BATCH_SIZE || 20)));

async function main() {
  const status = await ollamaStatus();
  if (!status.ready) {
    const missing = status.missingModels?.join(", ") || status.error || "required local models are unavailable";
    throw new Error(`Ollama is not ready for memory reindexing: ${missing}`);
  }

  let afterId = "";
  let indexed = 0;
  let skipped = 0;
  while (true) {
    const rows = await db.execute(sql`
      select m.id, m.content
      from memories m
      where m.id::text > ${afterId}
        and m.is_archived = false
        and m.deleted_at is null
        and (m.expires_at is null or m.expires_at > now())
      order by m.id::text
      limit ${BATCH_SIZE}
    `) as unknown as Array<{ id: string; content: string }>;
    if (!rows.length) break;

    for (const row of rows) {
      afterId = row.id;
      if (typeof row.content !== "string" || !row.content.trim() || isSensitiveMemory(row.content)) {
        await db.delete(memoryEmbeddings).where(eq(memoryEmbeddings.memoryId, row.id));
        skipped += 1;
        continue;
      }
      const embedding = await generateModelEmbeddingWithModel(row.content).catch(() => null);
      if (!embedding || embedding.vector.length !== 1536 || embedding.vector.some((value) => !Number.isFinite(value))) {
        skipped += 1;
        continue;
      }
      await db.transaction(async (tx) => {
        await tx.delete(memoryEmbeddings).where(eq(memoryEmbeddings.memoryId, row.id));
        await tx.insert(memoryEmbeddings).values({
          memoryId: row.id,
          embedding: embedding.vector,
          embeddingModel: embedding.modelId,
        });
      });
      indexed += 1;
    }
    console.log(`memory embedding reindex: indexed=${indexed}, skipped=${skipped}`);
  }
  console.log(`memory embedding reindex complete: indexed=${indexed}, skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "memory reindex failed");
  process.exitCode = 1;
});
