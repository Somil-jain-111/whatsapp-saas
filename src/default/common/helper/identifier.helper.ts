import { BusinessException } from "src/default/error/business.exception";
import { ERROR_CODES } from "src/default/error/error.code";

/** Digits-only country calling code stored without a leading '+'. India is the default. */
export const DEFAULT_DIAL_CODE = "91";

export interface ResolvedIdentifier {
  type: "mobile" | "email";
  value: string;
  /** Only meaningful for mobile identifiers; defaults to India ('91'). */
  dialCode: string;
}

export class IdentifierHelper {
  /**
   * Requires exactly one of mobile/email so a request can't be routed to
   * one channel while silently carrying an unverified second identifier.
   * A mobile identifier also carries its country dial code (default '91'),
   * because phone identity is unique per (dialCode, mobile).
   */
  static resolve(dto: {
    mobile?: string;
    email?: string;
    dialCode?: string;
  }): ResolvedIdentifier {
    if (dto.mobile && dto.email) {
      throw new BusinessException(ERROR_CODES.AUTH.MOBILE_OR_EMAIL_REQUIRED);
    }

    if (dto.mobile) {
      return {
        type: "mobile",
        value: dto.mobile,
        dialCode: dto.dialCode || DEFAULT_DIAL_CODE,
      };
    }

    if (dto.email) {
      return { type: "email", value: dto.email, dialCode: DEFAULT_DIAL_CODE };
    }

    throw new BusinessException(ERROR_CODES.AUTH.MOBILE_OR_EMAIL_REQUIRED);
  }
}
