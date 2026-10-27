import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { ConfigService } from "@nestjs/config";
import { ERROR_CODES } from "src/default/error/error.code";
import { BusinessException } from "src/default/error/business.exception";
import { RedisService } from "src/default/databases/redis/redis.service";

@Injectable()
export class HmacGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const secretKey = this.configService.get<string>("ENCRYPTION_SECRET_KEY");
    const receivedSignature = String(request.headers["x-hmac"] || "");
    const timestamp = String(request.headers["x-timestamp"] || "");
    const nonce = String(request.headers["x-nonce"] || "");
    if (!receivedSignature || !timestamp || !nonce) {
      throw new UnauthorizedException("HMAC signature missing");
    }

    // Compute the expected HMAC signature
    // const computedHmac = crypto
    // .createHmac('sha256', process.env.HMAC_SECRET_KEY)
    // .update(data, 'utf8')
    // .digest('hex');
    const hmac = crypto.createHmac("sha256", secretKey);
    const timestampMs = Number(timestamp);
    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000
    ) {
      throw new BusinessException(ERROR_CODES.AUTH.INVALID_HMAC_SIGNATURE);
    }
    const requestBody = `${timestamp}.${nonce}.${JSON.stringify(request.body)}`;
    const computedSignature = hmac.update(requestBody).digest("hex");
    const expected = Buffer.from(computedSignature, "hex");
    const received = Buffer.from(receivedSignature, "hex");
    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      throw new BusinessException(ERROR_CODES.AUTH.INVALID_HMAC_SIGNATURE);
    }

    const nonceAccepted = await this.redisService.setNX(
      `hmac:nonce:${nonce}`,
      true,
      5 * 60,
    );
    if (!nonceAccepted)
      throw new BusinessException(ERROR_CODES.AUTH.INVALID_HMAC_SIGNATURE);

    return true; // Allow access if valid
  }
}
