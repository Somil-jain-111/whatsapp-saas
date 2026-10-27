import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-custom";
import { ConfigService } from "@nestjs/config";
import { BusinessException } from "src/default/error/business.exception";
import { ERROR_CODES } from "src/default/error/error.code";

@Injectable()
export class ApiKeySecretStrategy extends PassportStrategy(
  Strategy,
  "api-key-secret",
) {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async validate(req: Request): Promise<{ apiKey: string }> {
    const apiKey = req.headers["x-api-key"] as string;
    const apiSecret = req.headers["x-api-secret"] as string;

    if (!apiKey || !apiSecret) {
      throw new BusinessException(ERROR_CODES.AUTH.API_KEY_AND_SECRET_REQUIRED);
    }

    // Validate API Secret from environment variable
    const validSecret = this.configService.get("API_SECRET");
    if (apiSecret !== validSecret) {
      throw new BusinessException(ERROR_CODES.AUTH.INVALID_API_SECRET);
    }

    // Pass the API Key for further processing (e.g., database validation)
    return { apiKey };
  }
}
