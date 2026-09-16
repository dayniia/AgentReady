import type { ClassifiedRoute } from "./types";

export function classificationCacheKey(
  sourceHash: string,
  method: string,
  path: string,
): string {
  return `${sourceHash}:${method}:${path}`;
}

export class ClassificationCache {
  private readonly store = new Map<string, ClassifiedRoute>();

  get(key: string): ClassifiedRoute | undefined {
    return this.store.get(key);
  }

  set(key: string, value: ClassifiedRoute): void {
    this.store.set(key, value);
  }

  get size(): number {
    return this.store.size;
  }
}
