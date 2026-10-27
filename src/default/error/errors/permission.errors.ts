export const PERMISSION_ERRORS = {
  PERMISSION_DENIED: {
    code: "PERM_001",
    message: "You do not have the required permission: {permission}",
    statusCode: 403,
  },
} as const;
