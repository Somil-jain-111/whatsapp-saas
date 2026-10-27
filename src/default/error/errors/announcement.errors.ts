export const ANNOUNCEMENT_ERRORS = {
  ROLES_NOT_FOUND: {
    code: "ANNOUNCEMENT_001",
    message: "Roles not found",
    statusCode: 404,
  },
  ANNOUNCEMENT_NOT_FOUND: {
    code: "ANNOUNCEMENT_002",
    message: "Announcement not found",
    statusCode: 404,
  },
} as const;
