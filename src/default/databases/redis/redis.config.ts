import { AppConfigService } from "../../../default/config/config.service";
import { RedisOptions } from "ioredis";

export const redisConfig = (configService: AppConfigService): RedisOptions => {
  const tlsEnabled =
    String(configService.get("REDIS_TLS", false)).toLowerCase() === "true";
  return {
    host: configService.get("REDIS_HOST"),
    port: configService.get("REDIS_PORT"),
    password: configService.get("REDIS_PASSWORD") || undefined,
    ...(tlsEnabled ? { tls: {} } : {}),
  };
};
