import { randomBytes } from "crypto";

export class ResetTokenHelper {
  static generateResetToken(): string {
    return randomBytes(32).toString("hex");
  }

  static isResetTokenExpired(expiryDate?: Date | null): boolean {
    if (!expiryDate) {
      return true;
    }

    return new Date() > new Date(expiryDate);
  }
}
