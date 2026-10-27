export const VALIDATION_ERRORS = {
  VALIDATION_FAILED: {
    code: "VAL_001",
    message: "Validation failed",
    statusCode: 422,
  },
  REQUIRED_FIELD_MISSING: {
    code: "VAL_002",
    message: "Required field missing: {field}",
    statusCode: 422,
  },
  INVALID_EMAIL_FORMAT: {
    code: "VAL_003",
    message: "Invalid email format",
    statusCode: 422,
  },
  INVALID_MOBILE_NUMBER: {
    code: "VAL_004",
    message: "Invalid mobile number",
    statusCode: 422,
  },
  INVALID_DATE_FORMAT: {
    code: "VAL_005",
    message: "Invalid date format",
    statusCode: 422,
  },
  INVALID_REQUEST: {
    code: "VAL_006",
    message: "{reason}",
    statusCode: 400,
  },
} as const;
