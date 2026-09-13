import { enqueueAgentTask, getQueueJob, listQueueJobs, type QueueJob } from "./taskQueue.js";
import type { AgentSkillId } from "./agentSkills.js";
import type { AgentTaskKind } from "./agentTasks.js";

/**
 * Bob is the only conversational model. Background tasks are execution jobs,
 * not separate user-facing model personalities.
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
