import { createCapabilityJob, updateCapabilityJob, type CapabilityJob } from "./jobs";
import { callCapabilityProvider } from "./capabilityProviders";

export async function executeMediaCapability(
  capability: string,
  input: Record<string, unknown>,
): Promise<CapabilityJob> {
  const job = createCapabilityJob(capability);
  updateCapabilityJob(job.id, { status: "processing" });

  try {
    const result = await callCapabilityProvider(capability, input);
    return updateCapabilityJob(job.id, { status: "completed", result })!;
  } catch (error) {
    const message = error instanceof Error ? error.message : "capability failed";
    return updateCapabilityJob(job.id, { status: "failed", error: message })!;
  }
}
