// src/default/common/utils/reference-id.util.ts

import { randomBytes } from "crypto";
import { KycType } from "../enums/kyc.enum";

export class ReferenceIdUtil {
  static generateKycReferenceId(type: KycType): string {
    const timestamp = Date.now();
    const random = randomBytes(4).toString("hex").toUpperCase();

    return `KYC_${type}_${timestamp}_${random}`;
  }
}
