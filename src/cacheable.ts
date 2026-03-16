type Promiseable<T> = T | Promise<T>;

export class Cacheable<T> {
  private value?: T;
  private hasValue = false;
  private lastFetched = 0;
  private pending: Promise<T> | null = null;

  constructor(
    private getter: () => Promiseable<T>,
    private ttl = 600,
  ) {}

  async get(): Promise<T> {
    if (!this.expired) return this.value as T;
    if (this.pending) return this.pending;
    this.pending = Promise.resolve(this.getter())
      .then((v) => {
        this.value = v;
        this.lastFetched = Date.now();
        this.hasValue = true;
        this.pending = null;
        return v;
      })
      .catch((err) => {
        this.pending = null;
        throw err;
      });
    return this.pending;
  }

  reset(): void {
    this.value = undefined;
    this.hasValue = false;
    this.lastFetched = 0;
  }

  get expired(): boolean {
    return !this.hasValue || Date.now() - this.lastFetched >= this.ttl * 1000;
  }
}
