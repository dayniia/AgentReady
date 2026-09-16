export class RateLimitError extends Error {
  constructor(message = "Too many scan requests") {
    super(message);
    this.name = "RateLimitError";
  }
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
}) {
  const hits = new Map<string, number[]>();

  return {
    check(key: string): void {
      const now = Date.now();
      const windowStart = now - options.windowMs;
      const recent = (hits.get(key) ?? []).filter((time) => time > windowStart);
      if (recent.length >= options.max) {
        hits.set(key, recent);
        throw new RateLimitError();
      }
      recent.push(now);
      hits.set(key, recent);
    },
  };
}
