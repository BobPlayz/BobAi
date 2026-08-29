import { getCapabilityProviderStatus } from "./capabilityProviders";

export function getCapabilityHealth(capabilities: readonly string[]) {
  return capabilities.map((capability) => ({
    capability,
    ...getCapabilityProviderStatus(capability),
  }));
}
