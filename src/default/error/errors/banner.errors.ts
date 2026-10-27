export const BANNER_ERRORS = {
  NOT_FOUND: {
    code: "BANNER_001",
    message: "Banner not found",
    statusCode: 404,
  },
  ROLES_NOT_FOUND: {
    code: "BANNER_002",
    message: "Roles not found",
    statusCode: 404,
  },
  REDIRECT_VALUE_REQUIRED: {
    code: "BANNER_003",
    message: "Redirect value is required",
    statusCode: 400,
  },
  INVALID_REDIRECT_URL: {
    code: "BANNER_004",
    message: "Invalid redirect URL",
    statusCode: 400,
  },
} as const;
