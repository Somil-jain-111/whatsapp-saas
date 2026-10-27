export const FAQ_ERRORS = {
  NOT_FOUND: {
    code: "FAQ_001",
    message: "FAQ not found",
    statusCode: 404,
  },
  ROLES_NOT_FOUND: {
    code: "FAQ_002",
    message: "Roles not found",
    statusCode: 404,
  },
  URL_ALREADY_EXISTS: {
    code: "FAQ_003",
    message: "FAQ URL already exists",
    statusCode: 409,
  },
} as const;
