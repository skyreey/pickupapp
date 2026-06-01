// ============================================================
// LRU-based dedup set (evicts least-recently-used on overflow)
// ============================================================

export class LRUSet {
  private map = new Map<string, true>();
  private max: number;

  constructor(max: number) {
    this.max = max;
  }

  get size(): number {
    return this.map.size;
  }

  has(v: string): boolean {
    return this.map.has(v);
  }

  add(v: string): void {
    // Move to end if already present (refresh LRU position)
    if (this.map.has(v)) {
      this.map.delete(v);
    }
    this.map.set(v, true);
    // Evict oldest (first in insertion order = least recently used)
    if (this.map.size > this.max) {
      const first = this.map.keys().next().value;
      if (first !== undefined) {
        this.map.delete(first);
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}