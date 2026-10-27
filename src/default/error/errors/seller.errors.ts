export const SELLER_ERRORS = {
  WRITE_ACCESS_REQUIRES_APPROVAL: {
    code: "SEL_000",
    message:
      "Seller profile and KYC approval are required before performing this action",
    statusCode: 403,
  },
  SELLER_ALREADY_REGISTERED: {
    code: "SEL_001",
    message: "This account is already registered as a seller",
    statusCode: 400,
  },
  SELLER_NOT_FOUND: {
    code: "SEL_002",
    message: "Seller profile not found",
    statusCode: 404,
  },
  SELLER_STORE_SLUG_TAKEN: {
    code: "SEL_003",
    message: "Store name is already taken, please choose another",
    statusCode: 400,
  },
  KYC_DOCUMENT_NOT_FOUND: {
    code: "SEL_004",
    message: "KYC document not found",
    statusCode: 404,
  },
  KYC_REJECTION_REASON_REQUIRED: {
    code: "SEL_005",
    message: "A rejection reason is required when rejecting a KYC document",
    statusCode: 400,
  },
  KYC_DOCUMENT_ALREADY_REVIEWED: {
    code: "SEL_006",
    message: "This KYC document has already been reviewed",
    statusCode: 400,
  },
  KYC_NOT_APPROVED: {
    code: "SEL_007",
    message: "Seller KYC has not been approved yet",
    statusCode: 403,
  },
  KYC_INCOMPLETE_FOR_APPROVAL: {
    code: "SEL_008",
    message: "Cannot approve seller KYC: {pending}",
    statusCode: 400,
  },
  PROFILE_ALREADY_COMPLETED: {
    code: "SEL_009",
    message: "Seller business profile has already been completed",
    statusCode: 409,
  },
  ONBOARDING_STEP_OUT_OF_ORDER: {
    code: "SEL_010",
    message: "Complete the previous seller onboarding step first",
    statusCode: 409,
  },
  AGREEMENT_NOT_ACCEPTED: {
    code: "SEL_011",
    message: "Seller agreement must be accepted",
    statusCode: 400,
  },
  KYC_INCOMPLETE: {
    code: "SEL_012",
    message: "Required seller KYC verification is incomplete",
    statusCode: 409,
  },
  BANK_DETAILS_INCOMPLETE: {
    code: "SEL_013",
    message: "Seller bank details are incomplete",
    statusCode: 409,
  },
  INVALID_AGREEMENT_VERSION: {
    code: "SEL_014",
    message: "Seller agreement version is invalid or outdated",
    statusCode: 409,
  },
  ONBOARDING_INCOMPLETE: {
    code: "SEL_015",
    message: "Seller onboarding requirements are incomplete",
    statusCode: 409,
  },
} as const;
