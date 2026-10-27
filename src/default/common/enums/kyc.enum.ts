export enum KycType {
  AADHAAR = "AADHAAR",
  PAN = "PAN",
  GST = "GST",
  NAME_MATCH = "NAME_MATCH",
  BANK = "BANK",
  UPI = "UPI",
  BENE_PAN = "BENE_PAN",
  BENE_AADHAAR = "BENE_AADHAAR",
}

export const KycTypeFiltered = {
  AADHAAR: KycType.AADHAAR,
  PAN: KycType.PAN,
  GST: KycType.GST,
} as const;

export type KycTypeFiltered =
  (typeof KycTypeFiltered)[keyof typeof KycTypeFiltered];

export enum KycStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  FAILED = "FAILED",
  REJECTED = "REJECTED",
}

export enum KycLogStatus {
  OTP_SENT = "OTP_SENT",
  VERIFIED = "VERIFIED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
  PROVIDER_ERROR = "PROVIDER_ERROR",
  SUBMITTED = "SUBMITTED",
  REJECTED = "REJECTED",
}

/**
 * Status of a Super Admin's manual override on a seller's overall KYC —
 * distinct from KycStatus (per-type auto-verification result). An override is
 * only ever an explicit decision, so it's just these two states; see
 * SellerKycOverallStatus for the full derived state a seller/list can be in.
 */
export enum SellerKycStatus {
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

/**
 * A seller's overall KYC state as shown in the admin list / seller profile.
 * Derived from {per-type verification results, override row} — never stored
 * directly. Completing all three of PAN/GST/AADHAAR does NOT auto-approve a
 * seller: it moves them to USER_PROFILE_APPROVAL, awaiting a Super Admin's
 * explicit approve (see SellerKycService.review). Only an APPROVED override
 * unlocks product/category creation (SellerKycService.isSellerKycApproved).
 */
export enum SellerKycOverallStatus {
  NOT_STARTED = "NOT_STARTED",
  PENDING = "PENDING",
  USER_PROFILE_APPROVAL = "USER_PROFILE_APPROVAL",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}
