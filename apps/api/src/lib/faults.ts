/**
 * Test-only fault injection. In production every hook is a no-op; createApp() only receives
 * real hooks from the test suite (NODE_ENV=test). Each point is awaited, so a test can make it
 * throw (simulate a crash) or wait on a promise (hold a request "in progress").
 */
export type FaultPoint = 'afterKeyClaimed' | 'afterSeatClaimed' | 'beforeKeyCompleted' | 'beforeCommit' | 'afterCommit';

export interface Faults {
  hit(point: FaultPoint, ctx: { attempt: number; key: string }): Promise<void>;
}

export const noFaults: Faults = { hit: async () => {} };
