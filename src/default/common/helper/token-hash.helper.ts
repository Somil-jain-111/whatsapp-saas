import * as crypto from "crypto";

export class TokenHashHelper {
  static hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}
