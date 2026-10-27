import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { ConsoleLogger } from "../../logger/console/console.service";
import { AppConfigService } from "src/default/config/config.service";

@Injectable()
export class RedisService implements OnModuleDestroy {
  public readonly client: Redis;

  constructor(private readonly configService: AppConfigService) {
    this.client = new Redis(this.getRedisConfig());
  }

  private getRedisConfig() {
    const tlsEnabled =
      String(this.configService.get("REDIS_TLS", false)).toLowerCase() ===
      "true";
    return {
      host: this.configService.get("REDIS_HOST") || "127.0.0.1",
      port: Number(this.configService.get("REDIS_PORT")) || 6379,
      password: this.configService.get("REDIS_PASSWORD") || undefined,
      db: Number(this.configService.get("REDIS_DB")) || 0,

      ...(tlsEnabled ? { tls: {} } : {}),

      /**
       * Required for BullMQ also.
       */
      maxRetriesPerRequest: null,
    };
  }

  /**
   * Use this for BullMQ connection.
   * Do not directly use `this.client` for BullMQ.
   */
  getBullMqConnection(): Redis {
    return this.client.duplicate({
      maxRetriesPerRequest: null,
    });
  }

  async set(key: string, value: any, ttl?: number): Promise<"OK" | null> {
    return ttl
      ? await this.client.set(key, JSON.stringify(value), "EX", ttl)
      : await this.client.set(key, JSON.stringify(value));
  }

  /**
   * Atomic "set if not exists". Returns true only if this call created the key,
   * so it's safe to use for locks/dedup where a race between concurrent callers must
   * result in exactly one winner.
   */
  async setNX(key: string, value: any, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(
      key,
      JSON.stringify(value),
      "EX",
      ttlSeconds,
      "NX",
    );
    return result === "OK";
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async delete(key: string): Promise<number> {
    return this.client.del(key);
  }

  /** Atomically consumes a single-use value. */
  async getAndDelete<T>(key: string): Promise<T | null> {
    // GETDEL was added in Redis 6.2. Use an atomic Lua operation so action tickets
    // remain single-use on older supported Redis servers without a GET/DEL race.
    const value = await this.client.eval(
      "local value=redis.call('GET',KEYS[1]); if value then redis.call('DEL',KEYS[1]); end; return value",
      1,
      key,
    );

    return typeof value === "string" ? JSON.parse(value) : null;
  }

  /** Atomic fixed-window counter; the first increment establishes the TTL. */
  async incrementWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    const result = await this.client.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n",
      1,
      key,
      ttlSeconds,
    );
    return Number(result);
  }

  async quit() {
    ConsoleLogger.log("Closing Redis connection", "RedisService");
    await this.client.quit();
  }

  async onModuleDestroy() {
    ConsoleLogger.log("Closing Redis connection", "RedisService");
    await this.client.quit();
  }
}
