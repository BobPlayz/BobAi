import { enqueueAgentTask, getQueueJob, listQueueJobs, type QueueJob } from "./taskQueue.js";
import type { AgentSkillId } from "./agentSkills.js";
import type { AgentTaskKind } from "./agentTasks.js";

/**
 * BobAI has exactly one conversational agent. Specialist agents are workers:
 * they only wake when a task is explicitly queued for them and never talk to
 * the user directly. Their results are returned to the conversational layer.
 */
export const USER_FACING_AGENT = "bob" as const;

export type BackgroundTaskRequest = {
  description: string;
  kind?: AgentTaskKind;
  skills?: AgentSkillId[];
  mode?: string;
  context?: { workspaceId?: string; createdBy?: string };
};

export function queueBackgroundTask(request: BackgroundTaskRequest): QueueJob {
  return enqueueAgentTask(request);
}

export function getBackgroundTask(id: string) {
  return getQueueJob(id);
}

export function listBackgroundTasks() {
  return listQueueJobs();
}
