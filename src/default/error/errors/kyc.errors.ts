export const KYC_ERRORS = {
  PAN_VERIFICATION_FAILED: {
    code: "KYC_001",
    message: "PAN verification failed: {reason}",
    statusCode: 400,
  },
  PAN_ALREADY_VERIFIED: {
    code: "KYC_002",
    message: "PAN is already verified",
    statusCode: 400,
  },
  AADHAAR_VERIFICATION_FAILED: {
    code: "KYC_003",
    message: "Aadhaar verification failed: {reason}",
    statusCode: 400,
  },
  GST_VERIFICATION_FAILED: {
    code: "KYC_004",
    message: "GST verification failed: {reason}",
    statusCode: 400,
  },
  KYC_SECRET_KEY_MISSING: {
    code: "KYC_005",
    message: "KYC secret key is missing",
    statusCode: 500,
  },
  NAME_MATCH_FAILED: {
    code: "KYC_005",
    message: "Name matching failed: {reason}",
    statusCode: 400,
  },
  USER_PROFILE_NAME_REQUIRED: {
    code: "KYC_006",
    message: "Please add name in your profile",
    statusCode: 400,
  },
  PAN_ALREADY_SUBMITTED: {
    code: "KYC_007",
    message:
      "Your PAN verification is already in process or approved. You cannot submit again.",
    statusCode: 400,
  },

  PAN_ALREADY_IN_USE: {
    code: "KYC_008",
    message: "This PAN number is already in use",
    statusCode: 400,
  },
  PAN_NOT_LINKED_WITH_AADHAAR: {
    code: "KYC_009",
    message: "This PAN number is not linked with an Aadhaar number",
    statusCode: 400,
  },

  PAN_DATA_ENCRYPTION_FAILED: {
    code: "KYC_010",
    message: "Failed to process PAN data",
    statusCode: 500,
  },

  AADHAAR_IMAGES_REQUIRED: {
    code: "KYC_011",
    message: "Both Aadhaar images are mandatory",
    statusCode: 400,
  },

  INVALID_AADHAAR_FRONT_IMAGE: {
    code: "KYC_012",
    message: "Invalid Aadhaar front image format",
    statusCode: 400,
  },

  INVALID_AADHAAR_BACK_IMAGE: {
    code: "KYC_013",
    message: "Invalid Aadhaar back image format",
    statusCode: 400,
  },

  INVALID_AADHAAR_NUMBER: {
    code: "KYC_014",
    message: "Aadhaar number must contain 12 digits",
    statusCode: 400,
  },

  AADHAAR_ALREADY_IN_USE: {
    code: "KYC_015",
    message: "This Aadhaar number is already in use",
    statusCode: 400,
  },

  AADHAAR_ALREADY_VERIFIED: {
    code: "KYC_016",
    message: "Aadhaar already verified",
    statusCode: 400,
  },

  AADHAAR_OTP_GENERATION_FAILED: {
    code: "KYC_017",
    message: "Aadhaar OTP generation failed: {reason}",
    statusCode: 400,
  },

  AADHAAR_OTP_EXPIRED: {
    code: "KYC_018",
    message: "Aadhaar OTP expired. Please generate OTP again",
    statusCode: 400,
  },
  INVALID_OTP: {
    code: "KYC_019",
    message: "OTP must be of 6 digits",
    statusCode: 400,
  },
  KYC_REQUIRED_FOR_REDEMPTION: {
    code: "KYC_020",
    message: "Aadhaar or PAN KYC is required for redemption.",
    statusCode: 400,
  },

  PAN_KYC_REQUIRED: {
    code: "KYC_021",
    message: "Complete PAN KYC to redeem this product.",
    statusCode: 400,
  },

  INVALID_PARTNER_TYPE_FOR_GST: {
    code: "KYC_022",
    message: "GST KYC cannot be done for this partner type",
    statusCode: 400,
  },

  ACCOUNT_MISMATCH: {
    code: "KYC_023",
    message: "Account numbers do not match",
    statusCode: 400,
  },

  ACCOUNT_ALREADY_USED: {
    code: "KYC_024",
    message: "This bank account is already registered",
    statusCode: 400,
  },

  UPI_ALREADY_USED: {
    code: "KYC_025",
    message: "This UPI ID is already registered",
    statusCode: 400,
  },

  BANK_VERIFICATION_FAILED: {
    code: "KYC_026",
    message: "Bank verification failed: {reason}",
    statusCode: 400,
  },

  UPI_VERIFICATION_FAILED: {
    code: "KYC_027",
    message: "UPI verification failed: {reason}",
    statusCode: 400,
  },

  INVALID_BENEFICIARY_TYPE: {
    code: "KYC_028",
    message: "Invalid beneficiary type",
    statusCode: 400,
  },

  PAN_KYC_PENDING: {
    code: "KYC_029",
    message: "PAN KYC is pending and is awaiting approval from the admin.",
    statusCode: 400,
  },

  PAN_KYC_REQUIRED_TO_REDEEM: {
    code: "KYC_030",
    message: "Complete PAN KYC to Redeem.",
    statusCode: 400,
  },

  KYC_ALREADY_VERIFIED: {
    code: "KYC_031",
    message: "KYC of {type} is already verified for this user.",
    statusCode: 400,
  },

  MISSING_BENEFICIARY_NAME: {
    code: "KYC_032",
    message: "Beneficiary Name is required",
    statusCode: 400,
  },

  BENEFICIARY_NOT_FOUND: {
    code: "KYC_033",
    message: "Beneficiary not found",
    statusCode: 404,
  },

  BENEFICIARY_ALREADY_VERIFIED: {
    code: "KYC_034",
    message: "Beneficiary is already verified",
    statusCode: 400,
  },

  DOB_REQUIRED: {
    code: "KYC_035",
    message: "Date of birth is required to perform PAN KYC",
    statusCode: 400,
  },
} as const;
