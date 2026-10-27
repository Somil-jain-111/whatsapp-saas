export const ADDRESS_ERRORS = {
  PINCODE_NOT_FOUND: {
    code: "ADDRESS_001",
    message: "Pincode details not available",
    statusCode: 404,
  },
  ADDRESS_NOT_FOUND: {
    code: "ADDRESS_002",
    message: "Address not found",
    statusCode: 404,
  },
  ADDRESS_LIMIT_EXCEEDED: {
    code: "ADDRESS_003",
    message: "You can only add up to 5 delivery addresses.",
    statusCode: 400,
  },
  ADDRESS_REQUIRED: {
    code: "ADDRESS_004",
    message: "Address is required for physical product.",
    statusCode: 400,
  },
} as const;
