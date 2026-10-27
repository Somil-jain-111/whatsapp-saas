import { Injectable } from "@nestjs/common";
import { RedisService } from "../databases/redis/redis.service";
import * as crypto from "crypto";

@Injectable()
export class IdempotencyService {
  private lockTTL = 5; // Lock expiration in seconds
  private hashTTL = 5; // Time to keep request hash in Redis

  constructor(private readonly redisService: RedisService) {}

  generateHash(data: any): string {
    const safeData = data ?? {};
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(safeData))
      .digest("hex");
  }

  async checkDuplicateRequest(data: any): Promise<boolean> {
    const hash = this.generateHash(data);
    // Atomic set-if-not-exists: only the first caller for a given hash gets `created === true`,
    // so concurrent identical requests can't both observe "not a duplicate".
    const created = await this.redisService.setNX(hash, "exists", this.hashTTL);
    return !created; // If we didn't create it, it already existed => duplicate
  }

  async acquireLock(idempotencyKey: string): Promise<boolean> {
    const lockKey = `idempotency-lock:${idempotencyKey}`;
    return this.redisService.setNX(lockKey, "locked", this.lockTTL);
  }

  async releaseLock(idempotencyKey: string): Promise<void> {
    const lockKey = `idempotency-lock:${idempotencyKey}`;
    await this.redisService.delete(lockKey);
  }
}
