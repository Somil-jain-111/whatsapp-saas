export const ADMIN_ERRORS = {
  ADMIN_NOT_FOUND: {
    code: "ADM_001",
    message: "Admin not found",
    statusCode: 404,
  },
  ADMIN_ALREADY_EXISTS: {
    code: "ADM_002",
    message: "Admin already exists",
    statusCode: 400,
  },
  ADMIN_INACTIVE: {
    code: "ADM_003",
    message: "Admin account is inactive",
    statusCode: 403,
  },
  INVALID_ADMIN_ID: {
    code: "ADM_004",
    message: "Invalid admin id",
    statusCode: 400,
  },
  ADMIN_CREATION_FAILED: {
    code: "ADM_005",
    message: "Admin creation failed",
    statusCode: 400,
  },
} as const;
