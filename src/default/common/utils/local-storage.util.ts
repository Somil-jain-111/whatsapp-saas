import { AsyncLocalStorage } from "async_hooks";

export class LocalStorageContextUtil {
  private static asyncLocalStorage = new AsyncLocalStorage<
    Map<string, string>
  >();

  static get(key: string): string | undefined {
    const store = this.asyncLocalStorage.getStore();
    return store ? store.get(key) : undefined;
  }

  static set(key: string, value: string): void {
    const store = this.asyncLocalStorage.getStore();
    if (store) {
      store.set(key, value);
    }
  }

  static has(key: string): boolean {
    const store = this.asyncLocalStorage.getStore();
    return store ? store.has(key) : false;
  }

  static delete(key: string): void {
    const store = this.asyncLocalStorage.getStore();
    if (store) {
      store.delete(key);
    }
  }

  static run(callback: () => void, initialData?: Map<string, string>): void {
    const store = initialData || new Map();
    this.asyncLocalStorage.run(store, callback);
  }
}
