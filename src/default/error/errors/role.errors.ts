export const ROLE_ERRORS = {
  ROLE_NOT_FOUND: {
    code: "ROL_001",
    message: "Role not found",
    statusCode: 404,
  },
  ROLE_ALREADY_EXISTS: {
    code: "ROL_002",
    message: "Role already exists",
    statusCode: 400,
  },
  INVALID_ROLE: {
    code: "ROL_003",
    message: "Invalid role",
    statusCode: 400,
  },
  ROLE_ASSIGNMENT_FAILED: {
    code: "ROL_004",
    message: "Role assignment failed",
    statusCode: 400,
  },
  ROLE_PERMISSION_DENIED: {
    code: "ROL_005",
    message: "Role permission denied",
    statusCode: 403,
  },
} as const;
