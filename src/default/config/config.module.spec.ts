import { Injectable, Module } from "@nestjs/common";
import { GLOBAL_MODULE_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";
import { AppConfigService } from "./config.service";

process.env.NODE_ENV ??= "test";
process.env.API_VERSION ??= "1";
process.env.API_KEY ??= "test-api-key";
process.env.API_SECRET ??= "test-api-secret-at-least-16";
process.env.API_KEY_HASH_SECRET ??=
  "test-api-key-hash-secret-at-least-32-characters";
process.env.PUBLIC_API_ACCESS_TOKEN_SECRET ??=
  "test-public-api-access-token-secret-at-least-32-characters";
process.env.META_CREDENTIAL_ENCRYPTION_KEY_BASE64 ??= Buffer.alloc(
  32,
  1,
).toString("base64");
process.env.META_CREDENTIAL_KEY_VERSION ??= "test-v1";
process.env.KYC_ENCRYPTION_SECRET_KEY ??= "test-encryption-key-at-least-16";
process.env.REDIS_HOST ??= "localhost";

const { ConfigModule } =
  require("./config.module") as typeof import("./config.module");

@Injectable()
class FeatureProvider {
  constructor(readonly config: AppConfigService) {}
}

@Module({ providers: [FeatureProvider] })
class FeatureModule {}

describe("ConfigModule", () => {
  it("exports application configuration globally to sibling feature modules", async () => {
    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, ConfigModule)).toBe(
      true,
    );
    const module = await Test.createTestingModule({
      imports: [ConfigModule, FeatureModule],
    }).compile();
    expect(module.get(FeatureProvider).config).toBeInstanceOf(AppConfigService);
    await module.close();
  });
});
