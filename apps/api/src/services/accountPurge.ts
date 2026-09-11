import { sql } from "drizzle-orm";
import { db } from "@bobai/db";

export async function purgeUserOwnedData(userId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM webhook_deliveries WHERE webhook_id IN (SELECT id FROM webhooks WHERE created_by = ${userId})`);
    await tx.execute(sql`DELETE FROM webhook_deliveries WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ${userId} AND type = 'personal')`);
    await tx.execute(sql`DELETE FROM webhooks WHERE created_by = ${userId}`);
    await tx.execute(sql`DELETE FROM tool_logs WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM tool_approvals WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM document_chunks WHERE upload_id IN (SELECT id FROM uploads WHERE uploaded_by = ${userId})`);
    await tx.execute(sql`DELETE FROM project_files WHERE uploaded_by = ${userId}`);
    await tx.execute(sql`DELETE FROM project_files WHERE project_id IN (SELECT id FROM projects WHERE owner_id = ${userId})`);
    await tx.execute(sql`DELETE FROM search_index WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ${userId} AND type = 'personal')`);
    await tx.execute(sql`DELETE FROM memory_embeddings WHERE memory_id IN (SELECT id FROM memories WHERE user_id = ${userId})`);
    await tx.execute(sql`DELETE FROM memory_history WHERE memory_id IN (SELECT id FROM memories WHERE user_id = ${userId}) OR user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ${userId})`);
    await tx.execute(sql`DELETE FROM conversations WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM memory_embeddings WHERE memory_id NOT IN (SELECT id FROM memories)`);
    await tx.execute(sql`DELETE FROM memory_history WHERE memory_id NOT IN (SELECT id FROM memories)`);
    await tx.execute(sql`DELETE FROM project_files WHERE project_id NOT IN (SELECT id FROM projects)`);
    await tx.execute(sql`DELETE FROM document_chunks WHERE upload_id NOT IN (SELECT id FROM uploads)`);
    await tx.execute(sql`DELETE FROM workflow_runs WHERE started_by = ${userId}`);
    await tx.execute(sql`DELETE FROM workflows WHERE created_by = ${userId}`);
    await tx.execute(sql`DELETE FROM agent_runs WHERE created_by = ${userId}`);
    await tx.execute(sql`DELETE FROM agents WHERE created_by = ${userId}`);
    await tx.execute(sql`DELETE FROM tasks WHERE created_by = ${userId}`);
    await tx.execute(sql`DELETE FROM reminders WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM notifications WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM integrations WHERE created_by = ${userId}`);
    await tx.execute(sql`DELETE FROM images WHERE created_by = ${userId}`);
    await tx.execute(sql`DELETE FROM voices WHERE created_by = ${userId}`);
    await tx.execute(sql`DELETE FROM research_sessions WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM settings WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM api_keys WHERE created_by = ${userId}`);
    await tx.execute(sql`DELETE FROM mfa_challenges WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM email_otps WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM password_resets WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM workspace_members WHERE user_id = ${userId}`);
  });
}
