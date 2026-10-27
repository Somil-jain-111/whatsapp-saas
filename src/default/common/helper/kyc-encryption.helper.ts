import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "crypto";
import * as CryptoJS from "crypto-js";

type KycValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, unknown>
  | unknown[];

/** Versioned authenticated encryption for regulated seller data. */
export class KycEncryptionHelper {
  private static readonly VERSION = "v2";

  static encrypt(value: KycValue, secret: string, _legacyIv?: string): any {
    if (value === undefined || value === null) return value;
    if (!secret) throw new Error("KYC encryption secret is missing");
    if (Array.isArray(value))
      return value.map((item) => this.encrypt(item as KycValue, secret));
    if (typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          k,
          this.encrypt(v as KycValue, secret),
        ]),
      );
    }
    const key = createHash("sha256").update(secret, "utf8").digest();
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    return [
      this.VERSION,
      nonce.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(":");
  }

  static decrypt(value: KycValue, secret: string, legacyIv?: string): any {
    if (value === undefined || value === null) return value;
    if (Array.isArray(value))
      return value.map((item) =>
        this.decrypt(item as KycValue, secret, legacyIv),
      );
    if (typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          k,
          this.decrypt(v as KycValue, secret, legacyIv),
        ]),
      );
    }
    const encoded = String(value);
    if (!encoded.startsWith(`${this.VERSION}:`))
      return this.decryptLegacy(encoded, secret, legacyIv);
    try {
      const [, nonce, tag, ciphertext] = encoded.split(":");
      const key = createHash("sha256").update(secret, "utf8").digest();
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(nonce, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
      return JSON.parse(plaintext);
    } catch {
      return null;
    }
  }

  static lookupHash(value: string, secret: string): string {
    if (!secret) throw new Error("KYC encryption secret is missing");
    return createHmac("sha256", secret)
      .update(value.trim().toUpperCase())
      .digest("hex");
  }

  static encryptLegacy(value: string, secret: string, fixedIv: string): string {
    return CryptoJS.AES.encrypt(
      JSON.stringify(value),
      CryptoJS.enc.Hex.parse(secret),
      {
        iv: CryptoJS.enc.Hex.parse(fixedIv),
      },
    ).toString();
  }

  private static decryptLegacy(
    value: string,
    secret: string,
    fixedIv?: string,
  ): unknown {
    if (!fixedIv) return null;
    const bytes = CryptoJS.AES.decrypt(value, CryptoJS.enc.Hex.parse(secret), {
      iv: CryptoJS.enc.Hex.parse(fixedIv),
    });
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    if (!plaintext) return null;
    try {
      return JSON.parse(plaintext);
    } catch {
      return plaintext;
    }
  }
}
