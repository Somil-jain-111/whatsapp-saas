export const DATABASE_ERRORS = {
  DATABASE_ERROR: {
    code: "DB_001",
    message: "Database error",
    statusCode: 500,
  },
  RECORD_NOT_FOUND: {
    code: "DB_002",
    message: "Record not found",
    statusCode: 404,
  },
  DUPLICATE_RECORD: {
    code: "DB_003",
    message: "Duplicate record",
    statusCode: 409,
  },
  DATABASE_CONNECTION_FAILED: {
    code: "DB_004",
    message: "Database connection failed",
    statusCode: 500,
  },
  TRANSACTION_FAILED: {
    code: "DB_005",
    message: "Database transaction failed",
    statusCode: 500,
  },
} as const;
