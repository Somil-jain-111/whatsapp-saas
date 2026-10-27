import { Inject, Injectable } from "@nestjs/common";
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager";

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  set<T>(key: string, value: T, ttlMilliseconds?: number): Promise<void> {
    return this.cacheManager.set(key, value, ttlMilliseconds);
  }

  async delete(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async testCache(): Promise<number> {
    const testKey = "test_key";
    const testValue = "Hello, Cache!";

    await this.cacheManager.set(testKey, testValue);

    const value = await this.cacheManager.get<string>(testKey);

    return value ? 1 : 0;
  }
}
