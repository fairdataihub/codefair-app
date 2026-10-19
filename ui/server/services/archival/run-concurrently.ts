/**
 * Runs `task` for indexes `0..count-1` with at most `limit` tasks in flight.
 *
 * The first failure aborts the shared signal so in-flight tasks can stop early,
 * prevents new tasks from starting, and is rethrown once every in-flight task
 * has settled.
 * @param count - Number of tasks to run.
 * @param limit - Maximum number of tasks running at the same time.
 * @param task - Work for a single index; should honour `signal`.
 * @returns Resolves when every task has completed.
 */
export async function runConcurrently(
  count: number,
  limit: number,
  task: (index: number, signal: AbortSignal) => Promise<void>,
): Promise<void> {
  const controller = new AbortController();
  let failure: { error: unknown } | undefined;
  let next = 0;

  const worker = async () => {
    while (next < count && !controller.signal.aborted) {
      const index = next++;
      try {
        await task(index, controller.signal);
      } catch (error) {
        // Later failures are usually just the abort reaching other tasks.
        if (!failure) {
          failure = { error };
          controller.abort(error);
        }
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(Math.max(limit, 1), count) }, worker),
  );
  if (failure) throw failure.error;
}
