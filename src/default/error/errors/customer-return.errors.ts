export const CUSTOMER_RETURN_ERRORS = {
  SESSION_NOT_FOUND: {
    code: "CRT_001",
    message: "Customer return session not found",
    statusCode: 404,
  },
  PAIR_NOT_FOUND: {
    code: "CRT_002",
    message: "Pair code or UID not found",
    statusCode: 404,
  },
  PAIR_NOT_SCANNED_BY_RETAILER: {
    code: "CRT_003",
    message: "Pair code has not been scanned or redeemed by your account",
    statusCode: 422,
  },
  PAIR_ALREADY_RETURNED: {
    code: "CRT_004",
    message: "This pair has already been returned by a customer",
    statusCode: 409,
  },
  PAIR_ALREADY_IN_SESSION: {
    code: "CRT_005",
    message: "This pair is already in your active return session",
    statusCode: 409,
  },
  PAIR_NOT_IN_SESSION: {
    code: "CRT_006",
    message: "This pair is not in your active return session",
    statusCode: 404,
  },
  REMARKS_REQUIRED_FOR_OTHER: {
    code: "CRT_007",
    message: 'Remarks are required when "OTHER" issue type is selected',
    statusCode: 400,
  },
  SESSION_EMPTY: {
    code: "CRT_008",
    message: "Cannot submit an empty customer return session",
    statusCode: 400,
  },
  SESSION_NOT_ACTIVE: {
    code: "CRT_009",
    message: "Customer return session is not active",
    statusCode: 400,
  },
} as const;
