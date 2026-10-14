let tail: Promise<void> = Promise.resolve();

/**
 * Serialize heavyweight local inference so an 8 GB machine does not run chat
 * and diffusion model loads concurrently. The queue itself never rejects.
 */
export async function withLocalModelLock<T>(work: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const previous = tail;
  tail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await work();
  } finally {
    release();
  }
}
