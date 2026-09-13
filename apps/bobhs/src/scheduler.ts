export type NodeStatus = "online" | "draining" | "offline";
export type DeploymentStatus = "queued" | "running" | "error" | "stopped" | "draining";
export interface SchedulerNode { id: string; status: NodeStatus; cpuCount: number; memoryMb: number; freeMemoryMb: number; load1: number; activeJobs: number; labels: string[]; capabilities: string[]; }
export interface SchedulerDeployment { memoryMb: number; replicas: number; cpus: number; requiredLabels: string[]; requiredCapabilities: string[]; preferredNodeId?: string; }

export function nodeCanRun(node: SchedulerNode, deployment: SchedulerDeployment) {
  if (node.status !== "online") return false;
  if (deployment.requiredLabels.some(label => !node.labels.includes(label))) return false;
  if (deployment.requiredCapabilities.some(capability => !node.capabilities.includes(capability))) return false;
  if (node.freeMemoryMb < deployment.memoryMb * deployment.replicas + 256) return false;
  if (Math.max(0, node.cpuCount - node.activeJobs) < deployment.cpus * deployment.replicas) return false;
  return true;
}

export function scoreNode(node: SchedulerNode, deployment: SchedulerDeployment) {
  if (!nodeCanRun(node, deployment)) return Number.NEGATIVE_INFINITY;
  if (deployment.preferredNodeId && deployment.preferredNodeId === node.id) return 100000;
  const memoryRatio = node.memoryMb > 0 ? node.freeMemoryMb / node.memoryMb : 0;
  const cpuFree = Math.max(0, node.cpuCount - node.activeJobs);
  return memoryRatio * 5000 + cpuFree * 100 - node.load1 * 50 - node.activeJobs * 25;
}

export function chooseNode(nodes: SchedulerNode[], deployment: SchedulerDeployment) {
  let winner: SchedulerNode | undefined;
  let winnerScore = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    const score = scoreNode(node, deployment);
    if (score > winnerScore) { winner = node; winnerScore = score; }
  }
  return winner;
}
