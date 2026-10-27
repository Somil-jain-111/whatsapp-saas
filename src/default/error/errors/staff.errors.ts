export const STAFF_ERRORS = {
  NOT_FOUND: {
    code: "STF_001",
    message: "Staff member not found",
    statusCode: 404,
  },
  ALREADY_EXISTS: {
    code: "STF_002",
    message: "Staff member already exists",
    statusCode: 409,
  },
  ROLE_NOT_FOUND: {
    code: "STF_003",
    message: "Staff role not found",
    statusCode: 404,
  },
  INVALID_INVITATION: {
    code: "STF_004",
    message: "Staff invitation is invalid or expired",
    statusCode: 400,
  },
  INVITATION_IDENTITY_MISMATCH: {
    code: "STF_005",
    message: "Invitation does not belong to this account",
    statusCode: 403,
  },
} as const;
