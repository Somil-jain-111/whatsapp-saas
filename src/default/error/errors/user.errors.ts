export const USER_ERRORS = {
  USER_NOT_FOUND: {
    code: "USR_001",
    message: "User not found",
    statusCode: 404,
  },

  USER_ALREADY_EXISTS: {
    code: "USR_002",
    message: "User already exists",
    statusCode: 400,
  },

  USER_INACTIVE: {
    code: "USR_003",
    message: "User is inactive",
    statusCode: 401,
  },

  INVALID_USER_ID: {
    code: "USR_004",
    message: "Invalid user id",
    statusCode: 400,
  },

  USER_UPDATE_FAILED: {
    code: "USR_005",
    message: "User update failed",
    statusCode: 400,
  },

  USER_PENDING: {
    code: "USR_006",
    message: "User approval is pending",
    statusCode: 403,
  },

  USER_REJECTED: {
    code: "USR_007",
    message: "User has been rejected",
    statusCode: 403,
  },

  USER_BLOCKED: {
    code: "USR_007",
    message: "User has been blocked",
    statusCode: 403,
  },

  USER_HOLD: {
    code: "USR_008",
    message: "User account is on hold",
    statusCode: 403,
  },

  USER_DELETED: {
    code: "USR_009",
    message: "User account has been deleted",
    statusCode: 410,
  },

  USER_INVALID_STATUS: {
    code: "USR_010",
    message: "User status is invalid",
    statusCode: 400,
  },

  MOBILE_NOT_FOUND: {
    code: "USR_011",
    message: "Mobile number not found",
    statusCode: 400,
  },

  USER_TEMP_BLOCKED: {
    code: "USR_012",
    message: "User profile is temporarily blocked until {blockedTill}",
    statusCode: 403,
  },

  USER_ALREADY_BLOCKED: {
    code: "USR_013",
    message: "User is already blocked till {blockedTill}",
    statusCode: 400,
  },

  INVALID_BLOCK_STATUS: {
    code: "USR_014",
    message:
      "User status must be in_approval, partial_approved or active to block",
    statusCode: 400,
  },

  INVALID_BLOCK_ROLE: {
    code: "USR_015",
    message: "Only L2 and SuperAdmin can permanently block a user",
    statusCode: 403,
  },

  NO_PERMANENT_BLOCK: {
    code: "USR_016",
    message: "User is not permanently blocked",
    statusCode: 400,
  },

  PENDING_SO_VERIFICATION: {
    code: "USR_017",
    message: "Profile is pending SO verification.",
    statusCode: 400,
  },
} as const;
