/** In-memory identities for a mounted workflow, not a financial ledger.
 * Same command + same payload retries with the same key after an uncertain
 * response. Concurrent identical submissions share one promise. A confirmed
 * success ends that intent; a later identical action is a new operation.
 * No financial data or credentials are persisted in browser storage.
 */
export class RetryableCommandStore {
  private readonly entries = new Map<string, { requestId: string; pending?: Promise<unknown> }>();

  constructor(private readonly createId: () => string = () => crypto.randomUUID()) {}

  run<Result>(operation: string, payload: Record<string, unknown>, submit: (requestId: string) => Promise<Result>): Promise<Result> {
    // Command payloads are flat RPC field maps. Sort keys so property insertion
    // order cannot accidentally turn a retry into a second financial event.
    const identity = JSON.stringify([operation, Object.keys(payload).sort().map((key) => [key, payload[key]])]);
    const entry = this.entries.get(identity) ?? { requestId: this.createId() };
    this.entries.set(identity, entry);
    if (entry.pending) return entry.pending as Promise<Result>;
    const pending = Promise.resolve().then(() => submit(entry.requestId)).then(
      (result) => { this.entries.delete(identity); return result; },
      (error: unknown) => { entry.pending = undefined; throw error; },
    );
    entry.pending = pending;
    return pending;
  }
}
