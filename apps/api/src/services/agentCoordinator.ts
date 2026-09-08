import { enqueueAgentTask, getQueueJob, listQueueJobs, type QueueJob } from "./taskQueue.js";
import type { AgentSkillId } from "./agentSkills.js";
import type { AgentTaskKind } from "./agentTasks.js";

/**
 * Bob is the only conversational agent. Alex, Ben, Ryan, and Violet are
 * specialist employees managed by Bob and never address the user directly.
 */
export const USER_FACING_AGENT = "bob" as const;
export const BOB_EMPLOYEES = ["alex", "ben", "ryan", "violet"] as const;
export type BobEmployee = (typeof BOB_EMPLOYEES)[number];

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
