/** Injectable time source so tests can expire sessions and leases without sleeping. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
