export type TaskNode = { id: string; skill: string; input: unknown; dependsOn: string[] };

export function planTasks(skills: string[], input: unknown): TaskNode[] {
  return skills.map((skill, index) => ({ id: `task_${index + 1}`, skill, input, dependsOn: index ? [`task_${index}`] : [] }));
}

export function readyTasks(tasks: TaskNode[], completed: Set<string>) {
  return tasks.filter((task) => task.dependsOn.every((id) => completed.has(id)));
}
