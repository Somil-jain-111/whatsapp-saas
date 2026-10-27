export const SUPER_ADMIN_ERRORS = {
  USER_MAPPING_NOT_FOUND: {
    code: "SAD_001",
    message: "User mapping not found",
    statusCode: 404,
  },
  DUPLICATE_USER_MAPPING: {
    code: "SAD_002",
    message:
      "An active mapping already exists between these users for this mapping type",
    statusCode: 409,
  },
  INVALID_MAPPING_PARENT_ROLE: {
    code: "SAD_003",
    message: "The parent user must be a distributor or sub-distributor",
    statusCode: 422,
  },
  INVALID_MAPPING_CHILD_ROLE: {
    code: "SAD_004",
    message: "The child user must be a retailer",
    statusCode: 422,
  },
} as const;
