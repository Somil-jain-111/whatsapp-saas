export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: {
    code: "AUTH_001",
    message: "Invalid email or password",
    statusCode: 401,
  },
  TOKEN_EXPIRED: {
    code: "AUTH_002",
    message: "Token expired",
    statusCode: 401,
  },
  INVALID_TOKEN: {
    code: "AUTH_003",
    message: "Invalid token",
    statusCode: 401,
  },
  UNAUTHORIZED_ACCESS: {
    code: "AUTH_004",
    message: "Unauthorized access",
    statusCode: 401,
  },
  FORBIDDEN_ACCESS: {
    code: "AUTH_005",
    message: "Forbidden access",
    statusCode: 403,
  },
  MOBILE_OR_EMAIL_REQUIRED: {
    code: "AUTH_006",
    message: "Mobile or email is required",
    statusCode: 400,
  },
  PASSWORD_LOGIN_DISABLED: {
    code: "AUTH_007",
    message: "Password login is not enabled for this user",
    statusCode: 401,
  },
  LOGIN_FAILED: {
    code: "AUTH_008",
    message: "Login failed",
    statusCode: 400,
  },
  INVALID_OTP: {
    code: "AUTH_009",
    message: "Invalid OTP",
    statusCode: 400,
  },
  OTP_EXPIRED: {
    code: "AUTH_010",
    message: "OTP has expired",
    statusCode: 400,
  },

  INVALID_REFRESH_TOKEN: {
    code: "AUTH_011",
    message: "Invalid refresh token",
    statusCode: 401,
  },

  REFRESH_TOKEN_EXPIRED: {
    code: "AUTH_012",
    message: "Refresh token expired",
    statusCode: 401,
  },
  RESET_TOKEN_GENERATION_FAILED: {
    code: "AUTH_013",
    message: "Reset token generation failed",
    statusCode: 400,
  },

  RESET_TOKEN_EXPIRED: {
    code: "AUTH_014",
    message: "Reset token has expired",
    statusCode: 400,
  },

  INVALID_RESET_TOKEN: {
    code: "AUTH_015",
    message: "Invalid reset token",
    statusCode: 400,
  },

  INVALID_ACCESS_TOKEN: {
    code: "AUTH_016",
    message: "Invalid access token",
    statusCode: 401,
  },
  REQUIRED_ROLES_MISSING: {
    code: "AUTH_017",
    message: "You do not have the required roles to access this resource.",
    statusCode: 403,
  },
  INVALID_HMAC_SIGNATURE: {
    code: "AUTH_018",
    message: "Invalid HMAC signature",
    statusCode: 401,
  },
  SESSION_EXPIRED: {
    code: "AUTH_019",
    message: "Session expired",
    statusCode: 401,
  },

  LOGGED_IN_ON_ANOTHER_DEVICE: {
    code: "AUTH_020",
    message: "Logged in on another device",
    statusCode: 401,
  },
  API_KEY_AND_SECRET_REQUIRED: {
    code: "AUTH_021",
    message: "API Key and API Secret are required",
    statusCode: 401,
  },

  INVALID_API_SECRET: {
    code: "AUTH_022",
    message: "Invalid API Secret",
    statusCode: 401,
  },

  INVALID_ROLE: {
    code: "AUTH_023",
    message: "Invalid role provided!",
    statusCode: 400,
  },

  INVALID_MOBILE: {
    code: "AUTH_024",
    message: "Invalid Mobile provided!",
    statusCode: 400,
  },

  EMAIL_REQUIRED: {
    code: "AUTH_025",
    message: "Email is required",
    statusCode: 400,
  },

  TOO_MANY_REQUESTS: {
    code: "AUTH_026",
    message: "Too many requests, please try again after sometime",
    statusCode: 429,
  },

  OTP_SEND_FAILED: {
    code: "AUTH_027",
    message: "Failed to send OTP. Please try again later.",
    statusCode: 502,
  },

  PASSWORD_ALREADY_SET: {
    code: "AUTH_028",
    message: "Password already set. Please login with your password.",
    statusCode: 400,
  },

  PASSWORD_MISMATCH: {
    code: "AUTH_029",
    message: "Password and confirm password do not match",
    statusCode: 400,
  },

  NO_PASSWORD_SET: {
    code: "AUTH_030",
    message:
      "No password set for this account yet. Please verify via OTP to set one first.",
    statusCode: 400,
  },

  CUSTOMER_NAME_REQUIRED: {
    code: "AUTH_031",
    message: "Name is required for new customer registration",
    statusCode: 400,
  },
} as const;
