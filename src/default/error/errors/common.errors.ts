export const COMMON_ERRORS = {
  SOMETHING_WENT_WRONG: {
    code: "COM_001",
    message: "Something went wrong",
    statusCode: 500,
  },
  BAD_REQUEST: {
    code: "COM_002",
    message: "Bad request",
    statusCode: 400,
  },
  NOT_FOUND: {
    code: "COM_003",
    message: "Resource not found",
    statusCode: 404,
  },
  CONFLICT: {
    code: "COM_004",
    message: "Duplicate Request",
    statusCode: 409,
  },
  SERVICE_UNAVAILABLE: {
    code: "COM_005",
    message: "Service unavailable",
    statusCode: 503,
  },
  BAD_REQUEST_RESON: {
    code: "COM_006",
    message: "Bad Request: {reason}",
    statusCode: 400,
  },
} as const;
