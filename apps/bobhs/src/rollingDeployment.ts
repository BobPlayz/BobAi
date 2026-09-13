export interface RollingDeploymentInput {
  currentReplicas: number;
  targetReplicas: number;
  maxUnavailable: number;
  maxSurge: number;
}

export type DeploymentStep =
  | { action: "start"; count: number }
  | { action: "stop"; count: number }
  | { action: "wait"; reason: string };

export function planRollingDeployment(input: RollingDeploymentInput): DeploymentStep[] {
  const current = Math.max(0, Math.floor(input.currentReplicas));
  const target = Math.max(1, Math.floor(input.targetReplicas));
  const unavailable = Math.max(0, Math.floor(input.maxUnavailable));
  const surge = Math.max(0, Math.floor(input.maxSurge));
  if (target === current) return [];
  if (target > current && surge === 0) throw new Error("maxSurge must be at least 1 when scaling up");
  if (target < current && unavailable === 0) throw new Error("maxUnavailable must be at least 1 when scaling down");

  const steps: DeploymentStep[] = [];
  let running = current;
  if (target > current) {
    let remaining = target - current;
    while (remaining > 0) {
      const start = Math.min(remaining, surge);
      steps.push({ action: "start", count: start });
      running += start;
      remaining -= start;
      if (remaining > 0) steps.push({ action: "wait", reason: "new replicas must become healthy before the next rollout step" });
    }
    return steps;
  }

  let remaining = current - target;
  while (remaining > 0) {
    const stop = Math.min(remaining, unavailable, Math.max(1, running - target));
    steps.push({ action: "stop", count: stop });
    running -= stop;
    remaining -= stop;
    if (remaining > 0) steps.push({ action: "wait", reason: "replacement capacity must remain healthy during rollout" });
  }
  return steps;
}
