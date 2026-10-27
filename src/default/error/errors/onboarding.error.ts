export const ONBOARD_ERRORS = {
  INCOMPLETE_BASIC_INFO: {
    code: "ONBOARD_001",
    message: "Please complete your basic profile information first.",
    statusCode: 400,
  },
  INCOMPLETE_PAN_KYC: {
    code: "ONBOARD_002",
    message: "Please complete your PAN KYC verification first.",
    statusCode: 400,
  },
  INCOMPLETE_GST_KYC: {
    code: "ONBOARD_003",
    message: "Please complete your GST KYC verification first.",
    statusCode: 400,
  },
  INCOMPLETE_STORE_INFO: {
    code: "ONBOARD_004",
    message: "Please fill your user store information first.",
    statusCode: 400,
  },
  EMAIL_ALREADY_USED: {
    code: "ONBOARD_005",
    message: "Email address already used!",
    statusCode: 400,
  },
  WHATSAPP_NUMBER_ALREADY_USED: {
    code: "ONBOARD_006",
    message: "Whatsapp Number address already used!",
    statusCode: 400,
  },
  STORE_INFO_COMPLETED: {
    code: "ONBOARD_007",
    message: "Store info already completed!",
    statusCode: 400,
  },
  LOCATION_PINCODE_MISMATCH: {
    code: "ONBOARD_008",
    message:
      "Location (latitude & longitude) does not match the provided pincode.",
    statusCode: 400,
  },
  ALREADY_SUBMITTED_FOR_APPROVAL: {
    code: "ONBOARD_009",
    message: "Your profile is not needing any submission for approval",
    statusCode: 400,
  },
  INCOMPLETE_AADHAAR_KYC: {
    code: "ONBOARD_010",
    message: "Please complete your Aadhaar KYC verification first.",
    statusCode: 400,
  },
} as const;
