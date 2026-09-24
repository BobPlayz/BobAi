// Compatibility facade for older callers. The runtime registry is owned by modelRuntime.ts.
export {
  RUNTIME_MODELS,
  modelRuntime,
  type RuntimeCapability,
  type RuntimeState,
  type RuntimeModel,
  type RuntimeSnapshot,
  type TaskPlan,
  inferTaskPlan,
  ModelRuntimeManager,
} from "./modelRuntime.js";
