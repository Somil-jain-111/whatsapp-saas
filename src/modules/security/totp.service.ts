import { Injectable } from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

@Injectable()
export class TotpService {
  secret() {
    return this.encode(randomBytes(20));
  }

  uri(secret: string, account: string, issuer: string) {
    return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  }

  verify(secret: string, code: string, now = Date.now()) {
    if (!/^\d{6}$/.test(code)) return false;
    return [-1, 0, 1].some((offset) => {
      const expected = this.code(secret, now + offset * 30_000);
      return timingSafeEqual(Buffer.from(code), Buffer.from(expected));
    });
  }

  code(secret: string, now = Date.now()) {
    const counter = Math.floor(now / 30_000);
    const bytes = Buffer.alloc(8);
    bytes.writeBigUInt64BE(BigInt(counter));
    const hash = createHmac("sha1", this.decode(secret)).update(bytes).digest();
    const offset = hash[hash.length - 1] & 15;
    const value =
      (((hash[offset] & 127) << 24) |
        ((hash[offset + 1] & 255) << 16) |
        ((hash[offset + 2] & 255) << 8) |
        (hash[offset + 3] & 255)) %
      1_000_000;
    return String(value).padStart(6, "0");
  }

  private encode(bytes: Buffer) {
    let bits = "";
    for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
    return bits
      .match(/.{1,5}/g)!
      .map((part) => alphabet[parseInt(part.padEnd(5, "0"), 2)])
      .join("");
  }

  private decode(value: string) {
    const normalized = value.toUpperCase().replace(/=+$/, "");
    if (!/^[A-Z2-7]+$/.test(normalized)) throw new Error("Invalid TOTP secret");
    const bits = [...normalized]
      .map((character) =>
        alphabet.indexOf(character).toString(2).padStart(5, "0"),
      )
      .join("");
    return Buffer.from(
      (bits.match(/.{8}/g) ?? []).map((part) => parseInt(part, 2)),
    );
  }
}
