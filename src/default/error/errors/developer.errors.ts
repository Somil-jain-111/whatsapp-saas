export const DEVELOPER_ERRORS = {
  IDEMPOTENCY_KEY_REQUIRED: {
    code: "IDEMPOTENCY_KEY_REQUIRED",
    message: "A valid Idempotency-Key header is required.",
    statusCode: 400,
  },
  API_KEY_EXPIRATION_INVALID: {
    code: "DEV_001",
    message: "API key expiration must be in the future",
    statusCode: 409,
  },
  API_KEY_NOT_FOUND: {
    code: "DEV_002",
    message: "API key not found",
    statusCode: 404,
  },
  API_KEY_ROTATION_INVALID: {
    code: "DEV_003",
    message: "Only active API keys can be rotated",
    statusCode: 409,
  },
  ACTIVE_API_KEY_NOT_FOUND: {
    code: "DEV_004",
    message: "Active API key not found",
    statusCode: 404,
  },
  API_KEY_SCOPES_FORBIDDEN: {
    code: "DEV_005",
    message: "Scopes exceed your permissions: {scopes}",
    statusCode: 403,
  },
} as const;
