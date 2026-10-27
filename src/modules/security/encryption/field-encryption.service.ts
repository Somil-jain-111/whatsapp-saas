import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { Inject, Injectable } from "@nestjs/common";

export const FIELD_ENCRYPTION_KEY_PROVIDER = Symbol(
  "FIELD_ENCRYPTION_KEY_PROVIDER",
);

export interface DataEncryptionKeyProvider {
  current(): Promise<{ key: Buffer; version: string }>;
  byVersion(version: string): Promise<Buffer>;
}

export interface EncryptedField {
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  keyVersion: string;
}

@Injectable()
export class FieldEncryptionService {
  constructor(
    @Inject(FIELD_ENCRYPTION_KEY_PROVIDER)
    private readonly keys: DataEncryptionKeyProvider,
  ) {}

  async encrypt(value: Buffer, context: string): Promise<EncryptedField> {
    const { key, version } = await this.keys.current();
    if (key.length !== 32)
      throw new Error("AES-256-GCM requires a 32-byte data key");
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(Buffer.from(context));
    const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
    return {
      ciphertext,
      nonce,
      authTag: cipher.getAuthTag(),
      keyVersion: version,
    };
  }

  async decrypt(field: EncryptedField, context: string): Promise<Buffer> {
    const key = await this.keys.byVersion(field.keyVersion);
    const decipher = createDecipheriv("aes-256-gcm", key, field.nonce);
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(field.authTag);
    return Buffer.concat([decipher.update(field.ciphertext), decipher.final()]);
  }
}
