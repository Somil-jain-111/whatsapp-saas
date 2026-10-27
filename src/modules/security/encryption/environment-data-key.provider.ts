import { Injectable } from "@nestjs/common";
import { AppConfigService } from "../../../default/config/config.service";
import { DataEncryptionKeyProvider } from "./field-encryption.service";

@Injectable()
export class EnvironmentDataKeyProvider implements DataEncryptionKeyProvider {
  constructor(private readonly config: AppConfigService) {}

  async current(): Promise<{ key: Buffer; version: string }> {
    return {
      key: this.readKey(),
      version: this.required("META_CREDENTIAL_KEY_VERSION"),
    };
  }

  async byVersion(version: string): Promise<Buffer> {
    if (version !== this.required("META_CREDENTIAL_KEY_VERSION")) {
      throw new Error(`Encryption key version ${version} is unavailable`);
    }
    return this.readKey();
  }

  private readKey(): Buffer {
    const key = Buffer.from(
      this.required("META_CREDENTIAL_ENCRYPTION_KEY_BASE64"),
      "base64",
    );
    if (key.length !== 32) {
      throw new Error(
        "META_CREDENTIAL_ENCRYPTION_KEY_BASE64 must decode to 32 bytes",
      );
    }
    return key;
  }

  private required(name: string): string {
    const value = this.config.get<string>(name);
    if (!value)
      throw new Error(`${name} is required when Meta integration is used`);
    return value;
  }
}
