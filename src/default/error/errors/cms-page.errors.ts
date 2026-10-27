export const CMS_PAGE_ERRORS = {
  NOT_FOUND: {
    code: "CMS_PAGE_001",
    message: "CMS page not found",
    statusCode: 404,
  },
  ROLES_NOT_FOUND: {
    code: "CMS_PAGE_002",
    message: "Roles not found",
    statusCode: 404,
  },
  URL_ALREADY_EXISTS: {
    code: "CMS_PAGE_003",
    message: "CMS page URL already exists",
    statusCode: 409,
  },
} as const;
