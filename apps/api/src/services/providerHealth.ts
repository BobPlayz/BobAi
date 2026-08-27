type ProviderState = { score: number; failures: number; updatedAt: number };
const states = new Map<string, ProviderState>();
const get = (id: string) => states.get(id) ?? { score: 100, failures: 0, updatedAt: Date.now() };

export function recordProviderSuccess(id: string) {
  const state = get(id);
  states.set(id, { score: Math.min(100, state.score + 5), failures: 0, updatedAt: Date.now() });
}

export function recordProviderFailure(id: string) {
  const state = get(id);
  const failures = state.failures + 1;
  states.set(id, { score: Math.max(0, state.score - Math.min(30, failures * 5)), failures, updatedAt: Date.now() });
}

export function providerAvailable(id: string, minimumScore = 30) { return get(id).score >= minimumScore; }
export function providerHealth(id: string) { return { id, ...get(id) }; }
