import { createHmac, timingSafeEqual } from "crypto";
import { Injectable } from "@nestjs/common";

@Injectable()
export class TokenVerifierService {
  digest(token: string, pepper: Buffer): string {
    if (pepper.length < 32)
      throw new Error("Token pepper must contain at least 32 bytes");
    return createHmac("sha256", pepper).update(token, "utf8").digest("hex");
  }

  matches(token: string, pepper: Buffer, expectedHex: string): boolean {
    const actual = Buffer.from(this.digest(token, pepper), "hex");
    const expected = Buffer.from(expectedHex, "hex");
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }
}
