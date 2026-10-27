/**
 * @Enum ApprovalStatus
 * @Approved = Action taken is approved for user (could be at any level in the approval chain)
 * @Blocked = Blocked in the approval chain (Final user should also be BLOCKED
 * @Rejected = User Profile was Rejected -> Push to previous level
 */

export enum ApprovalStatus {
  REJECTED = "rejected",
  APPROVED = "approved",
  BLOCKED = "blocked",
  PENDING = "pending",
}

export enum ApprovalType {
  PAN_KYC = "pan_kyc",
  AADHAAR_KYC = "aadhaar_kyc",
  BANK_KYC = "bank_kyc",
  GST_KYC = "gst_kyc",
  PROFILE = "profile",
  ORDER = "order",
  INVOICE = "invoice",
}

export enum ApprovalAction {
  APPROVE = "approve",
  REJECT = "reject",
  BLOCK = "block",
}
