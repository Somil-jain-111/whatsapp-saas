import { CacheModuleOptions, CacheStore } from "@nestjs/cache-manager";
import { AppConfigService } from "../../default/config/config.service";
import { redisStore } from "cache-manager-redis-yet";
import { ConsoleLogger } from "../logger/console/console.service";

export const cacheConfig = async (
  appConfigService: AppConfigService,
): Promise<CacheModuleOptions> => {
  const redisHost = appConfigService.get("REDIS_HOST");
  const redisPort = Number(appConfigService.get("REDIS_PORT"));
  const redisPassword = appConfigService.get("REDIS_PASSWORD");
  const redisTTL = Number(appConfigService.get("REDIS_TTL"));
  const redisTls =
    String(appConfigService.get("REDIS_TLS", false)).toLowerCase() === "true";

  try {
    const store = await redisStore({
      socket: {
        host: redisHost,
        port: redisPort,
        tls: redisTls,
        connectTimeout: 5000,
        reconnectStrategy: (retries) =>
          retries > 3
            ? new Error("Redis cache connection failed after 3 retries")
            : Math.min(retries * 200, 2000),
      },
      password: redisPassword,
    });

    return { store: store as unknown as CacheStore, ttl: redisTTL * 60000 };
  } catch (error) {
    // Cache is an optimization only. Security-critical OTP/rate-limit state uses
    // RedisService separately and must never silently fall back to process memory.
    ConsoleLogger.warn(
      "Redis cache unavailable; using process-local memory cache",
      {
        tag: "cacheConfig",
        data: {
          error: error instanceof Error ? error.message : "unknown error",
        },
      },
    );
    return { ttl: redisTTL * 60000 };
  }
};
