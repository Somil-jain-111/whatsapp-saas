export const OTP_ERRORS = {
  OTP_REQUIRED: {
    code: "OTP_001",
    message: "OTP is required",
    statusCode: 400,
  },
  OTP_NOT_FOUND: {
    code: "OTP_002",
    message: "OTP not found. Please resend OTP.",
    statusCode: 400,
  },
  INVALID_OTP: {
    code: "OTP_003",
    message: "Invalid OTP",
    statusCode: 400,
  },
  OTP_EXPIRED: {
    code: "OTP_004",
    message: "OTP expired. Please resend OTP.",
    statusCode: 400,
  },
} as const;
